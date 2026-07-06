// ════════════════════════════════════════════════════════════════════
// Vercel Serverless Function: POST /api/goaffpro-sync
//
// Pulls the FULL GoAffPro affiliate roster and upserts it into the Supabase
// `partners` table the admin dashboard reads — so Sofia only adds affiliates
// in GoAffPro and they appear in the portal automatically (no double entry).
//
// Matching is by email (case-insensitive):
//   • NEW affiliate  → insert a partner (name, email, platform 'GoAffPro',
//                      status 'Active Partner' for approved / 'Passed' for
//                      blocked, commission_link built from their coupon).
//                      select_token is auto-minted by the column default.
//   • EXISTING partner → NON-DESTRUCTIVE. Only refresh GoAffPro-derived
//                      commission_link if it's missing or changed. Never touch
//                      Sofia's manually-managed fields (status, notes, gifted,
//                      instagram, partner_message, name).
//   • NEVER deletes. Portal partners not in GoAffPro are left untouched.
//
// Writes to SUPABASE (the live source the dashboard reads), via the SERVICE
// ROLE key — NOT to scripts/partners_data.json (a git-tracked bootstrap seed a
// serverless function can't commit to). See README for why this stays consistent.
//
// Auth: admin only. Caller sends the admin's Supabase access token as
//   Authorization: Bearer <token>. We resolve it (Supabase GoTrue) and confirm
//   they're in the admins table (service role) before doing anything.
//
// Env (server-only): GOAFFPRO_ACCESS_TOKEN, GOAFFPRO_PUBLIC_TOKEN (optional),
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   AFFILIATE_STORE_URL (optional).
// ════════════════════════════════════════════════════════════════════

import {
  isAdminUser,
  isSupabaseAdminConfigured,
  listPartnersForSync,
  insertPartners,
  patchPartner,
} from './_lib/supabaseAdmin.js'
import { isGoaffproConfigured, fetchAllAffiliates, buildAffiliateLink } from './_lib/goaffpro.js'

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/+$/,
  ''
)
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

async function resolveAdmin(req) {
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearer || !SUPABASE_URL) return null

  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${bearer}`, apikey: SUPABASE_ANON || bearer },
  })
  if (!userResp.ok) return null
  const user = await userResp.json().catch(() => null)
  if (!user?.id) return null
  const admin = await isAdminUser(user.id)
  return admin ? user : null
}

// GoAffPro status → portal status vocabulary (Contacted/Interested/Active
// Partner/Passed). Only applied to NEW rows; existing rows keep Sofia's status.
function statusFor(affiliate) {
  return (affiliate?.status || '').toLowerCase() === 'blocked' ? 'Passed' : 'Active Partner'
}

// A displayable name, preferring the full name, then first+last, then the
// email's local part — partners.name is NOT NULL so we always need something.
function nameFor(affiliate) {
  const full = (affiliate?.name || '').trim()
  if (full) return full
  const parts = [affiliate?.first_name, affiliate?.last_name].filter(Boolean).join(' ').trim()
  if (parts) return parts
  return (affiliate?.email || '').split('@')[0] || 'Affiliate'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Graceful "not configured" responses so the UI can show a friendly note.
  if (!isGoaffproConfigured()) {
    return res.status(200).json({
      configured: false,
      message: 'GoAffPro is not connected yet. Add GOAFFPRO_ACCESS_TOKEN in Vercel to enable sync.',
    })
  }
  if (!isSupabaseAdminConfigured()) {
    return res.status(200).json({
      configured: false,
      message:
        'Supabase service role is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel to enable sync.',
    })
  }

  // Gate: admin only.
  const admin = await resolveAdmin(req)
  if (!admin) return res.status(401).json({ error: 'Not authorized' })

  try {
    // 1) Pull the full GoAffPro roster and the current portal partners.
    const [affiliates, partners] = await Promise.all([
      fetchAllAffiliates(),
      listPartnersForSync(),
    ])

    // Index existing partners by lower(email) for case-insensitive matching.
    const byEmail = new Map()
    for (const p of partners) {
      const key = (p.email || '').toLowerCase()
      if (key) byEmail.set(key, p)
    }

    // De-dupe the GoAffPro list by email (prefer an approved row over a
    // blocked duplicate) so we never try to insert the same email twice.
    const seen = new Map()
    for (const a of affiliates) {
      const key = (a.email || '').toLowerCase()
      if (!key) continue
      const prev = seen.get(key)
      if (!prev || ((prev.status || '').toLowerCase() === 'blocked' && (a.status || '').toLowerCase() !== 'blocked')) {
        seen.set(key, a)
      }
    }

    const toInsert = []
    const toPatch = [] // { id, commission_link }
    let skippedNoEmail = 0
    let unchanged = 0

    for (const a of affiliates) {
      const key = (a.email || '').toLowerCase()
      if (!key) {
        skippedNoEmail++
        continue
      }
      if (seen.get(key) !== a) continue // a de-duped duplicate; handled once

      const built = buildAffiliateLink(a)
      const link = built?.link || null
      const existing = byEmail.get(key)

      if (!existing) {
        // NEW affiliate → create a partner row.
        toInsert.push({
          name: nameFor(a),
          email: key,
          platform: 'GoAffPro',
          status: statusFor(a),
          commission_link: link,
        })
      } else if (link && link !== (existing.commission_link || null)) {
        // EXISTING partner → only refresh the GoAffPro-derived link.
        toPatch.push({ id: existing.id, commission_link: link })
      } else {
        unchanged++
      }
    }

    // 2) Write. Inserts in one batch; patches one row at a time (only the
    //    handful whose link actually changed).
    const inserted = await insertPartners(toInsert)
    for (const p of toPatch) {
      await patchPartner(p.id, { commission_link: p.commission_link })
    }

    const added = inserted.length || toInsert.length
    const updated = toPatch.length
    return res.status(200).json({
      configured: true,
      ok: true,
      affiliates: affiliates.length,
      added,
      updated,
      unchanged,
      skipped: skippedNoEmail,
      message: `${added} added, ${updated} updated`,
    })
  } catch (err) {
    console.error('goaffpro-sync error:', err.message)
    return res.status(502).json({ error: 'GoAffPro sync failed', detail: String(err.message).slice(0, 300) })
  }
}

// ════════════════════════════════════════════════════════════════════
// Server-side GoAffPro admin API client.
//
// The admin access token never leaves the server (same token /api/commissions
// uses). This module centralizes: config check, a PAGINATED "fetch every
// affiliate" call, and the coupon/ref → shareable-link builder — so both the
// commission lookup and the roster sync build links the exact same way.
//
// Required env (server-only, no VITE_ prefix):
//   GOAFFPRO_ACCESS_TOKEN   (admin token — GoAffPro → Settings → API Keys)
//   GOAFFPRO_PUBLIC_TOKEN   (optional public token, sent as a second header)
//   AFFILIATE_STORE_URL     (optional — storefront that honors coupons/links)
// ════════════════════════════════════════════════════════════════════

const GOAFFPRO_BASE = 'https://api.goaffpro.com/v1'

// The Shopify storefront that honors affiliate links/coupons. Matches
// api/commissions.js so links are identical across the portal.
const STORE_URL = (process.env.AFFILIATE_STORE_URL || 'https://shopplanetbylaureng.com').replace(
  /\/+$/,
  ''
)

export function isGoaffproConfigured() {
  return Boolean(process.env.GOAFFPRO_ACCESS_TOKEN)
}

function affHeaders() {
  const headers = { 'x-goaffpro-access-token': process.env.GOAFFPRO_ACCESS_TOKEN }
  // The public token is optional — only send it when configured.
  if (process.env.GOAFFPRO_PUBLIC_TOKEN) {
    headers['x-goaffpro-public-token'] = process.env.GOAFFPRO_PUBLIC_TOKEN
  }
  return headers
}

// Build a partner's shareable referral link from a GoAffPro affiliate object.
// PLANET's affiliates are coupon-based (no ref_id), so the link is a Shopify
// /discount/<CODE> URL that auto-applies their code at checkout. We still
// prefer a ref_id link if one ever exists. Returns { link, coupon } or null.
// (Kept byte-for-byte in sync with api/commissions.js → buildAffiliate.)
export function buildAffiliateLink(affiliate) {
  const refId = (affiliate?.ref_id || '').toString().trim()
  const coupon = (affiliate?.coupon?.code || '').toString().trim()
  if (refId) {
    return { link: `${STORE_URL}/?ref=${encodeURIComponent(refId)}`, coupon: coupon || null }
  }
  if (coupon) {
    return { link: `${STORE_URL}/discount/${encodeURIComponent(coupon)}`, coupon }
  }
  return null
}

// Fetch the ENTIRE affiliate roster, paginating via limit/offset until we've
// seen every row (GoAffPro returns { affiliates, total_results }). Only the
// fields the sync needs are requested. Throws on a non-2xx response.
export async function fetchAllAffiliates() {
  const fields = 'id,name,first_name,last_name,email,ref_id,coupon,status'
  const PAGE = 250 // GoAffPro's page cap is generous; PLANET has ~dozens.
  const out = []
  let offset = 0
  let total = Infinity

  // Hard stop after a sane number of pages so a misbehaving API can't loop.
  for (let page = 0; page < 100 && offset < total; page++) {
    const url = `${GOAFFPRO_BASE}/admin/affiliates?fields=${fields}&limit=${PAGE}&offset=${offset}`
    const resp = await fetch(url, { headers: affHeaders() })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`GoAffPro ${resp.status}: ${text.slice(0, 300)}`)
    }
    const data = await resp.json()
    const list = Array.isArray(data) ? data : data.affiliates || []
    out.push(...list)

    // total_results tells us when to stop; if it's absent, stop when a page
    // comes back short (fewer rows than we asked for).
    total = Number.isFinite(Number(data?.total_results)) ? Number(data.total_results) : out.length
    if (list.length < PAGE) break
    offset += PAGE
  }

  return out
}

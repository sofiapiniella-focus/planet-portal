import { supabase } from './supabase'

// Triggers the server-side GoAffPro → Supabase roster sync. The admin's
// session token is sent so the serverless function can confirm they're an
// admin; the GoAffPro admin token stays on the server.
//
// Returns the summary { configured, ok, affiliates, added, updated, ... }.
// Throws on an HTTP error so callers can surface why it failed.
export async function syncFromGoAffPro() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

  const resp = await fetch('/api/goaffpro-sync', { method: 'POST', headers })

  if (!resp.ok) {
    let error = ''
    let detail = ''
    try {
      const body = await resp.json()
      error = body?.error || ''
      detail = body?.detail || ''
    } catch {
      /* ignore */
    }
    const parts = [error || `GoAffPro sync failed (${resp.status})`]
    if (detail) parts.push(`— ${detail}`)
    throw new Error(parts.join(' '))
  }

  return resp.json()
}

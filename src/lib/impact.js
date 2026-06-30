import { supabase } from './supabase'

// Fetches aggregate Impact.com affiliate performance for the admin Overview
// from our serverless function, which talks to Impact with the secret keys.
// Returns { connected, sales, orders, commission, recentActions }.
export async function fetchImpactSummary() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = {}
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

  const resp = await fetch('/api/impact', { headers })

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
    // Surface Impact's literal complaint (the `detail` body) alongside our
    // summary, so the dashboard shows WHY it failed — not just the HTTP code.
    const parts = [error || `Impact lookup failed (${resp.status})`]
    if (detail) parts.push(`— Impact says: ${detail}`)
    throw new Error(parts.join(' '))
  }

  return resp.json()
}

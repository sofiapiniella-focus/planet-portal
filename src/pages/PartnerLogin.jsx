import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Logo, Card, Spinner, Field, FullPageLoader } from '../components/ui'

export default function PartnerLogin() {
  const { session, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <FullPageLoader />
  if (session && isAdmin) return <Navigate to="/admin" replace />
  if (session) return <Navigate to="/portal" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSending(true)

    const clean = email.trim()

    // Gate: only known partners may sign in. is_partner_email is a security-
    // definer RPC (see supabase/partner_selections.sql) that checks the
    // partners table past RLS, so we can reject non-partners cleanly BEFORE
    // any magic link is sent or auth user is created.
    const { data: isPartner, error: gateError } = await supabase.rpc('is_partner_email', {
      check_email: clean,
    })
    if (gateError) {
      // If the gate RPC isn't installed yet (migration not run), fail OPEN so
      // real partners aren't locked out — the portal still guards access by
      // requiring a partners row. Any other error → ask them to retry.
      const notInstalled =
        gateError.code === 'PGRST202' ||
        /function|does not exist|could not find/i.test(gateError.message || '')
      if (!notInstalled) {
        setSending(false)
        setError("We couldn't verify your email right now. Please try again in a moment.")
        return
      }
    } else if (!isPartner) {
      setSending(false)
      setError(
        "We couldn't find a partner account for that email. Reach out to the PLANET team if you think this is a mistake."
      )
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        // First-time partners won't have an auth user yet, so allow creation.
        // Access is restricted by the is_partner_email gate above (and the
        // portal's partners-row check), not by this flag.
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/portal`,
      },
    })
    setSending(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Logo subtitle="Partner Sign In" />

        <Card className="mt-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✦</div>
              <h2 className="font-heading text-2xl text-espresso">Check your inbox</h2>
              <p className="mt-3 text-sm text-espresso/60 leading-relaxed">
                We sent a secure sign-in link to
                <br />
                <span className="text-espresso font-medium">{email}</span>
              </p>
              <p className="mt-4 text-xs text-espresso/40">
                Click the link in that email to enter your portal. You can close this tab.
              </p>
              <button
                onClick={() => {
                  setSent(false)
                  setEmail('')
                }}
                className="btn-ghost mt-6 mx-auto"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-espresso/60 text-center leading-relaxed">
                Enter the email you partnered with. We'll send you a secure link — no
                password needed.
              </p>
              <Field label="Email">
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input"
                />
              </Field>
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <button type="submit" disabled={sending} className="btn-primary w-full">
                {sending ? <Spinner /> : 'Send my sign-in link'}
              </button>
            </form>
          )}
        </Card>

        <div className="text-center mt-6">
          <Link to="/" className="btn-ghost text-xs">
            ← Back
          </Link>
        </div>
      </div>
    </div>
  )
}

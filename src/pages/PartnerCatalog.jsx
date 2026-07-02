import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fetchCatalog } from '../lib/catalog'
import { Logo, Card, Spinner, FullPageLoader, EmptyState } from '../components/ui'

// Max pieces a partner may select in one submission. Change this single
// constant to raise/lower the cap everywhere.
const MAX_SELECTIONS = 5

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  )
}

export default function PartnerCatalog() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [partner, setPartner] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loadingPartner, setLoadingPartner] = useState(true)

  const [catalog, setCatalog] = useState({ loading: true })
  const [selected, setSelected] = useState({}) // product_id -> item
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Resolve the partner profile for this signed-in email.
  const loadPartner = useCallback(async () => {
    if (!user?.email) return
    setLoadingPartner(true)
    const { data: p } = await supabase
      .from('partners')
      .select('*')
      .ilike('email', user.email)
      .maybeSingle()
    if (!p) setNotFound(true)
    else setPartner(p)
    setLoadingPartner(false)
  }, [user])

  useEffect(() => {
    loadPartner()
  }, [loadPartner])

  // Load the live, in-stock catalog.
  useEffect(() => {
    let active = true
    fetchCatalog()
      .then((d) => active && setCatalog({ loading: false, items: d.items || [] }))
      .catch((e) => active && setCatalog({ loading: false, error: e.message }))
    return () => {
      active = false
    }
  }, [])

  const selectedCount = Object.keys(selected).length
  const atMax = selectedCount >= MAX_SELECTIONS

  function toggle(item) {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[item.product_id]) {
        delete next[item.product_id]
      } else {
        if (Object.keys(next).length >= MAX_SELECTIONS) return prev // ignore over-cap
        next[item.product_id] = item
      }
      return next
    })
  }

  async function submit() {
    if (selectedCount === 0 || !partner) return
    setSubmitting(true)
    setError('')

    // Persist only the fields the admin needs — mirrors the items jsonb shape.
    const items = Object.values(selected).map((it) => ({
      product_id: it.product_id,
      title: it.title,
      variant_id: it.variant_id,
      color: it.color,
      price: it.price,
      image: it.image,
    }))

    const { error: insErr } = await supabase.from('partner_selections').insert({
      partner_id: partner.id,
      partner_email: (user.email || '').toLowerCase(),
      partner_name: partner.name,
      items,
      note: note.trim() || null,
    })

    setSubmitting(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setSubmitted(true)
  }

  if (loadingPartner) return <FullPageLoader label="Opening the collection…" />

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <Logo subtitle="Hmm" />
          <p className="mt-6 text-sm text-espresso/70 leading-relaxed">
            We couldn't find a partner profile for{' '}
            <span className="font-medium">{user.email}</span>. Please reach out to the
            PLANET team so we can get you set up.
          </p>
          <button
            onClick={() => signOut().then(() => navigate('/'))}
            className="btn-outline mt-6 mx-auto"
          >
            Sign out
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-40">
      {/* Top bar */}
      <header className="border-b border-espresso/5 bg-cream/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-heading text-xl tracking-[0.2em]">
            PLANET <span className="text-gold text-xs tracking-[0.3em]">by Lauren G</span>
          </div>
          <Link to="/portal" className="btn-ghost text-xs">
            ← Back to portal
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 mt-10">
        {submitted ? (
          <Card className="max-w-lg mx-auto text-center">
            <div className="text-4xl mb-4">✦</div>
            <h2 className="font-heading text-3xl text-espresso">Your picks are in</h2>
            <p className="mt-3 text-sm text-espresso/60 leading-relaxed">
              Thank you — the PLANET team has been notified and will follow up with you
              shortly about your {selectedCount} piece{selectedCount === 1 ? '' : 's'}.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link to="/portal" className="btn-primary">
                Back to portal
              </Link>
              <button
                onClick={() => {
                  setSubmitted(false)
                  setSelected({})
                  setNote('')
                }}
                className="btn-ghost text-xs"
              >
                Choose more
              </button>
            </div>
          </Card>
        ) : (
          <>
            {/* Intro */}
            <div className="mb-8">
              <p className="eyebrow">The collection</p>
              <h1 className="font-heading text-4xl md:text-5xl text-espresso mt-1">
                Choose your pieces
              </h1>
              <p className="text-espresso/60 mt-2 font-light max-w-2xl">
                Browse what's in stock right now and select up to {MAX_SELECTIONS} pieces
                you'd love. Add a note with your sizes or preferences, then submit — we'll
                take it from there.
              </p>
            </div>

            {catalog.loading ? (
              <div className="flex items-center gap-3 text-espresso/50 text-sm py-16 justify-center">
                <Spinner /> Loading the live collection…
              </div>
            ) : catalog.error ? (
              <Card className="text-center">
                <p className="text-sm text-espresso/60">
                  We couldn't load the collection right now. Please try again in a moment.
                </p>
                <p className="text-xs text-espresso/35 mt-2 break-words">{catalog.error}</p>
              </Card>
            ) : catalog.items.length === 0 ? (
              <EmptyState
                title="Nothing in stock right now"
                hint="Check back soon — new pieces are added regularly."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {catalog.items.map((item) => (
                  <ProductCard
                    key={item.product_id}
                    item={item}
                    isSelected={Boolean(selected[item.product_id])}
                    disabled={atMax && !selected[item.product_id]}
                    onToggle={() => toggle(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky selection bar */}
      {!submitted && selectedCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-espresso/10 bg-cream/95 backdrop-blur">
          <div className="max-w-5xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-gold/20 text-gold">
                  {selectedCount} / {MAX_SELECTIONS} selected
                </span>
                {Object.values(selected).map((it) => (
                  <span
                    key={it.product_id}
                    className="inline-flex items-center gap-1.5 bg-white rounded-full pl-3 pr-2 py-1 text-xs border border-espresso/10"
                  >
                    <span className="text-espresso truncate max-w-[140px]">{it.title}</span>
                    <button
                      onClick={() => toggle(it)}
                      className="text-espresso/30 hover:text-red-600"
                      aria-label={`Remove ${it.title}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-end gap-3 flex-wrap">
              <label className="flex-1 min-w-[240px]">
                <span className="label">Note (sizes, preferences — optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Size M, prefer the espresso tones"
                  className="input"
                />
              </label>
              <button onClick={submit} disabled={submitting} className="btn-primary">
                {submitting ? <Spinner /> : `Submit ${selectedCount} pick${selectedCount === 1 ? '' : 's'}`}
              </button>
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            {atMax && (
              <p className="text-xs text-gold mt-2">
                That's the max of {MAX_SELECTIONS} — remove one to swap in something else.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductCard({ item, isSelected, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`text-left rounded-2xl border bg-white overflow-hidden transition group ${
        isSelected
          ? 'border-gold ring-2 ring-gold/40'
          : disabled
          ? 'border-espresso/5 opacity-40 cursor-not-allowed'
          : 'border-espresso/5 hover:border-espresso/20'
      }`}
    >
      <div className="aspect-[4/5] bg-cream relative overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-heading text-espresso/20 italic">
            No photo
          </span>
        )}
        {isSelected && (
          <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-gold text-white flex items-center justify-center text-xs shadow-soft">
            ✓
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-espresso leading-tight line-clamp-2">
          {item.title}
        </h3>
        {item.color && <p className="text-xs text-espresso/45 mt-0.5">{item.color}</p>}
        <p className="text-sm text-espresso/70 mt-1">{money(item.price)}</p>
      </div>
    </button>
  )
}

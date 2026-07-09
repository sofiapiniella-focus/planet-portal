// Fetches the live, in-stock PLANET "Stylist Collective" catalog from our
// /api/collection serverless proxy (which paginates + normalizes Shopify's
// collection feed). Returns { items, count } where each item is a
// product-level card:
//   { product_id, title, handle, url, variant_id, color, price, image,
//     available, variant_count }
export async function fetchCatalog() {
  const resp = await fetch('/api/collection', { headers: { Accept: 'application/json' } })

  if (!resp.ok) {
    let detail = ''
    try {
      const body = await resp.json()
      detail = body?.detail || body?.error || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Catalog lookup failed (${resp.status})`)
  }

  return resp.json()
}

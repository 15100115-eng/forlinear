// Vercel serverless function: official USD/GEL rate from the National Bank of Georgia.
// GET /api/usd-rate  ->  { rate: 2.7, date: "2026-11-01", source: "NBG" }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  try {
    const r = await fetch('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json?currencies=USD', {
      headers: { accept: 'application/json' },
    })
    if (!r.ok) throw new Error(`NBG responded ${r.status}`)
    const j = await r.json()
    // Response shape: [{ date, currencies: [{ code: 'USD', quantity: 1, rate: 2.7, validFromDate, ... }] }]
    const days = Array.isArray(j) ? j : [j]
    let found = null
    for (const d of days) {
      for (const c of d?.currencies ?? []) {
        if (String(c.code).toUpperCase() === 'USD' && Number(c.rate) > 0) found = { ...c, day: d.date }
      }
    }
    if (!found) throw new Error('USD not found in NBG response')
    const rate = Number(found.rate) / (Number(found.quantity) || 1)
    const date = String(found.validFromDate || found.date || found.day || '').slice(0, 10)
    res.status(200).json({ rate: Math.round(rate * 10000) / 10000, date, source: 'NBG' })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

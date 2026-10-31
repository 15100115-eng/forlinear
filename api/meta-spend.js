// Vercel serverless function: daily ad spend from the Meta Marketing API.
// Env vars (Vercel project settings):
//   META_ACCESS_TOKEN   — long-lived System User token with ads_read permission
//   META_AD_ACCOUNT_ID  — numeric ad account id (default: Next Move account)
// GET /api/meta-spend?since=YYYY-MM-DD&until=YYYY-MM-DD
export default async function handler(req, res) {
  const token = process.env.META_ACCESS_TOKEN
  const account = (process.env.META_AD_ACCOUNT_ID || '2134801500794274').replace(/^act_/, '')
  res.setHeader('Cache-Control', 'no-store')
  if (!token) {
    res.status(501).json({ error: 'META_ACCESS_TOKEN is not configured', configured: false })
    return
  }
  const url = new URL(req.url, 'http://x')
  const today = new Date().toISOString().slice(0, 10)
  const since = url.searchParams.get('since') || today.slice(0, 8) + '01'
  const until = url.searchParams.get('until') || today
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    res.status(400).json({ error: 'since/until must be YYYY-MM-DD' })
    return
  }
  const rows = []
  let next = `https://graph.facebook.com/v21.0/act_${account}/insights?${new URLSearchParams({
    fields: 'spend,account_currency',
    time_increment: '1',
    level: 'account',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    access_token: token,
  })}`
  try {
    while (next) {
      const r = await fetch(next)
      const j = await r.json()
      if (!r.ok || j.error) {
        res.status(502).json({ error: j.error?.message || `Meta API error ${r.status}` })
        return
      }
      for (const d of j.data || []) rows.push({ date: d.date_start, spend: Number(d.spend) || 0, currency: d.account_currency || 'USD' })
      next = j.paging?.next || null
    }
    res.status(200).json({ configured: true, account, since, until, rows })
  } catch (e) {
    res.status(502).json({ error: String(e?.message || e) })
  }
}

import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import type { AppData, OpexItem } from '../types'
import { fmtDate, fmtMoney, fmtMonth, monthKey, opexGel, todayIso, uid } from '../calc'
import type { Lang, TKey } from '../i18n'
import { Card, Modal, StatTile } from './ui'
import { GroupedBars, useColors } from './charts'

type T = (k: TKey) => string

/** Parses a Meta Ads "Transactions" export (xlsx or csv). Finds the header row by the Date / Amount columns. */
export async function parseMetaFile(file: File): Promise<{ date: string; amount: number; ref?: string }[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const out: { date: string; amount: number; ref?: string }[] = []
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true })
    let dateCol = -1, amtCol = -1, refCol = -1
    for (const r of rows) {
      if (dateCol < 0) {
        const cells = r.map((c) => String(c ?? '').toLowerCase())
        const d = cells.findIndex((c) => c === 'date' || c.startsWith('date'))
        const a = cells.findIndex((c) => c.startsWith('amount'))
        if (d >= 0 && a >= 0) {
          dateCol = d
          amtCol = a
          refCol = cells.findIndex((c) => c.includes('transaction id'))
        }
        continue
      }
      const dv = r[dateCol]
      const av = Number(r[amtCol])
      if (dv == null || !Number.isFinite(av)) continue
      let iso = ''
      if (dv instanceof Date) iso = new Date(dv.getTime() - dv.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      else if (typeof dv === 'number') {
        const d = XLSX.SSF.parse_date_code(dv)
        if (d) iso = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
      } else {
        const s = String(dv).trim()
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{2})[./](\d{2})[./](\d{4})/)
        if (m) iso = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`
        else {
          const d = new Date(s)
          if (!isNaN(d.getTime())) iso = d.toISOString().slice(0, 10)
        }
      }
      if (!iso) continue
      out.push({ date: iso, amount: av, ref: refCol >= 0 && r[refCol] != null ? String(r[refCol]) : undefined })
    }
    if (out.length) break
  }
  return out
}

export function OpexPage({ data, t, lang, update }: { data: AppData; t: T; lang: Lang; update: (fn: (d: AppData) => AppData) => void }) {
  const c = useColors()
  const file = useRef<HTMLInputElement>(null)
  const [edit, setEdit] = useState<OpexItem | null>(null)
  const [month, setMonth] = useState('all')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [range, setRange] = useState(() => {
    const now = todayIso()
    return { since: now.slice(0, 8) + '01', until: now }
  })
  const s = data.settings
  const months = useMemo(() => [...new Set(data.opex.map((x) => monthKey(x.date)))].sort().reverse(), [data.opex])
  const items = useMemo(
    () => data.opex.filter((x) => month === 'all' || monthKey(x.date) === month).sort((a, b) => b.date.localeCompare(a.date)),
    [data.opex, month],
  )
  const totalGel = items.reduce((a, x) => a + opexGel(x, s), 0)
  const adsGel = items.filter((x) => x.category === 'ads').reduce((a, x) => a + opexGel(x, s), 0)
  const adsUsd = items.filter((x) => x.category === 'ads' && x.currency === 'USD').reduce((a, x) => a + x.amount, 0)

  const monthly = useMemo(() => {
    const m = new Map<string, { ads: number; other: number }>()
    for (const x of data.opex) {
      const r = m.get(monthKey(x.date)) ?? { ads: 0, other: 0 }
      if (x.category === 'ads') r.ads += opexGel(x, s)
      else r.other += opexGel(x, s)
      m.set(monthKey(x.date), r)
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ m: fmtMonth(k, lang), ads: Math.round(v.ads), other: Math.round(v.other) }))
  }, [data.opex, s, lang])

  const daily = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of items) if (x.category === 'ads') m.set(x.date, (m.get(x.date) ?? 0) + opexGel(x, s))
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ d: d.slice(5).split('-').reverse().join('.'), ads: Math.round(v) }))
  }, [items, s])

  const onImport = async (f: File) => {
    try {
      const rows = await parseMetaFile(f)
      const existing = new Set(data.opex.map((x) => x.ref).filter(Boolean))
      const fresh = rows.filter((r) => !r.ref || !existing.has(r.ref))
      update((d) => ({
        ...d,
        opex: [...d.opex, ...fresh.map((r) => ({ id: uid(), date: r.date, category: 'ads' as const, amount: r.amount, currency: 'USD' as const, description: 'Meta Ads', ref: r.ref }))],
      }))
      setMsg(`${t('importMetaDone')}${fresh.length}${t('importMetaSkipped')}${rows.length - fresh.length}`)
    } catch {
      setMsg(t('importError'))
    }
  }

  const onSync = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch(`/api/meta-spend?since=${range.since}&until=${range.until}`)
      const j = (await r.json()) as { configured?: boolean; error?: string; rows?: { date: string; spend: number; currency: string }[] }
      if (r.status === 501 || j.configured === false) {
        setMsg(t('syncMetaNotConfigured'))
        return
      }
      if (!r.ok || !j.rows) {
        setMsg(t('syncMetaError') + (j.error ?? r.status))
        return
      }
      const rows = j.rows.filter((x) => x.spend > 0)
      update((d) => {
        const keep = d.opex.filter((x) => !(x.ref?.startsWith('meta-spend-') && x.date >= range.since && x.date <= range.until))
        return {
          ...d,
          opex: [
            ...keep,
            ...rows.map((x) => ({
              id: uid(),
              date: x.date,
              category: 'ads' as const,
              amount: Math.round(x.spend * 100) / 100,
              currency: (x.currency === 'GEL' ? 'GEL' : 'USD') as 'USD' | 'GEL',
              description: 'Meta Ads (API)',
              ref: `meta-spend-${x.date}`,
            })),
          ],
        }
      })
      setMsg(`${t('syncMetaDone')}${rows.length}`)
    } catch (e) {
      setMsg(t('syncMetaError') + String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="note" style={{ marginBottom: 16 }}>{t('opex_note')}</p>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ marginBottom: 6 }}>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {t('from')} <input type="date" value={range.since} onChange={(e) => setRange({ ...range, since: e.target.value })} style={{ width: 'auto' }} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {t('to')} <input type="date" value={range.until} onChange={(e) => setRange({ ...range, until: e.target.value })} style={{ width: 'auto' }} />
          </label>
          <button className="btn primary" onClick={onSync} disabled={busy}>{t('syncMeta')}</button>
          <button className="btn" onClick={() => file.current?.click()}>{t('importMeta')}</button>
          <input ref={file} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImport(f) }} />
        </div>
        <div className="small muted">{t('syncMetaHint')}</div>
        {msg && <p className="note" style={{ marginTop: 10 }}>{msg}</p>}
      </div>
      <div className="grid kpis">
        <StatTile label={t('kpi_ads')} value={fmtMoney(adsGel)} sub={adsUsd ? `$${adsUsd.toFixed(2)} × ${s.usdRate}` : undefined} />
        <StatTile label={t('opex_title')} value={fmtMoney(totalGel)} sub={`${items.length} ${t('transactions')}`} />
      </div>
      <div className="grid two section">
        <Card title={t('chart_adsMonthly')}>
          <GroupedBars data={monthly} xKey="m" series={[{ key: 'ads', label: t('series_ads'), color: c.s2 }, { key: 'other', label: t('opex_other'), color: c.s4 }]} />
        </Card>
        <Card title={t('chart_adsDaily')} sub={month === 'all' ? t('allMonths') : fmtMonth(month, lang, true)}>
          {daily.length ? <GroupedBars data={daily} xKey="d" series={[{ key: 'ads', label: t('series_ads'), color: c.s2 }]} /> : <div className="empty">{t('noData')}</div>}
        </Card>
      </div>
      <div className="section">
        <Card
          title={t('opex_title')}
          right={
            <div className="btn-row">
              <select className="inline-select" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="all">{t('allMonths')}</option>
                {months.map((m) => (
                  <option key={m} value={m}>{fmtMonth(m, lang, true)}</option>
                ))}
              </select>
              <button className="btn sm primary" onClick={() => setEdit({ id: uid(), date: todayIso(), category: 'ads', amount: 0, currency: 'USD', description: 'Meta Ads' })}>{t('addOpex')}</button>
            </div>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('col_date')}</th>
                  <th>{t('col_category')}</th>
                  <th>{t('col_description')}</th>
                  <th className="num">{t('col_amount')}</th>
                  <th className="num">{t('col_amountGel')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id} className="clickable" onClick={() => setEdit(x)}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(x.date)}</td>
                    <td>{x.category === 'ads' ? t('opex_ads') : t('opex_other')}</td>
                    <td>{x.description}{x.ref && <div className="cell-sub">{x.ref}</div>}</td>
                    <td className="num">{x.currency === 'USD' ? '$' : ''}{x.amount.toFixed(2)}{x.currency === 'GEL' ? ' ₾' : ''}</td>
                    <td className="num">{opexGel(x, s).toFixed(2)}</td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-btn danger" onClick={() => confirm(t('confirmDelete')) && update((d) => ({ ...d, opex: d.opex.filter((y) => y.id !== x.id) }))}>🗑</button>
                    </td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={6} className="empty">{t('noData')}</td></tr>}
                {items.length > 1 && (
                  <tr className="total">
                    <td colSpan={3}>{t('total')} · {items.length}</td>
                    <td className="num">{adsUsd ? `$${adsUsd.toFixed(2)}` : ''}</td>
                    <td className="num">{totalGel.toFixed(2)}</td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      {edit && (
        <OpexForm
          t={t}
          initial={edit}
          rate={s.usdRate}
          onClose={() => setEdit(null)}
          onSave={(x) => {
            update((d) => ({ ...d, opex: d.opex.some((y) => y.id === x.id) ? d.opex.map((y) => (y.id === x.id ? x : y)) : [...d.opex, x] }))
            setEdit(null)
          }}
        />
      )}
    </>
  )
}

function OpexForm({ t, initial, rate, onSave, onClose }: { t: T; initial: OpexItem; rate: number; onSave: (x: OpexItem) => void; onClose: () => void }) {
  const [x, setX] = useState(initial)
  return (
    <Modal title={t('opex_title')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">{t('col_date')}<input type="date" value={x.date} onChange={(e) => setX({ ...x, date: e.target.value })} /></label>
        <label className="field">{t('col_category')}
          <select value={x.category} onChange={(e) => setX({ ...x, category: e.target.value as OpexItem['category'] })}>
            <option value="ads">{t('opex_ads')}</option>
            <option value="other">{t('opex_other')}</option>
          </select>
        </label>
        <label className="field">{t('col_amount')}<input type="number" min={0} step="0.01" value={x.amount} onChange={(e) => setX({ ...x, amount: Number(e.target.value) })} onFocus={(e) => e.target.select()} autoFocus /></label>
        <label className="field">{t('col_currency')}
          <select value={x.currency} onChange={(e) => setX({ ...x, currency: e.target.value as OpexItem['currency'] })}>
            <option value="USD">USD ($)</option>
            <option value="GEL">GEL (₾)</option>
          </select>
        </label>
        <label className="field full">{t('col_description')}<input type="text" value={x.description} onChange={(e) => setX({ ...x, description: e.target.value })} /></label>
        <label className="field full">{t('col_ref')}<input type="text" value={x.ref ?? ''} onChange={(e) => setX({ ...x, ref: e.target.value })} /></label>
        <div className="full summary-box"><div className="r total"><span>{t('col_amountGel')}</span><span>{fmtMoney(x.currency === 'USD' ? x.amount * rate : x.amount, 2)}</span></div></div>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn primary" disabled={!x.date} onClick={() => onSave(x)}>{t('save')}</button>
      </div>
    </Modal>
  )
}

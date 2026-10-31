import { useMemo, useState } from 'react'
import type { AppData, Order } from '../types'
import { fmtDate, fmtMonth, fmtPct, monthKey, orderTotals } from '../calc'
import type { Lang, TKey } from '../i18n'
import { Card, Money } from './ui'

export function OrdersTable({
  orders,
  data,
  t,
  lang,
  onEdit,
  onDelete,
  onDuplicate,
  compact = false,
}: {
  orders: Order[]
  data: AppData
  t: (k: TKey) => string
  lang: Lang
  onEdit: (o: Order) => void
  onDelete?: (o: Order) => void
  onDuplicate?: (o: Order) => void
  compact?: boolean
}) {
  if (!orders.length) return <div className="empty">{t('orders_empty')}</div>
  // Per-month sequence numbers, like the spreadsheet (შეკვეთა N - 1, 2, …)
  const seq = new Map<string, number>()
  const sorted = [...data.orders].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const counters = new Map<string, number>()
  for (const o of sorted) {
    const m = monthKey(o.date)
    const n = (counters.get(m) ?? 0) + 1
    counters.set(m, n)
    seq.set(o.id, n)
  }
  const rows = orders.map((o) => ({ o, tt: orderTotals(o, data.settings) }))
  const sumRev = rows.reduce((a, r) => a + r.tt.netRevenue, 0)
  const sumExp = rows.reduce((a, r) => a + r.tt.totalExpense, 0)
  const sumProfit = rows.reduce((a, r) => a + r.tt.profit, 0)
  return (
    <>
    <div className="order-cards">
      {rows.map(({ o, tt }) => (
        <div className="order-card" key={o.id} onClick={() => onEdit(o)}>
          <div className="oc-top">
            <div className="oc-client">
              <span className="muted">#{seq.get(o.id)}</span> {o.client}
              {tt.profit < 0 && <span className="badge loss">{t('loss_badge')}</span>}
            </div>
            <div className={`oc-profit ${tt.profit < 0 ? 'neg' : 'pos'}`}>{tt.profit < 0 ? '−' : '+'}{Math.abs(tt.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₾</div>
          </div>
          {o.description && <div className="oc-desc">{o.description}</div>}
          <div className="oc-meta">
            <span>{fmtDate(o.date)}</span>
            <span>{t('col_revenue')} {tt.grossRevenue.toLocaleString()}</span>
            <span>{t('col_expense')} {tt.totalExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            {!compact && (onDelete || onDuplicate) && (
              <span className="oc-actions" onClick={(e) => e.stopPropagation()}>
                {onDuplicate && <button className="icon-btn" title={t('duplicate')} onClick={() => onDuplicate(o)}>⧉</button>}
                {onDelete && <button className="icon-btn danger" title={t('delete')} onClick={() => confirm(t('confirmDelete')) && onDelete(o)}>🗑</button>}
              </span>
            )}
          </div>
        </div>
      ))}
      {!compact && rows.length > 1 && (
        <div className="order-card total-card">
          <span>{t('total')} · {rows.length}</span>
          <Money v={sumProfit} />
        </div>
      )}
    </div>
    <div className="table-wrap desktop-only">
      <table>
        <thead>
          <tr>
            <th>{t('col_n')}</th>
            <th>{t('col_date')}</th>
            <th>{t('col_client')}</th>
            <th className="num">{t('col_revenue')}</th>
            {!compact && <th className="num">{t('col_netRevenue')}</th>}
            <th className="num">{t('col_expense')}</th>
            <th className="num">{t('col_profit')}</th>
            {!compact && <th className="num">{t('col_margin')}</th>}
            <th className="num">{t('col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ o, tt }) => (
            <tr key={o.id} className="clickable" onClick={() => onEdit(o)}>
              <td className="muted">{seq.get(o.id)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {fmtDate(o.date)}
                {!compact && <div className="cell-sub">{fmtMonth(monthKey(o.date), lang)}</div>}
              </td>
              <td>
                {o.client}
                {tt.profit < 0 && <span className="badge loss">{t('loss_badge')}</span>}
                {o.vatIncluded && <span className="badge">{t('vat_badge')}</span>}
                {o.applyPayoutTax && <span className="badge">{t('tax_badge')}</span>}
                {o.description && <div className="cell-sub" title={o.description}>{o.description}</div>}
              </td>
              <td className="num">{tt.grossRevenue.toLocaleString()}</td>
              {!compact && <td className="num muted">{tt.netRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>}
              <td className="num">{tt.totalExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="num"><Money v={tt.profit} /></td>
              {!compact && <td className="num muted">{fmtPct(tt.margin)}</td>}
              <td className="num" onClick={(e) => e.stopPropagation()}>
                <div className="row-actions">
                  <button className="icon-btn" title={t('edit')} onClick={() => onEdit(o)}>✎</button>
                  {onDuplicate && <button className="icon-btn" title={t('duplicate')} onClick={() => onDuplicate(o)}>⧉</button>}
                  {onDelete && <button className="icon-btn danger" title={t('delete')} onClick={() => confirm(t('confirmDelete')) && onDelete(o)}>🗑</button>}
                </div>
              </td>
            </tr>
          ))}
          {!compact && rows.length > 1 && (
            <tr className="total">
              <td colSpan={3}>{t('total')} · {rows.length}</td>
              <td className="num"></td>
              <td className="num">{sumRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="num">{sumExp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="num"><Money v={sumProfit} /></td>
              <td className="num muted">{sumRev ? fmtPct(sumProfit / sumRev) : ''}</td>
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  )
}

export function OrdersPage({
  data,
  t,
  lang,
  month,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  data: AppData
  t: (k: TKey) => string
  lang: Lang
  month: string
  onEdit: (o: Order) => void
  onDelete: (o: Order) => void
  onDuplicate: (o: Order) => void
}) {
  const [q, setQ] = useState('')
  const [onlyLoss, setOnlyLoss] = useState(false)
  const orders = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return data.orders
      .filter((o) => (month === 'all' ? true : monthKey(o.date) === month))
      .filter((o) => !ql || o.client.toLowerCase().includes(ql) || o.description.toLowerCase().includes(ql) || o.expenses.some((e) => e.name.toLowerCase().includes(ql)))
      .filter((o) => !onlyLoss || orderTotals(o, data.settings).profit < 0)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [data, month, q, onlyLoss])
  return (
    <Card>
      <div className="toolbar">
        <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={onlyLoss} onChange={(e) => setOnlyLoss(e.target.checked)} /> {t('lossOrdersTitle')}
        </label>
      </div>
      <OrdersTable orders={orders} data={data} t={t} lang={lang} onEdit={onEdit} onDelete={onDelete} onDuplicate={onDuplicate} />
    </Card>
  )
}

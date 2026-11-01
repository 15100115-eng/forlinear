import { useMemo, useState } from 'react'
import type { AppData, Invoice, InvoiceItem, Order } from '../types'
import { fmtDate, orderTotals, orderType, todayIso, uid } from '../calc'
import type { TKey } from '../i18n'
import { Card, Modal } from './ui'

type T = (k: TKey) => string

const money = (n: number) => `GEL ${n.toFixed(2)}`
export const invoiceTotal = (inv: Invoice) => inv.items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)

/** Next number in the form YYYY-NNN, counting invoices issued in the same year. */
export function nextInvoiceNumber(data: AppData, date = todayIso()): string {
  const y = date.slice(0, 4)
  const n = (data.invoices ?? []).filter((i) => i.number.startsWith(y + '-')).length + 1
  return `${y}-${String(n).padStart(3, '0')}`
}

export function invoiceFromOrder(data: AppData, o: Order): Invoice {
  const t = orderTotals(o, data.settings)
  const items: InvoiceItem[] =
    orderType(o) === 'sale' && o.items?.length
      ? o.items.map((i) => ({ id: uid(), name: i.name, qty: i.qty, price: i.price }))
      : [{ id: uid(), name: o.description || 'გადატანა', qty: 1, price: t.grossRevenue }]
  return {
    id: uid(),
    number: nextInvoiceNumber(data, o.date),
    date: o.date,
    clientName: o.client,
    clientId: '',
    clientAddress: '',
    items,
    bankId: data.settings.defaultBankId ?? data.banks?.[0]?.id ?? '',
    signed: true,
    orderId: o.id,
    createdAt: new Date().toISOString(),
  }
}

export function blankInvoice(data: AppData): Invoice {
  return {
    id: uid(),
    number: nextInvoiceNumber(data),
    date: todayIso(),
    clientName: '',
    clientId: '',
    clientAddress: '',
    items: [{ id: uid(), name: '', qty: 1, price: 0 }],
    bankId: data.settings.defaultBankId ?? data.banks?.[0]?.id ?? '',
    signed: true,
    createdAt: new Date().toISOString(),
  }
}

/** The printable document — layout follows the company's existing invoice template. */
export function InvoiceDoc({ inv, data, t }: { inv: Invoice; data: AppData; t: T }) {
  const co = data.company!
  const bank = (data.banks ?? []).find((b) => b.id === inv.bankId)
  const total = invoiceTotal(inv)
  return (
    <div className="inv-doc">
      <div className="inv-bar" />
      <div className="inv-head">
        <img src="/invoice/logo.png" alt="Next Move" className="inv-logo" />
        <div className="inv-meta">
          <div className="inv-title">
            {t('invoice').toUpperCase()}
            {inv.number && <span> № {inv.number}</span>}
          </div>
          <div className="inv-when">
            {t('inv_date')}: <b>{fmtDate(inv.date)}</b>
          </div>
        </div>
      </div>
      <div className="inv-parties">
        <div>
          <h3>{t('inv_executor')}</h3>
          <p>{t('inv_company')}: {co.name}</p>
          <p>{t('inv_pn')}: {co.taxId}</p>
          <p>{t('inv_tel')}: {co.phone}</p>
          <p>{t('inv_addr')}: {co.address}</p>
          {bank && (
            <>
              <p>{t('inv_bankLabel')}: {bank.name}</p>
              <p>{t('inv_iban')}: {bank.iban}</p>
            </>
          )}
        </div>
        <div className="inv-right">
          <h3>{t('inv_customer')}</h3>
          <p>{t('inv_org')}: {inv.clientName}</p>
          {inv.clientId && <p>{t('inv_sn')}: {inv.clientId}</p>}
          {inv.clientAddress && <p>{t('inv_addr')}: {inv.clientAddress}</p>}
        </div>
      </div>
      <table className="inv-table">
        <thead>
          <tr>
            <th>{t('inv_service')}</th>
            <th className="num">{t('inv_qty')}</th>
            <th className="num">{t('inv_cost')}</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td className="num">{i.qty}</td>
              <td className="num">GEL {Number(i.price) % 1 ? i.price.toFixed(2) : i.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inv-totals">
        <div className="inv-sub"><span>{t('inv_subtotal')}</span><span>{money(total)}</span></div>
        <div className="inv-total"><span>{t('inv_total')}</span><span>{money(total)}</span></div>
      </div>
      {inv.signed && (
        <div className="inv-sign">
          <h3>{t('inv_director')}</h3>
          <p>{co.director}</p>
          <img src="/invoice/signature.png" alt="" className="inv-signature" />
        </div>
      )}
    </div>
  )
}

export function InvoiceForm({
  initial,
  data,
  t,
  onSave,
  onClose,
}: {
  initial: Invoice
  data: AppData
  t: T
  onSave: (inv: Invoice) => void
  onClose: () => void
}) {
  const [inv, setInv] = useState<Invoice>(initial)
  const [preview, setPreview] = useState(false)
  const banks = data.banks ?? []
  const set = (p: Partial<Invoice>) => setInv((x) => ({ ...x, ...p }))
  const setItem = (id: string, p: Partial<InvoiceItem>) => setInv((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const valid = inv.clientName.trim() && inv.date && inv.items.some((i) => i.name.trim())
  const total = useMemo(() => invoiceTotal(inv), [inv])
  const clients = useMemo(() => [...new Set((data.invoices ?? []).map((i) => i.clientName).concat(data.orders.map((o) => o.client)))].filter(Boolean).sort(), [data])

  const print = () => {
    onSave(inv)
    setPreview(true)
    setTimeout(() => window.print(), 300)
  }

  if (preview) {
    return (
      <Modal title={`${t('invoice')} ${inv.number}`} onClose={() => setPreview(false)}>
        <div className="inv-preview-wrap">
          <InvoiceDoc inv={inv} data={data} t={t} />
        </div>
        <p className="hint" style={{ margin: '10px 0 0' }}>{t('inv_print_hint')}</p>
        <div className="form-actions">
          <button className="btn" onClick={() => setPreview(false)}>{t('edit')}</button>
          <button className="btn primary" onClick={() => window.print()}>🖨 {t('inv_print')}</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={initial.createdAt && (data.invoices ?? []).some((i) => i.id === initial.id) ? t('editInvoice') : t('newInvoice')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">{t('inv_number')}<input type="text" value={inv.number} onChange={(e) => set({ number: e.target.value })} /></label>
        <label className="field">{t('inv_date')}<input type="date" value={inv.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <label className="field full">
          {t('inv_client')} *
          <input type="text" list="inv-clients" value={inv.clientName} onChange={(e) => set({ clientName: e.target.value })} autoFocus={!inv.clientName} />
          <datalist id="inv-clients">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="field">{t('inv_clientId')}<input type="text" inputMode="numeric" value={inv.clientId} onChange={(e) => set({ clientId: e.target.value })} /></label>
        <label className="field">{t('inv_clientAddress')}<input type="text" value={inv.clientAddress} onChange={(e) => set({ clientAddress: e.target.value })} /></label>

        <div className="full">
          <h3>{t('inv_items')} *</h3>
          <div className="cost-group">
            {inv.items.map((i) => (
              <div className="cost-row" key={i.id}>
                <input type="text" className="nm" placeholder={t('inv_service')} value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} />
                <input type="number" className="qty" min={0} step="1" inputMode="decimal" value={i.qty || ''} placeholder="1" onChange={(e) => setItem(i.id, { qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                <input type="number" className="amt" min={0} step="0.01" inputMode="decimal" placeholder="₾" value={i.price || ''} onChange={(e) => setItem(i.id, { price: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                {inv.items.length > 1 && (
                  <button type="button" className="icon-btn danger" onClick={() => setInv((x) => ({ ...x, items: x.items.filter((y) => y.id !== i.id) }))}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="cg-add" onClick={() => setInv((x) => ({ ...x, items: [...x.items, { id: uid(), name: '', qty: 1, price: 0 }] }))}>{t('addLine')}</button>
          </div>
        </div>

        <label className="field">
          {t('inv_bank')}
          <select value={inv.bankId} onChange={(e) => set({ bankId: e.target.value })}>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.name} · {b.iban}</option>
            ))}
          </select>
        </label>
        <div className="check-wrap" style={{ alignSelf: 'end' }}>
          <label className="check">
            <input type="checkbox" checked={inv.signed} onChange={(e) => set({ signed: e.target.checked })} /> {t('inv_signed')}
          </label>
          <div className="hint">{t('inv_signed_hint')}</div>
        </div>

        <div className="full summary-box">
          <div className="r total"><span>{t('inv_total')}</span><span>{money(total)}</span></div>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn" disabled={!valid} onClick={() => { onSave(inv); setPreview(true) }}>{t('inv_preview')}</button>
        <button className="btn primary" disabled={!valid} onClick={print}>🖨 {t('inv_print')}</button>
      </div>
    </Modal>
  )
}

export function InvoicesPage({ data, t, onOpen, onNew, onDelete }: { data: AppData; t: T; onOpen: (inv: Invoice) => void; onNew: () => void; onDelete: (inv: Invoice) => void }) {
  const list = [...(data.invoices ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  return (
    <Card title={t('nav_invoices')} right={<button className="btn sm primary" onClick={onNew}>+ {t('invoice')}</button>}>
      {!list.length ? (
        <div className="empty">{t('inv_empty')}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>{t('inv_date')}</th>
                <th>{t('inv_customer')}</th>
                <th className="num">{t('inv_total')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((inv) => (
                <tr key={inv.id} className="clickable" onClick={() => onOpen(inv)}>
                  <td>{inv.number}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(inv.date)}</td>
                  <td>{inv.clientName}<div className="cell-sub">{inv.items.map((i) => i.name).join(', ')}</div></td>
                  <td className="num">{invoiceTotal(inv).toLocaleString()} ₾</td>
                  <td className="num" onClick={(e) => e.stopPropagation()}>
                    <div className="row-actions">
                      <button className="icon-btn" title={t('inv_print')} onClick={() => onOpen(inv)}>🖨</button>
                      <button className="icon-btn danger" title={t('delete')} onClick={() => confirm(t('confirmDelete')) && onDelete(inv)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

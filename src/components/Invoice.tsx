import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppData, Invoice, InvoiceItem, Order } from '../types'
import { fmtDate, orderTotals, orderType, todayIso, uid } from '../calc'
import type { TKey } from '../i18n'
import { Card, Modal, Icons } from './ui'

type T = (k: TKey) => string

const money = (n: number) => `GEL ${n.toFixed(2)}`
export const invoiceTotal = (inv: Invoice) => inv.items.reduce((a, i) => a + (Number(i.qty) || 0) * (Number(i.price) || 0), 0)

/** Next number in the form YYYY-NNN, counting invoices issued in the same year. */
export const vatModeOf = (inv: Invoice): 'excluded' | 'included' | 'none' => inv.vatMode ?? (inv.vatIncluded ? 'included' : 'excluded')

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
    vatMode: o.vatIncluded ? 'included' : 'excluded',
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
    vatMode: 'excluded',
    createdAt: new Date().toISOString(),
  }
}

/** Renders an A4-width document scaled down to fit its container, so the live preview matches the printed page. */
function LivePreview({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const update = () => {
      const sc = Math.min(1, o.clientWidth / PAGE_W)
      setScale(sc)
      setH(i.offsetHeight * sc)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="live-outer" ref={outer} style={{ height: h || undefined }}>
      <div className="live-page" ref={inner} style={{ width: PAGE_W, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

const PAGE_W = 794

/** The printable document — layout follows the company's existing invoice template. */
export function InvoiceDoc({ inv, data, t }: { inv: Invoice; data: AppData; t: T }) {
  const co = data.company!
  const bank = (data.banks ?? []).find((b) => b.id === inv.bankId)
  const total = invoiceTotal(inv)
  const vatRate = data.settings.vatRate
  const vatMode = vatModeOf(inv)
  const vatPart = vatMode === 'included' ? total - total / (1 + vatRate / 100) : 0
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
        {vatMode === 'included' && <div className="inv-sub"><span>{t('inv_vatIncl')} ({vatRate}%):</span><span>{money(vatPart)}</span></div>}
        <div className="inv-total"><span>{t('inv_total')}</span><span>{money(total)}</span></div>
        {vatMode !== 'none' && <div className="inv-vatnote">{vatMode === 'included' ? t('inv_vat_yes') : t('inv_vat_no')}</div>}
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
  const [tab, setTab] = useState<'form' | 'view'>('form')
  const banks = data.banks ?? []
  const set = (p: Partial<Invoice>) => setInv((x) => ({ ...x, ...p }))
  const setItem = (id: string, p: Partial<InvoiceItem>) => setInv((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }))
  const valid = inv.clientName.trim() && inv.date && inv.items.some((i) => i.name.trim())
  const total = useMemo(() => invoiceTotal(inv), [inv])

  const print = () => {
    onSave(inv)
    setTimeout(() => window.print(), 300)
  }

  return (
    <Modal className="modal-wide" title={initial.createdAt && (data.invoices ?? []).some((i) => i.id === initial.id) ? t('editInvoice') : t('newInvoice')} onClose={onClose}>
      <div className="seg-toggle inv-tabs">
        <button type="button" className={tab === 'form' ? 'active' : ''} onClick={() => setTab('form')}>{t('inv_tab_form')}</button>
        <button type="button" className={tab === 'view' ? 'active' : ''} onClick={() => setTab('view')}>{t('inv_tab_view')}</button>
      </div>
      <div className={`inv-split show-${tab}`}>
      <div className="form-grid inv-form">
        <label className="field">{t('inv_number')}<input type="text" value={inv.number} onChange={(e) => set({ number: e.target.value })} /></label>
        <label className="field">{t('inv_date')}<input type="date" value={inv.date} onChange={(e) => set({ date: e.target.value })} /></label>
        <label className="field full">
          {t('inv_client')} *
          <input type="text" value={inv.clientName} onChange={(e) => set({ clientName: e.target.value })} autoFocus={!inv.clientName} />
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

        <div className="field full">
          {t('inv_bank')}
          <div className="chips" style={{ marginTop: 2 }}>
            {banks.map((b) => (
              <button type="button" key={b.id} className={`chip ${inv.bankId === b.id ? 'active' : ''}`} onClick={() => set({ bankId: b.id })}>
                {b.name}
                <small>{b.iban}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="check-wrap full">
          <label className="check">
            <input type="checkbox" checked={inv.signed} onChange={(e) => set({ signed: e.target.checked })} /> {t('inv_signed')}
          </label>
          <div className="hint">{t('inv_signed_hint')}</div>
        </div>
        <div className="field full">
          {t('inv_vat_label')}
          <div className="chips" style={{ marginTop: 2 }}>
            {(['excluded', 'included', 'none'] as const).map((m) => (
              <button type="button" key={m} className={`chip ${vatModeOf(inv) === m ? 'active' : ''}`} onClick={() => set({ vatMode: m, vatIncluded: m === 'included' })}>
                {t(m === 'excluded' ? 'inv_vat_opt_excl' : m === 'included' ? 'inv_vat_opt_incl' : 'inv_vat_opt_none')}
              </button>
            ))}
          </div>
        </div>

        <div className="full summary-box">
          <div className="r total"><span>{t('inv_total')}</span><span>{money(total)}</span></div>
        </div>
      </div>
      <div className="inv-live">
        <LivePreview>
          <InvoiceDoc inv={inv} data={data} t={t} />
        </LivePreview>
        <p className="hint" style={{ margin: '8px 0 0' }}>{t('inv_print_hint')}</p>
      </div>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn" disabled={!valid} onClick={() => onSave(inv)}>{t('save')}</button>
        <button className="btn primary" disabled={!valid} onClick={print}>{t('inv_print')}</button>
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
                      <button className="icon-btn" title={t('inv_print')} onClick={() => onOpen(inv)}>{Icons.print}</button>
                      <button className="icon-btn danger" title={t('delete')} onClick={() => confirm(t('confirmDelete')) && onDelete(inv)}>{Icons.trash}</button>
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

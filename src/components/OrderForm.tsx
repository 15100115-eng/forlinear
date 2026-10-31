import { useMemo, useState } from 'react'
import type { ExpenseLine, Order, Settings } from '../types'
import { lineAmount, orderTotals, round2, todayIso, uid } from '../calc'
import { LABOR_PRESETS, MATERIAL_PRESETS, OTHER_PRESETS } from '../seed'
import type { TKey } from '../i18n'
import { Modal, Money } from './ui'

type T = (k: TKey) => string

function blankOrder(): Order {
  return {
    id: uid(),
    date: todayIso(),
    client: '',
    description: '',
    revenue: 0,
    vatIncluded: false,
    applyPayoutTax: false,
    expenses: [],
    note: '',
    createdAt: new Date().toISOString(),
  }
}

export function OrderForm({
  initial,
  settings,
  t,
  onSave,
  onClose,
  clients,
}: {
  initial?: Order
  settings: Settings
  t: T
  onSave: (o: Order) => void
  onClose: () => void
  clients: string[]
}) {
  const [o, setO] = useState<Order>(() => (initial ? structuredClone(initial) : blankOrder()))
  const [touched, setTouched] = useState(false)
  const totals = useMemo(() => orderTotals(o, settings), [o, settings])
  const set = (patch: Partial<Order>) => setO((p) => ({ ...p, ...patch }))
  const setLine = (id: string, patch: Partial<ExpenseLine>) =>
    setO((p) => ({
      ...p,
      expenses: p.expenses.map((l) => {
        if (l.id !== id) return l
        const nl = { ...l, ...patch }
        if (nl.kind === 'material' && nl.qty != null && nl.unitPrice != null) nl.amount = round2(nl.qty * nl.unitPrice)
        return nl
      }),
    }))
  const addLine = (kind: ExpenseLine['kind'], name = '', unitPrice?: number) =>
    setO((p) => ({
      ...p,
      expenses: [
        ...p.expenses,
        kind === 'material'
          ? { id: uid(), kind, name, qty: 1, unitPrice: unitPrice ?? 0, amount: unitPrice ?? 0 }
          : { id: uid(), kind, name, amount: 0, comment: '' },
      ],
    }))
  const removeLine = (id: string) => setO((p) => ({ ...p, expenses: p.expenses.filter((l) => l.id !== id) }))

  const payoutLines = o.expenses.filter((l) => l.kind !== 'material')
  const materialLines = o.expenses.filter((l) => l.kind === 'material')
  const valid = o.client.trim() && o.date && Number(o.revenue) >= 0

  const submit = () => {
    setTouched(true)
    if (!valid) return
    onSave({
      ...o,
      client: o.client.trim(),
      revenue: Number(o.revenue) || 0,
      expenses: o.expenses.map((l) => ({ ...l, amount: lineAmount(l) })).filter((l) => l.name.trim() || l.amount),
    })
  }

  return (
    <Modal title={initial ? t('editOrder') : t('newOrder')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">
          {t('f_client')} *
          <input type="text" list="clients-list" value={o.client} onChange={(e) => set({ client: e.target.value })} autoFocus />
          <datalist id="clients-list">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {touched && !o.client.trim() && <span className="err">{t('required')}</span>}
        </label>
        <label className="field">
          {t('f_date')} *
          <input type="date" value={o.date} onChange={(e) => set({ date: e.target.value })} />
        </label>
        <label className="field">
          {t('f_revenue')} *
          <input type="number" min={0} step="0.01" value={o.revenue} onChange={(e) => set({ revenue: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
        </label>
        <label className="field">
          {t('f_description')}
          <input type="text" value={o.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={o.vatIncluded} onChange={(e) => set({ vatIncluded: e.target.checked })} /> {t('f_vat')}
        </label>
        <label className="check">
          <input type="checkbox" checked={o.applyPayoutTax} onChange={(e) => set({ applyPayoutTax: e.target.checked })} /> {t('f_tax')}
        </label>

        <div className="full">
          <h3>{t('f_expenses')}</h3>
          <div className="lines">
            {payoutLines.map((l) => (
              <div className="line" key={l.id}>
                <select value={l.kind} onChange={(e) => setLine(l.id, { kind: e.target.value as ExpenseLine['kind'] })}>
                  <option value="labor">{t('f_kind_labor')}</option>
                  <option value="other">{t('f_kind_other')}</option>
                </select>
                <input type="text" placeholder={t('f_name')} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} list="payee-list" />
                <input type="number" className="amount" placeholder={t('f_amount')} min={0} step="0.01" value={l.amount} onChange={(e) => setLine(l.id, { amount: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                <input type="text" placeholder={t('col_comment')} value={l.comment ?? ''} onChange={(e) => setLine(l.id, { comment: e.target.value })} />
                <button className="icon-btn danger" onClick={() => removeLine(l.id)} aria-label={t('delete')}>✕</button>
              </div>
            ))}
          </div>
          <datalist id="payee-list">
            {[...LABOR_PRESETS, ...OTHER_PRESETS].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="chips">
            <span>{t('quickAdd')}</span>
            {LABOR_PRESETS.map((p) => (
              <button type="button" className="chip" key={p} onClick={() => addLine('labor', p)}>{p}</button>
            ))}
            {OTHER_PRESETS.slice(0, 3).map((p) => (
              <button type="button" className="chip" key={p} onClick={() => addLine('other', p)}>{p}</button>
            ))}
            <button type="button" className="btn sm" onClick={() => addLine('labor')}>{t('addLine')}</button>
          </div>
        </div>

        <div className="full">
          <h3>{t('f_materials')}</h3>
          <div className="lines">
            {materialLines.map((l) => (
              <div className="line material" key={l.id}>
                <input type="text" placeholder={t('col_item')} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} list="material-list" />
                <input type="number" placeholder={t('col_qty')} min={0} step="0.01" value={l.qty ?? ''} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                <input type="number" placeholder={t('col_price')} min={0} step="0.01" value={l.unitPrice ?? ''} onChange={(e) => setLine(l.id, { unitPrice: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                <div className="amount">{lineAmount(l).toFixed(2)} ₾</div>
                <button className="icon-btn danger" onClick={() => removeLine(l.id)} aria-label={t('delete')}>✕</button>
              </div>
            ))}
          </div>
          <datalist id="material-list">
            {MATERIAL_PRESETS.map((p) => (
              <option key={p.name} value={p.name} />
            ))}
          </datalist>
          <div className="chips">
            <span>{t('quickAdd')}</span>
            {MATERIAL_PRESETS.map((p) => (
              <button type="button" className="chip" key={p.name} onClick={() => addLine('material', p.name, p.unitPrice)}>
                {p.name} · {p.unitPrice} ₾
              </button>
            ))}
            <button type="button" className="btn sm" onClick={() => addLine('material')}>{t('addMaterial')}</button>
          </div>
        </div>

        <label className="field full">
          {t('f_note')}
          <textarea rows={2} value={o.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        </label>

        <div className="full summary-box">
          <div className="r"><span>{t('s_payouts')}</span><span>{totals.payouts.toFixed(2)} ₾</span></div>
          {o.applyPayoutTax && <div className="r"><span>{t('s_tax')} ({settings.payoutTaxRate}%)</span><span>{totals.tax.toFixed(2)} ₾</span></div>}
          <div className="r"><span>{t('s_materials')}</span><span>{totals.materials.toFixed(2)} ₾</span></div>
          <div className="r"><span>{t('s_totalExpense')}</span><span>{totals.totalExpense.toFixed(2)} ₾</span></div>
          {o.vatIncluded && <div className="r muted"><span>{t('s_vat')} ({settings.vatRate}%)</span><span>−{totals.vat.toFixed(2)} ₾</span></div>}
          <div className="r"><span>{t('s_netRevenue')}</span><span>{totals.netRevenue.toFixed(2)} ₾</span></div>
          <div className="r total"><span>{t('s_profit')}</span><Money v={totals.profit} digits={2} /></div>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn primary" onClick={submit} disabled={touched && !valid}>{t('save')}</button>
      </div>
    </Modal>
  )
}

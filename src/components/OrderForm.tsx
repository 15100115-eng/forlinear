import { useMemo, useState } from 'react'
import type { ExpenseGroup, ExpenseLine, Order, OrderType, SaleLine, Settings } from '../types'
import { lineAmount, orderTotals, round2, saleCost, saleRevenue, todayIso, uid } from '../calc'
import { HELPER_PRESETS, MATERIAL_PRESETS, OTHER_PRESETS, SALE_PRESETS, TRANSPORT_PRESETS } from '../seed'
import type { TKey } from '../i18n'
import { Modal, Money } from './ui'

type T = (k: TKey) => string

const groupOf = (l: ExpenseLine): ExpenseGroup => {
  if (l.group) return l.group
  if (l.kind === 'material') return 'material'
  if (l.kind === 'other') return 'other'
  return HELPER_PRESETS.includes(l.name) || /დამხმარე/.test(l.name) ? 'helper' : 'transport'
}

const row = (group: ExpenseGroup, name = '', comment = ''): ExpenseLine => ({
  id: uid(),
  kind: group === 'other' ? 'other' : 'labor',
  group,
  name,
  amount: 0,
  comment,
})
const matRow = (name: string, unitPrice: number): ExpenseLine => ({ id: uid(), kind: 'material', group: 'material', name, qty: 0, unitPrice, amount: 0 })

/** Pre-lists the usual rows (blank amounts) so the form is a checklist, keeping any existing lines. */
function withTemplates(lines: ExpenseLine[], type: OrderType): ExpenseLine[] {
  const out: ExpenseLine[] = lines.map((l) => ({ ...l, group: groupOf(l) }))
  const has = (g: ExpenseGroup, name?: string) => out.some((l) => l.group === g && (name == null || l.name === name))
  if (type === 'moving') {
    if (!has('transport')) out.push(row('transport'))
    if (!has('helper')) out.push(row('helper', HELPER_PRESETS[0]))
    for (const n of OTHER_PRESETS) if (!has('other', n)) out.push(row('other', n))
    for (const m of MATERIAL_PRESETS) if (!has('material', m.name)) out.push(matRow(m.name, m.unitPrice))
  } else {
    if (!has('other', 'მიტანა / ტაქსი')) out.push(row('other', 'მიტანა / ტაქსი'))
  }
  return out
}

function blankOrder(type: OrderType): Order {
  return {
    id: uid(),
    type,
    date: todayIso(),
    client: '',
    description: '',
    revenue: 0,
    vatIncluded: false,
    applyPayoutTax: false,
    expenses: [],
    items: [],
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
  const [o, setO] = useState<Order>(() => {
    const base = initial ? { items: [], ...structuredClone(initial) } : blankOrder('moving')
    return { ...base, expenses: withTemplates(base.expenses, base.type ?? 'moving') }
  })
  const [touched, setTouched] = useState(false)
  const type: OrderType = o.type ?? 'moving'
  const isSale = type === 'sale'
  const totals = useMemo(() => orderTotals(o, settings), [o, settings])
  const set = (patch: Partial<Order>) => setO((p) => ({ ...p, ...patch }))
  const switchType = (nt: OrderType) => setO((p) => ({ ...p, type: nt, expenses: withTemplates(p.expenses, nt) }))

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
  const addRow = (g: ExpenseGroup) => setO((p) => ({ ...p, expenses: [...p.expenses, g === 'material' ? matRow('', 0) : row(g)] }))
  const removeLine = (id: string) => setO((p) => ({ ...p, expenses: p.expenses.filter((l) => l.id !== id) }))

  const setItem = (id: string, patch: Partial<SaleLine>) => setO((p) => ({ ...p, items: (p.items ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  const addItem = (name = '', price = 0, unitCost = 0) => setO((p) => ({ ...p, items: [...(p.items ?? []), { id: uid(), name, qty: 1, price, unitCost }] }))
  const removeItem = (id: string) => setO((p) => ({ ...p, items: (p.items ?? []).filter((l) => l.id !== id) }))

  const grp = (g: ExpenseGroup) => o.expenses.filter((l) => (l.group ?? groupOf(l)) === g)
  const gsum = (g: ExpenseGroup) => grp(g).reduce((a, l) => a + lineAmount(l), 0)
  const items = o.items ?? []
  const valid = isSale ? o.date && items.some((i) => i.name.trim() && i.qty > 0) : o.client.trim() && o.date && Number(o.revenue) >= 0

  const submit = () => {
    setTouched(true)
    if (!valid) return
    onSave({
      ...o,
      type,
      client: isSale ? o.client.trim() || t('type_sale') : o.client.trim(),
      revenue: isSale ? saleRevenue(o) : Number(o.revenue) || 0,
      items: isSale ? items.filter((i) => i.name.trim() || i.qty) : [],
      expenses: o.expenses
        .map((l) => ({ ...l, amount: lineAmount(l) }))
        .filter((l) => (l.kind === 'material' ? (l.qty ?? 0) > 0 && l.name.trim() : l.amount > 0)),
    })
  }

  const CostRow = ({ l, list }: { l: ExpenseLine; list?: string[] }) => (
    <div className="cost-row">
      <input type="text" placeholder={t('f_who')} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} list={list ? `list-${l.group}` : undefined} />
      <input type="number" placeholder="₾" min={0} step="0.01" value={l.amount || ''} onChange={(e) => setLine(l.id, { amount: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
      <input type="text" placeholder={t('col_comment')} value={l.comment ?? ''} onChange={(e) => setLine(l.id, { comment: e.target.value })} />
      <button className="icon-btn danger" onClick={() => removeLine(l.id)} aria-label={t('delete')}>✕</button>
    </div>
  )

  const Group = ({ g, title, addLabel, list, children }: { g: ExpenseGroup; title: string; addLabel: string; list?: string[]; children?: React.ReactNode }) => (
    <div className="cost-group">
      <div className="cg-head">
        <h4>{title}</h4>
        <span className="sum">{gsum(g) ? `${gsum(g).toFixed(2)} ₾` : ''}</span>
      </div>
      {list && (
        <datalist id={`list-${g}`}>
          {list.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      )}
      {children}
      <button type="button" className="btn ghost" onClick={() => addRow(g)}>{addLabel}</button>
    </div>
  )

  return (
    <Modal title={initial ? t('editOrder') : t('newOrder')} onClose={onClose}>
      <div className="form-grid">
        <div className="full">
          <h3 style={{ marginBottom: 8 }}>{t('f_type')}</h3>
          <div className="type-pick">
            <button type="button" className={`type-btn ${!isSale ? 'active' : ''}`} onClick={() => switchType('moving')}>
              <span className="ico">🚚</span>
              <span>
                <b>{t('type_moving')}</b>
                <small>{t('type_moving_sub')}</small>
              </span>
            </button>
            <button type="button" className={`type-btn ${isSale ? 'active' : ''}`} onClick={() => switchType('sale')}>
              <span className="ico">📦</span>
              <span>
                <b>{t('type_sale')}</b>
                <small>{t('type_sale_sub')}</small>
              </span>
            </button>
          </div>
        </div>

        <label className="field">
          {isSale ? t('f_client_sale') : `${t('f_client')} *`}
          <input type="text" list="clients-list" value={o.client} onChange={(e) => set({ client: e.target.value })} autoFocus={!isSale} />
          <datalist id="clients-list">
            {clients.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {touched && !isSale && !o.client.trim() && <span className="err">{t('required')}</span>}
        </label>
        <label className="field">
          {t('f_date')} *
          <input type="date" value={o.date} onChange={(e) => set({ date: e.target.value })} />
        </label>

        {!isSale && (
          <>
            <label className="field">
              {t('f_revenue')} *
              <input type="number" min={0} step="0.01" value={o.revenue || ''} placeholder="0" onChange={(e) => set({ revenue: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
            </label>
            <label className="field">
              {t('f_description')}
              <input type="text" value={o.description} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={o.vatIncluded} onChange={(e) => set({ vatIncluded: e.target.checked })} /> {t('f_vat')}
            </label>
            <div>
              <label className="check">
                <input type="checkbox" checked={o.applyPayoutTax} onChange={(e) => set({ applyPayoutTax: e.target.checked })} /> {t('f_tax')}
              </label>
              <div className="hint">{t('f_tax_hint')}</div>
            </div>

            <div className="full">
              <h3>{t('f_costs')}</h3>
              <div className="hint" style={{ margin: '2px 0 0' }}>{t('f_costs_hint')}</div>

              <Group g="transport" title={t('grp_transport')} addLabel={t('add_vehicle')} list={TRANSPORT_PRESETS}>
                {grp('transport').map((l) => (
                  <CostRow key={l.id} l={l} list={TRANSPORT_PRESETS} />
                ))}
              </Group>

              <Group g="helper" title={t('grp_helpers')} addLabel={t('add_helper')} list={HELPER_PRESETS}>
                {grp('helper').map((l) => (
                  <CostRow key={l.id} l={l} list={HELPER_PRESETS} />
                ))}
              </Group>

              <Group g="other" title={t('grp_other')} addLabel={t('add_other')}>
                {grp('other').map((l) => (
                  <CostRow key={l.id} l={l} />
                ))}
              </Group>

              <Group g="material" title={t('grp_materials')} addLabel={t('add_material')}>
                {grp('material').map((l) => (
                  <div className="cost-row mat" key={l.id}>
                    <input type="text" className="nm" placeholder={t('col_item')} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} />
                    <input type="number" placeholder={t('qty_short')} min={0} step="0.01" value={l.qty || ''} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
                    <span className="x">
                      × <input type="number" min={0} step="0.01" value={l.unitPrice ?? ''} onChange={(e) => setLine(l.id, { unitPrice: Number(e.target.value) })} onFocus={(e) => e.target.select()} style={{ width: 70, display: 'inline-block', padding: '6px 8px' }} /> ₾
                    </span>
                    <div className="tot">{lineAmount(l) ? `${lineAmount(l).toFixed(2)} ₾` : <span className="muted">—</span>}</div>
                    <button className="icon-btn danger" onClick={() => removeLine(l.id)} aria-label={t('delete')}>✕</button>
                  </div>
                ))}
              </Group>
            </div>
          </>
        )}

        {isSale && (
          <>
            <div className="full">
              <h3>{t('f_items')} *</h3>
              <div className="lines">
                {items.map((l) => (
                  <div className="line sale" key={l.id}>
                    <label className="field">{t('col_item')}<input type="text" value={l.name} onChange={(e) => setItem(l.id, { name: e.target.value })} list="sale-list" autoFocus={!l.name} /></label>
                    <label className="field">{t('col_qty')}<input type="number" min={0} step="1" value={l.qty} onChange={(e) => setItem(l.id, { qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
                    <label className="field">{t('f_salePrice')}<input type="number" min={0} step="0.01" value={l.price} onChange={(e) => setItem(l.id, { price: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
                    <label className="field">{t('f_unitCost')}<input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => setItem(l.id, { unitCost: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
                    <div className="amount">{round2(l.qty * l.price).toFixed(2)} ₾</div>
                    <button className="icon-btn danger" onClick={() => removeItem(l.id)} aria-label={t('delete')}>✕</button>
                  </div>
                ))}
              </div>
              <datalist id="sale-list">
                {SALE_PRESETS.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
              <div className="chips">
                <span>{t('quickAdd')}</span>
                {SALE_PRESETS.map((p) => (
                  <button type="button" className="chip" key={p.name} onClick={() => addItem(p.name, p.price, p.unitCost)}>
                    {p.name}{p.price ? ` · ${p.price} ₾` : ''}
                  </button>
                ))}
                <button type="button" className="btn sm" onClick={() => addItem()}>{t('addLine')}</button>
              </div>
              {touched && !items.some((i) => i.name.trim() && i.qty > 0) && <span className="err">{t('required')}</span>}
            </div>

            <div className="full">
              <Group g="other" title={t('f_saleExpenses')} addLabel={t('add_other')}>
                {grp('other').map((l) => (
                  <CostRow key={l.id} l={l} />
                ))}
              </Group>
            </div>
            <label className="field full">
              {t('f_description')}
              <input type="text" value={o.description} onChange={(e) => set({ description: e.target.value })} />
            </label>
          </>
        )}

        {!isSale && (
          <label className="field full">
            {t('f_note')}
            <textarea rows={2} value={o.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
          </label>
        )}

        <div className="full summary-box">
          {isSale ? (
            <>
              <div className="r"><span>{t('s_revenue')}</span><span>{totals.grossRevenue.toFixed(2)} ₾</span></div>
              <div className="r"><span>{t('s_cogs')}</span><span>−{saleCost(o).toFixed(2)} ₾</span></div>
              {totals.payouts > 0 && <div className="r"><span>{t('s_other')}</span><span>−{totals.payouts.toFixed(2)} ₾</span></div>}
            </>
          ) : (
            <>
              <div className="r"><span>{t('s_transport')}</span><span>{gsum('transport').toFixed(2)} ₾</span></div>
              <div className="r"><span>{t('s_helpers')}</span><span>{gsum('helper').toFixed(2)} ₾</span></div>
              <div className="r"><span>{t('s_other')}</span><span>{gsum('other').toFixed(2)} ₾</span></div>
              {o.applyPayoutTax && <div className="r"><span>{t('s_tax')} ({settings.payoutTaxRate}%)</span><span>{totals.tax.toFixed(2)} ₾</span></div>}
              <div className="r"><span>{t('s_materials')}</span><span>{totals.materials.toFixed(2)} ₾</span></div>
              <div className="r"><span><b>{t('s_totalExpense')}</b></span><span><b>{totals.totalExpense.toFixed(2)} ₾</b></span></div>
              {o.vatIncluded && <div className="r muted"><span>{t('s_vat')} ({settings.vatRate}%)</span><span>−{totals.vat.toFixed(2)} ₾</span></div>}
              <div className="r"><span>{t('s_netRevenue')}</span><span>{totals.netRevenue.toFixed(2)} ₾</span></div>
            </>
          )}
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

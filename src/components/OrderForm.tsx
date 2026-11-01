import { useMemo, useState } from 'react'
import type { ExpenseGroup, ExpenseLine, Order, OrderType, SaleLine, Settings } from '../types'
import { lineAmount, orderTotals, round2, saleCost, saleRevenue, todayIso, uid } from '../calc'
import { HELPER_PRESETS, MATERIAL_PRESETS, SALE_PRESETS } from '../seed'
import type { TKey } from '../i18n'
import { Modal, Money, Icons } from './ui'

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

/** Keeps existing lines; adds one empty cost row so the list is never empty, and the material presets (qty 0). */
function withTemplates(lines: ExpenseLine[], type: OrderType): ExpenseLine[] {
  const out: ExpenseLine[] = lines.map((l) => ({ ...l, group: groupOf(l) }))
  if (!out.some((l) => l.group !== 'material')) out.push(row('other'))
  if (type === 'moving') for (const m of MATERIAL_PRESETS) if (!out.some((l) => l.group === 'material' && l.name === m.name)) out.push(matRow(m.name, m.unitPrice))
  return out
}

/** Preset material rows show their name as plain text; custom rows get a name input and a delete button. */
const isPresetRow = (l: ExpenseLine) => (l.group ?? groupOf(l)) === 'material' && MATERIAL_PRESETS.some((m) => m.name === l.name)

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
}: {
  initial?: Order
  settings: Settings
  t: T
  onSave: (o: Order) => void
  onClose: () => void
  clients?: string[]
}) {
  const [o, setO] = useState<Order>(() => {
    const base = initial ? { items: [], ...structuredClone(initial) } : blankOrder('moving')
    return { ...base, expenses: withTemplates(base.expenses, base.type ?? 'moving') }
  })
  const [touched, setTouched] = useState(false)
  const [useMaterials, setUseMaterials] = useState(() => (initial?.expenses ?? []).some((l) => l.kind === 'material' && (l.qty ?? 0) > 0))
  const [openComments, setOpenComments] = useState<Set<string>>(() => new Set(initial?.expenses.filter((l) => l.comment).map((l) => l.id)))
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
  const toggleComment = (id: string) =>
    setOpenComments((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

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
        .filter((l) => (l.kind === 'material' ? useMaterials && (l.qty ?? 0) > 0 && l.name.trim() : l.amount > 0)),
    })
  }

  // Plain render helpers (not components) so inputs keep focus between keystrokes.
  const costRow = (l: ExpenseLine) => {
    const showCm = openComments.has(l.id)
    const canDelete = grp('other').length + grp('transport').length + grp('helper').length > 1
    return (
      <div key={l.id}>
        <div className="cost-row">
          <input type="text" className="nm" placeholder={t('f_costName')} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} />
          <input type="number" className="amt" placeholder="₾" min={0} step="0.01" inputMode="decimal" value={l.amount || ''} onChange={(e) => setLine(l.id, { amount: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
          <input type="text" className="cm" placeholder={t('col_comment')} value={l.comment ?? ''} onChange={(e) => setLine(l.id, { comment: e.target.value })} />
          <button type="button" className={`icon-btn cm-toggle ${showCm || l.comment ? 'on' : ''}`} onClick={() => toggleComment(l.id)} aria-label={t('col_comment')} title={t('col_comment')}>
            {Icons.comment}
          </button>
          {canDelete && (
            <button type="button" className="icon-btn danger" onClick={() => removeLine(l.id)} aria-label={t('delete')}>✕</button>
          )}
        </div>
        {showCm && (
          <div className="cost-cm">
            <input type="text" placeholder={t('col_comment')} value={l.comment ?? ''} onChange={(e) => setLine(l.id, { comment: e.target.value })} autoFocus />
          </div>
        )}
      </div>
    )
  }

  const matRowEl = (l: ExpenseLine) => {
    const preset = isPresetRow(l)
    const amt = lineAmount(l)
    return (
      <div className="cost-row" key={l.id}>
        {preset ? (
          <span className="nm">{l.name}</span>
        ) : (
          <input type="text" className="nm" placeholder={t('col_item')} value={l.name} onChange={(e) => setLine(l.id, { name: e.target.value })} />
        )}
        <input type="number" className="qty" placeholder="0" min={0} step="1" inputMode="decimal" value={l.qty || ''} onChange={(e) => setLine(l.id, { qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
        <span className="x">×</span>
        <input type="number" className="price" min={0} step="0.01" inputMode="decimal" value={l.unitPrice ?? ''} onChange={(e) => setLine(l.id, { unitPrice: Number(e.target.value) })} onFocus={(e) => e.target.select()} title={t('col_price')} />
        <span className={`tot ${amt ? '' : 'zero'}`}>{amt ? `${amt.toFixed(2)} ₾` : '—'}</span>
        {!preset && (
          <button type="button" className="icon-btn danger" onClick={() => removeLine(l.id)} aria-label={t('delete')}>✕</button>
        )}
      </div>
    )
  }

  return (
    <Modal title={initial ? t('editOrder') : t('newOrder')} onClose={onClose}>
      <div className="form-grid">
        <div className="full type-pick">
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

        <label className="field full">
          {isSale ? t('f_client_sale') : `${t('f_client')} *`}
          <input type="text" value={o.client} onChange={(e) => set({ client: e.target.value })} />
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
              <input type="number" min={0} step="0.01" inputMode="decimal" value={o.revenue || ''} placeholder="0" onChange={(e) => set({ revenue: Number(e.target.value) })} onFocus={(e) => e.target.select()} />
            </label>
            <label className="field full">
              {t('f_description')}
              <input type="text" value={o.description} onChange={(e) => set({ description: e.target.value })} />
            </label>
            <div className="check-wrap">
              <label className="check">
                <input type="checkbox" checked={o.vatIncluded} onChange={(e) => set({ vatIncluded: e.target.checked })} /> {t('f_vat')}
              </label>
              <div className="hint">{t('f_vat_hint')}</div>
            </div>
            <div className="check-wrap">
              <label className="check">
                <input type="checkbox" checked={o.applyPayoutTax} onChange={(e) => set({ applyPayoutTax: e.target.checked })} /> {t('f_tax')}
              </label>
              <div className="hint">{t('f_tax_hint')}</div>
            </div>

            <div className="full">
              <div className="cost-group">
                <div className="cg-head">
                  <h4>{t('f_costs')}</h4>
                  <span className="sum">{totals.payouts ? `${totals.payouts.toFixed(2)} ₾` : ''}</span>
                </div>
                {[...grp('transport'), ...grp('helper'), ...grp('other')].map((l) => costRow(l))}
                <button type="button" className="cg-add" onClick={() => addRow('other')}>{t('add_other')}</button>
              </div>

              <div className="check-wrap" style={{ marginTop: 14 }}>
                <label className="check">
                  <input type="checkbox" checked={useMaterials} onChange={(e) => setUseMaterials(e.target.checked)} /> {t('f_materialsQ')}
                </label>
                {!useMaterials && <div className="hint">{t('f_materialsQ_hint')}</div>}
              </div>
              {useMaterials && (
                <div className="cost-group">
                  <div className="cg-head">
                    <h4>{t('grp_materials')}</h4>
                    <span className="sum">{gsum('material') ? `${gsum('material').toFixed(2)} ₾` : ''}</span>
                  </div>
                  {grp('material').map(matRowEl)}
                  <button type="button" className="cg-add" onClick={() => addRow('material')}>{t('add_material')}</button>
                </div>
              )}
            </div>
          </>
        )}

        {isSale && (
          <>
            <div className="field" />
            <div className="full">
              <h3>{t('f_items')} *</h3>
              <div className="lines">
                {items.map((l) => (
                  <div className="line sale" key={l.id}>
                    <label className="field">{t('col_item')}<input type="text" value={l.name} onChange={(e) => setItem(l.id, { name: e.target.value })} list="sale-list" /></label>
                    <label className="field">{t('col_qty')}<input type="number" min={0} step="1" inputMode="decimal" value={l.qty} onChange={(e) => setItem(l.id, { qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
                    <label className="field">{t('f_salePrice')}<input type="number" min={0} step="0.01" inputMode="decimal" value={l.price} onChange={(e) => setItem(l.id, { price: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
                    <label className="field">{t('f_unitCost')}<input type="number" min={0} step="0.01" inputMode="decimal" value={l.unitCost} onChange={(e) => setItem(l.id, { unitCost: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
                    <div className="amount">{round2(l.qty * l.price).toFixed(2)} ₾</div>
                    <button type="button" className="icon-btn danger" onClick={() => removeItem(l.id)} aria-label={t('delete')}>✕</button>
                  </div>
                ))}
              </div>
              <datalist id="sale-list">
                {SALE_PRESETS.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
              <div className="chips">
                {SALE_PRESETS.map((p) => (
                  <button type="button" className="chip" key={p.name} onClick={() => addItem(p.name, p.price, p.unitCost)}>
                    + {p.name}
                  </button>
                ))}
                <button type="button" className="chip" onClick={() => addItem()}>{t('addLine')}</button>
              </div>
              {touched && !items.some((i) => i.name.trim() && i.qty > 0) && <span className="err">{t('required')}</span>}
            </div>

            <div className="full">
              <div className="cost-group">
                <div className="cg-head">
                  <h4>{t('f_saleExpenses')}</h4>
                  <span className="sum">{totals.payouts ? `${totals.payouts.toFixed(2)} ₾` : ''}</span>
                </div>
                {[...grp('transport'), ...grp('helper'), ...grp('other')].map((l) => costRow(l))}
                <button type="button" className="cg-add" onClick={() => addRow('other')}>{t('add_other')}</button>
              </div>
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
            <input type="text" value={o.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
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
              <div className="r"><span>{t('s_netRevenue')}</span><span>{totals.netRevenue.toFixed(2)} ₾</span></div>
              {o.vatIncluded && <div className="r muted"><span>{t('s_vat')} ({settings.vatRate}%)</span><span>−{totals.vat.toFixed(2)} ₾</span></div>}
              <div className="r"><span>{t('f_costs')}</span><span>−{totals.payouts.toFixed(2)} ₾</span></div>
              {o.applyPayoutTax && <div className="r"><span>{t('s_tax')} ({settings.payoutTaxRate}%)</span><span>−{totals.tax.toFixed(2)} ₾</span></div>}
              <div className="r"><span>{t('s_materials')}</span><span>−{totals.materials.toFixed(2)} ₾</span></div>
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

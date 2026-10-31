import { useState } from 'react'
import type { AppData, Supply } from '../types'
import { fmtDate, fmtMoney, uid } from '../calc'
import type { TKey } from '../i18n'
import { Card, Modal } from './ui'

type T = (k: TKey) => string

export function SuppliesPage({ data, t, update }: { data: AppData; t: T; update: (fn: (d: AppData) => AppData) => void }) {
  const [edit, setEdit] = useState<Supply | null>(null)
  const total = data.supplies.reduce((a, s) => a + s.qty * s.unitPrice, 0)
  return (
    <Card
      title={t('supplies_title')}
      sub={`${t('supplies_total')}: ${fmtMoney(total, 2)}`}
      right={<button className="btn sm primary" onClick={() => setEdit({ id: uid(), supplier: '', item: '', unit: 'ცალი', qty: 1, unitPrice: 0, date: '' })}>{t('addSupply')}</button>}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('col_date')}</th>
              <th>{t('col_supplier')}</th>
              <th>{t('col_item')}</th>
              <th>{t('col_unit')}</th>
              <th className="num">{t('col_qty')}</th>
              <th className="num">{t('col_price')}</th>
              <th className="num">{t('col_total')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.supplies.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setEdit(s)}>
                <td className="muted">{s.date ? fmtDate(s.date) : '—'}</td>
                <td>{s.supplier || <span className="muted">—</span>}</td>
                <td>{s.item}{s.comment && <div className="cell-sub">{s.comment}</div>}</td>
                <td className="muted">{s.unit}</td>
                <td className="num">{s.qty.toLocaleString()}</td>
                <td className="num">{s.unitPrice}</td>
                <td className="num">{(s.qty * s.unitPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn danger" onClick={() => confirm(t('confirmDelete')) && update((d) => ({ ...d, supplies: d.supplies.filter((x) => x.id !== s.id) }))}>🗑</button>
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={6}>{t('total')}</td>
              <td className="num">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      {edit && (
        <SupplyForm
          t={t}
          initial={edit}
          onClose={() => setEdit(null)}
          onSave={(s) => {
            update((d) => ({ ...d, supplies: d.supplies.some((x) => x.id === s.id) ? d.supplies.map((x) => (x.id === s.id ? s : x)) : [...d.supplies, s] }))
            setEdit(null)
          }}
        />
      )}
    </Card>
  )
}

function SupplyForm({ t, initial, onSave, onClose }: { t: T; initial: Supply; onSave: (s: Supply) => void; onClose: () => void }) {
  const [s, setS] = useState(initial)
  return (
    <Modal title={t('supplies_title')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">{t('col_supplier')}<input type="text" value={s.supplier} onChange={(e) => setS({ ...s, supplier: e.target.value })} autoFocus /></label>
        <label className="field">{t('col_date')}<input type="date" value={s.date ?? ''} onChange={(e) => setS({ ...s, date: e.target.value })} /></label>
        <label className="field full">{t('col_item')}<input type="text" value={s.item} onChange={(e) => setS({ ...s, item: e.target.value })} /></label>
        <label className="field">{t('col_unit')}<input type="text" value={s.unit} onChange={(e) => setS({ ...s, unit: e.target.value })} /></label>
        <label className="field">{t('col_qty')}<input type="number" min={0} step="0.01" value={s.qty} onChange={(e) => setS({ ...s, qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
        <label className="field">{t('col_price')}<input type="number" min={0} step="0.001" value={s.unitPrice} onChange={(e) => setS({ ...s, unitPrice: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
        <label className="field">{t('col_comment')}<input type="text" value={s.comment ?? ''} onChange={(e) => setS({ ...s, comment: e.target.value })} /></label>
        <div className="full summary-box"><div className="r total"><span>{t('col_total')}</span><span>{fmtMoney(s.qty * s.unitPrice, 2)}</span></div></div>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn primary" disabled={!s.item.trim()} onClick={() => onSave(s)}>{t('save')}</button>
      </div>
    </Modal>
  )
}

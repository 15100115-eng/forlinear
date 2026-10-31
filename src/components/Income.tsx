import { useState } from 'react'
import type { AppData, ProductSale, StorageClient } from '../types'
import { fmtDate, fmtMoney, todayIso, uid } from '../calc'
import type { TKey } from '../i18n'
import { Card, Modal } from './ui'

type T = (k: TKey) => string

export function IncomePage({ data, t, update }: { data: AppData; t: T; update: (fn: (d: AppData) => AppData) => void }) {
  const [editSale, setEditSale] = useState<ProductSale | null>(null)
  const [editStorage, setEditStorage] = useState<StorageClient | null>(null)
  const storageTotal = data.storage.filter((s) => s.active).reduce((a, s) => a + s.monthlyFee, 0)
  const salesTotal = data.sales.reduce((a, s) => a + s.qty * s.price, 0)
  const salesQty = data.sales.reduce((a, s) => a + s.qty, 0)
  const sales = [...data.sales].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="grid two">
      <Card
        title={t('storage_title')}
        sub={`${t('storage_total')}: ${fmtMoney(storageTotal)}`}
        right={<button className="btn sm primary" onClick={() => setEditStorage({ id: uid(), client: '', description: '', monthlyFee: 0, active: true, since: todayIso() })}>{t('addStorage')}</button>}
      >
        <table>
          <thead>
            <tr>
              <th>{t('col_client')}</th>
              <th>{t('col_description')}</th>
              <th className="num">{t('col_monthlyFee')}</th>
              <th>{t('col_active')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.storage.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setEditStorage(s)}>
                <td>{s.client}</td>
                <td className="muted">{s.description}</td>
                <td className="num">{s.monthlyFee.toLocaleString()}</td>
                <td>{s.active ? '✓' : '—'}</td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn danger" onClick={() => confirm(t('confirmDelete')) && update((d) => ({ ...d, storage: d.storage.filter((x) => x.id !== s.id) }))}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title={t('sales_title')}
        sub={`${t('sales_total')}: ${salesQty} · ${fmtMoney(salesTotal)}`}
        right={<button className="btn sm primary" onClick={() => setEditSale({ id: uid(), date: todayIso(), item: 'მუყაოს ყუთები', qty: 1, price: 8 })}>{t('addSale')}</button>}
      >
        <table>
          <thead>
            <tr>
              <th>{t('col_date')}</th>
              <th>{t('col_item')}</th>
              <th className="num">{t('col_qty')}</th>
              <th className="num">{t('col_price')}</th>
              <th className="num">{t('col_total')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setEditSale(s)}>
                <td>{fmtDate(s.date)}</td>
                <td>{s.item}</td>
                <td className="num">{s.qty}</td>
                <td className="num">{s.price}</td>
                <td className="num">{(s.qty * s.price).toLocaleString()}</td>
                <td className="num" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn danger" onClick={() => confirm(t('confirmDelete')) && update((d) => ({ ...d, sales: d.sales.filter((x) => x.id !== s.id) }))}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {editSale && (
        <SaleForm
          t={t}
          initial={editSale}
          onClose={() => setEditSale(null)}
          onSave={(s) => {
            update((d) => ({ ...d, sales: d.sales.some((x) => x.id === s.id) ? d.sales.map((x) => (x.id === s.id ? s : x)) : [...d.sales, s] }))
            setEditSale(null)
          }}
        />
      )}
      {editStorage && (
        <StorageForm
          t={t}
          initial={editStorage}
          onClose={() => setEditStorage(null)}
          onSave={(s) => {
            update((d) => ({ ...d, storage: d.storage.some((x) => x.id === s.id) ? d.storage.map((x) => (x.id === s.id ? s : x)) : [...d.storage, s] }))
            setEditStorage(null)
          }}
        />
      )}
    </div>
  )
}

function SaleForm({ t, initial, onSave, onClose }: { t: T; initial: ProductSale; onSave: (s: ProductSale) => void; onClose: () => void }) {
  const [s, setS] = useState(initial)
  return (
    <Modal title={t('sales_title')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">{t('col_date')}<input type="date" value={s.date} onChange={(e) => setS({ ...s, date: e.target.value })} /></label>
        <label className="field">{t('col_item')}<input type="text" value={s.item} onChange={(e) => setS({ ...s, item: e.target.value })} /></label>
        <label className="field">{t('col_qty')}<input type="number" min={0} value={s.qty} onChange={(e) => setS({ ...s, qty: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
        <label className="field">{t('col_price')}<input type="number" min={0} step="0.01" value={s.price} onChange={(e) => setS({ ...s, price: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
        <div className="full summary-box"><div className="r total"><span>{t('col_total')}</span><span>{fmtMoney(s.qty * s.price, 2)}</span></div></div>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn primary" disabled={!s.item.trim() || !s.date} onClick={() => onSave(s)}>{t('save')}</button>
      </div>
    </Modal>
  )
}

function StorageForm({ t, initial, onSave, onClose }: { t: T; initial: StorageClient; onSave: (s: StorageClient) => void; onClose: () => void }) {
  const [s, setS] = useState(initial)
  return (
    <Modal title={t('storage_title')} onClose={onClose}>
      <div className="form-grid">
        <label className="field">{t('col_client')}<input type="text" value={s.client} onChange={(e) => setS({ ...s, client: e.target.value })} autoFocus /></label>
        <label className="field">{t('col_description')}<input type="text" value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></label>
        <label className="field">{t('col_monthlyFee')}<input type="number" min={0} value={s.monthlyFee} onChange={(e) => setS({ ...s, monthlyFee: Number(e.target.value) })} onFocus={(e) => e.target.select()} /></label>
        <label className="field">{t('col_date')}<input type="date" value={s.since ?? ''} onChange={(e) => setS({ ...s, since: e.target.value })} /></label>
        <label className="check full"><input type="checkbox" checked={s.active} onChange={(e) => setS({ ...s, active: e.target.checked })} /> {t('col_active')}</label>
      </div>
      <div className="form-actions">
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button className="btn primary" disabled={!s.client.trim()} onClick={() => onSave(s)}>{t('save')}</button>
      </div>
    </Modal>
  )
}

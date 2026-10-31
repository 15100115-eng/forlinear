import { useState } from 'react'
import type { AppData, StorageClient } from '../types'
import { fmtMoney, todayIso, uid } from '../calc'
import type { TKey } from '../i18n'
import { Card, Modal } from './ui'

type T = (k: TKey) => string

export function IncomePage({ data, t, update }: { data: AppData; t: T; update: (fn: (d: AppData) => AppData) => void }) {
  const [editStorage, setEditStorage] = useState<StorageClient | null>(null)
  const storageTotal = data.storage.filter((s) => s.active).reduce((a, s) => a + s.monthlyFee, 0)

  return (
    <div className="grid">
      <Card
        title={t('storage_title')}
        sub={`${t('storage_total')}: ${fmtMoney(storageTotal)}`}
        right={<button className="btn sm primary" onClick={() => setEditStorage({ id: uid(), client: '', description: '', monthlyFee: 0, active: true, since: todayIso() })}>{t('addStorage')}</button>}
      >
        <div className="table-wrap"><table>
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
        </table></div>
      </Card>

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

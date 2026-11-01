import { useRef } from 'react'
import type { AppData, BankAccount, CompanyInfo, Settings } from '../types'
import { uid } from '../calc'
import type { TKey } from '../i18n'
import { Card, Icons } from './ui'
import { exportJson, exportXlsx, importJson } from '../export'
import { resetToSeed } from '../store'

export function SettingsPage({ data, t, update, setData }: { data: AppData; t: (k: TKey) => string; update: (fn: (d: AppData) => AppData) => void; setData: (d: AppData) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const s = data.settings
  const set = (p: Partial<Settings>) => update((d) => ({ ...d, settings: { ...d.settings, ...p } }))
  const co = data.company!
  const setCo = (p: Partial<CompanyInfo>) => update((d) => ({ ...d, company: { ...d.company!, ...p } }))
  const banks = data.banks ?? []
  const setBank = (id: string, p: Partial<BankAccount>) => update((d) => ({ ...d, banks: (d.banks ?? []).map((b) => (b.id === id ? { ...b, ...p } : b)) }))
  const addBank = (name = '') => update((d) => ({ ...d, banks: [...(d.banks ?? []), { id: uid(), name, iban: '' }] }))
  const removeBank = (id: string) =>
    update((d) => {
      const left = (d.banks ?? []).filter((b) => b.id !== id)
      return { ...d, banks: left, settings: { ...d.settings, defaultBankId: d.settings.defaultBankId === id ? left[0]?.id : d.settings.defaultBankId } }
    })
  return (
    <div className="grid two">
      <Card title={t('settings_title')}>
        <div className="settings-grid">
          <label className="field">{t('set_tax')}<input type="number" min={0} max={100} value={s.payoutTaxRate} onChange={(e) => set({ payoutTaxRate: Number(e.target.value) })} /></label>
          <label className="field">{t('set_vat')}<input type="number" min={0} max={100} value={s.vatRate} onChange={(e) => set({ vatRate: Number(e.target.value) })} /></label>
          <label className="field">{t('set_usdRate')}<input type="number" min={0} step="0.01" value={s.usdRate} onChange={(e) => set({ usdRate: Number(e.target.value) })} /></label>
          <label className="field">{t('set_share')}<input type="number" min={0} max={100} value={s.profitSharePct} onChange={(e) => set({ profitSharePct: Number(e.target.value) })} /></label>
          <label className="field">{t('set_lang')}
            <select value={s.lang} onChange={(e) => set({ lang: e.target.value as Settings['lang'] })}>
              <option value="ka">ქართული</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="field">{t('set_theme')}
            <select value={s.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
              <option value="system">{t('theme_system')}</option>
              <option value="light">{t('theme_light')}</option>
              <option value="dark">{t('theme_dark')}</option>
            </select>
          </label>
        </div>
      </Card>
      <Card title={t('company_title')}>
        <div className="settings-grid">
          <label className="field" style={{ gridColumn: '1 / -1' }}>{t('co_name')}<input type="text" value={co.name} onChange={(e) => setCo({ name: e.target.value })} /></label>
          <label className="field">{t('co_taxId')}<input type="text" value={co.taxId} onChange={(e) => setCo({ taxId: e.target.value })} /></label>
          <label className="field">{t('co_phone')}<input type="text" value={co.phone} onChange={(e) => setCo({ phone: e.target.value })} /></label>
          <label className="field">{t('co_address')}<input type="text" value={co.address} onChange={(e) => setCo({ address: e.target.value })} /></label>
          <label className="field">{t('co_director')}<input type="text" value={co.director} onChange={(e) => setCo({ director: e.target.value })} /></label>
        </div>
      </Card>
      <Card title={t('banks_title')} right={<button className="btn sm" onClick={() => addBank(banks.some((b) => /თიბისი|TBC/i.test(b.name)) ? '' : t('bank_tbc'))}>{t('addBank')}</button>}>
        <div className="lines">
          {banks.map((b) => (
            <div className="bank-row" key={b.id}>
              <label className="field">{t('bank_name')}<input type="text" value={b.name} onChange={(e) => setBank(b.id, { name: e.target.value })} /></label>
              <label className="field">{t('bank_iban')}<input type="text" value={b.iban} onChange={(e) => setBank(b.id, { iban: e.target.value.toUpperCase().replace(/\s+/g, '') })} /></label>
              <label className="check"><input type="radio" name="defaultBank" checked={s.defaultBankId === b.id} onChange={() => set({ defaultBankId: b.id })} /> {t('bank_default')}</label>
              {banks.length > 1 && <button className="icon-btn danger" onClick={() => confirm(t('confirmDelete')) && removeBank(b.id)}>{Icons.trash}</button>}
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('data_title')}>
        <p className="note" style={{ marginBottom: 14 }}>{t('data_note')}</p>
        <div className="btn-row">
          <button className="btn" onClick={() => exportXlsx(data)}>⬇ {t('exportXlsx')}</button>
          <button className="btn" onClick={() => exportJson(data)}>⬇ {t('exportJson')}</button>
          <button className="btn" onClick={() => file.current?.click()}>⬆ {t('importJson')}</button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const d = await importJson(f)
                if (confirm(t('confirmImport'))) setData(d)
              } catch {
                alert(t('importError'))
              }
            }}
          />
          <button className="btn danger" onClick={() => confirm(t('confirmReset')) && setData(resetToSeed())}>{t('resetSeed')}</button>
        </div>
      </Card>
    </div>
  )
}

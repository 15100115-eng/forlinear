import { useRef } from 'react'
import type { AppData, Settings } from '../types'
import type { TKey } from '../i18n'
import { Card } from './ui'
import { exportJson, exportXlsx, importJson } from '../export'
import { resetToSeed } from '../store'

export function SettingsPage({ data, t, update, setData }: { data: AppData; t: (k: TKey) => string; update: (fn: (d: AppData) => AppData) => void; setData: (d: AppData) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const s = data.settings
  const set = (p: Partial<Settings>) => update((d) => ({ ...d, settings: { ...d.settings, ...p } }))
  return (
    <div className="grid two">
      <Card title={t('settings_title')}>
        <div className="settings-grid">
          <label className="field">{t('set_tax')}<input type="number" min={0} max={100} value={s.payoutTaxRate} onChange={(e) => set({ payoutTaxRate: Number(e.target.value) })} /></label>
          <label className="field">{t('set_vat')}<input type="number" min={0} max={100} value={s.vatRate} onChange={(e) => set({ vatRate: Number(e.target.value) })} /></label>
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

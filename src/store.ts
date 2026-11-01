import { useCallback, useEffect, useState } from 'react'
import type { AppData } from './types'
import { DEFAULT_BANKS, DEFAULT_COMPANY, metaSpendItems, seedData } from './seed'

const KEY = 'nextmove-finance-v1'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed && parsed.version === 1 && Array.isArray(parsed.orders)) {
        const seed = seedData()
        return migrateSales(mergeMetaSpend({ ...seed, ...parsed, settings: { ...seed.settings, ...parsed.settings } }))
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seedData()
}

/**
 * Keeps Meta ad spend in sync with the bundled snapshot: replaces every `meta-spend-*` item and drops the
 * old card-payment seed rows (Meta transaction ids), while leaving manually entered expenses untouched.
 */
export function mergeMetaSpend(d: AppData, items: ReturnType<typeof metaSpendItems> = metaSpendItems()): AppData {
  const isOldPaymentSeed = (x: AppData['opex'][number]) => x.category === 'ads' && x.description === 'Meta Ads' && /^\d{10,}-\d{10,}$/.test(x.ref ?? '')
  const kept = (d.opex ?? []).filter((x) => !x.ref?.startsWith('meta-spend-') && !isOldPaymentSeed(x))
  return { ...d, opex: [...kept, ...items] }
}

/** Older data kept box sales in a separate list; they are now 'sale' orders. */
export function migrateSales(d: AppData): AppData {
  d = {
    ...d,
    company: d.company ?? { ...DEFAULT_COMPANY },
    banks: d.banks?.length ? d.banks : DEFAULT_BANKS.map((b) => ({ ...b })),
    invoices: d.invoices ?? [],
    settings: { ...d.settings, defaultBankId: d.settings.defaultBankId ?? 'bog' },
  }
  if (!d.sales?.length) return { ...d, sales: [] }
  const orders = [
    ...d.orders,
    ...d.sales.map((s) => ({
      id: 'sale-' + s.id,
      type: 'sale' as const,
      date: s.date,
      client: 'გაყიდვა',
      description: '',
      revenue: s.qty * s.price,
      vatIncluded: false,
      applyPayoutTax: false,
      expenses: [],
      items: [{ id: 'si-' + s.id, name: s.item.replace(/ყუთები$/, 'ყუთი'), qty: s.qty, price: s.price, unitCost: /ყუთ/.test(s.item) ? 5.5 : 0 }],
      createdAt: new Date(s.date + 'T12:00:00Z').toISOString(),
    })),
  ]
  return { ...d, orders, sales: [] }
}

export function saveData(d: AppData) {
  localStorage.setItem(KEY, JSON.stringify(d))
}

export function useAppData() {
  const [data, setData] = useState<AppData>(loadData)
  useEffect(() => {
    saveData(data)
  }, [data])
  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])
  return { data, update, setData }
}

export function resetToSeed(): AppData {
  const d = seedData()
  saveData(d)
  return d
}

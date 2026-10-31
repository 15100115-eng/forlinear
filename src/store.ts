import { useCallback, useEffect, useState } from 'react'
import type { AppData } from './types'
import { seedData } from './seed'

const KEY = 'nextmove-finance-v1'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppData
      if (parsed && parsed.version === 1 && Array.isArray(parsed.orders)) {
        const seed = seedData()
        return { ...seed, ...parsed, settings: { ...seed.settings, ...parsed.settings } }
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seedData()
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

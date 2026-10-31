import type { AppData, ExpenseLine, Order, Settings } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export const monthKey = (iso: string) => iso.slice(0, 7)

export function lineAmount(l: ExpenseLine): number {
  if (l.kind === 'material' && l.qty != null && l.unitPrice != null) return round2(l.qty * l.unitPrice)
  return Number(l.amount) || 0
}

export const round2 = (n: number) => Math.round(n * 100) / 100

export interface OrderTotals {
  payouts: number
  tax: number
  materials: number
  otherCosts: number
  laborCosts: number
  totalExpense: number
  grossRevenue: number
  vat: number
  netRevenue: number
  profit: number
  margin: number
}

export function orderTotals(o: Order, s: Settings): OrderTotals {
  let labor = 0,
    other = 0,
    materials = 0
  for (const l of o.expenses) {
    const a = lineAmount(l)
    if (l.kind === 'labor') labor += a
    else if (l.kind === 'other') other += a
    else materials += a
  }
  const payouts = labor + other
  const tax = o.applyPayoutTax ? payouts * (s.payoutTaxRate / 100) : 0
  const totalExpense = payouts + tax + materials
  const grossRevenue = Number(o.revenue) || 0
  const netRevenue = o.vatIncluded ? grossRevenue / (1 + s.vatRate / 100) : grossRevenue
  const vat = grossRevenue - netRevenue
  const profit = netRevenue - totalExpense
  return {
    payouts: round2(payouts),
    tax: round2(tax),
    materials: round2(materials),
    otherCosts: round2(other),
    laborCosts: round2(labor),
    totalExpense: round2(totalExpense),
    grossRevenue: round2(grossRevenue),
    vat: round2(vat),
    netRevenue: round2(netRevenue),
    profit: round2(profit),
    margin: netRevenue ? profit / netRevenue : 0,
  }
}

export interface MonthReport {
  month: string
  orders: number
  lossOrders: number
  lossTotal: number
  profitableTotal: number
  profit: number
  profitShare: number
  remaining: number
  revenue: number
  netRevenue: number
  expenses: number
  labor: number
  tax: number
  materials: number
  other: number
  boxSales: number
  storage: number
  supplies: number
}

export function monthReports(data: AppData): MonthReport[] {
  const map = new Map<string, MonthReport>()
  const get = (m: string) => {
    let r = map.get(m)
    if (!r) {
      r = {
        month: m,
        orders: 0,
        lossOrders: 0,
        lossTotal: 0,
        profitableTotal: 0,
        profit: 0,
        profitShare: 0,
        remaining: 0,
        revenue: 0,
        netRevenue: 0,
        expenses: 0,
        labor: 0,
        tax: 0,
        materials: 0,
        other: 0,
        boxSales: 0,
        storage: 0,
        supplies: 0,
      }
      map.set(m, r)
    }
    return r
  }
  for (const o of data.orders) {
    const t = orderTotals(o, data.settings)
    const r = get(monthKey(o.date))
    r.orders++
    if (t.profit < 0) {
      r.lossOrders++
      r.lossTotal += t.profit
    } else r.profitableTotal += t.profit
    r.profit += t.profit
    r.revenue += t.grossRevenue
    r.netRevenue += t.netRevenue
    r.expenses += t.totalExpense
    r.labor += t.laborCosts
    r.tax += t.tax
    r.materials += t.materials
    r.other += t.otherCosts
  }
  for (const s of data.sales) get(monthKey(s.date)).boxSales += s.qty * s.price
  for (const s of data.supplies) if (s.date) get(monthKey(s.date)).supplies += s.qty * s.unitPrice
  const storageMonthly = data.storage.filter((s) => s.active).reduce((a, s) => a + s.monthlyFee, 0)
  for (const r of map.values()) {
    r.storage = storageMonthly
    r.profitShare = r.profit * (data.settings.profitSharePct / 100)
    r.remaining = r.profit - r.profitShare
    for (const k of Object.keys(r) as (keyof MonthReport)[]) {
      if (typeof r[k] === 'number') (r as unknown as Record<string, number>)[k] = round2(r[k] as number)
    }
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export function fmtMoney(n: number, digits = 0): string {
  const v = Number.isFinite(n) ? n : 0
  return (
    new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
      v,
    ) + ' ₾'
  )
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (abs >= 10_000) return (n / 1000).toFixed(1) + 'K'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

export function fmtPct(n: number): string {
  return (n * 100).toFixed(0) + '%'
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ']
const MONTHS_KA_FULL = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
]
const MONTHS_EN_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function fmtMonth(m: string, lang: 'en' | 'ka', full = false): string {
  const [y, mm] = m.split('-')
  const i = Number(mm) - 1
  const names = lang === 'ka' ? (full ? MONTHS_KA_FULL : MONTHS_KA) : full ? MONTHS_EN_FULL : MONTHS_EN
  return `${names[i] ?? mm} ${y}`
}

export function fmtDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

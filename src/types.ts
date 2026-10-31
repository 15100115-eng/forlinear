export type ExpenseKind = 'labor' | 'other' | 'material'

export interface ExpenseLine {
  id: string
  kind: ExpenseKind
  name: string
  /** For materials: quantity used (amount = qty * unitPrice when both are set). */
  qty?: number
  unitPrice?: number
  amount: number
  comment?: string
}

export interface Order {
  id: string
  /** ISO date (YYYY-MM-DD) when the job was completed. */
  date: string
  client: string
  description: string
  /** Amount received from the client (ჩარიცხული თანხა). */
  revenue: number
  /** Revenue includes 18% VAT which must be deducted before profit. */
  vatIncluded: boolean
  /** Apply income + pension tax (30%) on payouts to individuals. */
  applyPayoutTax: boolean
  expenses: ExpenseLine[]
  note?: string
  createdAt: string
}

export interface Supply {
  id: string
  date?: string
  supplier: string
  item: string
  unit: string
  qty: number
  unitPrice: number
  comment?: string
}

export interface ProductSale {
  id: string
  date: string
  item: string
  qty: number
  price: number
}

export interface StorageClient {
  id: string
  client: string
  description: string
  monthlyFee: number
  active: boolean
  since?: string
}

export interface Settings {
  payoutTaxRate: number // percent, default 30
  vatRate: number // percent, default 18
  profitSharePct: number // percent, default 15
  lang: 'en' | 'ka'
  theme: 'system' | 'light' | 'dark'
}

export interface AppData {
  version: 1
  orders: Order[]
  supplies: Supply[]
  sales: ProductSale[]
  storage: StorageClient[]
  settings: Settings
}

export interface MaterialPreset {
  name: string
  unitPrice: number
  unit: string
}

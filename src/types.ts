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

export type OrderType = 'moving' | 'sale'

/** A line of material sold in a 'sale' order. */
export interface SaleLine {
  id: string
  name: string
  qty: number
  /** Sale price per unit. */
  price: number
  /** Purchase cost per unit (cost of goods). */
  unitCost: number
}

export interface Order {
  id: string
  /** 'moving' (transport / relocation job) or 'sale' (selling packing materials). Missing = moving. */
  type?: OrderType
  /** Sold items for 'sale' orders; revenue is derived from them. */
  items?: SaleLine[]
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

export type OpexCategory = 'ads' | 'other'

/** Operating (non-order) expense, e.g. a Meta Ads card payment. */
export interface OpexItem {
  id: string
  date: string
  category: OpexCategory
  amount: number
  currency: 'USD' | 'GEL'
  description: string
  /** External reference (e.g. Meta transaction ID) used for de-duplication on import. */
  ref?: string
}

export interface Settings {
  /** GEL per 1 USD, used to convert USD expenses. */
  usdRate: number
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
  opex: OpexItem[]
  settings: Settings
}

export interface MaterialPreset {
  name: string
  unitPrice: number
  unit: string
}

export interface SalePreset {
  name: string
  price: number
  unitCost: number
}

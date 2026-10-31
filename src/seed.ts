import type { AppData, ExpenseLine, MaterialPreset, OpexItem, Order, SalePreset } from './types'
import metaSpend from '../public/data/meta-spend.json'

/** Default materials with the unit prices used in the original spreadsheet. */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: 'მუყაოს ყუთი', unitPrice: 5, unit: 'ცალი' },
  { name: 'სტრეიჯი', unitPrice: 10, unit: 'ცალი' },
  { name: 'ბუბლ პარკი', unitPrice: 3.5, unit: 'ცალი' },
  { name: 'კალკა', unitPrice: 0.12, unit: 'ცალი' },
  { name: 'პარკი მეტრობით', unitPrice: 3, unit: 'მეტრი' },
  { name: 'პენოპლასტი', unitPrice: 0, unit: 'ცალი' },
  { name: 'წებოვანა ლენტი', unitPrice: 9.17, unit: 'ცალი' },
]

/** Materials sold to customers: sale price and purchase cost per unit (from the spreadsheet and supplies). */
export const SALE_PRESETS: SalePreset[] = [
  { name: 'მუყაოს ყუთი', price: 8, unitCost: 5.5 },
  { name: 'სტრეიჯი', price: 0, unitCost: 10 },
  { name: 'ბუბლ პარკი', price: 0, unitCost: 3.5 },
  { name: 'კალკა', price: 0, unitCost: 0.12 },
  { name: 'წებოვანა ლენტი', price: 0, unitCost: 9.17 },
]

export const LABOR_PRESETS = ['ხვიჩა (ტრანსპორტი)', 'ჩვენი დამხმარე', 'ალთუნაშვილი გია', 'ტრანსპორტი', 'ხელოსანი']
export const OTHER_PRESETS = ['სხვა ხარჯი', 'ტაქსი', 'იანდექს ტაქსი', 'საწყობში ჩამოტვირთვა', 'დაზიანება']

let n = 0
const id = (p: string) => `${p}${(++n).toString(36)}`

const labor = (name: string, amount: number, comment = ''): ExpenseLine => ({ id: id('l'), kind: 'labor', name, amount, comment })
const other = (name: string, amount: number, comment = ''): ExpenseLine => ({ id: id('o'), kind: 'other', name, amount, comment })
const mat = (name: string, qty: number, unitPrice: number): ExpenseLine => ({
  id: id('m'),
  kind: 'material',
  name,
  qty,
  unitPrice,
  amount: Math.round(qty * unitPrice * 100) / 100,
})

const order = (
  date: string,
  client: string,
  description: string,
  revenue: number,
  opts: { vat?: boolean; tax?: boolean; note?: string },
  expenses: ExpenseLine[],
): Order => ({
  id: id('ord'),
  date,
  client,
  description,
  revenue,
  vatIncluded: !!opts.vat,
  applyPayoutTax: !!opts.tax,
  expenses,
  note: opts.note,
  createdAt: new Date(date + 'T12:00:00Z').toISOString(),
})

const sale = (date: string, name: string, qty: number, price: number, unitCost: number): Order => ({
  id: id('sale'),
  type: 'sale',
  date,
  client: 'გაყიდვა',
  description: '',
  revenue: qty * price,
  vatIncluded: false,
  applyPayoutTax: false,
  expenses: [],
  items: [{ id: id('si'), name, qty, price, unitCost }],
  createdAt: new Date(date + 'T12:00:00Z').toISOString(),
})

/** Daily Meta Ads spend (public/data/meta-spend.json) as operating-expense items; ref = meta-spend-<date>. */
export function metaSpendItems(): OpexItem[] {
  return (metaSpend.days as { date: string; spend: number }[])
    .filter((d) => d.spend > 0)
    .map((d) => ({
      id: 'ad-' + d.date,
      date: d.date,
      category: 'ads' as const,
      amount: Math.round(d.spend * 100) / 100,
      currency: (metaSpend.currency === 'GEL' ? 'GEL' : 'USD') as 'USD' | 'GEL',
      description: 'Meta Ads',
      ref: `meta-spend-${d.date}`,
    }))
}

export function seedData(): AppData {
  n = 0
  return {
    version: 1,
    settings: { usdRate: 2.7, payoutTaxRate: 30, vatRate: 18, profitSharePct: 15, lang: 'ka', theme: 'system' },
    orders: [
      // სექტემბერი 2026
      order(
        '2026-09-12',
        'გურამ ქარაზანაშვილის რობოტული ცენტრი',
        'ექოსკოპიის დანადგარის ტრანსპორტირება ზუგდიდი - თბილისი',
        900,
        {
          vat: true,
          tax: true,
          note: 'რადგან სატვირთოში არ შევიდა და წინასწარ ზომები არ გავიარეთ, მოგვიწია მეორე სატვირთოს გაშვება, რამაც გამოიწვია ზარალი',
        },
        [
          labor('ალთუნაშვილი გია', 500, 'სატვირთოს გაშვება თბილისიდან (არ შეეტია ტვირთი)'),
          labor('მარკელია პაატა', 550, 'სატვირთო ზუგდიდი - თბილისი'),
        ],
      ),
      order('2026-09-14', 'კოხრეიძე ნინი', 'სახლის ნივთების გადატანა (საბურთალოზე) (ხ.გ)', 310, { vat: true }, [
        labor('ალთუნაშვილი გია', 150, 'სატვირთო და დამხმარე'),
      ]),
      order('2026-09-22', 'გაბისკირია მარინა', 'სახლის ნივთების გადატანა. ბეთანია - ხილიანი', 800, {}, [
        labor('ხვიჩა (ტრანსპორტი)', 300, 'სატვირთო და დამხმარე'),
        labor('ჩვენი დამხმარე', 180, '2 ბიჭი 09:00-15:00'),
        mat('მუყაოს ყუთი', 8, 5),
        mat('სტრეიჯი', 1, 10),
        mat('ბუბლ პარკი', 3, 3.5),
        mat('კალკა', 60, 0.12),
      ]),
      order('2026-09-23', 'თაკო გავაშელიშვილი', 'სახლის ნივთების გადატანა. უზნაძე - ლისი', 950, {}, [
        labor('ხვიჩა (ტრანსპორტი)', 100, 'სატვირთო და დამხმარე'),
        labor('ჩვენი დამხმარე', 120, '2 ბიჭი'),
      ]),
      order('2026-09-23', 'თამარ ყაჭეიშვილი', 'სახლის ნივთების გადატანა. უზნაძე - პლეხანოვი', 350, {}, [
        labor('ხვიჩა (ტრანსპორტი)', 60, 'სატვირთო და დამხმარე'),
        labor('ჩვენი დამხმარე', 60, '2 ბიჭი'),
      ]),
      order('2026-09-30', 'Oktopus', 'სარბენი ბილიკების ტრანსპორტირება', 900, { tax: true }, [
        labor('ხვიჩა (ტრანსპორტი)', 550, 'სატვირთო და დამხმარე'),
        other('სხვა ხარჯი', 70, 'საწყობში ჩამოტვირთვა (გატანა დიდი მანქანით)'),
        other('დაზიანებული ტელევიზორი', 205),
        mat('პარკი მეტრობით', 3, 3),
      ]),
      // ოქტომბერი 2026
      order('2026-10-01', 'ირანელი მომხმარებელი', 'თბილისი მოლიდან მაცივრის მიტანა მისამართზე', 100, {}, [
        other('იანდექს ტაქსი', 23, 'სატვირთო და დამხმარე'),
      ]),
      order('2026-10-07', 'ძაღლის შეფუთვა (Paypal)', 'ყუთის გაკეთება', 600, {}, [
        labor('ხელოსანი', 250, 'ყუთის შეკვეთა'),
        other('სხვა ხარჯი', 50, 'ტაქსი'),
        mat('პენოპლასტი', 1, 40),
      ]),
      order('2026-10-08', 'გადატანა', 'მაცივარი და სარეცხი მანქანა', 280, {}, [labor('ტრანსპორტი', 200)]),
      order('2026-10-15', 'გადატანა', 'ძაღლის ყუთი (საწყობში)', 200, {}, [labor('ტრანსპორტი', 70)]),
      // მასალის გაყიდვა (Excel: „გაყიდული პროდუქცია")
      sale('2026-09-25', 'მუყაოს ყუთი', 7, 8, 5.5),
      sale('2026-10-05', 'მუყაოს ყუთი', 15, 8, 5.5),
      sale('2026-10-18', 'მუყაოს ყუთი', 5, 8, 5.5),
    ],
    supplies: [
      { id: id('s'), supplier: 'შპს უნიბოქს', item: 'მუყაოს ყუთები 40x40x60', unit: 'ცალი', qty: 200, unitPrice: 5.5 },
      { id: id('s'), supplier: 'შპს ზეიმი', item: 'შესაფუთი კალკები', unit: 'ცალი', qty: 12000, unitPrice: 0.12 },
      { id: id('s'), supplier: 'შპს ტან-ტან ჯორჯია', item: 'ყუთის ურიკა', unit: 'ცალი', qty: 1, unitPrice: 215 },
      {
        id: id('s'),
        supplier: 'დომინო',
        item: 'სახარჯი წვრილმანები (პლედები, სტრეიჯი, სკოჩი და ა.შ.)',
        unit: 'ცალი',
        qty: 1,
        unitPrice: 196,
      },
      { id: id('s'), supplier: 'Brand Pack', item: 'წებოვანა ლენტი', unit: 'ცალი', qty: 36, unitPrice: 9.165 },
      { id: id('s'), supplier: 'შპს რუდი N1', item: 'პარკი (20 მეტრი)', unit: 'მეტრი', qty: 20, unitPrice: 3 },
      { id: id('s'), supplier: '', item: 'ურიკა კიბის', unit: 'ცალი', qty: 2, unitPrice: 275 },
    ],
    sales: [],
    opex: metaSpendItems(),
    storage: [
      { id: id('st'), client: 'მამუკას ავეჯი', description: 'ყუთები', monthlyFee: 500, active: true },
      { id: id('st'), client: 'ოკტოპუსი', description: '13 ცალი', monthlyFee: 400, active: true },
      { id: id('st'), client: 'ძაღლის ყუთი', description: '1 ცალი', monthlyFee: 70, active: true },
    ],
  }
}

import * as XLSX from 'xlsx'
import type { AppData } from './types'
import { fmtDate, fmtMonth, lineAmount, monthKey, monthReports, orderTotals } from './calc'

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export function exportJson(data: AppData) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `nextmove-backup-${new Date().toISOString().slice(0, 10)}.json`)
}

export function importJson(file: File): Promise<AppData> {
  return file.text().then((txt) => {
    const d = JSON.parse(txt) as AppData
    if (!d || d.version !== 1 || !Array.isArray(d.orders)) throw new Error('bad file')
    return d
  })
}

/** Writes a workbook in the same spirit as the original spreadsheet: one sheet per month plus the side tables. */
export function exportXlsx(data: AppData) {
  const wb = XLSX.utils.book_new()
  const s = data.settings
  const months = [...new Set(data.orders.map((o) => monthKey(o.date)))].sort()
  for (const m of months) {
    const rows: (string | number)[][] = [['NEXT MOVE - რეალიზებული შეკვეთები', fmtMonth(m, 'ka', true)], []]
    const orders = data.orders.filter((o) => monthKey(o.date) === m).sort((a, b) => a.date.localeCompare(b.date))
    orders.forEach((o, i) => {
      const t = orderTotals(o, s)
      rows.push([`შეკვეთა N - ${i + 1}`])
      rows.push(['დამკვეთი / შესრულება', 'გამოყენებული მასალა', 'შესრულების თარიღი', 'ჩარიცხული თანხა', 'გადარიცხული თანხა', 'კომენტარი'])
      rows.push([o.client, '', fmtDate(o.date), o.revenue, '', o.description])
      for (const l of o.expenses) {
        if (l.kind === 'material') rows.push([l.name, lineAmount(l), '', '', '', l.qty != null ? `${l.qty} x ${l.unitPrice}` : ''])
        else rows.push([l.name, '', '', '', lineAmount(l), l.comment ?? ''])
      }
      rows.push(['სულ ფიზიკურ პირზე ჩარიცხული თანხა', '', '', '', t.payouts])
      rows.push([`საშემოსავლო და საპენსიო (${s.payoutTaxRate}%)`, '', '', '', o.applyPayoutTax ? t.tax : '-'])
      rows.push(['სახარჯი მასალა', '', '', '', t.materials])
      rows.push(['სრული ხარჯი', '', '', '', t.totalExpense])
      if (o.vatIncluded) rows.push([`დღგ (${s.vatRate}%)`, '', '', '', t.vat])
      rows.push(['მოგება', '', '', '', t.profit, o.note ?? ''])
      rows.push([])
    })
    const r = monthReports(data).find((x) => x.month === m)
    if (r) {
      rows.push([`${fmtMonth(m, 'ka', true)} - რეპორტი`])
      rows.push(['თვე', 'შეკვეთების რაოდენობა', 'წამგებიანი შეკვეთა', 'მომგებიანი შეკვეთა', 'მოგება', `PROFIT SHARE - ${s.profitSharePct}%`, 'დარჩენილი მოგება'])
      rows.push([fmtMonth(m, 'ka', true), r.orders, r.lossTotal, r.profitableTotal, r.profit, r.profitShare, r.remaining])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 38 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 50 }]
    XLSX.utils.book_append_sheet(wb, ws, fmtMonth(m, 'ka', true).slice(0, 31))
  }
  // Flat list of all orders — handy for pivot tables
  const flat = [
    ['თარიღი', 'დამკვეთი', 'აღწერა', 'ჩარიცხული', 'დღგ', 'წმინდა შემოსავალი', 'გადახდები', 'საშემოსავლო', 'მასალა', 'სრული ხარჯი', 'მოგება'],
    ...[...data.orders]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((o) => {
        const t = orderTotals(o, s)
        return [fmtDate(o.date), o.client, o.description, t.grossRevenue, t.vat, t.netRevenue, t.payouts, t.tax, t.materials, t.totalExpense, t.profit]
      }),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(flat), 'ყველა შეკვეთა')
  const sup = [
    ['მომწოდებელი', 'დასახელება', 'ერთეული', 'რაოდენობა', 'ფასი', 'ჯამი', 'თარიღი'],
    ...data.supplies.map((x) => [x.supplier, x.item, x.unit, x.qty, x.unitPrice, x.qty * x.unitPrice, x.date ? fmtDate(x.date) : '']),
    ['Total Payments', '', '', '', '', data.supplies.reduce((a, x) => a + x.qty * x.unitPrice, 0)],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sup), 'საწყობი - მარაგები')
  const sales = [
    ['თარიღი', 'დასახელება', 'რაოდენობა', 'ფასი', 'ჯამი (ლარი)'],
    ...data.sales.map((x) => [fmtDate(x.date), x.item, x.qty, x.price, x.qty * x.price]),
    ['', '', data.sales.reduce((a, x) => a + x.qty, 0), '', data.sales.reduce((a, x) => a + x.qty * x.price, 0)],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sales), 'გაყიდული პროდუქცია')
  const st = [
    ['კლიენტი', 'რაოდენობა', 'ყოველთვიური გადასახადი', 'აქტიური'],
    ...data.storage.map((x) => [x.client, x.description, x.monthlyFee, x.active ? 'კი' : 'არა']),
    ['', '', data.storage.filter((x) => x.active).reduce((a, x) => a + x.monthlyFee, 0)],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(st), 'საწყობის შემოსავალი')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `NEXT_MOVE_FINANCIAL_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

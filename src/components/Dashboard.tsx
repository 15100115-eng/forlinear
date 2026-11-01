import { useMemo } from 'react'
import type { AppData, Order } from '../types'
import { fmtMoney, fmtMonth, fmtPct, monthKey, monthReports, opexGel, orderTotals } from '../calc'
import type { Lang, TKey } from '../i18n'
import { Card, StatTile } from './ui'
import { GroupedBars, HorizontalBars, SegmentedBar, SignedBars, useColors } from './charts'
import { OrdersTable } from './Orders'

export function Dashboard({
  data,
  t,
  lang,
  month,
  onEdit,
  goOrders,
}: {
  data: AppData
  t: (k: TKey) => string
  lang: Lang
  month: string
  onEdit: (o: Order) => void
  goOrders: () => void
}) {
  const c = useColors()
  const reports = useMemo(() => monthReports(data), [data])
  const scoped = useMemo(
    () => data.orders.filter((o) => month === 'all' || monthKey(o.date) === month).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    [data, month],
  )
  const totals = scoped.map((o) => ({ o, t: orderTotals(o, data.settings) }))
  const sum = (f: (x: { profit: number; netRevenue: number; totalExpense: number; laborCosts: number; tax: number; materials: number; otherCosts: number }) => number) => totals.reduce((a, x) => a + f(x.t), 0)
  const netRevenue = sum((x) => x.netRevenue)
  const expenses = sum((x) => x.totalExpense)
  const profit = sum((x) => x.profit)
  const lossOrders = totals.filter((x) => x.t.profit < 0)
  const labor = sum((x) => x.laborCosts)
  const tax = sum((x) => x.tax)
  const materials = sum((x) => x.materials)
  const other = sum((x) => x.otherCosts)

  const storageMonthly = data.storage.filter((s) => s.active).reduce((a, s) => a + s.monthlyFee, 0)
  const monthsCount = month === 'all' ? Math.max(1, reports.length) : 1
  const opexScoped = data.opex.filter((x) => month === 'all' || monthKey(x.date) === month)
  const ads = opexScoped.filter((x) => x.category === 'ads').reduce((a, x) => a + opexGel(x, data.settings), 0)
  const opexOther = opexScoped.filter((x) => x.category !== 'ads').reduce((a, x) => a + opexGel(x, data.settings), 0)
  const otherIncome = storageMonthly * monthsCount
  const netResult = profit + otherIncome - ads - opexOther

  const cur = month === 'all' ? null : reports.find((r) => r.month === month)
  const prevIdx = cur ? reports.findIndex((r) => r.month === month) - 1 : -1
  const prev = prevIdx >= 0 ? reports[prevIdx] : null
  const delta = (k: 'profit' | 'netRevenue' | 'expenses') => (cur && prev ? cur[k] - prev[k] : null)

  const deltaNet = cur && prev ? cur.netResult - prev.netResult : null
  const profitShare = profit * (data.settings.profitSharePct / 100)

  const monthlyData = reports.map((r) => ({ m: fmtMonth(r.month, lang), income: r.netRevenue + r.storage, cost: r.expenses + r.ads + r.opexOther }))
  const byOrder = totals.map(({ o, t }, i) => ({ n: String(i + 1), client: o.client, profit: t.profit, date: o.date }))

  const clients = useMemo(() => {
    const m = new Map<string, number>()
    for (const { o, t } of totals) m.set(o.client, (m.get(o.client) ?? 0) + t.profit)
    return [...m.entries()].map(([client, p]) => ({ client, profit: Math.round(p) })).sort((a, b) => b.profit - a.profit).slice(0, 6)
  }, [totals])

  return (
    <>
      <div className="grid kpis">
        <StatTile label={t('kpi_netResult')} value={fmtMoney(netResult)} delta={deltaNet} deltaLabel={t('vsPrev')} sub={t('kpi_netResult_sub')} hero />
        <StatTile label={t('kpi_profit')} value={fmtMoney(profit)} delta={delta('profit')} deltaLabel={t('vsPrev')} />
        <StatTile label={t('kpi_netRevenue')} value={fmtMoney(netRevenue)} delta={delta('netRevenue')} deltaLabel={t('vsPrev')} />
        <StatTile label={t('kpi_expenses')} value={fmtMoney(expenses)} delta={delta('expenses')} deltaLabel={t('vsPrev')} upIsGood={false} />
        <StatTile label={t('kpi_orders')} value={String(scoped.length)} sub={`${t('kpi_lossOrders')}: ${lossOrders.length}`} />
        <StatTile label={t('kpi_avgProfit')} value={fmtMoney(scoped.length ? profit / scoped.length : 0)} sub={`${t('kpi_margin')}: ${fmtPct(netRevenue ? profit / netRevenue : 0)}`} />
        <StatTile label={t('kpi_remaining')} value={fmtMoney(profit - profitShare)} sub={`${t('kpi_profitShare')} ${data.settings.profitSharePct}%: ${fmtMoney(profitShare)}`} />
        <StatTile label={t('kpi_ads')} value={fmtMoney(ads)} delta={cur && prev ? cur.ads - prev.ads : null} deltaLabel={t('vsPrev')} upIsGood={false} sub={scoped.length ? `${t('adsPerOrder')}: ${fmtMoney(ads / scoped.length)}` : undefined} />
        <StatTile label={t('kpi_storage')} value={fmtMoney(otherIncome)} sub={`${fmtMoney(storageMonthly)}/${t('month').toLowerCase()} × ${monthsCount}`} />
      </div>

      <div className="grid three section">
        <Card title={t('chart_monthly')}>
          {monthlyData.length ? (
            <GroupedBars
              data={monthlyData}
              xKey="m"
              series={[
                { key: 'income', label: t('series_income'), color: c.s1 },
                { key: 'cost', label: t('series_totalCost'), color: c.s2 },
              ]}
            />
          ) : (
            <div className="empty">{t('noData')}</div>
          )}
        </Card>
        <Card title={t('chart_expenseBreakdown')} sub={fmtMoney(expenses + ads + opexOther)}>
          <SegmentedBar
            parts={[
              { label: t('cat_labor'), value: labor, color: c.s1 },
              { label: t('cat_tax'), value: tax, color: c.s2 },
              { label: t('cat_materials'), value: materials, color: c.s3 },
              { label: t('cat_other'), value: other, color: c.s4, darkInk: true },
              { label: t('cat_ads'), value: ads, color: c.s5 },
              { label: t('cat_opexOther'), value: opexOther, color: c.s7 },
            ]}
          />
        </Card>
      </div>

      <div className="grid two section">
        <Card title={t('chart_profitByOrder')} sub={month === 'all' ? t('allMonths') : fmtMonth(month, lang, true)}>
          {byOrder.length ? (
            <SignedBars data={byOrder} xKey="n" valueKey="profit" posLabel={t('series_profit')} negLabel={t('series_loss')} title={(p) => `${p.client as string}`} />
          ) : (
            <div className="empty">{t('noData')}</div>
          )}
        </Card>
        <Card title={t('chart_topClients')}>
          {clients.length ? <HorizontalBars data={clients} valueKey="profit" labelKey="client" color={c.s1} /> : <div className="empty">{t('noData')}</div>}
        </Card>
      </div>

      <div className="section">
        <Card
          title={t('recentOrders')}
          right={
            <button className="btn sm ghost" onClick={goOrders}>
              {t('viewAll')} →
            </button>
          }
        >
          <OrdersTable orders={[...scoped].reverse().slice(0, 8)} data={data} t={t} lang={lang} onEdit={onEdit} compact />
        </Card>
      </div>
    </>
  )
}

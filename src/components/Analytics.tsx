import { useMemo } from 'react'
import type { AppData } from '../types'
import { fmtMonth, fmtPct, lineAmount, monthKey, monthReports, orderTotals } from '../calc'
import type { Lang, TKey } from '../i18n'
import { Card, Money } from './ui'
import { GroupedBars, HorizontalBars, useColors } from './charts'

export function Analytics({ data, t, lang, month }: { data: AppData; t: (k: TKey) => string; lang: Lang; month: string }) {
  const c = useColors()
  const reports = useMemo(() => monthReports(data), [data])
  const scoped = data.orders.filter((o) => month === 'all' || monthKey(o.date) === month)

  const clients = useMemo(() => {
    const m = new Map<string, { n: number; revenue: number; profit: number }>()
    for (const o of scoped) {
      const tt = orderTotals(o, data.settings)
      const r = m.get(o.client) ?? { n: 0, revenue: 0, profit: 0 }
      r.n++
      r.revenue += tt.netRevenue
      r.profit += tt.profit
      m.set(o.client, r)
    }
    return [...m.entries()].map(([client, r]) => ({ client, ...r })).sort((a, b) => b.profit - a.profit)
  }, [scoped, data.settings])

  const payees = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of scoped) for (const l of o.expenses) if (l.kind !== 'material') m.set(l.name, (m.get(l.name) ?? 0) + lineAmount(l))
    return [...m.entries()].map(([name, amount]) => ({ name, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount).slice(0, 8)
  }, [scoped])

  const materials = useMemo(() => {
    const m = new Map<string, { qty: number; cost: number }>()
    for (const o of scoped) for (const l of o.expenses) if (l.kind === 'material') {
      const r = m.get(l.name) ?? { qty: 0, cost: 0 }
      r.qty += l.qty ?? 0
      r.cost += lineAmount(l)
      m.set(l.name, r)
    }
    return [...m.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.cost - a.cost)
  }, [scoped])

  const trend = reports.map((r) => ({ m: fmtMonth(r.month, lang), labor: r.labor, tax: r.tax, materials: r.materials, other: r.other, ads: r.ads }))
  const streams = reports.map((r) => ({ m: fmtMonth(r.month, lang), moving: r.movingProfit, sales: r.saleProfit, storage: r.storage }))

  return (
    <>
      <Card title={t('report_title')}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('month')}</th>
                <th className="num">{t('col_ordersCount')}</th>
                <th className="num">{t('col_netRevenue')}</th>
                <th className="num">{t('col_expense')}</th>
                <th className="num">{t('report_lossTotal')}</th>
                <th className="num">{t('report_profitableTotal')}</th>
                <th className="num">{t('report_profit')}</th>
                <th className="num">{t('col_margin')}</th>
                <th className="num">{t('report_share')} {data.settings.profitSharePct}%</th>
                <th className="num">{t('report_remaining')}</th>
                <th className="num">{t('report_ads')}</th>
                <th className="num">{t('report_netResult')}</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.month}>
                  <td>{fmtMonth(r.month, lang, true)}</td>
                  <td className="num">{r.orders}</td>
                  <td className="num">{r.netRevenue.toLocaleString()}</td>
                  <td className="num">{r.expenses.toLocaleString()}</td>
                  <td className="num"><Money v={r.lossTotal} /></td>
                  <td className="num">{r.profitableTotal.toLocaleString()}</td>
                  <td className="num"><Money v={r.profit} /></td>
                  <td className="num muted">{fmtPct(r.netRevenue ? r.profit / r.netRevenue : 0)}</td>
                  <td className="num">{r.profitShare.toLocaleString()}</td>
                  <td className="num"><Money v={r.remaining} /></td>
                  <td className="num">{(r.ads + r.opexOther).toLocaleString()}</td>
                  <td className="num"><Money v={r.netResult} /></td>
                </tr>
              ))}
              {reports.length > 1 && (
                <tr className="total">
                  <td>{t('total')}</td>
                  <td className="num">{reports.reduce((a, r) => a + r.orders, 0)}</td>
                  <td className="num">{reports.reduce((a, r) => a + r.netRevenue, 0).toLocaleString()}</td>
                  <td className="num">{reports.reduce((a, r) => a + r.expenses, 0).toLocaleString()}</td>
                  <td className="num"><Money v={reports.reduce((a, r) => a + r.lossTotal, 0)} /></td>
                  <td className="num">{reports.reduce((a, r) => a + r.profitableTotal, 0).toLocaleString()}</td>
                  <td className="num"><Money v={reports.reduce((a, r) => a + r.profit, 0)} /></td>
                  <td className="num"></td>
                  <td className="num">{reports.reduce((a, r) => a + r.profitShare, 0).toLocaleString()}</td>
                  <td className="num"><Money v={reports.reduce((a, r) => a + r.remaining, 0)} /></td>
                  <td className="num">{reports.reduce((a, r) => a + r.ads + r.opexOther, 0).toLocaleString()}</td>
                  <td className="num"><Money v={reports.reduce((a, r) => a + r.netResult, 0)} /></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid two section">
        <Card title={t('expense_trend')}>
          <GroupedBars
            data={trend}
            xKey="m"
            series={[
              { key: 'labor', label: t('cat_labor'), color: c.s1 },
              { key: 'tax', label: t('cat_tax'), color: c.s2 },
              { key: 'materials', label: t('cat_materials'), color: c.s3 },
              { key: 'other', label: t('cat_other'), color: c.s4 },
              { key: 'ads', label: t('cat_ads'), color: c.s5 },
            ]}
          />
        </Card>
        <Card title={t('chart_incomeStreams')}>
          <GroupedBars
            data={streams}
            xKey="m"
            series={[
              { key: 'moving', label: t('series_movingProfit'), color: c.s1 },
              { key: 'sales', label: t('series_saleProfit'), color: c.s3 },
              { key: 'storage', label: t('series_storage'), color: c.s2 },
            ]}
          />
        </Card>
      </div>

      <div className="grid two section">
        <Card title={t('clients_title')}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('col_client')}</th>
                  <th className="num">{t('col_ordersCount')}</th>
                  <th className="num">{t('col_netRevenue')}</th>
                  <th className="num">{t('col_profit')}</th>
                  <th className="num">{t('col_avgProfit')}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((r) => (
                  <tr key={r.client}>
                    <td>{r.client}</td>
                    <td className="num">{r.n}</td>
                    <td className="num">{Math.round(r.revenue).toLocaleString()}</td>
                    <td className="num"><Money v={r.profit} /></td>
                    <td className="num"><Money v={r.profit / r.n} /></td>
                  </tr>
                ))}
                {!clients.length && <tr><td colSpan={5} className="empty">{t('noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid" style={{ gap: 16 }}>
          <Card title={t('payees_title')}>
            {payees.length ? <HorizontalBars data={payees} valueKey="amount" labelKey="name" color={c.s2} /> : <div className="empty">{t('noData')}</div>}
          </Card>
          <Card title={t('materials_usage')}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('col_item')}</th>
                    <th className="num">{t('col_used')}</th>
                    <th className="num">{t('col_cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td className="num">{m.qty}</td>
                      <td className="num">{m.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!materials.length && <tr><td colSpan={3} className="empty">{t('noData')}</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

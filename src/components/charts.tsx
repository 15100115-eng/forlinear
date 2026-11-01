import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtCompact, fmtMoney } from '../calc'
import { Legend } from './ui'

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()

export function useColors() {
  return {
    s1: css('--s1') || '#2a78d6',
    s2: css('--s2') || '#eb6834',
    s3: css('--s3') || '#1baf7a',
    s4: css('--s4') || '#eda100',
    s5: css('--s5') || '#e87ba4',
    s7: css('--s7') || '#6250d6',
    critical: css('--critical') || '#d03b3b',
    grid: css('--grid') || '#e1e0d9',
    axis: css('--axis') || '#c3c2b7',
    muted: css('--muted') || '#898781',
    surface: css('--surface') || '#fcfcfb',
  }
}

interface TipRow { name: string; value: number; color?: string }
export function ChartTooltip({ active, payload, label, title }: { active?: boolean; payload?: { name: string; value: number; color?: string; payload?: Record<string, unknown> }[]; label?: string; title?: (p: Record<string, unknown>) => string }) {
  if (!active || !payload?.length) return null
  const rows: TipRow[] = payload.map((p) => ({ name: p.name, value: p.value, color: p.color }))
  const t = title && payload[0].payload ? title(payload[0].payload) : label
  return (
    <div className="tooltip">
      <div className="t">{t}</div>
      {rows.map((r) => (
        <div className="r" key={r.name}>
          <span>
            {r.color && <span className="swatch" style={{ background: r.color, display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6 }} />}
            {r.name}
          </span>
          <span>{fmtMoney(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export function GroupedBars({
  data,
  series,
  xKey,
  height = 260,
}: {
  data: Record<string, unknown>[]
  series: { key: string; label: string; color: string; stack?: string }[]
  xKey: string
  height?: number
}) {
  const c = useColors()
  const lastInStack = (s: { stack?: string }, i: number) => !s.stack || series.findLastIndex((x) => x.stack === s.stack) === i
  return (
    <div>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      <div className="chart-box" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
            <XAxis dataKey={xKey} tick={{ fill: c.muted, fontSize: 12 }} axisLine={{ stroke: c.axis }} tickLine={false} />
            <YAxis tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={48} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.4 }} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={24} stackId={s.stack} radius={lastInStack(s, i) ? [4, 4, 0, 0] : 0} stroke={s.stack ? c.surface : undefined} strokeWidth={s.stack ? 1 : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SignedBars({
  data,
  valueKey,
  xKey,
  posLabel,
  negLabel,
  height = 260,
  title,
}: {
  data: Record<string, unknown>[]
  valueKey: string
  xKey: string
  posLabel: string
  negLabel: string
  height?: number
  title?: (p: Record<string, unknown>) => string
}) {
  const c = useColors()
  const hasNeg = data.some((d) => (d[valueKey] as number) < 0)
  return (
    <div>
      {hasNeg && (
        <Legend
          items={[
            { label: posLabel, color: c.s1 },
            { label: negLabel, color: c.critical },
          ]}
        />
      )}
      <div className="chart-box" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke={c.grid} strokeWidth={1} />
            <XAxis dataKey={xKey} tick={{ fill: c.muted, fontSize: 12 }} axisLine={{ stroke: c.axis }} tickLine={false} interval={0} />
            <YAxis tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={48} />
            <Tooltip content={<ChartTooltip title={title} />} cursor={{ fill: c.grid, opacity: 0.4 }} />
            <Bar dataKey={valueKey} name={posLabel} maxBarSize={24} radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={(d[valueKey] as number) < 0 ? c.critical : c.s1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function HorizontalBars({ data, valueKey, labelKey, color, height }: { data: Record<string, unknown>[]; valueKey: string; labelKey: string; color: string; height?: number }) {
  const c = useColors()
  const h = height ?? Math.max(120, data.length * 34 + 20)
  return (
    <div className="chart-box" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid horizontal={false} stroke={c.grid} strokeWidth={1} />
          <XAxis type="number" tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
          <YAxis type="category" dataKey={labelKey} width={150} tick={{ fill: c.muted, fontSize: 12 }} axisLine={{ stroke: c.axis }} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: c.grid, opacity: 0.4 }} />
          <Bar dataKey={valueKey} name="" maxBarSize={20} radius={[0, 4, 4, 0]} label={{ position: 'right', fill: c.muted, fontSize: 12, formatter: (v: unknown) => fmtCompact(Number(v)) }}>
            {data.map((d, i) => (
              <Cell key={i} fill={(d[valueKey] as number) < 0 ? c.critical : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Tall segmented bar — one whole split into parts, with a legend listing names + amounts. */
export function SegmentedBar({ parts }: { parts: { label: string; value: number; color: string; darkInk?: boolean }[] }) {
  const total = parts.reduce((a, p) => a + Math.max(0, p.value), 0)
  if (!total) return <div className="empty">—</div>
  return (
    <div>
      <div className="segbar" role="img" aria-label={parts.map((p) => `${p.label}: ${fmtMoney(p.value)}`).join(', ')}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const share = p.value / total
            return (
              <div key={p.label} className={`seg ${p.darkInk ? 'dark-ink' : ''}`} style={{ width: `${share * 100}%`, background: p.color }} title={`${p.label}: ${fmtMoney(p.value)} (${Math.round(share * 100)}%)`}>
                {share > 0.12 && <span>{Math.round(share * 100)}%</span>}
              </div>
            )
          })}
      </div>
      <div className="seg-legend">
        {parts.map((p) => (
          <div key={p.label} style={{ display: 'contents' }}>
            <div className="k">
              <span className="swatch" style={{ background: p.color, width: 10, height: 10, borderRadius: 3, display: 'inline-block' }} /> {p.label}
            </div>
            <div className="v">{fmtMoney(p.value)}</div>
            <div className="p">{total ? Math.round((p.value / total) * 100) : 0}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

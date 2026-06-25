import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import type { RegionalPoint } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

export default function RegionalChart({ data }: { data: RegionalPoint[] }) {
  const t = useT()

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        {t('general.no_data')}
      </div>
    )
  }

  const top = data.slice(0, 15)
  const max = top[0]?.order_count ?? 1
  const totalOrders = top.reduce((s, d) => s + d.order_count, 0)
  const chartH = Math.max(180, top.length * 30)

  return (
    <div className="h-full overflow-y-auto">
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 90, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="regionBarGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="region"
            width={115}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(59,130,246,0.05)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as RegionalPoint
              return (
                <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="font-semibold text-white mb-1">{d.region}</p>
                  <p className="text-slate-300">{d.order_count} ta buyurtma</p>
                  <p className="text-blue-400 mt-0.5">{fmtSum(d.total_sum, true)} so'm</p>
                </div>
              )
            }}
          />
          <Bar dataKey="order_count" radius={[0, 3, 3, 0]} maxBarSize={16} animationDuration={500}>
            <LabelList
              dataKey="order_count"
              position="right"
              style={{ fill: '#64748b', fontSize: 10 }}
              formatter={(v: number) => {
                const pct = totalOrders > 0 ? ((v / totalOrders) * 100).toFixed(1) : '0'
                return `${v.toLocaleString()} · ${pct}%`
              }}
            />
            {top.map((entry, i) => (
              <Cell
                key={i}
                fill="url(#regionBarGrad)"
                fillOpacity={0.35 + (entry.order_count / max) * 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

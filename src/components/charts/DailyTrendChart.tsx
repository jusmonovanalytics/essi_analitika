import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { DailyPoint } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

function DayTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const orders = payload.find(p => p.dataKey === 'order_count')
  const sum    = payload.find(p => p.dataKey === 'total_sum')
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[150px]">
      <p className="text-slate-400 font-medium mb-1.5">{label}</p>
      {orders && <p className="text-white font-bold">{orders.value} ta buyurtma</p>}
      {sum    && <p className="text-emerald-400 mt-0.5">{fmtSum(sum.value, true)} so'm</p>}
    </div>
  )
}

export default function DailyTrendChart({ data }: { data: DailyPoint[] }) {
  const t = useT()
  const avg = data.length
    ? Math.round(data.reduce((s, d) => s + d.order_count, 0) / data.length)
    : 0

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        {t('general.no_data')}
      </div>
    )
  }

  const tickInterval = data.length > 20 ? Math.floor(data.length / 10) : data.length > 10 ? 1 : 0

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 18, left: -14, bottom: 0 }} barCategoryGap="32%">
        <defs>
          <linearGradient id="dailySumArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dailyBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke="rgba(148,163,184,0.05)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: '#475569', fontSize: 10 }}
          tickLine={false} axisLine={false}
          tickFormatter={v => v.slice(5)}
          interval={tickInterval}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#475569', fontSize: 9 }}
          tickLine={false} axisLine={false}
          width={28}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#374151', fontSize: 9 }}
          tickLine={false} axisLine={false}
          width={38}
          tickFormatter={v => fmtSum(v, true)}
        />
        <Tooltip content={<DayTooltip />} cursor={{ fill: 'rgba(148,163,184,0.04)' }} />
        {avg > 0 && (
          <ReferenceLine
            yAxisId="left"
            y={avg}
            stroke="#334155"
            strokeDasharray="4 4"
            label={{ value: `⌀ ${avg}`, fill: '#475569', fontSize: 9, position: 'insideTopRight' }}
          />
        )}
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="total_sum"
          fill="url(#dailySumArea)"
          stroke="#10B981"
          strokeWidth={1.5}
          dot={false}
          animationDuration={800}
        />
        <Bar
          yAxisId="left"
          dataKey="order_count"
          fill="url(#dailyBarGrad)"
          radius={[2, 2, 0, 0]}
          maxBarSize={22}
          animationDuration={500}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

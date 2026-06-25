import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import type { HourlyPoint } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

function HourTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: number }) {
  if (!active || !payload?.length) return null
  const orders = payload.find(p => p.dataKey === 'order_count')
  const sum    = payload.find(p => p.dataKey === 'total_sum')
  const h = String(label ?? 0).padStart(2, '0')
  const h1 = String((Number(label ?? 0) + 1) % 24).padStart(2, '0')
  return (
    <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm min-w-[140px]">
      <p className="text-slate-400 font-medium mb-1.5">{h}:00 — {h1}:00</p>
      {orders && (
        <p className="text-white font-bold">{orders.value} ta buyurtma</p>
      )}
      {sum && (
        <p className="text-blue-400 mt-0.5">{fmtSum(sum.value, true)} so'm</p>
      )}
    </div>
  )
}

export default function OrdersByHourChart({ data }: { data: HourlyPoint[] }) {
  const t = useT()
  const currentHour = new Date().getHours()
  const peakEntry = data.reduce(
    (mx, d) => d.order_count > mx.order_count ? d : mx,
    { hour: -1, order_count: 0, total_sum: 0 },
  )
  const peakHour = peakEntry.order_count > 0 ? peakEntry.hour : -1

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        {t('general.no_data')}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 14, left: -18, bottom: 0 }} barCategoryGap="28%">
        <defs>
          <linearGradient id="hourBarCurrent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.9} />
          </linearGradient>
          <linearGradient id="hourBarPeak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#B45309" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke="rgba(148,163,184,0.05)" vertical={false} />
        <XAxis
          dataKey="hour"
          tick={{ fill: '#475569', fontSize: 10 }}
          tickLine={false} axisLine={false}
          tickFormatter={h => h % 2 === 0 ? String(h).padStart(2, '0') : ''}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#475569', fontSize: 9 }}
          tickLine={false} axisLine={false}
          width={26}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#334155', fontSize: 9 }}
          tickLine={false} axisLine={false}
          width={30}
          tickFormatter={v => fmtSum(v, true)}
        />
        <Tooltip content={<HourTooltip />} cursor={{ fill: 'rgba(148,163,184,0.04)' }} />
        <Bar
          yAxisId="left"
          dataKey="order_count"
          radius={[3, 3, 0, 0]}
          maxBarSize={22}
          animationDuration={500}
        >
          <LabelList
            dataKey="order_count"
            position="top"
            style={{ fill: '#475569', fontSize: 9 }}
            formatter={(v: number) => {
              const max = Math.max(...data.map(d => d.order_count), 1)
              return v > max * 0.35 ? v : ''
            }}
          />
          {data.map((entry, i) => {
            const isCurrent = entry.hour === currentHour
            const isPeak    = entry.hour === peakHour && !isCurrent
            const isPast    = entry.hour < currentHour && !isCurrent
            if (isCurrent) return <Cell key={i} fill="url(#hourBarCurrent)" />
            if (isPeak)    return <Cell key={i} fill="url(#hourBarPeak)" />
            if (isPast)    return <Cell key={i} fill="#1E3A5F" fillOpacity={0.85} />
            return             <Cell key={i} fill="#1E293B" fillOpacity={0.5} />
          })}
        </Bar>
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="total_sum"
          stroke="#60A5FA"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          dot={false}
          animationDuration={800}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

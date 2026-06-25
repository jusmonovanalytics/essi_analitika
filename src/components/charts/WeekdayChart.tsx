import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import type { WeekdayPoint } from '../../types/api'
import { useT } from '../../i18n'

const WEEKDAY_KEYS = ['weekday.1','weekday.2','weekday.3','weekday.4','weekday.5','weekday.6','weekday.7']
const IS_WEEKEND = [false, false, false, false, false, true, true]
const FILL_WORK = '#3B82F6'
const FILL_REST = '#475569'

export default function WeekdayChart({ data }: { data: WeekdayPoint[] }) {
  const t = useT()

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        {t('general.no_data')}
      </div>
    )
  }

  // Normalize: average per weekday occurrence (orders / day_count)
  const chartData = data.map(d => ({
    name:     t(WEEKDAY_KEYS[d.weekday_num - 1] ?? 'weekday.1'),
    avg:      d.day_count > 0 ? Math.round(d.order_count / d.day_count) : 0,
    total:    d.order_count,
    weekend:  IS_WEEKEND[d.weekday_num - 1] ?? false,
    weekday_num: d.weekday_num,
  }))

  const maxAvg = Math.max(...chartData.map(d => d.avg), 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 44, left: 4, bottom: 0 }} barCategoryGap="18%">
        <defs>
          <linearGradient id="wdWorkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.75} />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 500 }}
          tickLine={false} axisLine={false}
          width={28}
        />
        <Tooltip
          cursor={{ fill: 'rgba(59,130,246,0.05)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl min-w-[150px]">
                <p className="font-semibold text-white mb-1">{d.name}</p>
                <p className="text-white font-bold">{t('chart.weekday_avg')}: {d.avg}</p>
                <p className="text-blue-400 mt-0.5">{t('chart.weekday_total')}: {d.total.toLocaleString()}</p>
              </div>
            )
          }}
        />
        <Bar dataKey="avg" radius={[0, 3, 3, 0]} maxBarSize={22} animationDuration={500}>
          <LabelList
            dataKey="avg"
            position="right"
            style={{ fill: '#64748b', fontSize: 11 }}
          />
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.weekend ? FILL_REST : FILL_WORK}
              fillOpacity={entry.weekend ? 0.5 : 0.55 + (entry.avg / maxAvg) * 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

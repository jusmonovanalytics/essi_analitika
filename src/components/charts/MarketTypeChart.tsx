import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { MarketTypePoint } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#64748B',
]

export default function MarketTypeChart({ data }: { data: MarketTypePoint[] }) {
  const t = useT()
  const total = data.reduce((s, d) => s + d.order_count, 0)

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        {t('general.no_data')}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Donut */}
      <div className="relative flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((_, i) => (
                <radialGradient key={i} id={`mtG${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={PALETTE[i % PALETTE.length]} stopOpacity={1} />
                  <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.6} />
                </radialGradient>
              ))}
            </defs>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius="48%"
              outerRadius="78%"
              paddingAngle={2}
              dataKey="order_count"
              animationDuration={650}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#mtG${i})`} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as MarketTypePoint
                return (
                  <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[210px]">
                    <p className="font-semibold text-white mb-1 truncate">{d.market_type}</p>
                    <p className="text-white">{d.order_count.toLocaleString()} ta · {d.share_pct.toFixed(1)}%</p>
                    <p className="text-blue-400 mt-0.5">{fmtSum(d.total_sum, true)} so'm</p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-white tabular-nums leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">{t('general.orders_unit')}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 px-2 pb-1 flex-shrink-0 overflow-y-auto" style={{ maxHeight: '48%' }}>
        {data.map((d, i) => {
          const color = PALETTE[i % PALETTE.length]
          return (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
              <span className="text-xs text-slate-400 flex-1 truncate">{d.market_type}</span>
              <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color }}>
                {d.share_pct.toFixed(1)}%
              </span>
              <span className="text-xs font-medium text-slate-200 tabular-nums flex-shrink-0 w-12 text-right">
                {d.order_count.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

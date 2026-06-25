import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PaymentPoint } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

const PAY_CFG: Record<string, { color: string; glow: string }> = {
  cash:  { color: '#10B981', glow: 'rgba(16,185,129,0.25)' },
  bank:  { color: '#3B82F6', glow: 'rgba(59,130,246,0.25)' },
  other: { color: '#64748B', glow: 'rgba(100,116,139,0.15)' },
}

export default function PaymentChart({ data }: { data: PaymentPoint[] }) {
  const t = useT()

  const chartData = data.map(d => ({
    ...d,
    label: d.payment_type === 'cash' ? t('payment.cash')
         : d.payment_type === 'bank' ? t('payment.bank')
         : t('payment.other'),
    color: (PAY_CFG[d.payment_type] ?? PAY_CFG.other).color,
  }))

  const total = chartData.reduce((s, d) => s + d.order_count, 0)

  if (!chartData.length) {
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
              {chartData.map((d, i) => (
                <radialGradient key={i} id={`payG${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={d.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={d.color} stopOpacity={0.65} />
                </radialGradient>
              ))}
            </defs>
            <Pie
              data={chartData}
              cx="50%" cy="50%"
              innerRadius="52%"
              outerRadius="82%"
              paddingAngle={3}
              dataKey="order_count"
              animationDuration={650}
              strokeWidth={0}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={`url(#payG${i})`} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload
                return (
                  <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                    <p className="font-semibold mb-1" style={{ color: d.color }}>{d.label}</p>
                    <p className="text-white">{d.order_count} ta · {d.share_pct.toFixed(1)}%</p>
                    <p className="text-slate-400 mt-0.5">{fmtSum(d.total_sum, true)} so'm</p>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-white tabular-nums leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">{t('general.orders_unit')}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 px-2 pb-1 flex-shrink-0">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ background: d.color }}
            />
            <span className="text-xs text-slate-400 flex-1">{d.label}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: d.color }}>
              {d.share_pct.toFixed(1)}%
            </span>
            <span className="text-xs font-medium text-slate-200 tabular-nums w-10 text-right">{d.order_count}</span>
            <span className="text-xs text-slate-600 tabular-nums w-16 text-right">
              {fmtSum(d.total_sum, true)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

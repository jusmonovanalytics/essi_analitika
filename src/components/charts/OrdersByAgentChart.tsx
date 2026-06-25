import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import type { AgentChartPoint } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

const RANK_FILLS = [
  '#F59E0B',  // 1 — oltin
  '#94A3B8',  // 2 — kumush
  '#F97316',  // 3 — bronza
  '#3B82F6',  // 4
  '#2563EB',  // 5
  '#1D4ED8',  // 6
  '#1E40AF',  // 7
  '#1E3A8A',  // 8
  '#172554',  // 9
  '#0F172A',  // 10
]

export default function OrdersByAgentChart({ agents }: { agents: AgentChartPoint[] }) {
  const t = useT()

  const data = agents.slice(0, 10).map((a, i) => ({
    name:  a.user_name.split(' ')[0],
    full:  a.user_name,
    orders: a.order_count,
    sum:    a.total_sum,
    rank:   i + 1,
    color:  RANK_FILLS[i] ?? '#0F172A',
  }))

  if (!data.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-600">
        {t('general.no_data')}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 4, bottom: 0 }} barCategoryGap="22%">
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickLine={false} axisLine={false}
          width={68}
        />
        <Tooltip
          cursor={{ fill: 'rgba(59,130,246,0.05)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="font-semibold text-white mb-1">#{d.rank} {d.full}</p>
                <p className="text-white font-bold">{d.orders} ta buyurtma</p>
                <p className="text-blue-400 mt-0.5">{fmtSum(d.sum, true)} so'm</p>
              </div>
            )
          }}
        />
        <Bar dataKey="orders" radius={[0, 4, 4, 0]} maxBarSize={20} animationDuration={550}>
          <LabelList
            dataKey="orders"
            position="right"
            style={{ fill: '#64748b', fontSize: 11 }}
          />
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.color}
              fillOpacity={i < 3 ? 0.95 : 0.75}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

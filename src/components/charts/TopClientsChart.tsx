import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import type { ClientData } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

export default function TopClientsChart({ clients }: { clients: ClientData[] }) {
  const t = useT()

  const data = clients.slice(0, 10).map((c, i) => ({
    name:     c.client_name.length > 22 ? c.client_name.slice(0, 20) + '…' : c.client_name,
    fullName: c.client_name,
    sum:      c.total_sum,
    count:    c.order_count,
    rank:     i + 1,
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
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 68, left: 4, bottom: 0 }} barCategoryGap="22%">
        <defs>
          <linearGradient id="clientBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.75} />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false} axisLine={false}
          width={132}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.05)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl max-w-[230px]">
                <p className="font-semibold text-white mb-1">#{d.rank} {d.fullName}</p>
                <p className="text-blue-400 font-bold">{fmtSum(d.sum)} so'm</p>
                <p className="text-slate-400 mt-0.5">{d.count} ta buyurtma</p>
              </div>
            )
          }}
        />
        <Bar dataKey="sum" radius={[0, 3, 3, 0]} maxBarSize={18} animationDuration={550}>
          <LabelList
            dataKey="sum"
            position="right"
            style={{ fill: '#64748b', fontSize: 10 }}
            formatter={(v: unknown) => {
              const idx = data.findIndex(d => d.sum === Number(v))
              const count = idx >= 0 ? data[idx].count : 0
              return `${fmtSum(Number(v), true)} · ${count}ta`
            }}
          />
          {data.map((_entry, i) => (
            <Cell
              key={i}
              fill="url(#clientBarGrad)"
              style={{ opacity: 0.9 - i * 0.06 }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

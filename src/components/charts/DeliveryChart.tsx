import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import type { DeliveryData } from '../../types/api'
import { fmtSum } from '../../utils/formatters'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']

export function DeliveryBarChart({ deliveries }: { deliveries: DeliveryData[] }) {
  const data = deliveries.slice(0, 8).map(d => ({
    name:     d.delivery_man_name.split(' ')[0],
    fullName: d.delivery_man_name,
    count:    d.order_count,
    sum:      d.total_sum,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(148,163,184,0.08)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false} axisLine={false}
          angle={-20} textAnchor="end" interval={0}
        />
        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.05)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="glass-card px-3 py-2 text-xs shadow-glass">
                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{d.fullName}</p>
                <p className="text-white font-bold">{d.count} buyurtma</p>
                <p className="text-blue-400">{fmtSum(d.sum, true)} so'm</p>
              </div>
            )
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DeliveryPieChart({ deliveries }: { deliveries: DeliveryData[] }) {
  const data = deliveries.slice(0, 6).map(d => ({
    name:  d.delivery_man_name.split(' ')[0],
    value: d.order_count,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          cx="50%" cy="45%" outerRadius="60%" innerRadius="35%"
          paddingAngle={2}
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={{ stroke: '#475569', strokeWidth: 1 }}
        >
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Legend iconType="circle" iconSize={8}
          formatter={v => <span className="text-slate-400 text-xs">{v}</span>}
        />
        <Tooltip content={({ active, payload }) => {
          if (!active || !payload?.length) return null
          return (
            <div className="glass-card px-3 py-2 text-xs">
              <p className="text-white font-bold">{payload[0].name}: {payload[0].value}</p>
            </div>
          )
        }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

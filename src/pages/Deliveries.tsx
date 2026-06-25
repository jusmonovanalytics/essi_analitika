import { Truck, Package, Weight, MapPin } from 'lucide-react'
import DeliveryTable from '../components/tables/DeliveryTable'
import { DeliveryBarChart } from '../components/charts/DeliveryChart'
import { useDeliveriesExtended } from '../hooks/useAnalytics'
import { fmtSum } from '../utils/formatters'
import { useT } from '../i18n'

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="glass-card px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted truncate">{label}</p>
        <p className="text-lg font-bold text-primary leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Deliveries() {
  const t = useT()
  const { data: deliveries = [], isLoading } = useDeliveriesExtended(50)

  if (isLoading) {
    return (
      <div className="h-full animate-pulse space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-20" style={{ background: 'var(--bg-surface)' }} />
          ))}
        </div>
        <div className="glass-card h-80" style={{ background: 'var(--bg-surface)' }} />
      </div>
    )
  }

  const totalOrders  = deliveries.reduce((s, d) => s + d.order_count, 0)
  const totalSum     = deliveries.reduce((s, d) => s + d.total_sum, 0)
  const totalWeight  = deliveries.reduce((s, d) => s + d.total_weight, 0)
  const activeCount  = deliveries.length
  const avgPerDriver = activeCount > 0 ? Math.round(totalOrders / activeCount) : 0

  // Convert for DeliveryBarChart (uses DeliveryData type)
  const chartData = deliveries.slice(0, 8).map(d => ({
    delivery_man_id:   d.delivery_man_id,
    delivery_man_name: d.delivery_man_name,
    order_count:       d.order_count,
    total_sum:         d.total_sum,
    avg_order_sum:     d.avg_order_sum,
    rank:              d.rank,
  }))

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t('kpi.active_deliveries')}
            value={String(activeCount)}
            sub={`⌀ ${avgPerDriver} ${t('general.orders_unit')}`}
            icon={Truck}
            color="bg-blue-600/80"
          />
          <StatCard
            label={t('table.orders_count_col')}
            value={totalOrders.toLocaleString()}
            icon={Package}
            color="bg-emerald-600/80"
          />
          <StatCard
            label={t('kpi.revenue')}
            value={fmtSum(totalSum, true) + ' so\'m'}
            icon={MapPin}
            color="bg-purple-600/80"
          />
          <StatCard
            label={t('table.weight_col')}
            value={Math.round(totalWeight).toLocaleString() + ' kg'}
            sub={activeCount > 0 ? `⌀ ${Math.round(totalWeight / activeCount)} kg` : ''}
            icon={Weight}
            color="bg-amber-600/80"
          />
        </div>

        {/* Chart + Top 8 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 glass-card p-5">
            <div className="section-title mb-4">{t('chart.deliveries_top8')}</div>
            <div className="h-72">
              <DeliveryBarChart deliveries={chartData} />
            </div>
          </div>
          <div className="lg:col-span-7 glass-card p-5">
            <div className="section-title mb-4">{t('chart.deliveries_dist')}</div>
            <div className="h-72">
              {/* Reuse OrdersByAgentChart style — horizontal bar with ranks */}
              <DeliveryTopBar deliveries={deliveries.slice(0, 10)} />
            </div>
          </div>
        </div>

        {/* Full table */}
        <DeliveryTable deliveries={deliveries} />

      </div>
    </div>
  )
}

// ─── Top 10 horizontal bar ────────────────────────────────────────────────────
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import type { DeliveryExtData } from '../types/api'

const RANK_FILLS = [
  '#F59E0B','#94A3B8','#F97316',
  '#3B82F6','#2563EB','#1D4ED8','#1E40AF','#1E3A8A','#172554','#0F172A',
]

function DeliveryTopBar({ deliveries }: { deliveries: DeliveryExtData[] }) {
  const t = useT()
  const data = deliveries.map((d, i) => ({
    name:   d.delivery_man_name.split(' ')[0],
    full:   d.delivery_man_name,
    orders: d.order_count,
    sum:    d.total_sum,
    rank:   d.rank,
    color:  RANK_FILLS[i] ?? '#0F172A',
  }))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, left: 4, bottom: 0 }} barCategoryGap="22%">
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={68} />
        <Tooltip
          cursor={{ fill: 'rgba(59,130,246,0.05)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload
            return (
              <div className="bg-slate-900/95 border border-slate-700/50 rounded-lg px-3 py-2 text-xs shadow-xl">
                <p className="font-semibold text-white mb-1">#{d.rank} {d.full}</p>
                <p className="text-white font-bold">{d.orders} {t('general.orders_unit')}</p>
                <p className="text-blue-400 mt-0.5">{fmtSum(d.sum, true)} so'm</p>
              </div>
            )
          }}
        />
        <Bar dataKey="orders" radius={[0, 4, 4, 0]} maxBarSize={20} animationDuration={550}>
          <LabelList dataKey="orders" position="right" style={{ fill: '#64748b', fontSize: 11 }} />
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} fillOpacity={i < 3 ? 0.95 : 0.75} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

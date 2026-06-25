import { Users, TrendingUp, Banknote, ShoppingBag } from 'lucide-react'
import TopClientsChart from '../components/charts/TopClientsChart'
import { useClients } from '../hooks/useAnalytics'
import { fmtSum } from '../utils/formatters'
import { useT } from '../i18n'
import { useState } from 'react'

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

type SortKey = 'order_count' | 'total_sum'

export default function ClientsPage() {
  const t = useT()
  const { data: clients = [], isLoading } = useClients(50)
  const [sortKey, setSortKey] = useState<SortKey>('total_sum')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')

  if (isLoading) {
    return (
      <div className="h-full animate-pulse space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-20" style={{ background: 'var(--bg-surface)' }} />
          ))}
        </div>
        <div className="glass-card h-96" style={{ background: 'var(--bg-surface)' }} />
      </div>
    )
  }

  const totalSum    = clients.reduce((s, c) => s + c.total_sum, 0)
  const totalOrders = clients.reduce((s, c) => s + c.order_count, 0)
  const avgCheck    = clients.length > 0 ? totalSum / totalOrders : 0
  const avgPerClient = clients.length > 0 ? totalSum / clients.length : 0

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = clients.filter(c =>
    search === '' || c.client_name.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey]
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const hdr = (key: SortKey, label: string) => (
    <th
      className="px-4 py-3 text-right text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-300 select-none"
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        {sortKey === key && <span className="text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t('nav.clients')}
            value={clients.length.toLocaleString()}
            sub={t('analytics.top_n_clients').replace('{n}', String(clients.length))}
            icon={Users}
            color="bg-blue-600/80"
          />
          <StatCard
            label={t('kpi.revenue')}
            value={fmtSum(totalSum, true) + ' so\'m'}
            sub={`⌀ ${fmtSum(avgPerClient, true)} so'm`}
            icon={Banknote}
            color="bg-emerald-600/80"
          />
          <StatCard
            label={t('table.orders_count_col')}
            value={totalOrders.toLocaleString()}
            icon={ShoppingBag}
            color="bg-purple-600/80"
          />
          <StatCard
            label={t('kpi.avg_check')}
            value={fmtSum(avgCheck, true) + ' so\'m'}
            icon={TrendingUp}
            color="bg-amber-600/80"
          />
        </div>

        {/* Chart + Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* TopClients chart */}
          <div className="lg:col-span-5 glass-card p-5">
            <div className="section-title mb-4">{t('analytics.top_client')} TOP 10</div>
            <div className="h-80">
              <TopClientsChart clients={clients} />
            </div>
          </div>

          {/* Clients table */}
          <div className="lg:col-span-7 glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b gap-3" style={{ borderColor: 'var(--bg-card-border)' }}>
              <span className="section-title flex-shrink-0">{t('nav.clients')}</span>
              <input
                type="text"
                placeholder={t('table.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 max-w-xs text-xs rounded-md px-3 py-1.5 outline-none border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--bg-card-border)',
                  color: 'var(--text-primary)',
                }}
              />
              <span className="text-xs text-muted flex-shrink-0">{sorted.length} ta</span>
            </div>
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 380 }}>
              <table className="w-full text-sm table-pro">
                <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t('table.client')}</th>
                    {hdr('order_count', t('table.orders_count_col'))}
                    {hdr('total_sum', t('kpi.revenue'))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c, i) => (
                    <tr
                      key={c.client_id}
                      className="border-b transition-colors"
                      style={{ borderColor: 'var(--bg-card-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td className="px-4 py-2.5 text-muted text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 text-slate-200 font-medium text-sm max-w-[200px] truncate">{c.client_name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-white font-semibold">{c.order_count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-blue-400">{fmtSum(c.total_sum, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

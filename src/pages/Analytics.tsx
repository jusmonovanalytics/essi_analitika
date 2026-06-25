import OrdersByHourChart from '../components/charts/OrdersByHourChart'
import DailyTrendChart from '../components/charts/DailyTrendChart'
import RegionalChart from '../components/charts/RegionalChart'
import OrdersByAgentChart from '../components/charts/OrdersByAgentChart'
import PaymentChart from '../components/charts/PaymentChart'
import TopClientsChart from '../components/charts/TopClientsChart'
import WeekdayChart from '../components/charts/WeekdayChart'
import MarketTypeChart from '../components/charts/MarketTypeChart'
import { useCharts, useClients, useKpis, useDeliveries, useStatusStats, useChartsExtended } from '../hooks/useAnalytics'
import { fmtSum } from '../utils/formatters'
import { useT } from '../i18n'
import { STATUS_CONFIG } from '../types'
import { cn } from '../utils/cn'

function ChartHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <span className="section-title">{title}</span>
      {hint && <span className="text-xs text-muted ml-2">{hint}</span>}
    </div>
  )
}

// Status → solid bar color (Tailwind hex values)
const STATUS_BAR_COLORS: Record<string, string> = {
  '0': '#fbbf24',
  '1': '#60a5fa',
  '2': '#22d3ee',
  '3': '#c084fc',
  '5': '#34d399',
  '6': '#f87171',
}

// ─── Status distribution mini-chart ──────────────────────────────────────────

function StatusDistributionCard() {
  const t = useT()
  const { data: stats = [] } = useStatusStats()

  if (!stats.length) return null

  const maxCount  = Math.max(...stats.map(s => s.order_count), 1)
  const totalAll  = stats.reduce((s, d) => s + d.order_count, 0)
  const totalSum  = stats.reduce((s, d) => s + d.total_sum, 0)

  return (
    <div className="glass-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <span className="section-title">{t('analytics.status_dist')}</span>
        <span className="text-xs text-muted">{totalAll.toLocaleString()} ta</span>
      </div>
      <div className="space-y-3">
        {stats.map(s => {
          const cfg = STATUS_CONFIG[s.status]
          if (!cfg) return null
          const pct = (s.order_count / maxCount) * 100
          const barColor = STATUS_BAR_COLORS[s.status] ?? '#64748b'
          const sumShare = totalSum > 0 ? ((s.total_sum / totalSum) * 100).toFixed(0) : '0'
          return (
            <div key={s.status}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('badge border flex-none text-xs', cfg.bg, cfg.color)}>
                  {t('status.' + s.status)}
                </span>
                <div className="flex-1" />
                <span className="text-white tabular-nums font-bold text-sm">
                  {s.order_count.toLocaleString()}
                </span>
                <span className="text-slate-500 text-xs tabular-nums w-9 text-right">{s.share_pct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
                <span className="text-slate-600 text-xs tabular-nums w-20 text-right">{fmtSum(s.total_sum, true)} ({sumShare}%)</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Kunlik statistika jadvali ────────────────────────────────────────────────

function DailyStatsTable({ data }: { data: Array<{ day: string; order_count: number; total_sum: number; avg_check: number }> }) {
  const t = useT()
  if (!data.length) return null

  const totalOrders = data.reduce((s, d) => s + d.order_count, 0)
  const totalSum    = data.reduce((s, d) => s + d.total_sum, 0)
  const maxOrders   = Math.max(...data.map(d => d.order_count), 1)

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--bg-card-border)' }}>
        <h3 className="section-title">{t('analytics.daily_stats')}</h3>
        <span className="text-xs text-muted">{data.length} kun · {totalOrders.toLocaleString()} ta · {fmtSum(totalSum, true)} so'm</span>
      </div>
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 340 }}>
        <table className="w-full text-sm table-pro">
          <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
            <tr>
              <th className="px-4 py-2.5 text-left text-xs text-muted">{t('analytics.date_col')}</th>
              <th className="px-4 py-2.5 text-right text-xs text-muted">{t('table.orders_count_col')}</th>
              <th className="px-4 py-2.5 text-right text-xs text-muted">{t('table.amount')}</th>
              <th className="px-4 py-2.5 text-right text-xs text-muted">{t('kpi.avg_check')}</th>
              <th className="px-4 py-2.5 text-right text-xs text-muted">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => {
              const sharePct = totalOrders > 0 ? (d.order_count / totalOrders) * 100 : 0
              return (
                <tr key={d.day} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--bg-card-border)' }}>
                  <td className="px-4 py-2 text-primary text-sm font-medium">{d.day}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${(d.order_count / maxOrders) * 100}%` }} />
                      </div>
                      <span>{d.order_count.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-blue-400 text-sm">
                    {fmtSum(d.total_sum, true)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-400 text-sm">
                    {fmtSum(d.avg_check, true)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600 text-xs">
                    {sharePct.toFixed(1)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2" style={{ borderColor: 'rgba(148,163,184,0.15)' }}>
              <td className="px-4 py-2.5 text-xs font-bold text-slate-400">JAMI</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-sm font-bold text-white">{totalOrders.toLocaleString()}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold text-blue-300 text-sm">{fmtSum(totalSum, true)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-400 text-sm">
                {data.length > 0 ? fmtSum(totalSum / totalOrders, true) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right text-xs text-slate-600">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Period summary banner ────────────────────────────────────────────────────

interface PeriodBannerProps {
  daily: Array<{ day: string; order_count: number; total_sum: number; avg_check: number }>
  hourly: Array<{ hour: number; order_count: number; total_sum: number }>
  agentName?: string
  topRegion?: string
}

function PeriodBanner({ daily, hourly, agentName, topRegion }: PeriodBannerProps) {
  const t = useT()
  const totalOrders = daily.reduce((s, d) => s + d.order_count, 0)
  const totalSum    = daily.reduce((s, d) => s + d.total_sum, 0)
  const avgCheck    = totalOrders > 0 ? totalSum / totalOrders : 0
  const peakHour    = hourly.reduce((mx, h) => h.order_count > mx.order_count ? h : mx, { hour: -1, order_count: 0, total_sum: 0 })
  const peakOrders  = peakHour.order_count

  if (!totalOrders) return null

  const items = [
    { label: t('kpi.orders'),    value: totalOrders.toLocaleString(),      sub: `${daily.length} kun` },
    { label: t('kpi.revenue'),   value: fmtSum(totalSum, true) + ' so\'m', sub: undefined },
    { label: t('kpi.avg_check'), value: fmtSum(avgCheck, true) + ' so\'m', sub: undefined },
    { label: t('analytics.peak_hour'), value: peakHour.hour >= 0 ? `${String(peakHour.hour).padStart(2,'0')}:00` : '—', sub: peakOrders > 0 ? `${peakOrders} ta` : undefined },
    { label: t('analytics.top_agent'), value: agentName ? agentName.split(' ')[0] : '—', sub: undefined },
    { label: t('chart.regional_title').split(' ')[0] + ' #1', value: topRegion ?? '—', sub: undefined },
  ]

  return (
    <div className="glass-card px-5 py-3">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col min-w-0">
            <span className="text-xs text-muted leading-tight">{item.label}</span>
            <span className="text-sm font-bold text-primary tabular-nums leading-snug">{item.value}</span>
            {item.sub && <span className="text-xs text-muted">{item.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Analytics() {
  const t = useT()
  const { data: charts } = useCharts()
  const { data: clients = [] } = useClients(20)
  const { data: ext } = useChartsExtended()
  useKpis()
  useDeliveries()

  if (!charts) return <div className="p-8 text-center text-muted">{t('general.loading')}</div>

  const topAgent  = charts.agent_chart?.[0]?.user_name
  const topRegion = charts.regional?.[0]?.region

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5">

        {/* Period summary banner */}
        <PeriodBanner
          daily={charts.daily}
          hourly={charts.hourly}
          agentName={topAgent}
          topRegion={topRegion}
        />

        {/* Row 1: Hourly (wider) + Payment (donut) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 glass-card p-5">
            <ChartHeader title={t('chart.hourly_title')} hint="soat / buyurtma · so'm" />
            <div className="h-72">
              <OrdersByHourChart data={charts.hourly} />
            </div>
          </div>
          <div className="lg:col-span-5 glass-card p-5">
            <ChartHeader title={t('chart.payments_title')} />
            <div className="h-72">
              <PaymentChart data={charts.payments} />
            </div>
          </div>
        </div>

        {/* Row 2: Daily trend full width — taller */}
        <div className="glass-card p-5">
          <ChartHeader title={t('chart.daily_title')} hint="bar = buyurtmalar · chiziq = summa" />
          <div className="h-72">
            <DailyTrendChart data={charts.daily} />
          </div>
        </div>

        {/* Row 3: Regional + Agent side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 glass-card p-5 flex flex-col">
            <ChartHeader title={t('chart.regional_title')} hint={`${charts.regional.length} ta hudud`} />
            <div className="flex-1 min-h-0" style={{ minHeight: 280 }}>
              <RegionalChart data={charts.regional} />
            </div>
          </div>
          <div className="lg:col-span-6 glass-card p-5">
            <ChartHeader title={t('chart.agents_title')} hint="top 10" />
            <div className="h-80">
              <OrdersByAgentChart agents={charts.agent_chart} />
            </div>
          </div>
        </div>

        {/* Row 3.5: Weekday chart + Market type chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 glass-card p-5">
            <ChartHeader title={t('chart.weekday_title')} hint={t('chart.weekday_hint')} />
            <div className="h-64">
              <WeekdayChart data={ext?.weekday ?? []} />
            </div>
          </div>
          <div className="lg:col-span-7 glass-card p-5">
            <ChartHeader title={t('chart.market_type_title')} />
            <div className="h-64">
              <MarketTypeChart data={ext?.market_types ?? []} />
            </div>
          </div>
        </div>

        {/* Row 4: Status distribution + Daily stats table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4">
            <StatusDistributionCard />
          </div>
          <div className="lg:col-span-8">
            <DailyStatsTable data={charts.daily} />
          </div>
        </div>

        {/* Row 5: Top clients table + chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 glass-card p-5">
            <ChartHeader title={t('analytics.top_client')} hint="summa bo'yicha top 10" />
            <div className="h-80">
              <TopClientsChart clients={clients} />
            </div>
          </div>
          <div className="lg:col-span-7 glass-card overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--bg-card-border)' }}>
              <h3 className="section-title">{t('tv.clients_slide')}</h3>
              <span className="text-xs text-muted">TOP 20</span>
            </div>
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 360 }}>
              <table className="w-full text-sm table-pro">
                <thead className="sticky top-0" style={{ background: 'var(--bg-card)' }}>
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs text-muted w-8">#</th>
                    <th className="px-4 py-2.5 text-left text-xs text-muted">{t('table.client')}</th>
                    <th className="px-4 py-2.5 text-right text-xs text-muted">{t('table.orders_count_col')}</th>
                    <th className="px-4 py-2.5 text-right text-xs text-muted">{t('table.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={c.client_id} className="border-b hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--bg-card-border)' }}>
                      <td className="px-4 py-2 text-muted text-xs">{i + 1}</td>
                      <td className="px-4 py-2 text-primary text-sm">{c.client_name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-sm">{c.order_count}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-blue-400 text-sm">
                        {fmtSum(c.total_sum, true)}
                      </td>
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

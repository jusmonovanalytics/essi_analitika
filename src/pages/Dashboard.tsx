import KPICards from '../components/dashboard/KPICards'
import AgentMarathon from '../components/dashboard/AgentMarathon'
import LiveFeed from '../components/dashboard/LiveFeed'
import OrdersByHourChart from '../components/charts/OrdersByHourChart'
import DailyTrendChart from '../components/charts/DailyTrendChart'
import RegionalChart from '../components/charts/RegionalChart'
import PaymentChart from '../components/charts/PaymentChart'
import { useKpis, useAgents, useLiveOrders, useCharts } from '../hooks/useAnalytics'
import { AlertTriangle } from 'lucide-react'
import { useT } from '../i18n'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="h-full flex flex-col gap-3 animate-pulse">
      {/* KPI row */}
      <div className="flex-none grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-card h-24 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        ))}
      </div>

      {/* Main grid */}
      <div
        className="flex-1 min-h-0 grid gap-3"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}
      >
        {/* Charts column */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
            <div className="glass-card rounded-xl" style={{ background: 'var(--bg-surface)' }} />
            <div className="glass-card rounded-xl" style={{ background: 'var(--bg-surface)' }} />
          </div>
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
            <div className="glass-card rounded-xl" style={{ background: 'var(--bg-surface)' }} />
            <div className="glass-card rounded-xl" style={{ background: 'var(--bg-surface)' }} />
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 glass-card rounded-xl" style={{ background: 'var(--bg-surface)' }} />
          <div className="flex-none glass-card rounded-xl" style={{ background: 'var(--bg-surface)', height: '220px' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Error alert ──────────────────────────────────────────────────────────────

function Alert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
      <AlertTriangle size={18} className="flex-shrink-0" />
      {message}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const t = useT()
  const { data: kpis,       isLoading: kpisLoading,   error: kpisError  } = useKpis()
  const { data: agents,     isLoading: agentsLoading                     } = useAgents()
  const { data: liveOrders  } = useLiveOrders(20)
  const { data: charts      } = useCharts()

  if (kpisLoading || agentsLoading) return <LoadingSkeleton />
  if (kpisError) return <Alert message={t('alerts.backend_error')} />

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      {/* ── KPI row ── */}
      <div className="flex-none">
        <KPICards data={kpis!} />
      </div>

      {/* ── Main content grid ── */}
      <div
        className="flex-1 min-h-0 grid gap-3"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}
      >

        {/* ── Charts column (2×2) ── */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Top row: Hourly + Daily */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">

            <div className="glass-card p-4 flex flex-col min-h-0 overflow-hidden">
              <p className="flex-none section-title mb-2 text-xs">{t('chart.hourly_title')}</p>
              <div className="flex-1 min-h-0">
                <OrdersByHourChart data={charts?.hourly ?? []} />
              </div>
            </div>

            <div className="glass-card p-4 flex flex-col min-h-0 overflow-hidden">
              <p className="flex-none section-title mb-2 text-xs">{t('chart.daily_title')}</p>
              <div className="flex-1 min-h-0">
                <DailyTrendChart data={charts?.daily ?? []} />
              </div>
            </div>

          </div>

          {/* Bottom row: Regional + Payment */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">

            <div className="glass-card p-4 flex flex-col min-h-0 overflow-hidden">
              <p className="flex-none section-title mb-2 text-xs">{t('chart.regional_title')}</p>
              <div className="flex-1 min-h-0 overflow-hidden">
                <RegionalChart data={charts?.regional ?? []} />
              </div>
            </div>

            <div className="glass-card p-4 flex flex-col min-h-0 overflow-hidden">
              <p className="flex-none section-title mb-2 text-xs">{t('chart.payments_title')}</p>
              <div className="flex-1 min-h-0">
                <PaymentChart data={charts?.payments ?? []} />
              </div>
            </div>

          </div>

        </div>

        {/* ── Side panel ── */}
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">

          {/* Agent Marathon — fills remaining height, scrolls internally */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AgentMarathon agents={agents ?? []} maxVisible={20} />
          </div>

          {/* Live Feed — fixed height */}
          <div className="flex-none" style={{ height: '220px' }}>
            <LiveFeed orders={liveOrders ?? []} maxItems={20} />
          </div>

        </div>

      </div>
    </div>
  )
}

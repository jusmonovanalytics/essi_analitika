import AgentMarathon from '../components/dashboard/AgentMarathon'
import AgentTable from '../components/tables/AgentTable'
import OrdersByAgentChart from '../components/charts/OrdersByAgentChart'
import { useAgents, useCharts } from '../hooks/useAnalytics'
import { useT } from '../i18n'

export default function Agents() {
  const t = useT()
  const { data: agents = [], isLoading } = useAgents()
  const { data: charts } = useCharts()

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5" style={{ height: 560 }}>
          <div className="xl:col-span-2 glass-card" style={{ background: 'var(--bg-surface)' }} />
          <div className="xl:col-span-3 glass-card" style={{ background: 'var(--bg-surface)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5" style={{ minHeight: '560px' }}>
        <div className="xl:col-span-2">
          <AgentMarathon agents={agents} maxVisible={20} />
        </div>
        <div className="xl:col-span-3 glass-card p-5">
          <div className="section-title mb-4">{t('chart.agents_title')}</div>
          <div style={{ height: 'calc(100% - 2.5rem)' }}>
            <OrdersByAgentChart agents={charts?.agent_chart ?? []} />
          </div>
        </div>
      </div>

      <AgentTable agents={agents} />
    </div>
    </div>
  )
}

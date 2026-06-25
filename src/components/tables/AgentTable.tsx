import { useRef, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { AgentData } from '../../types/api'
import { MEDAL_CONFIG } from '../../types'
import { fmtSum, fmtPercent, agentInitials } from '../../utils/formatters'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'

type SortKey = 'order_count' | 'total_sum' | 'delivered_count' | 'deliveryRate' | 'avg_check' | 'share_pct'

export default function AgentTable({ agents }: { agents: AgentData[] }) {
  const t = useT()
  const [sortKey, setSortKey] = useState<SortKey>('order_count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const prevRanksRef = useRef<Map<number, number>>(new Map())

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...agents]
    .map(a => {
      const rate = a.order_count > 0 ? (a.delivered_count / a.order_count) * 100 : 0
      const prevRank = prevRanksRef.current.get(a.user_id) ?? a.daily_rank
      const rankChange = prevRank - a.daily_rank
      return { ...a, deliveryRate: rate, rankChange }
    })
    .sort((a, b) => {
      const av = a[sortKey as keyof typeof a] as number
      const bv = b[sortKey as keyof typeof b] as number
      return sortDir === 'asc' ? av - bv : bv - av
    })

  agents.forEach(a => prevRanksRef.current.set(a.user_id, a.daily_rank))

  const hdr = (key: SortKey, label: string) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
      onClick={() => handleSort(key)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey === key && <span className="text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  )

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--bg-card-border)' }}>
        <div className="section-title">{t('table.agents_title')}</div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{agents.length} {t('nav.agents').toLowerCase()}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-pro">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold w-12" style={{ color: 'var(--text-muted)' }}>{t('table.rank_col')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('table.agent')}</th>
              {hdr('order_count', t('table.orders_count_col'))}
              {hdr('delivered_count', t('kpi.delivered'))}
              {hdr('deliveryRate', t('kpi.delivery_rate'))}
              {hdr('total_sum', t('kpi.revenue'))}
              {hdr('avg_check', t('kpi.avg_check'))}
              {hdr('share_pct', t('table.share_col'))}
              <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{t('table.trend_col')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(agent => {
              const rank = agent.daily_rank
              const medal = MEDAL_CONFIG[rank - 1]
              const isTop3 = rank <= 3
              return (
                <tr key={agent.user_id}
                  className={cn('border-b transition-colors', isTop3 ? 'font-medium' : '')}
                  style={{ borderColor: 'var(--bg-card-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td className="px-4 py-3">
                    {isTop3
                      ? <span className="text-lg">{medal?.emoji}</span>
                      : <span className="text-slate-600 text-xs">{rank}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        isTop3 ? 'bg-blue-600/20 text-blue-300' : 'bg-slate-800 text-slate-400')}>
                        {agentInitials(agent.user_name)}
                      </div>
                      <p className="text-slate-200 font-medium">{agent.user_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white font-bold tabular-nums">{agent.order_count}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold tabular-nums">{agent.delivered_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full',
                          agent.deliveryRate >= 80 ? 'bg-emerald-500'
                          : agent.deliveryRate >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                          style={{ width: `${agent.deliveryRate}%` }} />
                      </div>
                      <span className={cn('text-xs font-medium',
                        agent.deliveryRate >= 80 ? 'text-emerald-400'
                        : agent.deliveryRate >= 50 ? 'text-amber-400' : 'text-red-400')}>
                        {fmtPercent(agent.deliveryRate)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-200 font-semibold tabular-nums">{fmtSum(agent.total_sum, true)}</td>
                  <td className="px-4 py-3 text-slate-400 tabular-nums text-xs">{fmtSum(agent.avg_check, true)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs tabular-nums">{agent.share_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    {agent.rankChange > 0
                      ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><TrendingUp size={12} />+{agent.rankChange}</span>
                      : agent.rankChange < 0
                      ? <span className="flex items-center gap-1 text-red-400 text-xs"><TrendingDown size={12} />{agent.rankChange}</span>
                      : <Minus size={12} className="text-slate-700" />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

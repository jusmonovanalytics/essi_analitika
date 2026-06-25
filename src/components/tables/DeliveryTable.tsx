import { useState } from 'react'
import type { DeliveryExtData } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'
import { MEDAL_CONFIG } from '../../types'

type SortKey = 'order_count' | 'total_sum' | 'avg_order_sum' | 'total_weight' | 'region_count'

export default function DeliveryTable({ deliveries }: { deliveries: DeliveryExtData[] }) {
  const t = useT()
  const [sortKey, setSortKey] = useState<SortKey>('order_count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...deliveries].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const totalOrders = deliveries.reduce((s, d) => s + d.order_count, 0)

  const hdr = (key: SortKey, label: string, right = false) => (
    <th
      className={cn('px-4 py-3 text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-300 select-none whitespace-nowrap', right ? 'text-right' : 'text-left')}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === key && <span className="text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </span>
    </th>
  )

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--bg-card-border)' }}>
        <span className="section-title">{t('table.deliveries_title')}</span>
        <span className="text-xs text-muted">{deliveries.length} {t('nav.deliveries').toLowerCase()}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-pro">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-10">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{t('table.delivery_man')}</th>
              {hdr('order_count', t('table.orders_count_col'), true)}
              {hdr('total_sum', t('kpi.revenue'), true)}
              {hdr('avg_order_sum', t('kpi.avg_check'), true)}
              {hdr('total_weight', t('table.weight_col'), true)}
              {hdr('region_count', t('table.regions_col'), true)}
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{t('table.share_col')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => {
              const rank = d.rank
              const medal = MEDAL_CONFIG[rank - 1]
              const isTop3 = rank <= 3
              const share = totalOrders > 0 ? (d.order_count / totalOrders) * 100 : 0
              const initials = d.delivery_man_name.split(' ').slice(0, 2).map(s => s[0] ?? '').join('')
              return (
                <tr
                  key={d.delivery_man_id}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--bg-card-border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td className="px-4 py-3">
                    {isTop3
                      ? <span className="text-lg">{medal?.emoji}</span>
                      : <span className="text-slate-600 text-xs">{rank}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                        isTop3 ? 'bg-emerald-600/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      )}>
                        {initials}
                      </div>
                      <span className="text-slate-200 font-medium text-sm">{d.delivery_man_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-bold tabular-nums">{d.order_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-200 font-semibold tabular-nums">{fmtSum(d.total_sum, true)}</td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">{fmtSum(d.avg_order_sum, true)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 tabular-nums text-xs">{d.total_weight.toLocaleString()} kg</td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums text-xs">{d.region_count}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums w-9 text-right">
                        {share.toFixed(1)}%
                      </span>
                    </div>
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

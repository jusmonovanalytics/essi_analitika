import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import type { LiveOrderData } from '../../types/api'
import { fmtSum } from '../../utils/formatters'
import { useT } from '../../i18n'

export default function LiveFeed({ orders, maxItems = 15 }: { orders: LiveOrderData[]; maxItems?: number }) {
  const t = useT()
  const [feedItems, setFeedItems] = useState<LiveOrderData[]>([])
  const prevIds = useRef(new Set<number>())
  const newIds  = useRef(new Set<number>())

  useEffect(() => {
    const latest = orders.slice(0, maxItems)
    const currentIds = new Set(latest.map(o => o.id))
    newIds.current = new Set([...currentIds].filter(id => !prevIds.current.has(id)))
    prevIds.current = currentIds
    setFeedItems(latest)
  }, [orders, maxItems])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Title row */}
      <div
        className="flex-none flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'var(--bg-card-border)' }}
      >
        <div className="section-title text-xs">
          <Zap size={14} className="text-blue-400" />
          {t('live.title')}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('live.realtime')}</span>
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence initial={false}>
          {feedItems.length === 0 ? (
            <div className="text-center text-xs py-6" style={{ color: 'var(--text-muted)' }}>
              {t('general.no_data')}
            </div>
          ) : (
            feedItems.map(order => {
              const isNew = newIds.current.has(order.id)

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="flex items-center gap-2 px-3 py-2 border-b transition-colors"
                  style={{
                    borderColor: 'var(--bg-card-border)',
                    background: isNew ? 'rgba(59,130,246,0.06)' : 'transparent',
                  }}
                >
                  {/* New indicator dot */}
                  {isNew
                    ? <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-none animate-pulse" />
                    : <span className="w-1.5 h-1.5 flex-none" />
                  }

                  {/* Order number - small */}
                  <span
                    className="text-xs tabular-nums flex-none"
                    style={{ color: 'var(--text-muted)', width: '2.5rem' }}
                  >
                    #{order.order_number}
                  </span>

                  {/* Client name */}
                  <span
                    className="text-xs flex-1 min-w-0 truncate font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {order.client_name}
                  </span>

                  {/* Agent first name */}
                  <span className="text-xs flex-none" style={{ color: 'var(--text-muted)' }}>
                    {order.user_name.split(' ')[0]}
                  </span>

                  {/* Amount */}
                  <span className="text-xs font-bold tabular-nums flex-none text-blue-400">
                    {fmtSum(order.fact_price, true)}
                  </span>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

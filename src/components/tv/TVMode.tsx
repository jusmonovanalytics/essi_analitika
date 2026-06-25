import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Activity, Trophy, BarChart3, Users } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useKpis, useAgents, useLiveOrders, useCharts, useClients, useDeliveries } from '../../hooks/useAnalytics'
import AgentMarathon from '../dashboard/AgentMarathon'
import LiveFeed from '../dashboard/LiveFeed'
import KPICards from '../dashboard/KPICards'
import OrdersByHourChart from '../charts/OrdersByHourChart'
import OrdersByAgentChart from '../charts/OrdersByAgentChart'
import TopClientsChart from '../charts/TopClientsChart'
import { fmtSum } from '../../utils/formatters'

const SLIDE_DURATION = 18_000
const slides = [
  { id: 'marathon', label: 'Agent Marafonu',  icon: Trophy },
  { id: 'kpi',      label: 'KPI Dashboard',   icon: Activity },
  { id: 'charts',   label: 'Analitika',        icon: BarChart3 },
  { id: 'clients',  label: 'Top Mijozlar',     icon: Users },
]

export default function TVMode() {
  const { setTvMode, wsConnected } = useAppStore()
  const { data: kpis }             = useKpis()
  const { data: agents = [] }      = useAgents()
  const { data: liveOrders = [] }  = useLiveOrders(15)
  const { data: charts }           = useCharts()
  const { data: clients = [] }     = useClients(20)
  const { data: deliveries = [] }  = useDeliveries()

  const [currentSlide, setCurrentSlide] = useState(0)
  const [progress, setProgress] = useState(0)

  const next = useCallback(() => {
    setCurrentSlide(s => (s + 1) % slides.length)
    setProgress(0)
  }, [])

  useEffect(() => {
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { next(); return 0 }
        return p + (100 / (SLIDE_DURATION / 100))
      })
    }, 100)
    return () => clearInterval(iv)
  }, [next])

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { document.exitFullscreen?.().catch(() => {}) }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTvMode(false)
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setCurrentSlide(s => (s - 1 + slides.length) % slides.length)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [next, setTvMode])

  const slide = slides[currentSlide]

  return (
    <div className="fixed inset-0 bg-[#020817] flex flex-col overflow-hidden dark">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-xl">ESSI Sales Command Center</p>
            <p className="text-slate-500 text-sm">OOO Milkolino Products</p>
          </div>
        </div>

        {kpis && (
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Buyurtmalar</p>
              <p className="text-white text-3xl font-bold">{kpis.total_orders}</p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Jami summa</p>
              <p className="text-blue-400 text-2xl font-bold">{fmtSum(kpis.total_sum, true)}</p>
            </div>
            <div className="w-px h-10 bg-slate-800" />
            <div className="text-center">
              <p className="text-slate-500 text-xs uppercase tracking-wider">Agentlar</p>
              <p className="text-white text-3xl font-bold">{kpis.active_agents}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-slate-400 text-sm">{wsConnected ? 'Live' : 'Auto-refresh'}</span>
          </div>
          <button onClick={() => setTvMode(false)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-slate-900 flex-shrink-0">
        <div className="h-full bg-blue-500 transition-none" style={{ width: `${progress}%` }} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-8 py-2 border-b border-slate-900 flex-shrink-0">
        {slides.map((s, i) => (
          <button key={s.id} onClick={() => { setCurrentSlide(i); setProgress(0) }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
              ${i === currentSlide ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-600 hover:text-slate-400'}`}>
            <s.icon size={14} />{s.label}
          </button>
        ))}
        <div className="ml-auto text-slate-700 text-xs">ESC = chiqish • ← → = almashtirish</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div key={slide.id}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }} className="h-full">

            {slide.id === 'marathon' && (
              <div className="grid grid-cols-3 gap-6 h-full">
                <div className="col-span-2 h-full"><AgentMarathon agents={agents} maxVisible={15} /></div>
                <div className="h-full"><LiveFeed orders={liveOrders} maxItems={12} /></div>
              </div>
            )}

            {slide.id === 'kpi' && kpis && (
              <div className="space-y-6 h-full flex flex-col">
                <KPICards data={kpis} />
                <div className="flex-1 grid grid-cols-2 gap-6">
                  <div className="glass-card p-5 h-full">
                    <p className="section-title mb-4">Soat bo'yicha buyurtmalar</p>
                    <div className="h-[calc(100%-2.5rem)]">
                      <OrdersByHourChart data={charts?.hourly ?? []} />
                    </div>
                  </div>
                  <div className="h-full"><AgentMarathon agents={agents} maxVisible={8} /></div>
                </div>
              </div>
            )}

            {slide.id === 'charts' && (
              <div className="grid grid-cols-2 gap-6 h-full">
                <div className="glass-card p-5">
                  <p className="section-title mb-4">Agent reytingi (buyurtma soni)</p>
                  <div className="h-[calc(100%-2.5rem)]">
                    <OrdersByAgentChart agents={charts?.agent_chart ?? []} />
                  </div>
                </div>
                <div className="glass-card p-5">
                  <p className="section-title mb-4">Soatlik faollik</p>
                  <div className="h-[calc(100%-2.5rem)]">
                    <OrdersByHourChart data={charts?.hourly ?? []} />
                  </div>
                </div>
              </div>
            )}

            {slide.id === 'clients' && (
              <div className="grid grid-cols-2 gap-6 h-full">
                <div className="glass-card p-5">
                  <p className="section-title mb-4">Top mijozlar (summa bo'yicha)</p>
                  <div className="h-[calc(100%-2.5rem)]">
                    <TopClientsChart clients={clients} />
                  </div>
                </div>
                <div className="glass-card p-5 overflow-hidden">
                  <p className="section-title mb-4">Yetkazuvchilar reytingi</p>
                  <div className="overflow-y-auto h-[calc(100%-2.5rem)] space-y-2">
                    {deliveries.slice(0, 12).map((d, i) => (
                      <div key={d.delivery_man_id} className="flex items-center gap-3 py-2 border-b border-slate-800/40">
                        <span className="text-slate-600 text-sm w-6 text-right">{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-slate-200 font-medium text-sm">{d.delivery_man_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="h-1 bg-slate-800 rounded-full flex-1 overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${(d.order_count / (deliveries[0]?.order_count || 1)) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                        <span className="text-white font-bold text-lg tabular-nums">{d.order_count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Clock */}
      <div className="flex items-center justify-center py-2 border-t border-slate-900 flex-shrink-0">
        <Clock />
      </div>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="text-slate-700 text-xs tabular-nums">
      {time.toLocaleString('ru-RU', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })}
    </div>
  )
}

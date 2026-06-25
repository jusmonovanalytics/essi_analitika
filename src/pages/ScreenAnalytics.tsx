import { useState } from 'react'
import {
  ComposedChart, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, LabelList, CartesianGrid, Area, ReferenceLine,
  PieChart, Pie, Cell as PieCell,
} from 'recharts'
import {
  RefreshCw, Activity, Wifi, WifiOff, AlertTriangle, X,
  ShoppingCart, DollarSign, TrendingUp, Users, Truck, CheckCircle2, Clock, Database,
  SlidersHorizontal, CalendarDays,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCharts, useKpis, useDeliveries, useAgents, useChartsExtended } from '../hooks/useAnalytics'
import { useAppStore } from '../store/useAppStore'
import { useT, useLangStore } from '../i18n'
import { fmtSum } from '../utils/formatters'
import type { RegionalPoint, MarketTypePoint, HourlyPoint, DeliveryData, KPIData } from '../types/api'
import type { DatePreset } from '../types'

const API = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8001'

// ─── Palette ──────────────────────────────────────────────────────────────────
const RANK_COLORS = ['#F59E0B','#94A3B8','#F97316','#3B82F6','#6366F1','#8B5CF6','#EC4899','#06B6D4']
const MT_COLORS   = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F97316','#64748B']

const PRESETS: { key: DatePreset; uz: string; ru: string }[] = [
  { key: 'today',     uz: 'Bugun',   ru: 'Сегодня' },
  { key: 'yesterday', uz: 'Kecha',   ru: 'Вчера'   },
  { key: 'week',      uz: 'Hafta',   ru: 'Неделя'  },
  { key: 'month',     uz: 'Oy',      ru: 'Месяц'   },
]

// ─── Excel-style multi-select dropdown ───────────────────────────────────────

// ─── Filter Bar ────────────────────────────────────────────────────────────────

function FilterBar() {
  const { dateRange, setCustomRange, setDatePreset } = useAppStore()
  const today = new Date().toISOString().slice(0, 10)

  const DATE_PRESETS: { label: string; key: DatePreset }[] = [
    { label: 'Bugun',   key: 'today'     },
    { label: 'Kecha',   key: 'yesterday' },
    { label: 'Hafta',   key: 'week'      },
    { label: 'Oy',      key: 'month'     },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{
      background: 'rgba(7,14,28,0.97)',
      borderBottom: '1px solid rgba(59,130,246,0.07)',
    }}>

      {/* ── Calendar date range ── */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border" style={{
        borderColor:'rgba(59,130,246,0.18)', background:'rgba(59,130,246,0.05)',
      }}>
        <CalendarDays size={11} style={{ color:'#3B82F6', flexShrink:0 }} />
        <input type="date" value={dateRange.from} max={dateRange.to}
          onChange={e => setCustomRange(e.target.value, dateRange.to)}
          className="text-xs font-mono outline-none bg-transparent border-none"
          style={{ color:'#93c5fd', colorScheme:'dark', width:102 }} />
        <span className="text-slate-700 text-xs">—</span>
        <input type="date" value={dateRange.to} min={dateRange.from} max={today}
          onChange={e => setCustomRange(dateRange.from, e.target.value)}
          className="text-xs font-mono outline-none bg-transparent border-none"
          style={{ color:'#93c5fd', colorScheme:'dark', width:102 }} />
      </div>

      {/* ── Quick date presets ── */}
      <div className="flex gap-0.5 rounded-md p-0.5" style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)' }}>
        {DATE_PRESETS.map(p => {
          const act = dateRange.preset === p.key
          return (
            <button key={p.key} onClick={() => setDatePreset(p.key)}
              className="px-2.5 py-1 rounded text-xs font-semibold transition-all"
              style={{
                background: act ? 'rgba(59,130,246,0.2)' : 'transparent',
                color:      act ? '#93c5fd' : '#374151',
                boxShadow:  act ? 'inset 0 0 0 1px rgba(59,130,246,0.3)' : 'none',
              }}>
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── RITM Sync status ─────────────────────────────────────────────────────────

interface AutoSyncInfo { running: boolean; today: string; today_count: number }
interface SyncLogMin  { id: number; status: string; error_msg: string | null; started_at: string; loaded: number }

function useRitmStatus() {
  const { data: sync } = useQuery<AutoSyncInfo>({
    queryKey: ['ritm-autosync'],
    queryFn: () => fetch(`${API}/api/data/autosync`).then(r => r.json()),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
  const { data: logs } = useQuery<SyncLogMin[]>({
    queryKey: ['ritm-logs-mini'],
    queryFn: () => fetch(`${API}/api/data/logs?limit=3`).then(r => r.json()),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
  const lastLog = logs?.[0]
  const hasError = lastLog?.status === 'error'
  return { sync, lastLog, hasError }
}

// Compact badge shown inside TopBar
function RitmBadge() {
  const { sync, hasError } = useRitmStatus()
  if (!sync) return null

  if (hasError) return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border" style={{
      background:'rgba(239,68,68,0.09)', borderColor:'rgba(239,68,68,0.25)', color:'#f87171',
    }}>
      <AlertTriangle size={9} />
      RITM Xatolik
    </div>
  )

  if (!sync.running) return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border" style={{
      background:'rgba(251,191,36,0.07)', borderColor:'rgba(251,191,36,0.2)', color:'#fbbf24',
    }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background:'#fbbf24' }} />
      RITM To'xtatilgan
    </div>
  )

  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border" style={{
      background:'rgba(52,211,153,0.07)', borderColor:'rgba(52,211,153,0.18)', color:'#34d399',
    }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#34d399', boxShadow:'0 0 4px #34d399' }} />
      RITM · {sync.today_count.toLocaleString()} ta
    </div>
  )
}

// Alert banner shown below TopBar when there's an error or sync is stopped
function SyncAlert() {
  const { sync, lastLog, hasError } = useRitmStatus()
  const [dismissed, setDismissed] = useState<string | null>(null)

  if (!sync) return null

  // Error state
  if (hasError && lastLog) {
    const key = `err-${lastLog.id}`
    if (dismissed === key) return null
    return (
      <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0" style={{
        background: 'rgba(239,68,68,0.08)',
        borderBottom: '1px solid rgba(239,68,68,0.2)',
      }}>
        <AlertTriangle size={13} style={{ color:'#f87171', flexShrink:0 }} />
        <p className="flex-1 text-xs" style={{ color:'#fca5a5' }}>
          <b>RITM sinxronizatsiya xatoligi:</b>{' '}
          {lastLog.error_msg ?? "Noma'lum xato — server loglarini tekshiring"}
          <span className="ml-2 text-red-800 text-xs">
            ({new Date(lastLog.started_at).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' })})
          </span>
        </p>
        <button onClick={() => setDismissed(key)}
          className="text-red-800 hover:text-red-500 transition-colors flex-shrink-0">
          <X size={13} />
        </button>
      </div>
    )
  }

  // Stopped state (no error, but auto-sync not running)
  if (!sync.running) {
    const key = 'stopped'
    if (dismissed === key) return null
    return (
      <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0" style={{
        background: 'rgba(251,191,36,0.06)',
        borderBottom: '1px solid rgba(251,191,36,0.15)',
      }}>
        <AlertTriangle size={13} style={{ color:'#fbbf24', flexShrink:0 }} />
        <p className="flex-1 text-xs" style={{ color:'#fde68a' }}>
          <b>Avtomatik sinxronizatsiya to'xtatilgan.</b>{' '}
          Bugungi buyurtmalar yangilanmayapti.
          {sync.today_count === 0
            ? " Ma'lumotlarni qo'lda yuklang."
            : ` Oxirgi ma'lumot: bugun ${sync.today_count.toLocaleString()} ta.`}
        </p>
        <button onClick={() => setDismissed(key)}
          className="text-yellow-800 hover:text-yellow-500 transition-colors flex-shrink-0">
          <X size={13} />
        </button>
      </div>
    )
  }

  return null
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
function TopBar({ onGoToData, showFilters, onToggleFilters }: {
  onGoToData?: () => void
  showFilters: boolean
  onToggleFilters: () => void
}) {
  const t = useT()
  const { lang, setLang } = useLangStore()
  const { wsConnected, filters } = useAppStore()
  const [spin, setSpin] = useState(false)
  const qc = useQueryClient()
  const refresh = () => { setSpin(true); qc.invalidateQueries(); setTimeout(() => setSpin(false), 900) }

  const activeFilterCount = Object.values(filters).filter(v => Array.isArray(v) ? v.length > 0 : v !== null).length

  return (
    <div className="flex items-center gap-2.5 px-5 py-2 flex-shrink-0" style={{
      background: 'rgba(7,16,31,0.98)',
      borderBottom: '1px solid rgba(59,130,246,0.12)',
      minHeight: 46,
    }}>
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{
          background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
          boxShadow: '0 0 12px rgba(59,130,246,0.4)',
        }}>
          <Activity size={14} className="text-white" />
        </div>
        <div>
          <p className="text-white font-extrabold text-sm leading-none">ESSI</p>
          <p className="text-blue-400/40 text-xs leading-none mt-0.5">Analytics</p>
        </div>
      </div>

      {/* Filter toggle button */}
      <button onClick={onToggleFilters}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
        style={{
          background:   showFilters ? 'rgba(59,130,246,0.15)' : activeFilterCount > 0 ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
          borderColor:  showFilters ? 'rgba(59,130,246,0.4)'  : activeFilterCount > 0 ? 'rgba(59,130,246,0.3)'  : 'rgba(255,255,255,0.07)',
          color:        showFilters ? '#93c5fd'                : activeFilterCount > 0 ? '#60a5fa'               : '#4b5563',
        }}>
        <SlidersHorizontal size={11} />
        Filtrlar
        {activeFilterCount > 0 && (
          <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black"
            style={{ background:'#3B82F6', color:'white', marginLeft:2 }}>
            {activeFilterCount}
          </span>
        )}
      </button>

      <div className="flex-1" />

      <RitmBadge />

      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border" style={{
        background:  wsConnected ? 'rgba(52,211,153,0.07)' : 'rgba(100,116,139,0.05)',
        borderColor: wsConnected ? 'rgba(52,211,153,0.2)'  : 'rgba(100,116,139,0.13)',
        color:       wsConnected ? '#34d399' : '#4b5563',
      }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{
          background: wsConnected ? '#34d399' : '#374151',
          boxShadow:  wsConnected ? '0 0 5px #34d399' : 'none',
        }} />
        {wsConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
        {wsConnected ? ' Live' : ' Offline'}
      </div>

      <button onClick={() => setLang(lang === 'uz' ? 'ru' : 'uz')}
        className="px-2.5 py-1 rounded-md text-xs font-bold border"
        style={{ borderColor:'rgba(148,163,184,0.12)', color:'#4b5563', background:'transparent' }}>
        {lang === 'uz' ? 'RU' : 'UZ'}
      </button>

      {onGoToData && (
        <button onClick={onGoToData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ background:'rgba(139,92,246,0.08)', borderColor:'rgba(139,92,246,0.2)', color:'#a78bfa' }}>
          <Database size={11} />
          Ma'lumotlar
        </button>
      )}
      <button onClick={refresh}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
        style={{ background:'rgba(59,130,246,0.08)', borderColor:'rgba(59,130,246,0.2)', color:'#60a5fa' }}>
        <RefreshCw size={11} className={spin ? 'animate-spin' : ''} />
        {t('header.refresh')}
      </button>
    </div>
  )
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, trend, icon: Icon, accent }: {
  label: string; value: string; sub?: string; trend?: number
  icon: React.ElementType; accent: string
}) {
  const up = (trend ?? 0) >= 0
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl flex-1 min-w-0 relative overflow-hidden" style={{
      background: 'rgba(15,23,42,0.82)',
      border: `1px solid ${accent}22`,
    }}>
      <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background:`linear-gradient(180deg,${accent},${accent}28)` }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
        background:`${accent}16`, border:`1px solid ${accent}28`,
      }}>
        <Icon size={14} style={{ color:accent }} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-black tabular-nums text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 leading-tight mt-0.5 truncate">{label}</p>
        {(trend !== undefined || sub) && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend !== undefined && (
              <span className="text-xs font-bold" style={{ color: up ? '#34d399' : '#f87171' }}>
                {up ? '↑' : '↓'}{Math.abs(trend).toFixed(1)}%
              </span>
            )}
            {sub && <span className="text-xs text-slate-700 truncate">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiRow({ d }: { d: KPIData }) {
  const t = useT()
  const pO  = d.prev.total_orders
  const trO = pO > 0 ? ((d.total_orders - pO) / pO) * 100 : undefined
  return (
    <div className="flex gap-1.5 px-2 py-1.5 flex-shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <KpiCard label={t('kpi.orders')}            value={d.total_orders.toLocaleString()}       trend={trO} sub={pO>0?`kecha: ${pO}`:''} icon={ShoppingCart}  accent="#3B82F6" />
      <KpiCard label={t('kpi.revenue')}           value={fmtSum(d.total_sum,true)+' so\'m'}                                               icon={DollarSign}    accent="#10B981" />
      <KpiCard label={t('kpi.avg_check')}         value={fmtSum(d.avg_check,true)+' so\'m'}                                               icon={TrendingUp}    accent="#8B5CF6" />
      <KpiCard label={t('kpi.active_agents')}     value={String(d.active_agents)}                                                         icon={Users}         accent="#F59E0B" />
      <KpiCard label={t('kpi.active_deliveries')} value={String(d.active_deliveries)}                                                     icon={Truck}         accent="#06B6D4" />
      <KpiCard label={t('kpi.delivered')}         value={String(d.delivered_orders)}                                                      icon={CheckCircle2}  accent="#34D399" />
      <KpiCard label={t('kpi.pending')}           value={String(d.pending_orders)}                                                        icon={Clock}         accent="#FBBF24" />
      <KpiCard label={t('kpi.delivery_rate')}     value={d.delivery_rate.toFixed(1)+'%'}                                                  icon={TrendingUp}    accent="#EC4899" />
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function Panel({ title, hint, accent = '#3B82F6', children, noPad }: {
  title: string; hint?: React.ReactNode; accent?: string; children: React.ReactNode; noPad?: boolean
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl" style={{
      background: 'rgba(7,16,31,0.88)',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div className="flex items-center justify-between px-4 pt-2.5 pb-2 flex-shrink-0" style={{
        borderBottom:'1px solid rgba(255,255,255,0.05)',
        minHeight: 38,
      }}>
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full" style={{ background:`linear-gradient(180deg,${accent},${accent}30)` }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color:'rgba(255,255,255,0.65)' }}>{title}</span>
        </div>
        {hint && <div className="text-xs tabular-nums">{hint}</div>}
      </div>
      <div className={`flex-1 min-h-0 ${noPad ? '' : 'p-1.5'}`}>{children}</div>
    </div>
  )
}

// ─── 1. Soatlar — timeline chart ──────────────────────────────────────────────
function HourlyPanel({ data }: { data: HourlyPoint[] }) {
  const now  = new Date().getHours()
  const peak = data.reduce((mx,d) => d.order_count>mx.order_count?d:mx, data[0] ?? { hour:-1, order_count:0, total_sum:0 })
  const maxV = Math.max(...data.map(d => d.order_count), 1)
  const avg  = data.length ? Math.round(data.reduce((s,d)=>s+d.order_count,0)/data.length) : 0

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 16, right: 56, left: -8, bottom: 0 }} barCategoryGap="20%">
        <defs>
          <linearGradient id="h_now"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.75} />
          </linearGradient>
          <linearGradient id="h_peak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#FCD34D" />
            <stop offset="100%" stopColor="#D97706" stopOpacity={0.8} />
          </linearGradient>
          <linearGradient id="h_biz" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1E40AF" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="h_night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0c1526" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#07101f" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="h_area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#A78BFA" stopOpacity={0.38} />
            <stop offset="85%"  stopColor="#A78BFA" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 10" stroke="rgba(148,163,184,0.05)" vertical={false} />
        <XAxis dataKey="hour" height={18}
          tick={({ x, y, payload }) => {
            const h = payload.value as number
            const isNow  = h === now
            const isPeak = h === peak.hour
            if (h % 3 !== 0 && !isNow && !isPeak) return <g />
            return (
              <text x={x} y={y+11} textAnchor="middle"
                fontSize={isNow || isPeak ? 10 : 9}
                fill={isNow ? '#60a5fa' : isPeak ? '#fcd34d' : '#374151'}
                fontWeight={isNow || isPeak ? 700 : 400}>
                {String(h).padStart(2,'0')}
              </text>
            )
          }}
          tickLine={false} axisLine={{ stroke:'rgba(255,255,255,0.05)' }}
        />
        <YAxis yAxisId="l" tick={{ fill:'#374151', fontSize:10 }} tickLine={false} axisLine={false} width={30}
               tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
        <YAxis yAxisId="r" orientation="right" tick={{ fill:'#3d2875', fontSize:9 }} tickLine={false} axisLine={false}
               width={46} tickFormatter={v => fmtSum(v,true)} />
        {avg > 0 && (
          <ReferenceLine yAxisId="l" y={avg} stroke="#1e3a5f" strokeDasharray="5 9"
            label={{ value:`⌀${avg}`, fill:'#2d4a6b', fontSize:9, position:'insideTopLeft' }} />
        )}
        <Tooltip cursor={{ fill:'rgba(99,102,241,0.05)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const h  = String(label ?? 0).padStart(2,'0')
            const h1 = String((Number(label??0)+1)%24).padStart(2,'0')
            const cnt = Number(payload.find(p=>p.dataKey==='order_count')?.value ?? 0)
            const sm  = Number(payload.find(p=>p.dataKey==='total_sum')?.value ?? 0)
            return (
              <div style={{ background:'rgba(7,16,31,0.97)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:10, padding:'10px 14px', fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', minWidth:170 }}>
                <p style={{ color:'#818cf8', fontWeight:700, marginBottom:6 }}>{h}:00 – {h1}:00</p>
                <p style={{ color:'#f1f5f9', fontWeight:800 }}>{cnt.toLocaleString()} ta buyurtma</p>
                <p style={{ color:'#a78bfa', marginTop:4, fontWeight:600 }}>{fmtSum(sm,true)} so'm</p>
              </div>
            )
          }}
        />
        <Area yAxisId="r" type="monotone" dataKey="total_sum"
          fill="url(#h_area)" stroke="#A78BFA" strokeWidth={2} dot={false} animationDuration={900} />
        <Bar yAxisId="l" dataKey="order_count" radius={[3,3,0,0]} maxBarSize={24} animationDuration={500}>
          <LabelList dataKey="order_count" position="top"
            style={{ fill:'#4b5563', fontSize:9, fontWeight:700 }}
            formatter={(v: number) => v >= maxV * 0.44 ? v.toLocaleString() : ''}
          />
          {data.map((e,i) => {
            const isCurr  = e.hour === now
            const isPeak  = e.hour === peak.hour && !isCurr
            const isNight = (e.hour < 7 || e.hour >= 22) && !isCurr && !isPeak
            if (isCurr)  return <Cell key={i} fill="url(#h_now)" />
            if (isPeak)  return <Cell key={i} fill="url(#h_peak)" />
            if (isNight) return <Cell key={i} fill="url(#h_night)" />
            return        <Cell key={i} fill="url(#h_biz)" />
          })}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── 2 & 3. Scrollable ranked list ───────────────────────────────────────────
interface RankedRow { name: string; full: string; orders: number; sum: number; color: string }

function RankedList({ rows }: { rows: RankedRow[] }) {
  if (!rows.length) return (
    <div className="h-full flex items-center justify-center text-xs text-slate-700">Ma'lumot yo'q</div>
  )
  const maxO = Math.max(...rows.map(r => r.orders), 1)
  return (
    <div className="h-full overflow-y-auto px-3 py-2 space-y-2"
      style={{ scrollbarWidth:'thin', scrollbarColor:'#1e3a5f transparent' }}>
      {rows.map((row, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold tabular-nums flex-shrink-0 w-4 text-right"
              style={{ color: i < 3 ? '#fbbf24' : 'rgba(100,116,139,0.45)' }}>
              {i + 1}
            </span>
            <span className="text-xs truncate flex-1 min-w-0"
              style={{ color: i < 3 ? '#d1d5db' : '#64748b', fontWeight: i < 3 ? 600 : 400 }}>
              {row.full}
            </span>
            <span className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color:'#f1f5f9' }}>
              {row.orders.toLocaleString()}
            </span>
            <span className="text-xs tabular-nums flex-shrink-0 w-20 text-right" style={{ color:'#a78bfa' }}>
              {fmtSum(row.sum, true)}
            </span>
          </div>
          <div className="h-2.5 rounded overflow-hidden" style={{ background:'rgba(255,255,255,0.03)' }}>
            <div style={{
              width: `${(row.orders / maxO) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${row.color}cc, ${row.color}33)`,
              borderRadius: '0 2px 2px 0',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 4. Regionlar — scrollable Recharts bar chart ────────────────────────────
function RegionBars({ data }: { data: RegionalPoint[] }) {
  if (!data.length) return (
    <div className="h-full flex items-center justify-center text-xs text-slate-700">Ma'lumot yo'q</div>
  )
  const ROW_H  = 38
  const totalH = Math.max(data.length * ROW_H + 24, 120)
  const totalO = data.reduce((s, d) => s + d.order_count, 0)
  const maxS   = Math.max(...data.map(d => d.total_sum), 1)

  const chartData = data.map(d => ({
    ...d,
    short:    d.region.length > 20 ? d.region.slice(0, 18) + '…' : d.region,
    share:    totalO > 0 ? +(d.order_count / totalO * 100).toFixed(1) : 0,
    sumRatio: d.total_sum / maxS,
  }))

  return (
    <div className="h-full overflow-y-auto"
      style={{ scrollbarWidth:'thin', scrollbarColor:'#1e3a5f transparent' }}>
      <div style={{ height: totalH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical"
            margin={{ top: 4, right: 138, left: 6, bottom: 4 }}
            barSize={14} barCategoryGap="18%">
            <defs>
              {chartData.map((d, i) => {
                const hue = Math.round(200 + d.sumRatio * 20)
                const sat = Math.round(55  + d.sumRatio * 40)
                const lit = Math.round(28  + d.sumRatio * 38)
                const c   = `hsl(${hue},${sat}%,${lit}%)`
                return (
                  <linearGradient key={i} id={`rb${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={c} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.3} />
                  </linearGradient>
                )
              })}
            </defs>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis dataKey="short" type="category" width={130}
              tick={({ x, y, payload, index: idx }) => (
                <text x={x - 4} y={y} textAnchor="end" dominantBaseline="middle"
                  fontSize={11} fontWeight={idx < 3 ? 600 : 400}
                  fill={idx < 3 ? '#d1d5db' : '#6b7280'}>
                  {payload.value}
                </text>
              )}
              tickLine={false} axisLine={false}
            />
            <Tooltip cursor={{ fill:'rgba(255,255,255,0.02)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const d = payload[0].payload as typeof chartData[0]
                return (
                  <div style={{ background:'rgba(7,16,31,0.97)', border:'1px solid rgba(56,189,248,0.25)', borderRadius:10, padding:'10px 14px', fontSize:12, minWidth:190 }}>
                    <p style={{ color:'#38bdf8', fontWeight:700, marginBottom:6 }}>{d.region}</p>
                    <p style={{ color:'#f1f5f9', fontWeight:800 }}>📦 {d.order_count.toLocaleString()} ta · {d.share}%</p>
                    <p style={{ color:'#a78bfa', marginTop:3, fontWeight:600 }}>💰 {fmtSum(d.total_sum, true)} so'm</p>
                    <p style={{ color:'#94a3b8', marginTop:3, fontSize:11 }}>⌀ {fmtSum(d.avg_check, true)} so'm</p>
                  </div>
                )
              }}
            />
            <Bar dataKey="order_count" radius={[0, 4, 4, 0]}>
              <LabelList
                content={(props: { x?: number; y?: number; width?: number; height?: number; value?: unknown; index?: number }) => {
                  const { x = 0, y = 0, width = 0, height = 0, value, index = 0 } = props
                  const d = chartData[index]
                  if (!d || !value) return null
                  const rx  = (x as number) + (width as number) + 8
                  const mid = (y as number) + (height as number) / 2
                  return (
                    <g>
                      <text x={rx} y={mid - 6} fill="#e2e8f0" fontSize={11} fontWeight={700} dominantBaseline="middle">
                        {Number(value).toLocaleString()} ta
                      </text>
                      <text x={rx} y={mid + 7} fill="#7c3aed" fontSize={10} dominantBaseline="middle">
                        {fmtSum(d.total_sum, true)}
                      </text>
                    </g>
                  )
                }}
              />
              {chartData.map((_, i) => <Cell key={i} fill={`url(#rb${i})`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── 5. Bozor turi ────────────────────────────────────────────────────────────
function MarketDonut({ data }: { data: MarketTypePoint[] }) {
  const total  = data.reduce((s,d) => s+d.order_count, 0)
  const totalS = data.reduce((s,d) => s+d.total_sum,   0)

  return (
    <div className="h-full flex gap-2 px-2 py-1">
      {/* Donut */}
      <div className="relative" style={{ flex:'0 0 42%', minWidth:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((_,i) => (
                <radialGradient key={i} id={`mtG${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor={MT_COLORS[i%MT_COLORS.length]} />
                  <stop offset="100%" stopColor={MT_COLORS[i%MT_COLORS.length]} stopOpacity={0.45} />
                </radialGradient>
              ))}
            </defs>
            <Pie data={data} cx="50%" cy="50%" innerRadius="44%" outerRadius="80%"
              paddingAngle={2} dataKey="order_count" animationDuration={700} strokeWidth={0}>
              {data.map((_,i) => <PieCell key={i} fill={`url(#mtG${i})`} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as MarketTypePoint
              return (
                <div style={{ background:'rgba(7,16,31,0.97)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 14px', fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', maxWidth:210 }}>
                  <p style={{ color:'#e2e8f0', fontWeight:700, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.market_type}</p>
                  <p style={{ color:'#f1f5f9', fontWeight:800 }}>📦 {d.order_count.toLocaleString()} ta · {d.share_pct.toFixed(1)}%</p>
                  <p style={{ color:'#a78bfa', marginTop:4, fontWeight:600 }}>💰 {fmtSum(d.total_sum,true)} so'm</p>
                </div>
              )
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-black text-white tabular-nums leading-none">{total.toLocaleString()}</span>
          <span className="text-xs text-slate-600 mb-1">ta buyurtma</span>
          <div className="w-8 h-px bg-slate-800" />
          <span className="text-sm font-bold mt-1 tabular-nums leading-none" style={{ color:'#a78bfa' }}>{fmtSum(totalS,true)}</span>
          <span className="text-xs text-slate-700">so'm</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="flex items-center gap-2 pb-1.5 mb-1 flex-shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span className="flex-1 text-xs font-bold text-slate-600 uppercase tracking-wide">Tur</span>
          <span className="text-xs font-bold text-slate-600 w-8 text-right">%</span>
          <span className="text-xs font-bold text-slate-600 w-14 text-right">Soni</span>
          <span className="text-xs font-bold text-slate-600 w-16 text-right">Summa</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
          {data.map((d,i) => {
            const c   = MT_COLORS[i%MT_COLORS.length]
            const pct = total > 0 ? (d.order_count/total)*100 : 0
            return (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:c, boxShadow:`0 0 4px ${c}70` }} />
                <span className="flex-1 min-w-0 truncate text-xs leading-tight" style={{ color:'rgba(148,163,184,0.8)' }}>{d.market_type}</span>
                <div className="w-8 h-1.5 rounded-full overflow-hidden bg-slate-900 flex-shrink-0">
                  <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:9999 }} />
                </div>
                <span className="text-xs font-bold tabular-nums w-8 text-right flex-shrink-0" style={{ color:c }}>{pct.toFixed(0)}%</span>
                <span className="text-xs font-semibold tabular-nums w-14 text-right flex-shrink-0" style={{ color:'#e2e8f0' }}>{d.order_count.toLocaleString()}</span>
                <span className="text-xs tabular-nums w-16 text-right flex-shrink-0" style={{ color:'#8b5cf6' }}>{fmtSum(d.total_sum,true)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ScreenAnalytics({ onGoToData }: { onGoToData?: () => void }) {
  const t = useT()
  const [showFilters, setShowFilters] = useState(false)
  const { data: charts, isLoading } = useCharts()
  const { data: kpis  }             = useKpis()
  const { data: agents = [] }       = useAgents()
  const { data: deliveries = [] }   = useDeliveries()
  const { data: ext   }             = useChartsExtended()

  const agentRows: RankedRow[] = agents.map((a, i) => ({
    name:   a.user_name.split(' ')[0],
    full:   a.user_name,
    orders: a.order_count,
    sum:    a.total_sum,
    color:  RANK_COLORS[i % RANK_COLORS.length],
  }))

  const delivRows: RankedRow[] = (deliveries as DeliveryData[]).map((d, i) => ({
    name:   d.delivery_man_name.split(' ')[0],
    full:   d.delivery_man_name,
    orders: d.order_count,
    sum:    d.total_sum,
    color:  RANK_COLORS[i % RANK_COLORS.length],
  }))

  const peak  = charts?.hourly.reduce((mx,d) => d.order_count>mx.order_count?d:mx, charts.hourly[0])
  const agTot = agentRows.reduce((s,r)=>s+r.orders,0)
  const agSum = agentRows.reduce((s,r)=>s+r.sum,0)
  const dlTot = delivRows.reduce((s,r)=>s+r.orders,0)
  const dlSum = delivRows.reduce((s,r)=>s+r.sum,0)
  const regD  = (charts?.regional ?? [])
  const regTot = regD.reduce((s,d)=>s+d.order_count,0)
  const regSum = regD.reduce((s,d)=>s+d.total_sum,0)

  const Hint = ({ cnt, sm, cc='#f1f5f9', sc='#a78bfa' }: { cnt:number; sm:number; cc?:string; sc?:string }) => (
    <span>
      <span style={{ color:cc, fontWeight:700 }}>{cnt.toLocaleString()}</span>
      <span style={{ color:'#374151' }}> ta · </span>
      <span style={{ color:sc, fontWeight:600 }}>{fmtSum(sm,true)} so'm</span>
    </span>
  )

  // Grid cell style
  const cell = (area: string): React.CSSProperties => ({
    gridArea: area, height: '100%', overflow: 'hidden',
  })

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background:'#07101f' }}>
      <TopBar onGoToData={onGoToData} showFilters={showFilters} onToggleFilters={() => setShowFilters(v => !v)} />
      <SyncAlert />
      {showFilters && <FilterBar />}
      {kpis && <KpiRow d={kpis} />}

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
            <span className="text-sm text-slate-600">{t('general.loading')}</span>
          </div>
        </div>
      )}

      {!isLoading && charts && (
        <div className="flex-1 min-h-0 p-2 grid gap-2" style={{
          gridTemplateColumns: '2.8fr 2fr 2fr',
          gridTemplateRows:    '44% 56%',
          gridTemplateAreas:   '"soat agnt dlvr" "rmap rmap bozr"',
        }}>

          <div style={cell('soat')}>
            <Panel title={t('chart.hourly_title')} accent="#6366F1"
              hint={peak
                ? <span>
                    <span style={{ color:'#818cf8' }}>faol: </span>
                    <span style={{ color:'#fcd34d', fontWeight:700 }}>{String(peak.hour).padStart(2,'0')}:00</span>
                    <span style={{ color:'#374151' }}> · </span>
                    <span style={{ color:'#f1f5f9', fontWeight:700 }}>{peak.order_count}ta</span>
                    <span style={{ color:'#374151' }}> · </span>
                    <span style={{ color:'#a78bfa' }}>{fmtSum(peak.total_sum,true)}</span>
                  </span>
                : null
              }>
              <HourlyPanel data={charts.hourly} />
            </Panel>
          </div>

          <div style={cell('agnt')}>
            <Panel title={t('nav.agents')} accent="#F59E0B"
              hint={<Hint cnt={agTot} sm={agSum} cc="#f59e0b" />}>
              <RankedList rows={agentRows} />
            </Panel>
          </div>

          <div style={cell('dlvr')}>
            <Panel title={t('nav.deliveries')} accent="#06B6D4"
              hint={<Hint cnt={dlTot} sm={dlSum} cc="#06b6d4" />}>
              <RankedList rows={delivRows} />
            </Panel>
          </div>

          <div style={cell('rmap')}>
            <Panel title={t('chart.regional_title')} accent="#38BDF8"
              hint={<Hint cnt={regTot} sm={regSum} cc="#38bdf8" sc="#34d399" />}>
              <RegionBars data={regD} />
            </Panel>
          </div>

          <div style={cell('bozr')}>
            <Panel title={t('chart.market_type_title')} accent="#8B5CF6">
              <MarketDonut data={ext?.market_types ?? []} />
            </Panel>
          </div>

        </div>
      )}
    </div>
  )
}

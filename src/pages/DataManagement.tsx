import { useState, useEffect } from 'react'
import {
  Database, Download, RefreshCw, Trash2, AlertTriangle,
  CheckCircle, Loader2, Activity, X, Square, Ban,
  ShieldAlert, Copy, Clock, Zap, ArrowLeft,
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'

import { adminSarlavha } from '../api/admin'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8001'

// Bu bo'limga faqat admin kiradi, lekin so'rovni server ham tekshiradi —
// shuning uchun har birida parol sarlavhasi ketadi.
async function apiGet(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: adminSarlavha() })
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}
async function apiPost(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params)
  const r = await fetch(`${BASE}${path}?${q}`, { method: 'POST', headers: adminSarlavha() })
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}
async function apiDelete(path: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params)
  const url = Object.keys(params).length ? `${BASE}${path}?${q}` : `${BASE}${path}`
  const r = await fetch(url, { method: 'DELETE', headers: adminSarlavha() })
  if (!r.ok) throw new Error(r.statusText)
  return r.json()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataStatus {
  total_orders: number
  last_sync: string | null
  oldest_day: string | null
  newest_day: string | null
  distinct_days: number
  table_size: string | null
  today_count: number
  today_last_sync: string | null
}
interface AutoSyncStatus {
  running: boolean
  today: string
  today_count: number
}
interface DupStats {
  total_rows: number
  unique_ids: number
  dup_by_id: number
  unique_order_numbers: number
  dup_by_order_num: number
}
interface SyncLog {
  id: number
  started_at: string
  finished_at: string | null
  date_from: string | null
  date_to: string | null
  date_field: string
  loaded: number
  skipped: number
  status: 'running' | 'success' | 'error' | 'cancelled'
  error_msg: string | null
  duration_ms: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const today     = format(new Date(), 'yyyy-MM-dd')
const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
const weekStart = format(subDays(new Date(), 6), 'yyyy-MM-dd')
const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
const lastMonthStart = format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')
const lastMonthEnd   = format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd')

const LOAD_PRESETS = [
  { label: 'Bugun',     from: today,          to: today,         key: 'today' },
  { label: 'Kecha',     from: yesterday,      to: yesterday,     key: 'yesterday' },
  { label: 'Bu hafta',  from: weekStart,      to: today,         key: 'week' },
  { label: 'Bu oy',     from: monthStart,     to: today,         key: 'month' },
  { label: "O'tgan oy", from: lastMonthStart, to: lastMonthEnd,  key: 'last_month' },
]

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function fmtDuration(ms: number | null) {
  if (ms == null) return '—'
  return ms < 1000 ? ms + ' ms' : Math.round(ms / 1000) + ' s'
}

// ─── Shared date-field toggle ─────────────────────────────────────────────────

function DateFieldToggle({
  value, onChange,
}: { value: 'created_date' | 'date_delivery'; onChange: (v: 'created_date' | 'date_delivery') => void }) {
  return (
    <div className="flex rounded overflow-hidden border" style={{ borderColor: 'var(--bg-card-border)' }}>
      {(['created_date', 'date_delivery'] as const).map(f => (
        <button key={f} onClick={() => onChange(f)}
          className={`px-3 py-1.5 text-xs font-medium transition-all ${
            value === f ? 'bg-blue-600 text-white' : 'text-muted hover:text-primary'
          }`}>
          {f === 'created_date' ? 'Yaratilgan sana' : 'Yetkazish sanasi'}
        </button>
      ))}
    </div>
  )
}

function DatePickers({
  from, to, onFrom, onTo,
}: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={from} onChange={e => onFrom(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500" />
      <span className="text-muted text-sm">—</span>
      <input type="date" value={to} onChange={e => onTo(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-blue-500" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DataManagement({ onBack }: { onBack?: () => void }) {
  // DB status
  const [status, setStatus]           = useState<DataStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [autoSync, setAutoSync]       = useState<AutoSyncStatus | null>(null)

  // Load section
  const [loadFrom, setLoadFrom]       = useState(today)
  const [loadTo, setLoadTo]           = useState(today)
  const [loadField, setLoadField]     = useState<'created_date' | 'date_delivery'>('created_date')
  const [loadPreset, setLoadPreset]   = useState('today')
  const [syncing, setSyncing]         = useState(false)
  const [stopping, setStopping]       = useState(false)
  const [loadMsg, setLoadMsg]         = useState<string | null>(null)

  // Delete section
  const [delFrom, setDelFrom]         = useState(today)
  const [delTo, setDelTo]             = useState(today)
  const [delField, setDelField]       = useState<'created_date' | 'date_delivery'>('created_date')
  const [deleting, setDeleting]       = useState(false)
  const [deleteMsg, setDeleteMsg]     = useState<string | null>(null)

  // Duplicate stats
  const [dupStats, setDupStats]       = useState<DupStats | null>(null)
  const [loadingDups, setLoadingDups] = useState(true)
  const [cleaningDups, setCleaningDups] = useState(false)

  // Sync logs
  const [logs, setLogs]               = useState<SyncLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  // Misc
  const [refreshing, setRefreshing]   = useState(false)

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const loadStatus = async () => {
    try { setStatus(await apiGet('/api/data/status')) } catch {}
    setLoadingStatus(false)
  }
  const loadAutoSync = async () => {
    try { setAutoSync(await apiGet('/api/data/autosync')) } catch {}
  }
  const loadLogs = async () => {
    try { setLogs(await apiGet('/api/data/logs?limit=50')) } catch {}
    setLoadingLogs(false)
  }
  const loadDups = async () => {
    try { setDupStats(await apiGet('/api/data/duplicates')) } catch {}
    setLoadingDups(false)
  }

  useEffect(() => {
    loadStatus(); loadAutoSync(); loadLogs(); loadDups()
  }, [])

  // Poll every 3s while any sync is running
  useEffect(() => {
    if (!logs.some(l => l.status === 'running')) return
    const t = setInterval(() => { loadStatus(); loadAutoSync(); loadLogs() }, 3000)
    return () => clearInterval(t)
  }, [logs])

  const hasRunning = logs.some(l => l.status === 'running')

  // ── Load handlers ────────────────────────────────────────────────────────────

  const handleLoad = async () => {
    setSyncing(true)
    setLoadMsg(null)
    try {
      await apiPost('/api/data/load', {
        dateFrom: loadFrom, dateTo: loadTo, dateField: loadField,
      })
      setLoadMsg(`${loadFrom} → ${loadTo} uchun yuklash boshlandi`)
      setTimeout(() => { loadStatus(); loadAutoSync(); loadLogs() }, 1000)
    } catch (e) {
      setLoadMsg('Xatolik: ' + String(e))
    }
    setSyncing(false)
  }

  const handleStop = async (logId?: number) => {
    setStopping(true)
    try {
      const path = logId ? `/api/data/stop/${logId}` : '/api/data/stop'
      await fetch(`${BASE}${path}`, { method: 'POST' })
      setTimeout(() => { loadAutoSync(); loadLogs() }, 800)
    } catch {}
    setStopping(false)
  }

  const handleRefreshViews = async () => {
    setRefreshing(true)
    try {
      await apiPost('/api/data/refresh-views')
      setLoadMsg("Ko'rinishlar yangilandi")
    } catch {}
    setRefreshing(false)
  }

  // ── Delete handlers ──────────────────────────────────────────────────────────

  const handleDeleteRange = async () => {
    if (!confirm(`${delFrom} → ${delTo} oralig'idagi ma'lumotlar o'chiriladi. Davom etasizmi?`)) return
    setDeleting(true)
    setDeleteMsg(null)
    try {
      const r = await apiDelete('/api/data/range', { dateFrom: delFrom, dateTo: delTo, dateField: delField })
      setDeleteMsg(`${r.deleted?.toLocaleString() ?? 0} ta yozuv o'chirildi`)
      loadStatus(); loadAutoSync(); loadDups()
    } catch (e) { setDeleteMsg('Xatolik: ' + String(e)) }
    setDeleting(false)
  }

  const handleDeleteToday = async () => {
    if (!confirm(`Bugungi (${today}) ma'lumotlar o'chiriladi. Davom etasizmi?`)) return
    setDeleting(true)
    try {
      const r = await apiDelete('/api/data/range', { dateFrom: today, dateTo: today, dateField: 'created_date' })
      setDeleteMsg(`${r.deleted?.toLocaleString() ?? 0} ta bugungi yozuv o'chirildi. Auto-sinxronizatsiya to'xtatildi.`)
      loadStatus(); loadAutoSync(); loadDups()
    } catch (e) { setDeleteMsg('Xatolik: ' + String(e)) }
    setDeleting(false)
  }

  const handleDeleteAll = async () => {
    if (!confirm("BARCHA ma'lumotlar o'chiriladi! Bu amalni qaytarib bo'lmaydi.")) return
    if (!confirm("Ikkinchi tasdiqlash: Rostdan ham HAMMA ma'lumotni o'chirmoqchimisiz?")) return
    setDeleting(true)
    try {
      const r = await apiDelete('/api/data/all', { confirm: 'yes' })
      setDeleteMsg(`${r.deleted?.toLocaleString() ?? 0} ta yozuv o'chirildi (baza tozalandi)`)
      loadStatus(); loadAutoSync(); loadDups()
    } catch (e) { setDeleteMsg('Xatolik: ' + String(e)) }
    setDeleting(false)
  }

  // ── Duplicate handlers ───────────────────────────────────────────────────────

  const handleCleanDups = async () => {
    if (!confirm('Dublikat yozuvlar o\'chiriladi. Eng eski yozuv qoldiriladi. Davom etasizmi?')) return
    setCleaningDups(true)
    try {
      const r = await apiPost('/api/data/duplicates/clean')
      setDeleteMsg(`${r.cleaned ?? 0} ta dublikat o'chirildi`)
      loadStatus(); loadDups()
    } catch {}
    setCleaningDups(false)
  }

  // ── Log handlers ─────────────────────────────────────────────────────────────

  const handleDeleteLog = async (id: number) => {
    try { await apiDelete(`/api/data/logs/${id}`) } catch {}
    setLogs(prev => prev.filter(l => l.id !== id))
  }
  const handleDeleteAllLogs = async () => {
    if (!confirm("Barcha jurnal yozuvlari o'chiriladi. Davom etasizmi?")) return
    try { await apiDelete('/api/data/logs') } catch {}
    setLogs([])
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const totalDups = (dupStats?.dup_by_id ?? 0) + (dupStats?.dup_by_order_num ?? 0)

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#07101f' }}>
      {/* Header */}
      {onBack && (
        <div className="flex items-center gap-4 px-5 py-2.5 flex-shrink-0" style={{
          background: 'rgba(7,16,31,0.98)',
          borderBottom: '1px solid rgba(59,130,246,0.12)',
          minHeight: 46,
        }}>
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
            style={{ borderColor:'rgba(59,130,246,0.2)', color:'#60a5fa', background:'rgba(59,130,246,0.06)' }}>
            <ArrowLeft size={13} /> Orqaga
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{
              background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)',
            }}>
              <Database size={12} className="text-white" />
            </div>
            <span className="text-white font-extrabold text-sm">Ma'lumotlar Boshqaruvi</span>
            <span className="text-purple-400/40 text-xs">RITM API → PostgreSQL</span>
          </div>
        </div>
      )}
    <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-6">

      {/* ── 1. BAZA HOLATI ──────────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="section-title mb-4">
          <Database size={16} className="text-blue-400" />
          Baza Holati
        </div>

        {loadingStatus ? (
          <div className="text-muted text-sm">Yuklanmoqda...</div>
        ) : status ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {[
                { label: 'Jami buyurtmalar', value: status.total_orders?.toLocaleString(),     color: 'text-blue-400' },
                { label: 'Eng eski sana',    value: status.oldest_day ?? '—',                 color: 'text-slate-300' },
                { label: 'Eng yangi sana',   value: status.newest_day ?? '—',                 color: 'text-slate-300' },
                { label: 'Noyob kunlar',     value: String(status.distinct_days),             color: 'text-slate-300' },
                { label: 'Jadval hajmi',     value: status.table_size ?? '—',                 color: 'text-emerald-400' },
                { label: 'Oxirgi sinxr.',    value: fmtTime(status.last_sync),               color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="glass-card p-3">
                  <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-xs mt-0.5 text-muted">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Today's auto-sync indicator */}
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
              autoSync?.running
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-slate-800/50 border-slate-700/50'
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                autoSync?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`} />
              <div className="flex-1 min-w-0">
                {autoSync?.running ? (
                  <span className="text-sm font-medium text-emerald-400">
                    Bugungi auto-sinxronizatsiya FAOL — har 5 daqiqada yangilanadi
                  </span>
                ) : (
                  <span className="text-sm text-muted">
                    Auto-sinxronizatsiya to'xtatilgan
                    {autoSync?.today_count === 0 ? " — bugungi ma'lumot yuklansa avtomatik boshlanadi" : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted flex-shrink-0">
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Bugun: <b className="text-slate-300 ml-0.5">{status.today_count?.toLocaleString()}</b> ta buyurtma
                </span>
                {status.today_last_sync && (
                  <span className="flex items-center gap-1">
                    <Zap size={11} />
                    Oxirgi: <b className="text-slate-300 ml-0.5">{fmtTime(status.today_last_sync)}</b>
                  </span>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── 2. MA'LUMOT YUKLASH ─────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="section-title mb-4">
          <Download size={16} className="text-blue-400" />
          Ma'lumot Yuklash
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <DateFieldToggle value={loadField} onChange={setLoadField} />
          <div className="w-px h-5" style={{ background: 'var(--bg-card-border)' }} />
          {LOAD_PRESETS.map(p => (
            <button key={p.key}
              onClick={() => { setLoadFrom(p.from); setLoadTo(p.to); setLoadPreset(p.key) }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                loadPreset === p.key ? 'bg-slate-600 text-white' : 'glass-card text-muted hover:text-primary'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <DatePickers from={loadFrom} to={loadTo}
            onFrom={v => { setLoadFrom(v); setLoadPreset('custom') }}
            onTo={v => { setLoadTo(v); setLoadPreset('custom') }} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleLoad} disabled={syncing || hasRunning} className="btn-primary">
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {syncing ? 'Yuklanmoqda...' : "Ma'lumotlarni yuklash"}
          </button>

          {hasRunning && (
            <button onClick={() => handleStop()} disabled={stopping}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-orange-500/40 text-orange-400 hover:bg-orange-500/10 transition-colors">
              {stopping ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
              To'xtatish
            </button>
          )}

          <button onClick={handleRefreshViews} disabled={refreshing} className="btn-ghost border border-slate-700">
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Ko'rinishlarni yangilash
          </button>
        </div>

        {loadMsg && (
          <div className="mt-3 px-3 py-2 rounded text-xs bg-blue-500/10 border border-blue-500/20 text-blue-300">
            {loadMsg}
          </div>
        )}
      </div>

      {/* ── 3. MA'LUMOTLARNI O'CHIRISH ──────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="section-title mb-4">
          <Trash2 size={16} className="text-red-400" />
          Ma'lumotlarni O'chirish
        </div>

        {/* Range delete */}
        <div className="mb-4">
          <p className="text-xs text-muted mb-2">Davr bo'yicha o'chirish:</p>
          <div className="flex flex-wrap items-center gap-2">
            <DateFieldToggle value={delField} onChange={setDelField} />
            <DatePickers from={delFrom} to={delTo} onFrom={setDelFrom} onTo={setDelTo} />
            <button onClick={handleDeleteRange} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Tanlangan davrni o'chirish
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--bg-card-border)' }}>
          <button onClick={handleDeleteToday} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Bugungi ma'lumotlarni tozalash
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-slate-500" />
            <span className="text-xs text-muted">Administrator:</span>
            <button onClick={handleDeleteAll} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-red-600/50 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
              Barcha ma'lumotlarni o'chirish
            </button>
          </div>
        </div>

        {deleteMsg && (
          <div className="mt-3 px-3 py-2 rounded text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300">
            {deleteMsg}
          </div>
        )}
      </div>

      {/* ── 4. DUBLIKATLAR NAZORATI ─────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="section-title">
            <Copy size={16} className="text-purple-400" />
            Dublikatlar Nazorati
          </div>
          <button onClick={loadDups} className="btn-ghost p-1.5"><RefreshCw size={13} /></button>
        </div>

        {loadingDups ? (
          <div className="text-muted text-sm">Yuklanmoqda...</div>
        ) : dupStats ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid grid-cols-3 gap-3 flex-1">
              {[
                { label: 'Jami yozuvlar',     value: dupStats.total_rows?.toLocaleString(),           color: 'text-slate-300' },
                { label: 'Noyob buyurtmalar', value: dupStats.unique_order_numbers?.toLocaleString(), color: 'text-emerald-400' },
                { label: 'Dublikatlar',       value: dupStats.dup_by_order_num?.toLocaleString(),     color: totalDups > 0 ? 'text-red-400' : 'text-slate-500' },
              ].map(s => (
                <div key={s.label} className="glass-card p-3">
                  <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-xs mt-0.5 text-muted">{s.label}</p>
                </div>
              ))}
            </div>
            <button onClick={handleCleanDups} disabled={cleaningDups || totalDups === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-purple-500/40 text-purple-400 hover:bg-purple-500/10">
              {cleaningDups ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Dublikatlarni tozalash
            </button>
          </div>
        ) : null}

        {totalDups === 0 && !loadingDups && (
          <p className="mt-2 text-xs text-emerald-500 flex items-center gap-1">
            <CheckCircle size={12} /> Dublikatlar topilmadi — baza toza
          </p>
        )}
      </div>

      {/* ── 5. SINXRONIZATSIYA JURNALI ──────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--bg-card-border)' }}>
          <div className="section-title">
            <Activity size={16} className="text-blue-400" />
            Sinxronizatsiya Jurnali
          </div>
          <div className="flex items-center gap-1">
            {logs.length > 0 && (
              <button onClick={handleDeleteAllLogs}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={12} />Barchasini o'chirish
              </button>
            )}
            <button onClick={loadLogs} className="btn-ghost p-1.5"><RefreshCw size={13} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-pro">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Boshlanish</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Davr</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Yangi</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">O'tkazildi</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Davomiylik</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted">Holat</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {loadingLogs ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">Yuklanmoqda...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-xs text-muted">Jurnal bo'sh</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="group border-b transition-colors hover:bg-white/[0.03]"
                  style={{ borderColor: 'var(--bg-card-border)' }}>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-secondary">
                    {log.started_at ? new Date(log.started_at).toLocaleString('ru-RU', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    }) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-primary">
                    {log.date_from} → {log.date_to}
                    <span className="ml-1 text-muted">({log.date_field})</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-bold tabular-nums text-emerald-400">
                    {log.loaded > 0 ? '+' + log.loaded.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-muted">
                    {log.skipped > 0 ? log.skipped.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums text-muted">
                    {fmtDuration(log.duration_ms)}
                  </td>
                  <td className="px-4 py-2.5">
                    {log.status === 'success'   && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} />Muvaffaq</span>}
                    {log.status === 'running'   && <span className="flex items-center gap-1 text-xs text-blue-400"><Loader2 size={12} className="animate-spin" />Ishlamoqda</span>}
                    {log.status === 'error'     && <span className="flex items-center gap-1 text-xs text-red-400" title={log.error_msg ?? ''}><AlertTriangle size={12} />Xatolik</span>}
                    {log.status === 'cancelled' && <span className="flex items-center gap-1 text-xs text-orange-400"><Ban size={12} />To'xtatildi</span>}
                  </td>
                  <td className="pr-3 text-right">
                    {log.status === 'running' ? (
                      <button onClick={() => handleStop(log.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-orange-500/15 hover:text-orange-400 text-slate-600 transition-all"
                        title="To'xtatish">
                        <Square size={13} />
                      </button>
                    ) : (
                      <button onClick={() => handleDeleteLog(log.id)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 text-slate-600 transition-all">
                        <X size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
    </div>
  )
}

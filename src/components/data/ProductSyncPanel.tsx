import { useCallback, useEffect, useState } from 'react'
import { Activity, Download, Loader2, Play, Square, Trash2 } from 'lucide-react'
import { adminSarlavha } from '../../api/admin'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8001'
const today = new Date().toISOString().slice(0, 10)

type Status = {
  rows: number; orders: number; products: number; oldest_day: string | null
  newest_day: string | null; last_sync: string | null; today_rows: number
  table_size: string; auto_sync_running: boolean; manual_sync_running: boolean
}
type Log = { id: number; started_at: string; date_from: string; date_to: string
  loaded: number; status: string; error_msg: string | null }

async function request(path: string, method = 'GET') {
  const r = await fetch(`${BASE}${path}`, { method, headers: adminSarlavha() })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText)
  return r.json()
}

export default function ProductSyncPanel() {
  const [from, setFrom] = useState(today), [to, setTo] = useState(today)
  const [status, setStatus] = useState<Status | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const refresh = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        request('/api/data/products/status'), request('/api/data/products/logs?limit=12')])
      setStatus(s); setLogs(l)
    } catch (e) { setMessage(String(e)) }
  }, [])
  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (!status?.manual_sync_running && !logs.some(x => x.status === 'running')) return
    const id = setInterval(refresh, 2500); return () => clearInterval(id)
  }, [status?.manual_sync_running, logs, refresh])

  const act = async (path: string, method = 'POST', ok = 'Bajarildi') => {
    setBusy(true); setMessage('')
    try { await request(path, method); setMessage(ok); setTimeout(refresh, 700) }
    catch (e) { setMessage(`Xatolik: ${String(e)}`) }
    setBusy(false)
  }
  const load = () => act(`/api/data/products/load?dateFrom=${from}&dateTo=${to}`, 'POST', `${from} — ${to} yuklash boshlandi`)
  const remove = () => {
    if (confirm(`${from} — ${to} mahsulot ma'lumotlari o'chirilsinmi?`))
      act(`/api/data/products/range?dateFrom=${from}&dateTo=${to}`, 'DELETE', 'Tanlangan davr o‘chirildi')
  }

  return <div className="glass-card p-5">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="section-title"><Activity size={16} className="text-emerald-400"/>RITM mahsulotlari · delivery_product</div>
      <span className={`text-xs px-2 py-1 rounded ${status?.auto_sync_running ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'}`}>
        Auto-sync: {status?.auto_sync_running ? 'faol' : 'to‘xtagan'}
      </span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
      {[
        ['Qatorlar', status?.rows], ['Buyurtmalar', status?.orders], ['Mahsulotlar', status?.products],
        ['Davr', status?.oldest_day ? `${status.oldest_day} — ${status.newest_day}` : '—'],
        ['Bugun', status?.today_rows], ['Hajm', status?.table_size || '—'],
      ].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-slate-900/60 border border-slate-800 p-2.5">
        <div className="text-sm font-semibold text-slate-200 tabular-nums">{typeof v === 'number' ? v.toLocaleString() : v ?? '—'}</div>
        <div className="text-[10px] text-slate-500 mt-0.5">{k}</div>
      </div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs"/>
      <span className="text-slate-600">—</span>
      <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs"/>
      <button disabled={busy || status?.manual_sync_running} onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-xs disabled:opacity-40">
        {status?.manual_sync_running ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>} Yuklash / qayta yuklash
      </button>
      <button disabled={busy} onClick={remove} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-500/30 text-red-400 text-xs"><Trash2 size={13}/>Davrni o‘chirish</button>
      {status?.manual_sync_running && <button onClick={() => act('/api/data/products/stop')} className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-amber-500/30 text-amber-400 text-xs"><Square size={12}/>To‘xtatish</button>}
      <button onClick={() => act(`/api/data/products/autosync/${status?.auto_sync_running ? 'stop' : 'start'}`)} className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-700 text-slate-300 text-xs">
        {status?.auto_sync_running ? <Square size={12}/> : <Play size={12}/>} {status?.auto_sync_running ? 'Auto-syncni to‘xtatish' : 'Auto-syncni boshlash'}
      </button>
    </div>
    {message && <div className="text-xs text-slate-400 mt-3">{message}</div>}
    {logs.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-[11px]">
      <thead className="text-slate-500"><tr><th className="text-left py-1">Boshlangan</th><th>Davr</th><th>Qator</th><th>Holat</th></tr></thead>
      <tbody>{logs.map(l => <tr key={l.id} className="border-t border-slate-800/70"><td className="py-1.5">{new Date(l.started_at).toLocaleString('ru-RU')}</td><td className="text-center">{l.date_from} — {l.date_to}</td><td className="text-center">{l.loaded.toLocaleString()}</td><td className={`text-center ${l.status === 'success' ? 'text-emerald-400' : l.status === 'error' ? 'text-red-400' : 'text-amber-400'}`} title={l.error_msg || ''}>{l.status}</td></tr>)}</tbody>
    </table></div>}
  </div>
}

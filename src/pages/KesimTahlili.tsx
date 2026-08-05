import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Loader2, Package, Scissors, Store, TrendingUp } from 'lucide-react'

import { fetchKesimTahlili, type KesimMetric } from '../api/prognoz'

type Tab = 'kunlar' | 'tovarlar' | 'otdellar'

const money = (v: number) => new Intl.NumberFormat('uz-UZ', {
  maximumFractionDigits: 0,
}).format(v)

export default function KesimTahlili() {
  const [oy, setOy] = useState<string>()
  const [tab, setTab] = useState<Tab>('kunlar')
  const { data, isLoading, error } = useQuery({
    queryKey: ['kesim-tahlili', oy], queryFn: () => fetchKesimTahlili(oy),
  })

  const rows = data?.[tab] ?? []

  return (
    <div className="h-full overflow-auto px-5 py-4 text-slate-200">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <h1 className="text-lg font-semibold">Kesilgan va qo‘shilgan savdo</h1>
          <p className="text-xs text-slate-500">Fakt savdo va yakuniy savdo summalari farqi</p>
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays size={14} /> Oy
          <select value={oy ?? data?.oy ?? ''} onChange={e => setOy(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-slate-200 bg-slate-900 border border-slate-700">
            {(data?.oylar ?? []).map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {isLoading && <div className="flex items-center gap-2 py-12 justify-center text-slate-500"><Loader2 className="animate-spin" size={18} /> Yuklanmoqda…</div>}
      {error && <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error.message}</div>}

      {data && data.oy && (
        <>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
            <Card title="Fakt buyurtma" value={data.summary.fakt_summa} color="#60a5fa" />
            <Card title="Yakuniy savdo" value={data.summary.yak_summa} color="#a78bfa" />
            <Card title="Kesilgan summa" value={data.summary.kesilgan_summa} color="#fb7185" icon={<Scissors size={15} />} />
            <Card title="Qo‘shilgan summa" value={data.summary.qoshilgan_summa} color="#34d399" icon={<TrendingUp size={15} />} />
          </div>

          <div className="flex gap-1 mb-3">
            <TabButton active={tab === 'kunlar'} onClick={() => setTab('kunlar')} icon={<CalendarDays size={13} />} label="Kunlar" />
            <TabButton active={tab === 'tovarlar'} onClick={() => setTab('tovarlar')} icon={<Package size={13} />} label="Tovarlar" />
            <TabButton active={tab === 'otdellar'} onClick={() => setTab('otdellar')} icon={<Store size={13} />} label="Otdellar" />
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2.5">{tab === 'kunlar' ? 'Sana' : tab === 'tovarlar' ? 'Tovar' : 'Otdel'}</th>
                  <th className="text-right px-3 py-2.5">Fakt summa</th>
                  <th className="text-right px-3 py-2.5">Yakuniy summa</th>
                  <th className="text-right px-3 py-2.5 text-rose-400">Kesilgan</th>
                  <th className="text-right px-3 py-2.5 text-emerald-400">Qo‘shilgan</th>
                  <th className="text-right px-3 py-2.5">Kesilgan miqdor</th>
                  <th className="text-right px-3 py-2.5">Qo‘shilgan miqdor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const metric: KesimMetric = row
                  const label = 'sana' in row ? row.sana : 'tovar' in row ? row.tovar : row.otdel
                  return <tr key={`${label}-${index}`} className="border-t border-slate-800/70 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-300">{label}</td>
                    <Num value={metric.fakt_summa} /><Num value={metric.yak_summa} />
                    <Num value={metric.kesilgan_summa} color="text-rose-300" />
                    <Num value={metric.qoshilgan_summa} color="text-emerald-300" />
                    <Num value={metric.kesilgan_qty} /><Num value={metric.qoshilgan_qty} />
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ title, value, color, icon }: { title: string; value: number; color: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl p-3.5 border border-slate-800 bg-slate-900/50">
    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">{icon}{title}</div>
    <div className="font-mono text-xl font-semibold mt-1" style={{ color }}>{money(value)} <span className="text-[10px] text-slate-600">so‘m</span></div>
  </div>
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
    style={active ? { background: 'rgba(59,130,246,.14)', color: '#93c5fd' } : { color: '#64748b' }}>{icon}{label}</button>
}

function Num({ value, color = 'text-slate-400' }: { value: number; color?: string }) {
  return <td className={`px-3 py-2 text-right font-mono tabular-nums ${color}`}>{money(value)}</td>
}

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Loader2, Package, Scissors, Store, TrendingUp } from 'lucide-react'

import { fetchKesimTafsilot, fetchKesimTahlili, type KesimMetric } from '../api/prognoz'

type Tab = 'kunlar' | 'tovarlar' | 'otdellar'

const money = (v: number) => new Intl.NumberFormat('uz-UZ', {
  maximumFractionDigits: 0,
}).format(v)

export default function KesimTahlili() {
  const [oy, setOy] = useState<string>()
  const [tab, setTab] = useState<Tab>('kunlar')
  const [drill, setDrill] = useState<{ sana: string; otdel?: string; orderNo?: number } | null>(null)
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

          {drill ? <DrillView drill={drill} setDrill={setDrill} /> : <>
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
                  const clickable = 'sana' in row
                  return <tr key={`${label}-${index}`} onClick={() => clickable && setDrill({ sana: row.sana })}
                    className={`border-t border-slate-800/70 hover:bg-slate-800/30 ${clickable ? 'cursor-pointer' : ''}`}>
                    <td className="px-3 py-2 text-slate-300">
                      <span className="flex items-center gap-1.5">{label}{clickable && <ChevronRight size={12} className="text-blue-400" />}</span>
                    </td>
                    <Num value={metric.fakt_summa} /><Num value={metric.yak_summa} />
                    <Num value={metric.kesilgan_summa} color="text-rose-300" />
                    <Num value={metric.qoshilgan_summa} color="text-emerald-300" />
                    <Num value={metric.kesilgan_qty} /><Num value={metric.qoshilgan_qty} />
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          </>}
        </>
      )}
    </div>
  )
}

function DrillView({ drill, setDrill }: {
  drill: { sana: string; otdel?: string; orderNo?: number }
  setDrill: (value: { sana: string; otdel?: string; orderNo?: number } | null) => void
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['kesim-tafsilot', drill.sana, drill.otdel, drill.orderNo],
    queryFn: () => fetchKesimTafsilot(drill.sana, drill.otdel, drill.orderNo),
  })
  const title = drill.orderNo ? `Buyurtma №${drill.orderNo}` : drill.otdel ? drill.otdel : drill.sana
  const firstTitle = drill.orderNo ? 'Mahsulot' : drill.otdel ? 'Buyurtma №' : 'Otdel'

  const back = () => {
    if (drill.orderNo) setDrill({ sana: drill.sana, otdel: drill.otdel })
    else if (drill.otdel) setDrill({ sana: drill.sana })
    else setDrill(null)
  }

  return <div>
    <div className="flex items-center gap-2 mb-3 text-xs">
      <button onClick={back} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800">
        <ChevronLeft size={13} /> Orqaga
      </button>
      <button onClick={() => setDrill(null)} className="text-slate-500 hover:text-blue-300">Kunlar</button>
      <ChevronRight size={11} className="text-slate-700" />
      <button onClick={() => setDrill({ sana: drill.sana })} className="text-slate-400 hover:text-blue-300">{drill.sana}</button>
      {drill.otdel && <><ChevronRight size={11} className="text-slate-700" /><button onClick={() => setDrill({ sana: drill.sana, otdel: drill.otdel })} className="text-slate-400 hover:text-blue-300">{drill.otdel}</button></>}
      {drill.orderNo && <><ChevronRight size={11} className="text-slate-700" /><span className="text-blue-300">№{drill.orderNo}</span></>}
      <span className="ml-auto text-slate-500">{title}</span>
    </div>

    {isLoading && <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><Loader2 size={17} className="animate-spin" /> Tafsilot yuklanmoqda…</div>}
    {error && <div className="rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error.message}</div>}
    {data?.info && <OrderInfo info={data.info} />}
    {data && <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/40">
      <table className="w-full text-xs">
        <thead className="bg-slate-900 text-slate-500"><tr>
          <th className="text-left px-3 py-2.5">{firstTitle}</th>
          {!drill.orderNo && drill.otdel && <th className="text-left px-3 py-2.5">Do‘kon / agent</th>}
          <th className="text-right px-3 py-2.5">Fakt summa</th><th className="text-right px-3 py-2.5">Yakuniy summa</th>
          <th className="text-right px-3 py-2.5 text-rose-400">Kesilgan</th><th className="text-right px-3 py-2.5 text-emerald-400">Qo‘shilgan</th>
          <th className="text-right px-3 py-2.5">Fakt miqdor</th><th className="text-right px-3 py-2.5">Yakuniy miqdor</th>
        </tr></thead>
        <tbody>{data.items.map((row, i) => {
          const label = drill.orderNo ? row.product : drill.otdel ? `№${row.order_no}` : row.otdel
          const clickable = !drill.orderNo
          return <tr key={`${label}-${i}`} onClick={() => {
            if (!drill.otdel && row.otdel) setDrill({ sana: drill.sana, otdel: row.otdel })
            else if (drill.otdel && row.order_no) setDrill({ sana: drill.sana, otdel: drill.otdel, orderNo: row.order_no })
          }} className={`border-t border-slate-800/70 hover:bg-slate-800/30 ${clickable ? 'cursor-pointer' : ''}`}>
            <td className="px-3 py-2 text-slate-200"><span className="flex items-center gap-1.5">{drill.orderNo ? <Package size={12} className="text-slate-500" /> : <FileText size={12} className="text-blue-400" />}{label}{clickable && <ChevronRight size={11} className="text-blue-400" />}</span></td>
            {!drill.orderNo && drill.otdel && <td className="px-3 py-2 text-slate-500"><div>{row.shop_name || '—'}</div><div className="text-[10px]">{row.agent || ''}</div></td>}
            <Num value={row.fakt_summa} /><Num value={row.yak_summa} /><Num value={row.kesilgan_summa} color="text-rose-300" /><Num value={row.qoshilgan_summa} color="text-emerald-300" /><Num value={row.fakt_qty} /><Num value={row.yak_qty} />
          </tr>
        })}</tbody>
      </table>
    </div>}
  </div>
}

function OrderInfo({ info }: { info: NonNullable<import('../api/prognoz').KesimTafsilot['info']> }) {
  const fields = [
    ['Buyurtma', `№${info.order_no}`], ['Otdel', info.otdel], ['Do‘kon', info.shop_name],
    ['Do‘kon №', info.shop_no], ['Tip', info.shop_type], ['Zona', info.zone],
    ['Agent', info.agent], ['Buyurtma oluvchi', info.orderer], ['Yetkazuvchi', info.courier],
    ['To‘lov', info.pay_type], ['Chegirma', info.discount_pct != null ? `${info.discount_pct}%` : null],
  ]
  return <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
    {fields.map(([k, v]) => <div key={String(k)} className="rounded-lg px-3 py-2 bg-slate-900/60 border border-slate-800">
      <div className="text-[9px] uppercase tracking-wide text-slate-600">{k}</div><div className="text-xs text-slate-300 mt-0.5 truncate" title={String(v ?? '')}>{v ?? '—'}</div>
    </div>)}
  </div>
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

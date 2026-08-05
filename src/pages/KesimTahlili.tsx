import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Loader2, Scissors, TrendingUp } from 'lucide-react'

import { fetchKesimErkin, fetchKesimTafsilot, fetchKesimTahlili, type DrillDimension, type KesimMetric } from '../api/prognoz'

type DrillState = { oy: string; path: { dimension: DrillDimension; value: string }[]; groupBy: DrillDimension }

const money = (v: number) => new Intl.NumberFormat('uz-UZ', {
  maximumFractionDigits: 0,
}).format(v)

export default function KesimTahlili() {
  const [oy, setOy] = useState<string>()
  const [drill, setDrill] = useState<DrillState | null>(null)
  const { data, isLoading, error } = useQuery({
    queryKey: ['kesim-tahlili', oy], queryFn: () => fetchKesimTahlili(oy),
  })

  const rows = data?.kunlar ?? []

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
          <select value={oy ?? data?.oy ?? ''} onChange={e => { setOy(e.target.value); setDrill(null) }}
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
            <div className="flex items-center justify-end gap-2 mb-3 text-xs text-slate-500">
              Birinchi kesim
              <select defaultValue="" onChange={e => e.target.value && setDrill({ oy: data.oy!, path: [], groupBy: e.target.value as DrillDimension })}
                className="rounded-lg px-3 py-1.5 text-slate-200 bg-slate-900 border border-slate-700">
                <option value="" disabled>Parametrni tanlang</option>
                {DIMENSIONS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2.5">Sana</th>
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
                  const label = row.sana
                  const clickable = 'sana' in row
                  return <tr key={`${label}-${index}`} onClick={() => clickable && setDrill({ oy: data.oy!, path: [{ dimension: 'sana', value: row.sana }], groupBy: 'otdel' })}
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

const DIMENSIONS: { key: DrillDimension; label: string }[] = [
  { key: 'sana', label: 'Sana' },
  { key: 'otdel', label: 'Otdel' }, { key: 'shop_type', label: 'Do‘kon turi' },
  { key: 'zone', label: 'Zona' }, { key: 'agent', label: 'Agent' },
  { key: 'orderer', label: 'Buyurtma oluvchi' }, { key: 'courier', label: 'Yetkazuvchi' },
  { key: 'shop', label: 'Do‘kon' }, { key: 'pay_type', label: 'To‘lov turi' },
  { key: 'product_type', label: 'Mahsulot turi' }, { key: 'product', label: 'Mahsulot' },
  { key: 'order_no', label: 'Buyurtma raqami' },
]

function DrillView({ drill, setDrill }: { drill: DrillState; setDrill: (v: DrillState | null) => void }) {
  const filters = Object.fromEntries(drill.path.map(x => [x.dimension, x.value])) as Partial<Record<DrillDimension, string>>
  const order = drill.path.find(x => x.dimension === 'order_no')
  const otdel = drill.path.find(x => x.dimension === 'otdel')?.value
  const sana = drill.path.find(x => x.dimension === 'sana')?.value
  const free = useQuery({ queryKey: ['kesim-erkin', drill.oy, drill.groupBy, filters],
    queryFn: () => fetchKesimErkin(drill.oy, drill.groupBy, filters), enabled: !order })
  const detail = useQuery({ queryKey: ['kesim-order', drill.oy, sana, otdel, order?.value],
    queryFn: () => fetchKesimTafsilot(drill.oy, sana, otdel, Number(order!.value)), enabled: !!order })
  const used = new Set(drill.path.map(x => x.dimension))
  const available = DIMENSIONS.filter(x => !used.has(x.key))
  const currentLabel = DIMENSIONS.find(x => x.key === drill.groupBy)?.label
  const data = order ? detail.data : free.data
  const loading = order ? detail.isLoading : free.isLoading
  const error = order ? detail.error : free.error

  const goBack = () => {
    if (!drill.path.length) return setDrill(null)
    const path = drill.path.slice(0, -1)
    const removed = drill.path.at(-1)!.dimension
    setDrill({ ...drill, path, groupBy: removed })
  }
  const choose = (value: string) => {
    const path = [...drill.path, { dimension: drill.groupBy, value }]
    if (drill.groupBy === 'order_no') return setDrill({ ...drill, path })
    const next = DIMENSIONS.find(x => !path.some(p => p.dimension === x.key))?.key
    if (next) setDrill({ ...drill, path, groupBy: next })
  }

  return <div>
    <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
      <button onClick={goBack} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-slate-400 bg-slate-900 border border-slate-800"><ChevronLeft size={13}/>Orqaga</button>
      <button onClick={() => setDrill(null)} className="text-slate-500 hover:text-blue-300">Kunlar</button>
      <ChevronRight size={11}/><span className="text-slate-300">{drill.oy}</span>
      {drill.path.map((p, i) => <span key={p.dimension} className="contents"><ChevronRight size={11}/><button
        onClick={() => setDrill({ ...drill, path: drill.path.slice(0, i), groupBy: p.dimension })}
        className="text-blue-300 hover:text-blue-200">{DIMENSIONS.find(x => x.key === p.dimension)?.label}: {p.value}</button></span>)}
      {!order && <label className="ml-auto flex items-center gap-2 text-slate-500">Keyingi kesim
        <select value={drill.groupBy} onChange={e => setDrill({ ...drill, groupBy: e.target.value as DrillDimension })}
          className="rounded-lg px-3 py-1.5 text-slate-200 bg-slate-900 border border-slate-700">
          {available.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select></label>}
    </div>
    {loading && <div className="flex justify-center gap-2 py-16 text-slate-500"><Loader2 className="animate-spin" size={17}/>Yuklanmoqda…</div>}
    {error && <div className="p-4 text-red-300">{error.message}</div>}
    {order && detail.data?.info && <OrderInfo info={detail.data.info}/>}
    {data && <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950/40"><table className="w-full text-xs">
      <thead className="bg-slate-900 text-slate-500"><tr><th className="text-left px-3 py-2.5">{order ? 'Mahsulot' : currentLabel}</th>
        <th className="text-right px-3 py-2.5">Buyurtmalar</th><th className="text-right px-3 py-2.5">Mahsulotlar</th>
        <th className="text-right px-3 py-2.5">Fakt summa</th><th className="text-right px-3 py-2.5">Yakuniy summa</th>
        <th className="text-right px-3 py-2.5 text-rose-400">Kesilgan</th><th className="text-right px-3 py-2.5 text-emerald-400">Qo‘shilgan</th></tr></thead>
      <tbody>{data.items.map((row, i) => {
        const value = order ? ('product' in row ? row.product || '' : '') : ('value' in row ? row.value : '')
        return <tr key={`${value}-${i}`} onClick={() => !order && choose(value)} className={`border-t border-slate-800/70 hover:bg-slate-800/30 ${!order ? 'cursor-pointer' : ''}`}>
          <td className="px-3 py-2 text-slate-200"><span className="flex items-center gap-1.5"><FileText size={12} className="text-blue-400"/>{value}{!order&&<ChevronRight size={11}/>}</span></td>
          <td className="px-3 py-2 text-right text-slate-500">{'buyurtmalar' in row ? row.buyurtmalar : '—'}</td>
          <td className="px-3 py-2 text-right text-slate-500">{'mahsulotlar' in row ? row.mahsulotlar : '—'}</td>
          <Num value={row.fakt_summa}/><Num value={row.yak_summa}/><Num value={row.kesilgan_summa} color="text-rose-300"/><Num value={row.qoshilgan_summa} color="text-emerald-300"/>
        </tr>})}</tbody></table></div>}
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

function Num({ value, color = 'text-slate-400' }: { value: number; color?: string }) {
  return <td className={`px-3 py-2 text-right font-mono tabular-nums ${color}`}>{money(value)}</td>
}

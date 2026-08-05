import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Loader2, Search, Scissors, TrendingUp, X } from 'lucide-react'

import { fetchKesimErkin, fetchKesimTafsilot, fetchKesimTahlili, kesimOyEksport, type DrillDimension, type KesimMetric } from '../api/prognoz'

type DrillState = { oy: string; path: { dimension: DrillDimension; value: string }[]; groupBy: DrillDimension }
type SortKey = 'label' | 'buyurtmalar' | 'mahsulotlar' | keyof KesimMetric

const money = (v: number) => Math.round(v).toLocaleString('en-US').replaceAll(',', ' ')

export default function KesimTahlili() {
  const [oy, setOy] = useState<string>()
  const [drill, setDrill] = useState<DrillState | null>(null)
  const { data, isLoading, error } = useQuery({
    queryKey: ['kesim-tahlili', oy], queryFn: () => fetchKesimTahlili(oy),
  })

  const rows = data?.kunlar ?? []
  const totals = sumRows(rows)

  return (
    <div className="h-full overflow-hidden px-5 py-4 text-slate-200">
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
            <div className="rounded-xl overflow-auto border border-slate-800 bg-slate-950/40" style={{ maxHeight: 'calc(100vh - 285px)' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500">
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
              <tfoot className="sticky bottom-0 z-10 bg-slate-900 font-semibold border-t-2 border-blue-900/60"><tr>
                <td className="px-3 py-2.5 text-blue-300">JAMI</td>
                <Num value={totals.fakt_summa}/><Num value={totals.yak_summa}/>
                <Num value={totals.kesilgan_summa} color="text-rose-300"/><Num value={totals.qoshilgan_summa} color="text-emerald-300"/>
                <Num value={totals.kesilgan_qty}/><Num value={totals.qoshilgan_qty}/>
              </tr></tfoot>
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
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'kesilgan_summa', dir: 'desc' })
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
  const visibleRows = useMemo(() => {
    const items = [...(data?.items ?? [])]
    const label = (row: typeof items[number]) => order
      ? ('product' in row ? row.product || '' : '') : ('value' in row ? row.value : '')
    const filtered = items.filter(row => {
      if (search && !label(row).toLocaleLowerCase().includes(search.toLocaleLowerCase())) return false
      return true
    })
    filtered.sort((a, b) => {
      const av = sort.key === 'label' ? label(a) : Number(a[sort.key as keyof typeof a] ?? 0)
      const bv = sort.key === 'label' ? label(b) : Number(b[sort.key as keyof typeof b] ?? 0)
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : av - Number(bv)
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return filtered
  }, [data, order, search, sort])
  const totals = sumRows(visibleRows)
  const toggleSort = (key: SortKey) => setSort(x => ({ key, dir: x.key === key && x.dir === 'asc' ? 'desc' : 'asc' }))
  const resetTable = () => { setSearch(''); setSort({ key: 'kesilgan_summa', dir: 'desc' }) }
  const exportRows = async () => {
    const XLSX = await import('xlsx')
    const rows = visibleRows.map(row => ({
      [order ? 'Mahsulot' : currentLabel || 'Kesim']: order ? ('product' in row ? row.product : '') : ('value' in row ? row.value : ''),
      Buyurtmalar: 'buyurtmalar' in row ? row.buyurtmalar : '', Mahsulotlar: 'mahsulotlar' in row ? row.mahsulotlar : '',
      'Fakt summa': row.fakt_summa, 'Yakuniy summa': row.yak_summa,
      Kesilgan: row.kesilgan_summa, "Qo‘shilgan": row.qoshilgan_summa,
    }))
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kesim tahlili'); XLSX.writeFile(wb, `kesim-${drill.oy}-${drill.groupBy}.xlsx`)
  }

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
    {data && <div className="flex items-center gap-2 mb-2">
      <label className="relative"><Search size={13} className="absolute left-2.5 top-2 text-slate-600"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Jadvaldan qidirish…"
          className="w-64 rounded-lg pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 outline-none focus:border-blue-600"/></label>
      <span className="text-[10px] text-slate-600">{visibleRows.length} / {data.items.length} qator</span>
      {search && <button onClick={resetTable} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white"><X size={12}/>Qidiruvni tozalash</button>}
      <div className="ml-auto flex items-center gap-1.5">
        <button onClick={exportRows} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-900/50"><Download size={12}/>Joriy holat</button>
        <button onClick={() => kesimOyEksport(drill.oy)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-blue-300 bg-blue-950/30 border border-blue-900/50"><Download size={12}/>Oyning to‘liq ma’lumoti</button>
      </div>
    </div>}
    {data && <div className="rounded-xl overflow-auto border border-slate-800 bg-slate-950/40" style={{ maxHeight: 'calc(100vh - 285px)' }}><table className="w-full text-xs">
      <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500"><tr>
        <SortHead label={order ? 'Mahsulot' : currentLabel || ''} column="label" sort={sort} onSort={toggleSort}/>
        <SortHead label="Buyurtmalar" column="buyurtmalar" sort={sort} onSort={toggleSort}/><SortHead label="Mahsulotlar" column="mahsulotlar" sort={sort} onSort={toggleSort}/>
        <SortHead label="Fakt summa" column="fakt_summa" sort={sort} onSort={toggleSort}/><SortHead label="Yakuniy summa" column="yak_summa" sort={sort} onSort={toggleSort}/>
        <SortHead label="Kesilgan" column="kesilgan_summa" sort={sort} onSort={toggleSort} color="text-rose-400"/><SortHead label="Qo‘shilgan" column="qoshilgan_summa" sort={sort} onSort={toggleSort} color="text-emerald-400"/>
      </tr></thead>
      <tbody>{visibleRows.map((row, i) => {
        const value = order ? ('product' in row ? row.product || '' : '') : ('value' in row ? row.value : '')
        return <tr key={`${value}-${i}`} onClick={() => !order && choose(value)} className={`border-t border-slate-800/70 hover:bg-slate-800/30 ${!order ? 'cursor-pointer' : ''}`}>
          <td className="px-3 py-2 text-slate-200"><span className="flex items-center gap-1.5"><FileText size={12} className="text-blue-400"/>{value}{!order&&<ChevronRight size={11}/>}</span></td>
          <td className="px-3 py-2 text-right text-slate-500">{'buyurtmalar' in row ? row.buyurtmalar : '—'}</td>
          <td className="px-3 py-2 text-right text-slate-500">{'mahsulotlar' in row ? row.mahsulotlar : '—'}</td>
          <Num value={row.fakt_summa}/><Num value={row.yak_summa}/><Num value={row.kesilgan_summa} color="text-rose-300"/><Num value={row.qoshilgan_summa} color="text-emerald-300"/>
        </tr>})}</tbody>
      <tfoot className="sticky bottom-0 z-10 bg-slate-900 font-semibold border-t-2 border-blue-900/60"><tr>
        <td className="px-3 py-2.5 text-blue-300">JAMI</td>
        <td className="px-3 py-2.5 text-right text-slate-300">{totals.buyurtmalar || '—'}</td>
        <td className="px-3 py-2.5 text-right text-slate-300">{totals.mahsulotlar || '—'}</td>
        <Num value={totals.fakt_summa}/><Num value={totals.yak_summa}/><Num value={totals.kesilgan_summa} color="text-rose-300"/><Num value={totals.qoshilgan_summa} color="text-emerald-300"/>
      </tr></tfoot></table></div>}
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

function SortHead({ label, column, sort, onSort, color = '' }: {
  label: string; column: SortKey; sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (key: SortKey) => void; color?: string
}) {
  return <th onClick={() => onSort(column)} className={`px-3 py-2.5 cursor-pointer select-none ${column === 'label' ? 'text-left' : 'text-right'} ${color}`}>
    <span className={`inline-flex items-center gap-1 ${column === 'label' ? '' : 'justify-end'}`}>{label}
      {sort.key === column && (sort.dir === 'asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>)}</span>
  </th>
}

function Num({ value, color = 'text-slate-400' }: { value: number; color?: string }) {
  return <td className={`px-3 py-2 text-right font-mono tabular-nums ${color}`}>{money(value)}</td>
}

type Totals = KesimMetric & { buyurtmalar: number; mahsulotlar: number }

function sumRows(rows: Array<Partial<KesimMetric> & { buyurtmalar?: number; mahsulotlar?: number }>): Totals {
  return rows.reduce<Totals>((a, r) => ({
    fakt_summa: a.fakt_summa + (r.fakt_summa ?? 0),
    yak_summa: a.yak_summa + (r.yak_summa ?? 0),
    kesilgan_summa: a.kesilgan_summa + (r.kesilgan_summa ?? 0),
    qoshilgan_summa: a.qoshilgan_summa + (r.qoshilgan_summa ?? 0),
    fakt_qty: a.fakt_qty + (r.fakt_qty ?? 0), yak_qty: a.yak_qty + (r.yak_qty ?? 0),
    kesilgan_qty: a.kesilgan_qty + (r.kesilgan_qty ?? 0),
    qoshilgan_qty: a.qoshilgan_qty + (r.qoshilgan_qty ?? 0),
    buyurtmalar: a.buyurtmalar + (r.buyurtmalar ?? 0),
    mahsulotlar: a.mahsulotlar + (r.mahsulotlar ?? 0),
  }), { fakt_summa: 0, yak_summa: 0, kesilgan_summa: 0, qoshilgan_summa: 0,
    fakt_qty: 0, yak_qty: 0, kesilgan_qty: 0, qoshilgan_qty: 0,
    buyurtmalar: 0, mahsulotlar: 0 })
}

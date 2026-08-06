import { useMemo, useState } from 'react'
import { Activity, Boxes, ChevronDown, Clock3, Filter, LayoutDashboard, PackageSearch, Percent, ReceiptText, RotateCcw, Search, Table2, TrendingUp, WalletCards, X } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useProductAnalytics } from '../../hooks/useAnalytics'
import { useAppStore } from '../../store/useAppStore'
import { fmtSum } from '../../utils/formatters'
import type { ProductAnalyticsItem, ProductBreakdownPoint, ProductDashboardFilters } from '../../types/api'

type SortKey = 'total_sum' | 'quantity' | 'order_count' | 'avg_price' | 'share_pct'

const fmt = (value: number, digits = 0) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: digits,
}).format(Number(value || 0))

const panel = 'rounded-xl border overflow-hidden bg-slate-900/70 border-slate-700/60'
const emptyFilters = (): ProductDashboardFilters => ({ operators:[], deliveries:[], departments:[], productIds:[], zones:[] })

type FilterValue = string | number
function MultiFilter({ label, values, options, onChange }: { label: string; values: FilterValue[]; options: Array<{ value: FilterValue; label: string }>; onChange: (values: FilterValue[]) => void }) {
  const selected = new Set(values.map(String))
  return <details className="relative group">
    <summary className={`list-none cursor-pointer h-8 min-w-36 px-3 rounded-lg border flex items-center gap-2 text-[11px] ${values.length ? 'border-blue-500/60 bg-blue-500/10 text-blue-200' : 'border-slate-700 bg-slate-900/80 text-slate-400'}`}>
      <span className="flex-1 truncate">{label}{values.length ? ` · ${values.length}` : ''}</span><ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
    </summary>
    <div className="absolute z-50 top-10 left-0 w-72 max-h-72 overflow-auto rounded-xl border border-slate-700 bg-slate-950 shadow-2xl p-2">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800 mb-1"><span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>{values.length > 0 && <button onClick={() => onChange([])} className="text-[10px] text-blue-400 hover:text-blue-300">Tozalash</button>}</div>
      {options.map(option => <label key={String(option.value)} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-800/70 cursor-pointer text-[11px] text-slate-300"><input type="checkbox" checked={selected.has(String(option.value))} onChange={() => onChange(selected.has(String(option.value)) ? values.filter(value => String(value) !== String(option.value)) : [...values, option.value])} className="accent-blue-500"/><span className="truncate" title={option.label}>{option.label}</span></label>)}
      {!options.length && <div className="px-2 py-4 text-center text-[10px] text-slate-600">Qiymatlar mavjud emas</div>}
    </div>
  </details>
}

function RankedBars({ rows, metric, color }: {
  rows: ProductAnalyticsItem[]
  metric: 'total_sum' | 'quantity'
  color: string
}) {
  const max = Math.max(...rows.map(row => Number(row[metric])), 1)
  return <div className="space-y-2.5">
    {rows.map((row, index) => <div key={row.product_id}>
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className="w-4 text-slate-600 tabular-nums">{index + 1}</span>
        <span className="flex-1 truncate text-slate-200" title={row.product_name}>{row.product_name}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {metric === 'total_sum' ? `${fmtSum(row.total_sum, true)} so‘m` : fmt(row.quantity, 3)}
        </span>
      </div>
      <div className="ml-6 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Number(row[metric]) / max * 100}%`, background: color }} />
      </div>
    </div>)}
  </div>
}

function Breakdown({ title, subtitle, rows, color }: { title: string; subtitle: string; rows: ProductBreakdownPoint[]; color: string }) {
  const shown = rows.slice(0, 5)
  const max = Math.max(...shown.map(row => Number(row.total_sum)), 1)
  const total = rows.reduce((sum, row) => sum + Number(row.total_sum), 0)
  return <div className={`${panel} p-3 min-w-0 h-full`}>
    <div className="flex items-start justify-between gap-2 mb-3"><div><h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">{title}</h3><p className="text-[9px] text-slate-600 mt-0.5">{subtitle}</p></div><span className="text-[10px] text-slate-600">TOP {shown.length}</span></div>
    <div className="space-y-2.5">{shown.map((row, index) => <div key={`${title}-${row.name}`}>
      <div className="flex items-center gap-1.5 text-[11px] mb-1"><span className="w-3 text-slate-700 tabular-nums">{index + 1}</span><span className="flex-1 truncate text-slate-200 font-medium" title={row.name}>{row.name}</span><span className="text-slate-400 tabular-nums">{fmt(row.order_count)} ta</span><span className="font-bold tabular-nums w-12 text-right" style={{ color }}>{total ? (Number(row.total_sum) / total * 100).toFixed(1) : '0.0'}%</span></div>
      <div className="ml-4 h-1 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Number(row.total_sum) / max * 100}%`, background: color }} /></div>
    </div>)}</div>
  </div>
}

export default function ProductAnalyticsSection() {
  const dateField = useAppStore(s => s.dateField)
  const dateRange = useAppStore(s => s.dateRange)
  const [draftFilters, setDraftFilters] = useState<ProductDashboardFilters>(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState<ProductDashboardFilters>(emptyFilters)
  const { data, isLoading, isError, isFetching } = useProductAnalytics(500, appliedFilters)
  const [sort, setSort] = useState<SortKey>('total_sum')
  const [query, setQuery] = useState('')
  const [displayMode, setDisplayMode] = useState<'monitor' | 'details'>('monitor')
  const activeFilterCount = appliedFilters.operators.length + appliedFilters.deliveries.length + appliedFilters.departments.length + appliedFilters.productIds.length + appliedFilters.zones.length
  const draftFilterCount = draftFilters.operators.length + draftFilters.deliveries.length + draftFilters.departments.length + draftFilters.productIds.length + draftFilters.zones.length
  const hasPendingChanges = JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters)
  const updateFilter = <K extends keyof ProductDashboardFilters>(key: K, values: ProductDashboardFilters[K]) => setDraftFilters(current => ({ ...current, [key]: values }))
  const applyFilters = () => setAppliedFilters({ ...draftFilters, operators:[...draftFilters.operators], deliveries:[...draftFilters.deliveries], departments:[...draftFilters.departments], productIds:[...draftFilters.productIds], zones:[...draftFilters.zones] })

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return [...(data?.items ?? [])]
      .filter(row => !q || row.product_name.toLocaleLowerCase().includes(q) || row.product_type.toLocaleLowerCase().includes(q))
      .sort((a, b) => Number(b[sort]) - Number(a[sort]))
  }, [data?.items, query, sort])

  if (isLoading) return <div className="h-full flex items-center justify-center text-sm text-slate-500">Mahsulotlar tahlili yuklanmoqda…</div>
  if (isError || !data) return <div className="h-full flex items-center justify-center text-sm text-red-400">Mahsulotlar tahlilini yuklab bo‘lmadi</div>

  const { summary } = data
  const filterOptions = data.filter_options ?? { operators:[], deliveries:[], departments:[], products:[], zones:[] }
  const topSales = [...data.items].sort((a,b) => b.total_sum-a.total_sum).slice(0, 6)
  const topQuantity = [...data.items].sort((a,b) => b.quantity-a.quantity).slice(0, 6)
  const maxType = Math.max(...data.types.map(type => Number(type.total_sum)), 1)
  const sourceLabel = dateField === 'created_date' ? 'Yaratilgan sana · order_product' : 'Yetkazish sanasi · delivery_product'
  const freshness = summary.refreshed_at ? new Date(summary.refreshed_at) : null
  const useDaily = data.daily.length > 1
  const trend: Array<{ label: string; order_count: number; total_sum: number }> = useDaily
    ? data.daily.map(row => ({ ...row, label: new Date(`${row.day}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) }))
    : data.hourly.map(row => ({ ...row, label: `${String(row.hour).padStart(2, '0')}:00` }))

  const cards = [
    { label: 'Mahsulotlar savdosi', value: `${fmtSum(summary.total_sum, true)} so‘m`, note: `${fmt(summary.product_count)} faol mahsulot`, icon: WalletCards, color:'#34d399' },
    { label: 'Buyurtmalar', value: fmt(summary.all_order_count), note: `${fmt(summary.order_count)} mahsulotli · ${fmt(summary.orders_without_products)} mahsulotsiz`, icon: ReceiptText, color:'#60a5fa' },
    { label: 'O‘rtacha mahsulotli buyurtma', value: `${fmtSum(summary.avg_order_sum, true)} so‘m`, note: 'faqat mahsulot satri mavjud', icon: TrendingUp, color:'#c084fc' },
    { label: 'Top-10 konsentratsiyasi', value: `${Number(summary.top10_share_pct).toFixed(1)}%`, note: 'jami mahsulotlar savdosidan', icon: Boxes, color:'#fbbf24' },
    { label: 'Chegirma', value: `${fmtSum(summary.discount_sum, true)} so‘m`, note: `yalpi summaning ${Number(summary.discount_rate_pct).toFixed(1)}%`, icon: Percent, color:'#fb923c' },
    { label: 'Qaytarilgan miqdor', value: fmt(summary.return_quantity, 3), note: `sotilgan miqdorning ${Number(summary.return_rate_pct).toFixed(1)}%`, icon: RotateCcw, color:'#f87171' },
  ]

  return <section className="h-full min-h-0 flex flex-col gap-2">
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2"><PackageSearch size={17} className="text-emerald-400"/><h2 className="font-bold text-slate-100">Mahsulotlar boshqaruv paneli</h2></div>
        <p className="text-[11px] text-slate-500 mt-0.5">{dateRange.from} — {dateRange.to} · {sourceLabel} · Operator, dostavshik, otdel, zona va produkt kesimlari</p>
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
          <button onClick={() => setDisplayMode('monitor')} className={`h-7 px-2.5 flex items-center gap-1.5 ${displayMode === 'monitor' ? 'bg-blue-500/20 text-blue-200' : 'text-slate-500 hover:text-slate-300'}`}><LayoutDashboard size={12}/>Monitor</button>
          <button onClick={() => setDisplayMode('details')} className={`h-7 px-2.5 flex items-center gap-1.5 ${displayMode === 'details' ? 'bg-blue-500/20 text-blue-200' : 'text-slate-500 hover:text-slate-300'}`}><Table2 size={12}/>Tafsilotlar</button>
        </div>
        <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
        <span className="text-slate-400">{isFetching ? 'Yangilanmoqda' : '5 daqiqalik monitoring'}</span>
        {freshness && <span className="flex items-center gap-1 text-slate-500 border-l border-slate-700 pl-2"><Clock3 size={11}/>{freshness.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
      </div>
    </div>

    <div className={`${panel} px-3 py-2.5 flex flex-wrap items-center gap-2 overflow-visible`}>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mr-1"><Filter size={13} className="text-blue-400"/><span>Dashboard filtrlari</span>{activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 tabular-nums">{activeFilterCount} faol</span>}{hasPendingChanges && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300">tanlov tayyor</span>}</div>
      <MultiFilter label="Operator" values={draftFilters.operators} options={filterOptions.operators.map(value => ({ value, label:value }))} onChange={values => updateFilter('operators', values as string[])} />
      <MultiFilter label="Dostavshik" values={draftFilters.deliveries} options={filterOptions.deliveries.map(value => ({ value, label:value }))} onChange={values => updateFilter('deliveries', values as string[])} />
      <MultiFilter label="Otdel" values={draftFilters.departments} options={filterOptions.departments.map(value => ({ value, label:value }))} onChange={values => updateFilter('departments', values as string[])} />
      <MultiFilter label="Produkt" values={draftFilters.productIds} options={filterOptions.products.map(item => ({ value:item.id, label:item.name }))} onChange={values => updateFilter('productIds', values as number[])} />
      <MultiFilter label="Zona" values={draftFilters.zones} options={filterOptions.zones.map(value => ({ value, label:value }))} onChange={values => updateFilter('zones', values as string[])} />
      <div className="ml-auto flex items-center gap-2">
        {draftFilterCount > 0 && <button onClick={() => setDraftFilters(emptyFilters())} className="h-8 px-2.5 rounded-lg border border-red-500/25 text-[11px] text-red-300 hover:bg-red-500/10 flex items-center gap-1"><X size={12}/>Tozalash</button>}
        {hasPendingChanges && <button onClick={() => setDraftFilters(appliedFilters)} className="h-8 px-2.5 rounded-lg border border-slate-700 text-[11px] text-slate-400 hover:text-slate-200">Bekor qilish</button>}
        <button onClick={applyFilters} disabled={!hasPendingChanges || isFetching} className="h-8 px-4 rounded-lg border border-blue-500/60 bg-blue-500/20 text-[11px] font-semibold text-blue-200 hover:bg-blue-500/30 disabled:opacity-35 disabled:cursor-not-allowed">{isFetching ? 'Qo‘llanmoqda…' : 'Qabul qilish'}</button>
      </div>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-2">
      {cards.map(card => <div key={card.label} className={`${panel} px-4 py-3 flex items-center gap-3 relative`}>
        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{background:card.color}} />
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{background:`${card.color}14`,border:`1px solid ${card.color}28`}}><card.icon size={17} style={{color:card.color}}/></div>
        <div className="min-w-0"><div className="text-[11px] text-slate-500">{card.label}</div><div className="text-xl font-black tabular-nums text-slate-100 truncate">{card.value}</div><div className="text-[10px] text-slate-600 truncate">{card.note}</div></div>
      </div>)}
    </div>

    {displayMode === 'monitor' && <>
    <div className={`${panel} p-3`}>
      <div className="flex items-center justify-between mb-1"><div><h3 className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">Savdo dinamikasi</h3><p className="text-[9px] text-slate-600">{useDaily ? 'kunlar bo‘yicha' : 'buyurtma yaratilgan soat bo‘yicha'} · summa va buyurtmalar</p></div><Activity size={15} className="text-blue-400" /></div>
      <div className="h-[145px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="label" tick={{ fill:'#64748b', fontSize:9 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="orders" tick={{ fill:'#475569', fontSize:9 }} axisLine={false} tickLine={false} width={28} /><YAxis yAxisId="sum" orientation="right" tickFormatter={value => fmtSum(value, true)} tick={{ fill:'#475569', fontSize:9 }} axisLine={false} tickLine={false} width={38} />
        <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, fontSize:11 }} formatter={(value, name) => name === 'Savdo' ? [`${fmtSum(Number(value), true)} so‘m`, name] : [`${fmt(Number(value))} ta`, name]} />
        <Bar yAxisId="orders" dataKey="order_count" name="Buyurtma" fill="#2563eb" radius={[3,3,0,0]} maxBarSize={22} /><Line yAxisId="sum" type="monotone" dataKey="total_sum" name="Savdo" stroke="#a78bfa" strokeWidth={2.2} dot={false} />
      </ComposedChart></ResponsiveContainer></div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-2">
      <div className={`${panel} xl:col-span-4 p-3`}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-wide text-slate-300 uppercase">Top savdo</h3><span className="text-[10px] text-slate-600">summa bo‘yicha</span></div>
        <RankedBars rows={topSales} metric="total_sum" color="#60a5fa" />
      </div>
      <div className={`${panel} xl:col-span-4 p-3`}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-wide text-slate-300 uppercase">Top miqdor</h3><span className="text-[10px] text-slate-600">mahsulotlar kesimida</span></div>
        <RankedBars rows={topQuantity} metric="quantity" color="#22d3ee" />
      </div>
      <div className={`${panel} xl:col-span-4 p-3`}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-wide text-slate-300 uppercase">Mahsulot turlari</h3><span className="text-[10px] text-slate-600">savdo tarkibi</span></div>
        <div className="space-y-2.5">{data.types.slice(0,7).map(type => <div key={type.product_type}>
          <div className="flex items-center gap-2 text-xs mb-1"><span className="flex-1 truncate text-slate-300" title={type.product_type}>{type.product_type}</span><span className="text-slate-500 tabular-nums">{type.product_count} tur</span><span className="text-violet-300 tabular-nums w-12 text-right">{Number(type.share_pct).toFixed(1)}%</span></div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-violet-500/75 rounded-full" style={{width:`${Number(type.total_sum)/maxType*100}%`}}/></div>
        </div>)}</div>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
      <Breakdown title="Operator" subtitle="buyurtma oluvchi" rows={data.agents} color="#60a5fa" />
      <Breakdown title="Dostavshik" subtitle="yetkazib beruvchi" rows={data.deliveries} color="#22d3ee" />
      <Breakdown title="Otdel" subtitle="do‘kon turi guruhlari" rows={data.departments} color="#fbbf24" />
      <Breakdown title="Zona" subtitle="hududlar bo‘yicha" rows={data.regions} color="#c084fc" />
    </div>

    </>}

    {displayMode === 'details' && <div className={`${panel} flex-1 min-h-0 flex flex-col`}>
      <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between gap-3">
        <div><span className="text-xs font-bold uppercase tracking-wide text-slate-300">Barcha mahsulotlar</span><span className="text-[11px] text-slate-600 ml-2">{items.length} ta</span></div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-1.5 w-60"><Search size={13} className="text-slate-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki turini qidirish…" className="w-full bg-transparent outline-none text-xs text-slate-300 placeholder:text-slate-700"/></label>
      </div>
      <div className="overflow-auto flex-1 min-h-0"><table className="w-full text-xs min-w-[850px]">
        <thead className="sticky top-0 z-10 bg-slate-900"><tr className="text-slate-500 border-b border-slate-700/60">
          <th className="text-left px-4 py-2 font-medium">Mahsulot</th><th className="text-left px-3 py-2 font-medium">Turi</th>
          {([['order_count','Buyurtmalar'],['quantity','Miqdor'],['total_sum','Summa'],['avg_price','O‘rtacha narx'],['share_pct','Ulushi']] as const).map(([key,label])=><th key={key} onClick={()=>setSort(key)} className={`text-right px-3 py-2 font-medium cursor-pointer ${sort===key?'text-blue-300':'hover:text-slate-300'}`}>{label}{sort===key?' ↓':''}</th>)}
        </tr></thead>
        <tbody>{items.map(row=><tr key={row.product_id} className="border-b border-slate-800/80 hover:bg-white/[0.025]">
          <td className="px-4 py-2 text-slate-200 max-w-72 truncate" title={row.product_name}>{row.product_name}</td><td className="px-3 py-2 text-slate-500 max-w-40 truncate">{row.product_type}</td><td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmt(row.order_count)}</td><td className="px-3 py-2 text-right tabular-nums text-cyan-300">{fmt(row.quantity,3)}</td><td className="px-3 py-2 text-right tabular-nums text-emerald-300">{fmtSum(row.total_sum)}</td><td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtSum(row.avg_price)}</td><td className="px-3 py-2 text-right tabular-nums text-violet-300">{Number(row.share_pct).toFixed(1)}%</td>
        </tr>)}</tbody>
        <tfoot className="sticky bottom-0 bg-slate-900"><tr className="font-bold border-t-2 border-blue-500/30"><td className="px-4 py-2 text-blue-300" colSpan={2}>JAMI</td><td className="px-3 py-2 text-right">{fmt(summary.order_count)}</td><td className="px-3 py-2 text-right text-cyan-300">{fmt(summary.quantity,3)}</td><td className="px-3 py-2 text-right text-emerald-300">{fmtSum(summary.total_sum)}</td><td></td><td className="px-3 py-2 text-right text-violet-300">100%</td></tr></tfoot>
      </table></div>
    </div>}
  </section>
}

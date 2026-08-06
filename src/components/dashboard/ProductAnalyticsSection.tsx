import { useMemo, useState } from 'react'
import { Boxes, Clock3, PackageSearch, ReceiptText, Search, TrendingUp, WalletCards } from 'lucide-react'
import { useProductAnalytics } from '../../hooks/useAnalytics'
import { useAppStore } from '../../store/useAppStore'
import { fmtSum } from '../../utils/formatters'
import type { ProductAnalyticsItem } from '../../types/api'

type SortKey = 'total_sum' | 'quantity' | 'order_count' | 'avg_price' | 'share_pct'

const fmt = (value: number, digits = 0) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: digits,
}).format(Number(value || 0))

const panel = 'rounded-xl border overflow-hidden bg-slate-900/70 border-slate-700/60'

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

export default function ProductAnalyticsSection() {
  const dateField = useAppStore(s => s.dateField)
  const { data, isLoading, isError, isFetching } = useProductAnalytics()
  const [sort, setSort] = useState<SortKey>('total_sum')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return [...(data?.items ?? [])]
      .filter(row => !q || row.product_name.toLocaleLowerCase().includes(q) || row.product_type.toLocaleLowerCase().includes(q))
      .sort((a, b) => Number(b[sort]) - Number(a[sort]))
  }, [data?.items, query, sort])

  if (isLoading) return <div className="h-full flex items-center justify-center text-sm text-slate-500">Mahsulotlar tahlili yuklanmoqda…</div>
  if (isError || !data) return <div className="h-full flex items-center justify-center text-sm text-red-400">Mahsulotlar tahlilini yuklab bo‘lmadi</div>

  const { summary } = data
  const topSales = [...data.items].sort((a,b) => b.total_sum-a.total_sum).slice(0, 7)
  const topQuantity = [...data.items].sort((a,b) => b.quantity-a.quantity).slice(0, 7)
  const maxType = Math.max(...data.types.map(type => Number(type.total_sum)), 1)
  const sourceLabel = dateField === 'created_date' ? 'Yaratilgan sana · order_product' : 'Yetkazish sanasi · delivery_product'
  const freshness = summary.refreshed_at ? new Date(summary.refreshed_at) : null

  const cards = [
    { label: 'Mahsulotlar savdosi', value: `${fmtSum(summary.total_sum, true)} so‘m`, note: `${fmt(summary.product_count)} faol mahsulot`, icon: WalletCards, color:'#34d399' },
    { label: 'Buyurtmalar', value: fmt(summary.all_order_count), note: `${fmt(summary.order_count)} mahsulotli · ${fmt(summary.orders_without_products)} mahsulotsiz`, icon: ReceiptText, color:'#60a5fa' },
    { label: 'O‘rtacha mahsulotli buyurtma', value: `${fmtSum(summary.avg_order_sum, true)} so‘m`, note: 'faqat mahsulot satri mavjud', icon: TrendingUp, color:'#c084fc' },
    { label: 'Top-10 konsentratsiyasi', value: `${Number(summary.top10_share_pct).toFixed(1)}%`, note: 'jami mahsulotlar savdosidan', icon: Boxes, color:'#fbbf24' },
  ]

  return <section className="space-y-3 pb-2">
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2"><PackageSearch size={17} className="text-emerald-400"/><h2 className="font-bold text-slate-100">Mahsulotlar boshqaruv paneli</h2></div>
        <p className="text-[11px] text-slate-500 mt-0.5">{sourceLabel}</p>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
        <span className="text-slate-400">{isFetching ? 'Yangilanmoqda' : '5 daqiqalik monitoring'}</span>
        {freshness && <span className="flex items-center gap-1 text-slate-500 border-l border-slate-700 pl-2"><Clock3 size={11}/>{freshness.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>}
      </div>
    </div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
      {cards.map(card => <div key={card.label} className={`${panel} px-4 py-3 flex items-center gap-3 relative`}>
        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{background:card.color}} />
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{background:`${card.color}14`,border:`1px solid ${card.color}28`}}><card.icon size={17} style={{color:card.color}}/></div>
        <div className="min-w-0"><div className="text-[11px] text-slate-500">{card.label}</div><div className="text-xl font-black tabular-nums text-slate-100 truncate">{card.value}</div><div className="text-[10px] text-slate-600 truncate">{card.note}</div></div>
      </div>)}
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-12 gap-2.5">
      <div className={`${panel} xl:col-span-4 p-4`}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-wide text-slate-300 uppercase">Top savdo</h3><span className="text-[10px] text-slate-600">summa bo‘yicha</span></div>
        <RankedBars rows={topSales} metric="total_sum" color="#60a5fa" />
      </div>
      <div className={`${panel} xl:col-span-4 p-4`}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-wide text-slate-300 uppercase">Top miqdor</h3><span className="text-[10px] text-slate-600">mahsulotlar kesimida</span></div>
        <RankedBars rows={topQuantity} metric="quantity" color="#22d3ee" />
      </div>
      <div className={`${panel} xl:col-span-4 p-4`}>
        <div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold tracking-wide text-slate-300 uppercase">Mahsulot turlari</h3><span className="text-[10px] text-slate-600">savdo tarkibi</span></div>
        <div className="space-y-2.5">{data.types.slice(0,7).map(type => <div key={type.product_type}>
          <div className="flex items-center gap-2 text-xs mb-1"><span className="flex-1 truncate text-slate-300" title={type.product_type}>{type.product_type}</span><span className="text-slate-500 tabular-nums">{type.product_count} tur</span><span className="text-violet-300 tabular-nums w-12 text-right">{Number(type.share_pct).toFixed(1)}%</span></div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-violet-500/75 rounded-full" style={{width:`${Number(type.total_sum)/maxType*100}%`}}/></div>
        </div>)}</div>
      </div>
    </div>

    <div className={panel}>
      <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between gap-3">
        <div><span className="text-xs font-bold uppercase tracking-wide text-slate-300">Barcha mahsulotlar</span><span className="text-[11px] text-slate-600 ml-2">{items.length} ta</span></div>
        <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-1.5 w-60"><Search size={13} className="text-slate-600"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Mahsulot yoki turini qidirish…" className="w-full bg-transparent outline-none text-xs text-slate-300 placeholder:text-slate-700"/></label>
      </div>
      <div className="overflow-auto" style={{maxHeight:430}}><table className="w-full text-xs min-w-[850px]">
        <thead className="sticky top-0 z-10 bg-slate-900"><tr className="text-slate-500 border-b border-slate-700/60">
          <th className="text-left px-4 py-2 font-medium">Mahsulot</th><th className="text-left px-3 py-2 font-medium">Turi</th>
          {([['order_count','Buyurtmalar'],['quantity','Miqdor'],['total_sum','Summa'],['avg_price','O‘rtacha narx'],['share_pct','Ulushi']] as const).map(([key,label])=><th key={key} onClick={()=>setSort(key)} className={`text-right px-3 py-2 font-medium cursor-pointer ${sort===key?'text-blue-300':'hover:text-slate-300'}`}>{label}{sort===key?' ↓':''}</th>)}
        </tr></thead>
        <tbody>{items.map(row=><tr key={row.product_id} className="border-b border-slate-800/80 hover:bg-white/[0.025]">
          <td className="px-4 py-2 text-slate-200 max-w-72 truncate" title={row.product_name}>{row.product_name}</td><td className="px-3 py-2 text-slate-500 max-w-40 truncate">{row.product_type}</td><td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmt(row.order_count)}</td><td className="px-3 py-2 text-right tabular-nums text-cyan-300">{fmt(row.quantity,3)}</td><td className="px-3 py-2 text-right tabular-nums text-emerald-300">{fmtSum(row.total_sum)}</td><td className="px-3 py-2 text-right tabular-nums text-slate-500">{fmtSum(row.avg_price)}</td><td className="px-3 py-2 text-right tabular-nums text-violet-300">{Number(row.share_pct).toFixed(1)}%</td>
        </tr>)}</tbody>
        <tfoot className="sticky bottom-0 bg-slate-900"><tr className="font-bold border-t-2 border-blue-500/30"><td className="px-4 py-2 text-blue-300" colSpan={2}>JAMI</td><td className="px-3 py-2 text-right">{fmt(summary.order_count)}</td><td className="px-3 py-2 text-right text-cyan-300">{fmt(summary.quantity,3)}</td><td className="px-3 py-2 text-right text-emerald-300">{fmtSum(summary.total_sum)}</td><td></td><td className="px-3 py-2 text-right text-violet-300">100%</td></tr></tfoot>
      </table></div>
    </div>
  </section>
}

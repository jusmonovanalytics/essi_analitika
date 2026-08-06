import { useMemo, useState } from 'react'
import { Boxes, PackageCheck, ReceiptText, Search, WalletCards } from 'lucide-react'
import { useProductAnalytics } from '../../hooks/useAnalytics'
import { fmtSum } from '../../utils/formatters'
import type { ProductAnalyticsItem } from '../../types/api'
import { useAppStore } from '../../store/useAppStore'

type SortKey = 'total_sum' | 'quantity' | 'order_count' | 'avg_price' | 'share_pct'

const number = (value: number, digits = 0) => new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: digits,
}).format(value)

export default function ProductAnalyticsSection() {
  const dateField = useAppStore(s => s.dateField)
  const { data, isLoading, isError } = useProductAnalytics()
  const [metric, setMetric] = useState<SortKey>('total_sum')
  const [sort, setSort] = useState<SortKey>('total_sum')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return [...(data?.items ?? [])]
      .filter(x => !q || x.product_name.toLocaleLowerCase().includes(q) || x.product_type.toLocaleLowerCase().includes(q))
      .sort((a, b) => b[sort] - a[sort])
  }, [data?.items, query, sort])

  if (isLoading) return <div className="glass-card p-5 text-sm text-muted">Mahsulotlar tahlili yuklanmoqda…</div>
  if (isError || !data) return <div className="glass-card p-5 text-sm text-red-400">Mahsulotlar tahlilini yuklab bo‘lmadi</div>

  const summary = data.summary
  const top = [...data.items].sort((a, b) => b[metric] - a[metric]).slice(0, 10)
  const max = Math.max(...top.map(x => x[metric]), 1)
  const cards = [
    { label: 'Sotilgan miqdor', value: number(summary.quantity, 3), icon: PackageCheck, color: 'text-cyan-400' },
    { label: 'Buyurtmalar', value: number(summary.all_order_count), icon: ReceiptText, color: 'text-blue-400', sub: `${number(summary.order_count)} mahsulotli${summary.orders_without_products ? ` · ${number(summary.orders_without_products)} mahsulotsiz` : ''}` },
    { label: 'Faol mahsulotlar', value: number(summary.product_count), icon: Boxes, color: 'text-violet-400' },
    { label: 'Mahsulotlar savdosi', value: `${fmtSum(summary.total_sum)} so‘m`, icon: WalletCards, color: 'text-emerald-400' },
  ]

  const metricLabel = metric === 'total_sum' ? 'Summa' : metric === 'quantity' ? 'Miqdor' : 'Buyurtmalar'
  const metricValue = (row: ProductAnalyticsItem) => metric === 'total_sum'
    ? `${fmtSum(row.total_sum)} so‘m`
    : metric === 'quantity' ? number(row.quantity, 3) : number(row.order_count)

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-primary">Mahsulotlar tahlili</h2>
          <p className="text-xs text-muted mt-0.5">PostgreSQL · {dateField === 'created_date' ? 'buyurtma yaratilgan sana' : 'sotilgan/yetkazilgan sana'} · har 2 daqiqada yangilanadi</p>
        </div>
        {summary.refreshed_at && <span className="text-xs text-muted">Manba yangilangan: {new Date(summary.refreshed_at).toLocaleString('ru-RU')}</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(card => <div key={card.label} className="glass-card p-4 flex items-center gap-3">
          <card.icon size={20} className={card.color} />
          <div className="min-w-0"><div className="text-xs text-muted">{card.label}</div><div className={`text-lg font-bold tabular-nums truncate ${card.color}`}>{card.value}</div>{'sub' in card && card.sub && <div className="text-[11px] text-muted truncate">{card.sub}</div>}</div>
        </div>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 glass-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <span className="section-title">Top-10 mahsulot</span>
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              {([['total_sum','Summa'],['quantity','Miqdor'],['order_count','Buyurtma']] as const).map(([key,label]) =>
                <button key={key} onClick={() => setMetric(key)} className={`px-2.5 py-1 text-xs ${metric === key ? 'bg-blue-500/20 text-blue-300' : 'text-muted hover:text-primary'}`}>{label}</button>)}
            </div>
          </div>
          <div className="space-y-3">
            {top.map((row, i) => <div key={row.product_id}>
              <div className="flex gap-2 items-center text-xs mb-1"><span className="text-muted w-4">{i + 1}</span><span className="text-primary truncate flex-1" title={row.product_name}>{row.product_name}</span><span className="tabular-nums text-blue-300">{metricValue(row)}</span></div>
              <div className="ml-6 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div className="h-full rounded-full bg-blue-500/70" style={{ width: `${row[metric] / max * 100}%` }} /></div>
            </div>)}
          </div>
          <div className="text-[11px] text-muted mt-4 text-right">Saralash: {metricLabel}</div>
        </div>

        <div className="xl:col-span-7 glass-card overflow-hidden">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--bg-card-border)' }}>
            <div><span className="section-title">Barcha mahsulotlar</span><span className="text-xs text-muted ml-2">{items.length} ta</span></div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-700 px-2.5 py-1.5 min-w-52"><Search size={14} className="text-muted"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Mahsulotni qidirish…" className="bg-transparent outline-none text-xs text-primary w-full" /></label>
          </div>
          <div className="overflow-auto" style={{ maxHeight: 430 }}>
            <table className="w-full text-sm table-pro min-w-[760px]">
              <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}><tr>
                <th className="px-3 py-2.5 text-left text-xs text-muted">Mahsulot</th>
                <th className="px-3 py-2.5 text-left text-xs text-muted">Turi</th>
                {([['order_count','Buyurtmalar'],['quantity','Miqdor'],['total_sum','Summa'],['avg_price','O‘rtacha narx'],['share_pct','Ulushi']] as const).map(([key,label]) =>
                  <th key={key} onClick={() => setSort(key)} className={`px-3 py-2.5 text-right text-xs cursor-pointer ${sort === key ? 'text-blue-300' : 'text-muted'}`}>{label}{sort === key ? ' ↓' : ''}</th>)}
              </tr></thead>
              <tbody>{items.map(row => <tr key={row.product_id} className="border-b hover:bg-white/5" style={{ borderColor: 'var(--bg-card-border)' }}>
                <td className="px-3 py-2 text-primary max-w-64 truncate" title={row.product_name}>{row.product_name}</td>
                <td className="px-3 py-2 text-muted max-w-36 truncate" title={row.product_type}>{row.product_type}</td>
                <td className="px-3 py-2 text-right tabular-nums">{number(row.order_count)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-cyan-300">{number(row.quantity, 3)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-300">{fmtSum(row.total_sum)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted">{fmtSum(row.avg_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-300">{Number(row.share_pct).toFixed(1)}%</td>
              </tr>)}</tbody>
              <tfoot className="sticky bottom-0" style={{ background: 'var(--bg-card)' }}><tr className="border-t-2 border-blue-500/30 font-bold">
                <td className="px-3 py-2.5 text-blue-300" colSpan={2}>JAMI</td><td className="px-3 py-2.5 text-right">{number(summary.order_count)}</td><td className="px-3 py-2.5 text-right text-cyan-300">{number(summary.quantity, 3)}</td><td className="px-3 py-2.5 text-right text-emerald-300">{fmtSum(summary.total_sum)}</td><td></td><td className="px-3 py-2.5 text-right text-violet-300">100%</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useState, useMemo } from 'react'
import { Download, Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Order } from '../../types'
import { STATUS_CONFIG, PAYMENT_CONFIG } from '../../types'
import { fmtSum, fmtDate, fmtWeight } from '../../utils/formatters'
import { exportOrdersToExcel } from '../../utils/exportExcel'
import { cn } from '../../utils/cn'
import { useT } from '../../i18n'

type SortKey = keyof Pick<Order, 'order_number' | 'fact_price' | 'created_date' | 'date_delivery' | 'status'>

interface ExternalPagination {
  page: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
}

interface OrdersTableProps {
  orders: Order[]
  pageSize?: number
  onSearch?: (q: string) => void
  externalPagination?: ExternalPagination
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown size={12} className="text-slate-600" />
  return direction === 'asc'
    ? <ChevronUp size={12} className="text-blue-400" />
    : <ChevronDown size={12} className="text-blue-400" />
}

export default function OrdersTable({ orders, pageSize = 20, onSearch, externalPagination }: OrdersTableProps) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('order_number')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let result = orders

    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(o =>
        o.client.name.toLowerCase().includes(q) ||
        String(o.order_number).includes(q) ||
        o.user.first_name.toLowerCase().includes(q) ||
        (o.delivery_man?.first_name.toLowerCase() ?? '').includes(q)
      )
    }

    return [...result].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      if (sortKey === 'fact_price') { av = a.fact_price; bv = b.fact_price }
      else if (sortKey === 'order_number') { av = a.order_number; bv = b.order_number }
      else if (sortKey === 'created_date') { av = a.created_date; bv = b.created_date }
      else if (sortKey === 'date_delivery') { av = a.date_delivery; bv = b.date_delivery }
      else if (sortKey === 'status') { av = a.status; bv = b.status }

      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [orders, search, sortKey, sortDir, statusFilter])

  // Local pagination (used when externalPagination is NOT provided)
  const totalPages   = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated    = filtered.slice((page - 1) * pageSize, page * pageSize)
  const displayRows  = externalPagination ? filtered : paginated

  // External pagination info
  const extPage      = externalPagination?.page ?? 1
  const extTotal     = externalPagination?.totalCount ?? filtered.length
  const extPageSize  = externalPagination?.pageSize ?? pageSize
  const extPages     = Math.max(1, Math.ceil(extTotal / extPageSize))

  const columns: { key: SortKey | null; label: string; sortable?: boolean }[] = [
    { key: 'order_number', label: t('table.order_num'), sortable: true },
    { key: null, label: t('table.client') },
    { key: null, label: t('table.agent') },
    { key: null, label: t('table.delivery_man') },
    { key: 'fact_price', label: t('table.amount'), sortable: true },
    { key: 'status', label: t('table.status'), sortable: true },
    { key: null, label: t('table.payment') },
    { key: 'date_delivery', label: t('table.delivery_date'), sortable: true },
    { key: 'created_date', label: t('table.created_date'), sortable: true },
    { key: null, label: t('table.weight') },
  ]

  return (
    <div className="glass-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-800/60 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={t('table.search_placeholder')}
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(1)
              onSearch?.(e.target.value)
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-sm
                       text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 flex-wrap">
          {['all', '1', '2', '3', '5', '6'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={cn(
                'px-3 py-1 text-xs rounded-md transition-all',
                statusFilter === s ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {s === 'all' ? t('table.all_statuses') : t('status.' + s)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {externalPagination ? extTotal : filtered.length} {t('general.orders_unit')}
          </span>
          <button
            onClick={() => exportOrdersToExcel(filtered)}
            className="btn-ghost"
          >
            <Download size={14} />
            <span className="text-xs">{t('table.export')}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-pro">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.label}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap',
                    col.sortable && 'cursor-pointer hover:text-slate-300 select-none'
                  )}
                  onClick={() => col.sortable && col.key && handleSort(col.key as SortKey)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && col.key && (
                      <SortIcon active={sortKey === col.key} direction={sortDir} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map(order => {
              const status  = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['1']
              const payment = PAYMENT_CONFIG[order.payment_type]
              return (
                <tr key={order.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-blue-400 font-semibold">#{order.order_number}</td>
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium truncate max-w-[180px]">{order.client.name}</p>
                    <p className="text-slate-600 text-xs">{order.market.border.title}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{order.user.first_name}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {order.delivery_man?.first_name ?? <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-white font-semibold tabular-nums">
                    {fmtSum(order.fact_price)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${status.bg} ${status.color} border`}>{t('status.' + order.status)}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {payment?.icon} {payment?.label ?? order.payment_type}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(order.date_delivery)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(order.created_date)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmtWeight(order.total_weight)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {externalPagination ? (
        /* Server-side pagination */
        extPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60">
            <span className="text-slate-500 text-xs">
              {(extPage - 1) * extPageSize + 1}–{Math.min(extPage * extPageSize, extTotal)} / {extTotal}
            </span>
            <div className="flex gap-1 items-center">
              <button
                onClick={() => externalPagination.onPageChange(1)}
                disabled={extPage === 1}
                className="px-2 py-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 text-xs"
              >
                «
              </button>
              <button
                onClick={() => externalPagination.onPageChange(extPage - 1)}
                disabled={extPage === 1}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(7, extPages) }, (_, i) => {
                const start = Math.max(1, Math.min(extPage - 3, extPages - 6))
                const n = start + i
                if (n > extPages) return null
                return (
                  <button key={n} onClick={() => externalPagination.onPageChange(n)}
                    className={cn('w-8 h-7 rounded text-xs', n === extPage
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                    )}>
                    {n}
                  </button>
                )
              })}
              <button
                onClick={() => externalPagination.onPageChange(extPage + 1)}
                disabled={extPage === extPages}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => externalPagination.onPageChange(extPages)}
                disabled={extPage === extPages}
                className="px-2 py-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 text-xs"
              >
                »
              </button>
            </div>
          </div>
        )
      ) : (
        /* Client-side pagination */
        totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60">
            <span className="text-slate-500 text-xs">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 text-sm">
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                return (
                  <button key={n} onClick={() => setPage(n)}
                    className={cn('w-8 h-7 rounded text-xs', n === page
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                    )}>
                    {n}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 text-sm">
                ›
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../store/useAppStore'
import OrdersTable from '../components/tables/OrdersTable'
import { useKpis } from '../hooks/useAnalytics'
import { fmtSum } from '../utils/formatters'
import type { Order } from '../types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8001'
const PAGE_SIZE = 100

function useOrdersData(
  dateFrom: string,
  dateTo: string,
  dateField: string,
  search: string,
  page: number,
) {
  const params = new URLSearchParams({
    dateFrom, dateTo, dateField,
    page: String(page),
    pageSize: String(PAGE_SIZE),
    ...(search ? { search } : {}),
  })
  return useQuery({
    queryKey: ['orders', dateFrom, dateTo, dateField, search, page],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/orders?${params}`)
      if (!res.ok) throw new Error('Orders fetch failed')
      return res.json() as Promise<{ count: number; results: Order[] }>
    },
    staleTime: 60_000,
    placeholderData: prev => prev,
  })
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function Orders() {
  const { dateRange, dateField } = useAppStore()
  const { data: kpis } = useKpis()

  const [page, setPage]           = useState(1)
  const [searchInput, setSearch]  = useState('')
  const debouncedSearch           = useDebounce(searchInput)

  // Reset to page 1 when date/search changes
  const prevKey = useRef('')
  const key = `${dateRange.from}-${dateRange.to}-${dateField}-${debouncedSearch}`
  if (key !== prevKey.current) {
    prevKey.current = key
    if (page !== 1) setPage(1)
  }

  const { data, isLoading, isFetching } = useOrdersData(
    dateRange.from, dateRange.to, dateField, debouncedSearch, page,
  )

  const orders     = data?.results ?? []
  const totalCount = data?.count ?? 0

  const handleSearch = useCallback((q: string) => {
    setSearch(q)
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4">

        {/* Status summary */}
        <div className="glass-card px-5 py-3 flex items-center gap-4 flex-wrap">
          {[
            { label: 'Jami',        value: totalCount,                   color: 'text-white' },
            { label: 'Yetkazilgan', value: kpis?.delivered_orders ?? 0,  color: 'text-emerald-400' },
            { label: 'Kutilmoqda',  value: kpis?.pending_orders   ?? 0,  color: 'text-amber-400' },
            { label: 'Jami summa',  value: fmtSum(kpis?.total_sum ?? 0, true) + ' so\'m', color: 'text-blue-400' },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && <div className="w-px h-8 bg-slate-800" />}
              <div>
                <p className="text-slate-500 text-xs">{s.label}</p>
                <p className={`font-bold text-lg tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            </div>
          ))}
          {isFetching && !isLoading && (
            <div className="ml-auto flex items-center gap-2 text-slate-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Yangilanmoqda...
            </div>
          )}
        </div>

        {/* Orders table */}
        {isLoading ? (
          <div className="glass-card h-64 animate-pulse rounded-xl bg-slate-800/40" />
        ) : (
          <OrdersTable
            orders={orders}
            onSearch={handleSearch}
            pageSize={25}
            externalPagination={totalCount > PAGE_SIZE ? {
              page,
              totalCount,
              pageSize: PAGE_SIZE,
              onPageChange: setPage,
            } : undefined}
          />
        )}
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import axios from 'axios'

const BACKEND = 'http://localhost:8001'

export interface PeriodStats {
  date_from: string
  date_to: string
  total_orders: number
  total_sum: number
  active_agents: number
  delivered_orders: number
  pending_orders: number
  delivery_rate: number
  regions: number
  top_agents: { name: string; count: number; sum: number }[]
  regional: { name: string; count: number; sum: number }[]
}

async function fetchStats(dateFrom: string, dateTo: string): Promise<PeriodStats> {
  const res = await axios.get(`${BACKEND}/api/stats`, {
    params: { dateFrom, dateTo },
  })
  return res.data
}

export function useStatsData(dateFrom: string, dateTo: string) {
  return useQuery<PeriodStats>({
    queryKey: ['stats', dateFrom, dateTo],
    queryFn: () => fetchStats(dateFrom, dateTo),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: !!dateFrom && !!dateTo,
  })
}

/** Returns stats for the previous equivalent period (for comparison) */
export function usePrevStatsData(dateFrom: string, dateTo: string) {
  const from = new Date(dateFrom)
  const to   = new Date(dateTo)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)

  const prevTo   = format(subDays(from, 1), 'yyyy-MM-dd')
  const prevFrom = format(subDays(from, days), 'yyyy-MM-dd')

  return useQuery<PeriodStats>({
    queryKey: ['stats', prevFrom, prevTo],
    queryFn: () => fetchStats(prevFrom, prevTo),
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!dateFrom && !!dateTo,
  })
}

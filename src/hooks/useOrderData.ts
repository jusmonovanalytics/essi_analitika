import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useEffect } from 'react'
import { fetchAllOrders, connectWebSocket } from '../api/client'
import { processOrders } from '../utils/dataProcessors'
import { useAppStore } from '../store/useAppStore'
import type { ProcessedData } from '../types'

const LIVE_REFETCH_MS = 5 * 60 * 1000

export function useOrderData() {
  const { dateRange, dateField, isLive, setLastRefresh, setWsConnected, addNotification } = useAppStore()
  const prevAgentsRef = useRef<ProcessedData['agents']>([])
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching, error, refetch } = useQuery<ProcessedData>({
    queryKey: ['orders', dateRange.from, dateRange.to, dateField],
    queryFn: async () => {
      const orders = await fetchAllOrders({
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
        dateField,
      })
      const processed = processOrders(orders, prevAgentsRef.current)
      prevAgentsRef.current = processed.agents
      setLastRefresh(new Date())
      return processed
    },
    refetchInterval: isLive() ? LIVE_REFETCH_MS : false,
    staleTime: isLive() ? LIVE_REFETCH_MS : Infinity,
    retry: 2,
  })

  // Try WebSocket connection
  useEffect(() => {
    if (!isLive()) return

    const ws = connectWebSocket(
      (orders) => {
        const processed = processOrders(orders, prevAgentsRef.current)
        prevAgentsRef.current = processed.agents
        setLastRefresh(new Date())
        setWsConnected(true)
        queryClient.setQueryData(['orders', dateRange.from, dateRange.to, dateField], processed)
      },
      () => setWsConnected(false),
    )

    return () => { ws?.close(); setWsConnected(false) }
  }, [dateRange.from, dateRange.to, dateField]) // eslint-disable-line

  useEffect(() => {
    if (error) addNotification({ type: 'error', message: 'API ga ulanishda xatolik yuz berdi' })
  }, [error]) // eslint-disable-line

  return { data, isLoading, isFetching, error, refetch }
}

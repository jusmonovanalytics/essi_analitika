import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '../store/useAppStore'
import * as api from '../api/endpoints'
import type { DateFilters } from '../api/endpoints'
import type { StatusPoint } from '../types/api'
import type { ExtendedChartsData, DeliveryExtData } from '../types/api'

// 2-minute refresh for live periods (today / yesterday / week / month)
const LIVE_MS = 2 * 60 * 1000

function useFilterState(): DateFilters {
  const dateRange = useAppStore(s => s.dateRange)
  const filters   = useAppStore(s => s.filters)
  return {
    dateFrom:       dateRange.from,
    dateTo:         dateRange.to,
    agentId:        filters.agentId,
    region:         filters.region,
    paymentType:    filters.paymentType,
    deliveryManId:  filters.deliveryManId,
    statusFilter:   filters.statusFilter,
  }
}

function useRefetchInterval() {
  const isLive = useAppStore(s => s.isLive())
  return isLive ? LIVE_MS : false as const
}

// ─── KPI cards ───────────────────────────────────────────────────────────────
export function useKpis() {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['kpis', f],
    queryFn: () => api.fetchKpis(f),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Agent marathon ───────────────────────────────────────────────────────────
export function useAgents() {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['agents', f],
    queryFn: () => api.fetchAgents(f),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Delivery rankings ────────────────────────────────────────────────────────
export function useDeliveries() {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['deliveries', f],
    queryFn: () => api.fetchDeliveries(f),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Live feed ────────────────────────────────────────────────────────────────
export function useLiveOrders(limit = 20) {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['live', f, limit],
    queryFn: () => api.fetchLiveOrders(f, limit),
    refetchInterval: ri,
    staleTime: 30_000,
  })
}

// ─── Charts ───────────────────────────────────────────────────────────────────
export function useCharts() {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['charts', f],
    queryFn: () => api.fetchCharts(f),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Clients ─────────────────────────────────────────────────────────────────
export function useClients(limit = 20) {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['clients', f, limit],
    queryFn: () => api.fetchClients(f, limit),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Filter options ───────────────────────────────────────────────────────────
export function useFilterOptions() {
  const dateRange = useAppStore(s => s.dateRange)
  return useQuery({
    queryKey: ['filters', dateRange.from, dateRange.to],
    queryFn: () => api.fetchFilterOptions(dateRange.from, dateRange.to),
    staleTime: 5 * 60_000,
  })
}

// ─── Status distribution ─────────────────────────────────────────────────────
export function useStatusStats() {
  const dateRange = useAppStore(s => s.dateRange)
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['statusStats', dateRange.from, dateRange.to],
    queryFn: (): Promise<StatusPoint[]> => api.fetchStatusStats(dateRange.from, dateRange.to),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Extended charts (weekday + market type) ─────────────────────────────────
export function useChartsExtended() {
  const dateRange = useAppStore(s => s.dateRange)
  const statusFilter = useAppStore(s => s.filters.statusFilter)
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['chartsExt', dateRange.from, dateRange.to, statusFilter],
    queryFn: (): Promise<ExtendedChartsData> =>
      api.fetchChartsExtended(dateRange.from, dateRange.to, statusFilter),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Extended deliveries ─────────────────────────────────────────────────────
export function useDeliveriesExtended(limit = 30) {
  const f = useFilterState()
  const ri = useRefetchInterval()
  return useQuery({
    queryKey: ['deliveriesExt', f, limit],
    queryFn: (): Promise<DeliveryExtData[]> => api.fetchDeliveriesExtended(f, limit),
    refetchInterval: ri,
    refetchIntervalInBackground: true,
    staleTime: 60_000,
  })
}

// ─── Sync status ─────────────────────────────────────────────────────────────
export function useSyncStatus() {
  return useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => api.fetchSyncStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

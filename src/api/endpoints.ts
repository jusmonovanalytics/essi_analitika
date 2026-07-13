import type {
  KPIData, AgentData, DeliveryData, LiveOrderData,
  ChartsData, ClientData, FilterOptions, ActiveFilters, StatusPoint,
  ExtendedChartsData, DeliveryExtData,
} from '../types/api'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8001'

async function get<T>(path: string, params: Record<string, string | number | undefined | null> = {}): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v))
  }
  const url = `${BASE}${path}${q.toString() ? '?' + q : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export type DateFilters = {
  dateFrom: string
  dateTo: string
} & Partial<ActiveFilters>

const joinIds   = (a: number[] | null | undefined) => a?.length ? a.join(',') : undefined
const joinStrs  = (a: string[] | null | undefined) => a?.length ? a.join(',') : undefined

export const fetchKpis = (f: DateFilters) =>
  get<KPIData>('/api/kpis', {
    dateFrom: f.dateFrom, dateTo: f.dateTo,
    agentId: joinIds(f.agentId), region: joinStrs(f.region),
    paymentType: joinStrs(f.paymentType), deliveryManId: joinIds(f.deliveryManId),
    status: joinStrs(f.statusFilter),
  })

export const fetchAgents = (f: DateFilters) =>
  get<AgentData[]>('/api/agents', {
    dateFrom: f.dateFrom, dateTo: f.dateTo,
    region: joinStrs(f.region), paymentType: joinStrs(f.paymentType),
    deliveryManId: joinIds(f.deliveryManId), status: joinStrs(f.statusFilter),
  })

export const fetchDeliveries = (f: DateFilters) =>
  get<DeliveryData[]>('/api/deliveries', {
    dateFrom: f.dateFrom, dateTo: f.dateTo,
    agentId: joinIds(f.agentId), region: joinStrs(f.region),
    paymentType: joinStrs(f.paymentType), status: joinStrs(f.statusFilter),
  })

export const fetchLiveOrders = (f: DateFilters, limit = 20) =>
  get<LiveOrderData[]>('/api/live', {
    dateFrom: f.dateFrom, dateTo: f.dateTo, limit,
    agentId: joinIds(f.agentId), region: joinStrs(f.region),
    paymentType: joinStrs(f.paymentType), deliveryManId: joinIds(f.deliveryManId),
    status: joinStrs(f.statusFilter),
  })

export const fetchCharts = (f: DateFilters) =>
  get<ChartsData>('/api/charts', {
    dateFrom: f.dateFrom, dateTo: f.dateTo,
    agentId: joinIds(f.agentId), region: joinStrs(f.region),
    paymentType: joinStrs(f.paymentType), deliveryManId: joinIds(f.deliveryManId),
    status: joinStrs(f.statusFilter),
  })

export const fetchClients = (f: DateFilters, limit = 20) =>
  get<ClientData[]>('/api/clients', {
    dateFrom: f.dateFrom, dateTo: f.dateTo, limit,
    agentId: joinIds(f.agentId), region: joinStrs(f.region),
    paymentType: joinStrs(f.paymentType), deliveryManId: joinIds(f.deliveryManId),
    status: joinStrs(f.statusFilter),
  })

export const fetchFilterOptions = (dateFrom: string, dateTo: string) =>
  get<FilterOptions>('/api/filters', { dateFrom, dateTo })

export const fetchSyncStatus = () =>
  get<{ total_orders: number; last_sync: string | null; oldest_order: string | null; newest_order: string | null }>(
    '/api/sync/status'
  )

export const fetchStatusStats = (dateFrom: string, dateTo: string) =>
  get<StatusPoint[]>('/api/status-stats', { dateFrom, dateTo })

export const fetchChartsExtended = (dateFrom: string, dateTo: string, statuses?: string[] | null) =>
  get<ExtendedChartsData>('/api/charts-extended', { dateFrom, dateTo, status: joinStrs(statuses) })

export const fetchDeliveriesExtended = (f: DateFilters, limit = 30) =>
  get<DeliveryExtData[]>('/api/deliveries-extended', {
    dateFrom: f.dateFrom, dateTo: f.dateTo,
    agentId: joinIds(f.agentId), region: joinStrs(f.region),
    paymentType: joinStrs(f.paymentType), status: joinStrs(f.statusFilter),
    limit,
  })

export const triggerSync = () =>
  fetch(`${BASE}/api/sync/trigger`, { method: 'POST' }).then(r => r.json())

import axios from 'axios'
import type { Order, PaginatedResponse } from '../types'
import { format } from 'date-fns'

const BACKEND_URL = 'http://localhost:8001'

export const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
})

export type DateField = 'created_date' | 'date_delivery'

export interface FetchOrdersParams {
  dateFrom?: string
  dateTo?: string
  dateField?: DateField
  page?: number
  pageSize?: number
  search?: string
}

export async function fetchOrdersPage(params: FetchOrdersParams = {}): Promise<PaginatedResponse<Order>> {
  const { dateFrom, dateTo, dateField = 'created_date', page = 1, pageSize = 100, search } = params
  const qp: Record<string, string | number> = {
    dateField,
    page,
    pageSize,
  }
  if (dateFrom) qp['dateFrom'] = dateFrom
  if (dateTo)   qp['dateTo']   = dateTo
  if (search)   qp['search']   = search

  const res = await api.get<PaginatedResponse<Order>>('/api/orders', { params: qp })
  return res.data
}

export async function fetchAllOrders(params: FetchOrdersParams = {}): Promise<Order[]> {
  const all: Order[] = []
  let page = 1

  while (true) {
    const data = await fetchOrdersPage({ ...params, page, pageSize: 200 })
    all.push(...data.results)
    if (!data.next || all.length >= data.count) break
    page++
  }

  return all
}

export function getTodayRange() {
  const today = format(new Date(), 'yyyy-MM-dd')
  return { dateFrom: today, dateTo: today }
}

export function getYesterdayRange() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = format(d, 'yyyy-MM-dd')
  return { dateFrom: y, dateTo: y }
}

export function getWeekRange() {
  const to = format(new Date(), 'yyyy-MM-dd')
  const from = new Date()
  from.setDate(from.getDate() - 6)
  return { dateFrom: format(from, 'yyyy-MM-dd'), dateTo: to }
}

export function getMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  return { dateFrom: format(from, 'yyyy-MM-dd'), dateTo: format(now, 'yyyy-MM-dd') }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────

export type WSMessageHandler = (orders: Order[]) => void

export function connectWebSocket(
  onMessage: WSMessageHandler,
  onError?: () => void,
  serverUrl = 'ws://localhost:8001/ws'
): WebSocket | null {
  try {
    const ws = new WebSocket(serverUrl)
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload.type === 'orders_update' && Array.isArray(payload.data)) {
          onMessage(payload.data)
        }
      } catch { /* ignore */ }
    }
    ws.onerror = () => onError?.()
    return ws
  } catch {
    onError?.()
    return null
  }
}

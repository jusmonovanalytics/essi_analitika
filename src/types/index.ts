// ─── Raw API types ────────────────────────────────────────────────────────────

export interface Position { id: number; name: string }

export interface ApiUser {
  id: number
  first_name: string
  second_name: string
  position: Position
  phone_number: string
}

export interface ApiClient { id: number; name: string }

export interface MarketType { id: number; name: string }
export interface Border { id: number; title: string }

export interface ApiMarket {
  id: number
  name: string
  market_type: MarketType
  address: string | null
  uuid: string
  border: Border
  inn: string
}

export interface Currency { id: number; name: string; sign: string; price_list: null }
export interface Division { id: number; name: string }
export interface CustomPaymentType { name: string; key: string; type: string }

export interface Order {
  id: number
  uuid: string
  user: ApiUser
  expeditor: ApiUser | null
  delivery_man: ApiUser | null
  is_new: boolean
  client: ApiClient
  market: ApiMarket
  status: string
  contract: null
  currency: Currency
  division: Division
  deal_type: string
  total_price: string
  created_date: string
  payment_type: string
  custom_payment_type: CustomPaymentType
  payment_date: string
  date_delivery: string
  total_balance: string
  request_deadline: null
  order_number: number
  total_amount_products: null
  total_balance_client: null
  fact_price: number
  total_return_price: string
  comment: string | null
  invoice_number: null
  invoice_date: null
  invoice_is_active: boolean
  transport: null
  accepted_time: null
  discount_price: string
  is_paid: boolean
  is_fiscal: boolean
  total_weight: string
  discount_percent: number
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ─── Processed / derived types ───────────────────────────────────────────────

export interface AgentStats {
  id: number
  name: string
  firstName: string
  position: string
  orderCount: number
  totalSum: number
  deliveredCount: number
  pendingCount: number
  totalWeight: number
  rank: number
  prevRank: number
  rankChange: number
  avgOrderValue: number
  orders: Order[]
}

export interface DeliveryStats {
  id: number
  name: string
  orderCount: number
  totalSum: number
  totalWeight: number
  orders: Order[]
}

export interface ClientStats {
  id: number
  name: string
  marketType: string
  district: string
  orderCount: number
  totalSum: number
  orders: Order[]
}

export interface HourlyData {
  hour: string
  count: number
  sum: number
}

export interface DailyData {
  date: string
  count: number
  sum: number
}

export interface RegionalStats {
  name: string
  count: number
  sum: number
}

export interface ProcessedData {
  orders: Order[]
  agents: AgentStats[]
  deliveries: DeliveryStats[]
  clients: ClientStats[]
  hourly: HourlyData[]
  daily: DailyData[]
  regional: RegionalStats[]
  totalOrders: number
  totalSum: number
  deliveredOrders: number
  pendingOrders: number
  activeAgents: number
  deliverySuccessRate: number
  avgOrdersPerAgent: number
}

// ─── UI types ─────────────────────────────────────────────────────────────────

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export interface DateRange {
  preset: DatePreset
  from: string
  to: string
}

export interface Notification {
  id: string
  type: 'warning' | 'error' | 'info' | 'success'
  message: string
  timestamp: Date
  dismissed: boolean
}

export type SortDirection = 'asc' | 'desc'

// ─── Constants ─────────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  '0': { label: 'Yangi',         color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/30' },
  '1': { label: 'Tasdiqlangan',  color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/30' },
  '2': { label: 'Jarayonda',     color: 'text-cyan-400',    bg: 'bg-cyan-400/10 border-cyan-400/30' },
  '3': { label: 'Yolda',         color: 'text-purple-400',  bg: 'bg-purple-400/10 border-purple-400/30' },
  '4': { label: 'Qaytarilgan',   color: 'text-orange-400',  bg: 'bg-orange-400/10 border-orange-400/30' },
  '5': { label: 'Yetkazilgan',   color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  '6': { label: 'Bekor qilingan',color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30' },
}

export const PAYMENT_CONFIG: Record<string, { label: string; icon: string }> = {
  bank: { label: 'Bank', icon: '🏦' },
  cash: { label: 'Naqd', icon: '💵' },
}

export const MEDAL_CONFIG = [
  { emoji: '🥇', color: 'medal-gold', text: 'text-yellow-400', shadow: 'shadow-glow-amber' },
  { emoji: '🥈', color: 'medal-silver', text: 'text-slate-300', shadow: '' },
  { emoji: '🥉', color: 'medal-bronze', text: 'text-orange-400', shadow: '' },
]

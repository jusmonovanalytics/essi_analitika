// ─── KPI ──────────────────────────────────────────────────────────────────────
export interface KPIData {
  total_orders: number
  total_sum: number
  avg_check: number
  active_agents: number
  active_deliveries: number
  delivered_orders: number
  pending_orders: number
  cancelled_orders: number
  delivery_rate: number
  prev: {
    total_orders: number
    total_sum: number
    avg_check: number
    active_agents: number
    delivered_orders: number
    delivery_rate: number
  }
  period: { from: string; to: string }
  prev_period: { from: string; to: string }
}

// ─── Agents ───────────────────────────────────────────────────────────────────
export interface AgentData {
  user_id: number
  user_name: string
  order_count: number
  total_sum: number
  avg_check: number
  client_count: number
  share_pct: number
  daily_rank: number
  delivered_count: number
  pending_count: number
  total_weight: number
}

// ─── Deliveries ───────────────────────────────────────────────────────────────
export interface DeliveryData {
  delivery_man_id: number
  delivery_man_name: string
  order_count: number
  total_sum: number
  avg_order_sum: number
  rank: number
}

// ─── Live orders ──────────────────────────────────────────────────────────────
export interface LiveOrderData {
  id: number
  order_number: number
  client_name: string
  user_name: string
  delivery_man_name: string | null
  fact_price: number
  status: string
  payment_type: string
  market_border: string | null
  created_date: string
}

// ─── Charts ───────────────────────────────────────────────────────────────────
export interface HourlyPoint { hour: number; order_count: number; total_sum: number }
export interface DailyPoint  { day: string; order_count: number; total_sum: number; avg_check: number }
export interface RegionalPoint { region: string; order_count: number; total_sum: number; avg_check: number }
export interface PaymentPoint  { payment_type: string; order_count: number; total_sum: number; share_pct: number }
export interface AgentChartPoint { user_name: string; order_count: number; total_sum: number }

export interface ChartsData {
  hourly:      HourlyPoint[]
  daily:       DailyPoint[]
  regional:    RegionalPoint[]
  payments:    PaymentPoint[]
  agent_chart: AgentChartPoint[]
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export interface ClientData {
  client_id: number
  client_name: string
  order_count: number
  total_sum: number
}

// ─── Status distribution ─────────────────────────────────────────────────────
export interface StatusPoint {
  status: string
  order_count: number
  total_sum: number
  share_pct: number
}

// ─── Weekday / Market type ───────────────────────────────────────────────────
export interface WeekdayPoint {
  weekday_num: number
  order_count: number
  total_sum: number
  avg_check: number
  day_count: number
}

export interface MarketTypePoint {
  market_type: string
  order_count: number
  total_sum: number
  share_pct: number
}

export interface ExtendedChartsData {
  weekday: WeekdayPoint[]
  market_types: MarketTypePoint[]
}

// ─── Extended Delivery ────────────────────────────────────────────────────────
export interface DeliveryExtData {
  delivery_man_id: number
  delivery_man_name: string
  order_count: number
  total_sum: number
  avg_order_sum: number
  total_weight: number
  region_count: number
  rank: number
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface FilterOptions {
  agents:        { user_id: number; user_name: string }[]
  regions:       string[]
  delivery_men:  { delivery_man_id: number; delivery_man_name: string }[]
  payment_types: string[]
}

export interface ActiveFilters {
  agentId:        number[] | null
  region:         string[] | null
  paymentType:    string[] | null
  deliveryManId:  number[] | null
  statusFilter:   string[] | null
}

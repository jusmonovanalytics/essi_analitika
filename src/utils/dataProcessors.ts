import type { Order, AgentStats, DeliveryStats, ClientStats, HourlyData, ProcessedData, RegionalStats } from '../types'

export function processOrders(orders: Order[], prevAgents: AgentStats[] = []): ProcessedData {
  const prevRankMap = new Map(prevAgents.map(a => [a.id, a.rank]))

  // Agent stats
  const agentMap = new Map<number, AgentStats>()
  for (const order of orders) {
    const u = order.user
    if (!agentMap.has(u.id)) {
      agentMap.set(u.id, {
        id: u.id,
        name: `${u.first_name} ${u.second_name}`,
        firstName: u.first_name,
        position: u.position.name,
        orderCount: 0,
        totalSum: 0,
        deliveredCount: 0,
        pendingCount: 0,
        totalWeight: 0,
        rank: 0,
        prevRank: prevRankMap.get(u.id) ?? 0,
        rankChange: 0,
        avgOrderValue: 0,
        orders: [],
      })
    }
    const agent = agentMap.get(u.id)!
    agent.orderCount++
    agent.totalSum += order.fact_price
    agent.totalWeight += parseFloat(order.total_weight)
    if (order.status === '5') agent.deliveredCount++
    else agent.pendingCount++
    agent.orders.push(order)
  }

  const agents = Array.from(agentMap.values())
    .sort((a, b) => b.orderCount - a.orderCount)
    .map((a, i) => {
      const rank = i + 1
      const prevRank = a.prevRank || rank
      return {
        ...a,
        rank,
        rankChange: prevRank - rank,
        avgOrderValue: a.orderCount > 0 ? a.totalSum / a.orderCount : 0,
      }
    })

  // Delivery stats
  const deliveryMap = new Map<number, DeliveryStats>()
  for (const order of orders) {
    const dm = order.delivery_man
    if (!dm) continue
    if (!deliveryMap.has(dm.id)) {
      deliveryMap.set(dm.id, {
        id: dm.id,
        name: `${dm.first_name} ${dm.second_name}`,
        orderCount: 0,
        totalSum: 0,
        totalWeight: 0,
        orders: [],
      })
    }
    const d = deliveryMap.get(dm.id)!
    d.orderCount++
    d.totalSum += order.fact_price
    d.totalWeight += parseFloat(order.total_weight)
    d.orders.push(order)
  }
  const deliveries = Array.from(deliveryMap.values()).sort((a, b) => b.orderCount - a.orderCount)

  // Client stats
  const clientMap = new Map<number, ClientStats>()
  for (const order of orders) {
    const c = order.client
    if (!clientMap.has(c.id)) {
      clientMap.set(c.id, {
        id: c.id,
        name: c.name,
        marketType: order.market.market_type.name,
        district: order.market.border.title,
        orderCount: 0,
        totalSum: 0,
        orders: [],
      })
    }
    const cl = clientMap.get(c.id)!
    cl.orderCount++
    cl.totalSum += order.fact_price
    cl.orders.push(order)
  }
  const clients = Array.from(clientMap.values()).sort((a, b) => b.totalSum - a.totalSum)

  // Hourly distribution
  const hourMap = new Map<number, { count: number; sum: number }>()
  for (let h = 0; h < 24; h++) hourMap.set(h, { count: 0, sum: 0 })
  for (const order of orders) {
    const h = new Date(order.created_date).getHours()
    const entry = hourMap.get(h)!
    entry.count++
    entry.sum += order.fact_price
  }
  const hourly: HourlyData[] = Array.from(hourMap.entries()).map(([h, d]) => ({
    hour: `${String(h).padStart(2, '0')}:00`,
    count: d.count,
    sum: d.sum,
  }))

  // Daily distribution
  const dayMap = new Map<string, { count: number; sum: number }>()
  for (const order of orders) {
    const date = order.created_date.slice(0, 10)
    if (!dayMap.has(date)) dayMap.set(date, { count: 0, sum: 0 })
    const d = dayMap.get(date)!
    d.count++
    d.sum += order.fact_price
  }
  const daily = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }))

  // Regional stats
  const regionMap = new Map<string, { count: number; sum: number }>()
  for (const order of orders) {
    const name = order.market?.border?.title || 'Noma\'lum'
    if (!regionMap.has(name)) regionMap.set(name, { count: 0, sum: 0 })
    const r = regionMap.get(name)!
    r.count++
    r.sum += order.fact_price
  }
  const regional: RegionalStats[] = Array.from(regionMap.entries())
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  const totalOrders = orders.length
  const totalSum = orders.reduce((s, o) => s + o.fact_price, 0)
  const deliveredOrders = orders.filter(o => o.status === '5').length
  const pendingOrders = orders.filter(o => o.status !== '5').length
  const activeAgents = agents.length
  const deliverySuccessRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0
  const avgOrdersPerAgent = activeAgents > 0 ? totalOrders / activeAgents : 0

  return {
    orders,
    agents,
    deliveries,
    clients,
    hourly,
    daily,
    regional,
    totalOrders,
    totalSum,
    deliveredOrders,
    pendingOrders,
    activeAgents,
    deliverySuccessRate,
    avgOrdersPerAgent,
  }
}

export function getOrdersSince(orders: Order[], minutes: number): Order[] {
  const cutoff = Date.now() - minutes * 60 * 1000
  return orders.filter(o => new Date(o.created_date).getTime() > cutoff)
}

import * as XLSX from 'xlsx'
import type { Order, AgentStats } from '../types'
import { fmtDate, fmtSum } from './formatters'

const STATUS_LABELS: Record<string, string> = {
  '0': 'Yangi',
  '1': 'Tasdiqlangan',
  '2': 'Jarayonda',
  '3': "Yo'lda",
  '4': 'Qaytarilgan',
  '5': 'Yetkazilgan',
  '6': 'Bekor qilingan',
}

export function exportOrdersToExcel(orders: Order[], filename = 'orders') {
  const rows = orders.map(o => ({
    '№': o.order_number,
    'Mijoz': o.client?.name ?? '',
    'Agent': o.user ? `${o.user.first_name} ${o.user.second_name}` : '',
    'Yetkazuvchi': o.delivery_man
      ? `${o.delivery_man.first_name} ${o.delivery_man.second_name}`
      : '',
    'Summa': o.fact_price,
    'Status': STATUS_LABELS[o.status] ?? o.status,
    "To'lov": o.custom_payment_type?.name ?? o.payment_type ?? '',
    'Yaratilgan': fmtDate(o.created_date),
    'Yetkazish sanasi': o.date_delivery ?? '',
    "Og'irlik (kg)": o.total_weight ? parseFloat(o.total_weight).toFixed(0) : '',
    'Chegirma': o.discount_percent ?? 0,
    'Hudud': o.market?.border?.title ?? '',
    'Market turi': o.market?.market_type?.name ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Buyurtmalar')

  const cols = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String((r as Record<string, unknown>)[key] ?? '').length)) + 2,
  }))
  ws['!cols'] = cols

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportAgentsToExcel(agents: AgentStats[], filename = 'agents') {
  const rows = agents.map((a, i) => ({
    "O'rin": i + 1,
    'Agent': a.name,
    'Lavozim': a.position,
    'Buyurtmalar': a.orderCount,
    'Yetkazilgan': a.deliveredCount,
    'Kutilmoqda': a.pendingCount,
    'Jami summa': fmtSum(a.totalSum),
    "O'rtacha summa": fmtSum(a.avgOrderValue),
    'Yetkazish %': a.orderCount > 0 ? ((a.deliveredCount / a.orderCount) * 100).toFixed(1) : '0',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Agentlar')
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

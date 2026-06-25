import { useEffect, useRef, useState } from 'react'
import {
  ShoppingCart, BarChart2, TrendingUp, TrendingDown,
  Users, CheckCircle, Clock, Truck, XCircle,
} from 'lucide-react'
import type { KPIData } from '../../types/api'
import { fmtSum, fmtPercent } from '../../utils/formatters'
import { useT } from '../../i18n'

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target)
  const prevRef = useRef(target)
  useEffect(() => {
    const from = prevRef.current
    if (from === target) return
    prevRef.current = target
    const steps = 25
    const diff = target - from
    let step = 0
    const iv = setInterval(() => {
      step++
      setValue(Math.round(from + (diff * step) / steps))
      if (step >= steps) { setValue(target); clearInterval(iv) }
    }, duration / steps)
    return () => clearInterval(iv)
  }, [target, duration])
  return value
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? 'text-emerald-500' : 'text-red-400'
      }`}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── Individual card ──────────────────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  borderClass: string
  current?: number
  prev?: number
  prevLabel?: string
}

function KPICard({
  title, value, sub, icon, borderClass, current, prev, prevLabel,
}: KPICardProps) {
  const [fresh, setFresh] = useState(false)
  const prevValRef = useRef(value)

  useEffect(() => {
    if (prevValRef.current !== value) {
      prevValRef.current = value
      setFresh(true)
      setTimeout(() => setFresh(false), 600)
    }
  }, [value])

  return (
    <div
      className={`glass-card p-4 border-l-4 ${borderClass} flex flex-col gap-1 min-h-[100px] transition-all duration-300 ${
        fresh ? 'ring-1 ring-white/10' : ''
      }`}
    >
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between">
        <span className="stat-label leading-tight">{title}</span>
        <span className="opacity-40" style={{ color: 'var(--text-muted)' }}>
          {icon}
        </span>
      </div>

      {/* Big number */}
      <p
        className={`text-2xl font-bold tabular-nums leading-tight ${fresh ? 'tick-up' : ''}`}
        style={{ color: 'var(--text-primary)' }}
      >
        {value}
      </p>

      {/* Bottom row: trend + sub text */}
      <div className="flex items-center gap-2 flex-wrap">
        {current !== undefined && prev !== undefined && (
          <TrendBadge current={current} prev={prev} />
        )}
        {sub && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {prevLabel ? `${prevLabel}: ${sub}` : sub}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function KPICards({ data }: { data: KPIData }) {
  const t = useT()

  const totalOrders  = useCountUp(data.total_orders)
  const activeAgents = useCountUp(data.active_agents)
  const delivered    = useCountUp(data.delivered_orders)
  const pending      = useCountUp(data.pending_orders)

  // "kecha: X" label — prev period values formatted for the sub slot
  const prevOrders   = data.prev.total_orders
  const prevRevenue  = data.prev.total_sum
  const prevAvg      = data.prev.avg_check
  const prevAgents   = data.prev.active_agents
  const prevDelivered = data.prev.delivered_orders
  const prevRate     = data.prev.delivery_rate

  const kechaLabel = t('header.yesterday')

  const cancelled = useCountUp(data.cancelled_orders ?? 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">

      {/* 1. Orders */}
      <KPICard
        title={t('kpi.orders')}
        value={totalOrders}
        sub={prevOrders > 0 ? String(prevOrders) : undefined}
        prevLabel={prevOrders > 0 ? kechaLabel : undefined}
        icon={<ShoppingCart size={14} />}
        borderClass="border-l-blue-500"
        current={data.total_orders}
        prev={prevOrders}
      />

      {/* 2. Revenue */}
      <KPICard
        title={t('kpi.revenue')}
        value={`${fmtSum(data.total_sum, true)} ${t('general.som')}`}
        sub={prevRevenue > 0 ? `${fmtSum(prevRevenue, true)} ${t('general.som')}` : undefined}
        prevLabel={prevRevenue > 0 ? kechaLabel : undefined}
        icon={<BarChart2 size={14} />}
        borderClass="border-l-cyan-500"
        current={data.total_sum}
        prev={prevRevenue}
      />

      {/* 3. Avg check */}
      <KPICard
        title={t('kpi.avg_check')}
        value={`${fmtSum(data.avg_check, true)} ${t('general.som')}`}
        sub={prevAvg > 0 ? `${fmtSum(prevAvg, true)} ${t('general.som')}` : undefined}
        prevLabel={prevAvg > 0 ? kechaLabel : undefined}
        icon={<TrendingUp size={14} />}
        borderClass="border-l-indigo-500"
        current={data.avg_check}
        prev={prevAvg}
      />

      {/* 4. Active agents */}
      <KPICard
        title={t('kpi.active_agents')}
        value={activeAgents}
        sub={prevAgents > 0 ? String(prevAgents) : undefined}
        prevLabel={prevAgents > 0 ? kechaLabel : undefined}
        icon={<Users size={14} />}
        borderClass="border-l-violet-500"
        current={data.active_agents}
        prev={prevAgents}
      />

      {/* 5. Delivered */}
      <KPICard
        title={t('kpi.delivered')}
        value={delivered}
        sub={prevDelivered > 0 ? String(prevDelivered) : undefined}
        prevLabel={prevDelivered > 0 ? kechaLabel : undefined}
        icon={<CheckCircle size={14} />}
        borderClass="border-l-green-500"
        current={data.delivered_orders}
        prev={prevDelivered}
      />

      {/* 6. Pending */}
      <KPICard
        title={t('kpi.pending')}
        value={pending}
        icon={<Clock size={14} />}
        borderClass="border-l-amber-500"
      />

      {/* 7. Cancelled */}
      <KPICard
        title={t('kpi.cancelled')}
        value={cancelled}
        icon={<XCircle size={14} />}
        borderClass="border-l-red-500"
      />

      {/* 8. Delivery rate */}
      <KPICard
        title={t('kpi.delivery_rate')}
        value={fmtPercent(data.delivery_rate)}
        sub={prevRate > 0 ? fmtPercent(prevRate) : undefined}
        prevLabel={prevRate > 0 ? kechaLabel : undefined}
        icon={<Truck size={14} />}
        borderClass="border-l-teal-500"
        current={data.delivery_rate}
        prev={prevRate}
      />

    </div>
  )
}

import { RefreshCw, Calendar, Monitor, Menu, Filter, X } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { DateField } from '../../store/useAppStore'
import { cn } from '../../utils/cn'
import type { DatePreset } from '../../types'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSyncStatus } from '../../hooks/useAnalytics'
import { useFilterOptions } from '../../hooks/useAnalytics'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useT, useLangStore } from '../../i18n'
import type { Lang } from '../../i18n'

export default function Header({ title }: { title: string }) {
  const t = useT()
  const { lang, setLang } = useLangStore()

  const {
    dateRange, dateField,
    setDatePreset, setCustomRange, setDateField,
    wsConnected,
    setTvMode, setMobileSidebarOpen,
    filters, setFilter, clearFilters,
  } = useAppStore()

  const [syncing, setSyncing] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const queryClient = useQueryClient()
  const { data: syncData } = useSyncStatus()
  const { data: filterOpts } = useFilterOptions()

  const hasActiveFilters = Object.values(filters).some(v => v != null)

  const lastSync = syncData?.last_sync
    ? formatDistanceToNow(new Date(syncData.last_sync), { addSuffix: true, locale: ru })
    : null

  async function handleRefresh() {
    setSyncing(true)
    try {
      await queryClient.invalidateQueries()
    } finally {
      setSyncing(false)
    }
  }

  const PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'today',     label: t('header.today') },
    { key: 'yesterday', label: t('header.yesterday') },
    { key: 'week',      label: t('header.this_week') },
    { key: 'month',     label: t('header.this_month') },
  ]

  const DATE_FIELDS: { key: DateField; label: string }[] = [
    { key: 'created_date',  label: t('header.created_date') },
    { key: 'date_delivery', label: t('header.delivery_date') },
  ]

  return (
    <header className="flex-shrink-0 border-b transition-colors duration-300"
      style={{ background: 'var(--bg-header)', borderColor: 'var(--bg-card-border)' }}>

      {/* ── Top row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
        <button className="md:hidden btn-ghost p-2" onClick={() => setMobileSidebarOpen(true)}>
          <Menu size={18} />
        </button>

        <h1 className="font-bold text-base mr-2 flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>

        {/* Sync status */}
        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
          {wsConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 sync-pulse" />
              <span className="text-emerald-500 font-medium">{t('header.live')}</span>
            </>
          ) : lastSync ? (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400 opacity-70" />
              <span style={{ color: 'var(--text-muted)' }}>{t('header.updated_at')}: {lastSync}</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span style={{ color: 'var(--text-muted)' }}>{t('header.loading')}</span>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {/* Language switcher */}
          <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-card-border)' }}>
            {(['uz', 'ru'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`px-2 py-0.5 text-xs font-bold rounded transition-all ${
                  lang === l ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white'
                }`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(p => !p)}
            className={cn('btn-ghost p-2 relative', showFilters && 'text-blue-400')}
            title={t('header.filters')}
          >
            <Filter size={14} />
            {hasActiveFilters && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>

          {/* Refresh / sync */}
          <button onClick={handleRefresh} disabled={syncing} className="btn-ghost">
            <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
            <span className="hidden sm:inline text-xs">{t('header.refresh')}</span>
          </button>

          {/* TV mode */}
          <button onClick={() => setTvMode(true)} className="btn-ghost p-2" title="TV rejim">
            <Monitor size={14} />
          </button>
        </div>
      </div>

      {/* ── Date row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 flex-wrap border-t"
        style={{ borderColor: 'var(--bg-card-border)' }}>

        {/* Date field */}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5 flex-shrink-0"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-card-border)' }}>
          {DATE_FIELDS.map(({ key, label }) => (
            <button key={key} onClick={() => setDateField(key)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap',
                dateField === key ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5'
              )}
              style={{ color: dateField === key ? undefined : 'var(--text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5 flex-shrink-0"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-card-border)' }}>
          {PRESETS.map(({ key, label }) => (
            <button key={key} onClick={() => setDatePreset(key)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap',
                dateRange.preset === key ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-black/5 dark:hover:bg-white/5'
              )}
              style={{ color: dateRange.preset === key ? undefined : 'var(--text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Custom range */}
        <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 flex-shrink-0"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--bg-card-border)' }}>
          <Calendar size={12} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          <input type="date" value={dateRange.from}
            onChange={e => setCustomRange(e.target.value, dateRange.to)}
            className="bg-transparent text-xs outline-none cursor-pointer w-28"
            style={{ color: 'var(--text-secondary)' }}
          />
          <span style={{ color: 'var(--text-muted)' }} className="text-xs">—</span>
          <input type="date" value={dateRange.to}
            onChange={e => setCustomRange(dateRange.from, e.target.value)}
            className="bg-transparent text-xs outline-none cursor-pointer w-28"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>
      </div>

      {/* ── Filter row (collapsible) ──────────────────────────────────────── */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 flex-wrap border-t"
          style={{ borderColor: 'var(--bg-card-border)', background: 'var(--bg-surface)' }}>

          {/* Agent filter */}
          <FilterSelect
            label={t('agent_filter')}
            allItems={t('all_items')}
            value={filters.agentId ? String(filters.agentId[0]) : ''}
            onChange={v => setFilter('agentId', v ? [Number(v)] : null)}
            options={filterOpts?.agents.map(a => ({ value: String(a.user_id), label: a.user_name })) ?? []}
          />

          {/* Region filter */}
          <FilterSelect
            label={t('region_filter')}
            allItems={t('all_items')}
            value={filters.region?.[0] ?? ''}
            onChange={v => setFilter('region', v ? [v] : null)}
            options={filterOpts?.regions.map(r => ({ value: r, label: r })) ?? []}
          />

          {/* Payment type filter */}
          <FilterSelect
            label={t('payment_filter')}
            allItems={t('all_items')}
            value={filters.paymentType?.[0] ?? ''}
            onChange={v => setFilter('paymentType', v ? [v] : null)}
            options={filterOpts?.payment_types.map(p => ({
              value: p,
              label: p === 'cash' ? t('payment.cash') : p === 'bank' ? t('payment.bank') : t('payment.other'),
            })) ?? []}
          />

          {/* Delivery man filter */}
          <FilterSelect
            label={t('delivery_filter')}
            allItems={t('all_items')}
            value={filters.deliveryManId ? String(filters.deliveryManId[0]) : ''}
            onChange={v => setFilter('deliveryManId', v ? [Number(v)] : null)}
            options={filterOpts?.delivery_men.map(d => ({ value: String(d.delivery_man_id), label: d.delivery_man_name })) ?? []}
          />

          {/* Status filter */}
          <FilterSelect
            label={t('status_filter')}
            allItems={t('all_items')}
            value={filters.statusFilter?.[0] ?? ''}
            onChange={v => setFilter('statusFilter', v ? [v] : null)}
            options={[
              { value: '1', label: t('status.1') },
              { value: '2', label: t('status.2') },
              { value: '3', label: t('status.3') },
              { value: '5', label: t('status.5') },
              { value: '6', label: t('status.6') },
            ]}
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
            >
              <X size={11} /> {t('header.clear_filters')}
            </button>
          )}
        </div>
      )}
    </header>
  )
}

function FilterSelect({
  label, allItems, value, onChange, options,
}: {
  label: string
  allItems: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-card-border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent text-xs outline-none cursor-pointer"
        style={{ color: 'var(--text-secondary)', maxWidth: 140 }}
      >
        <option value="">{allItems}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

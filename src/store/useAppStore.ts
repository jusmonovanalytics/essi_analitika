import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, subDays, startOfMonth } from 'date-fns'
import type { DatePreset, Notification } from '../types'
import type { ActiveFilters } from '../types/api'

export type DateField = 'created_date' | 'date_delivery'
export type Theme = 'dark' | 'light'

interface DateRange { preset: DatePreset; from: string; to: string }

interface AppStore {
  // Theme
  theme: Theme
  toggleTheme: () => void

  // Date filter
  dateRange: DateRange
  dateField: DateField
  setDatePreset: (preset: DatePreset) => void
  setCustomRange: (from: string, to: string) => void
  setDateField: (field: DateField) => void
  isLive: () => boolean

  // Active filters (agent / region / payment / delivery)
  filters: ActiveFilters
  setFilter: <K extends keyof ActiveFilters>(key: K, value: ActiveFilters[K]) => void
  clearFilters: () => void

  // Refresh
  lastRefresh: Date | null
  setLastRefresh: (d: Date) => void
  wsConnected: boolean
  setWsConnected: (v: boolean) => void

  // Notifications
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>) => void
  dismissNotification: (id: string) => void
  clearNotifications: () => void

  // UI state
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (v: boolean) => void
  tvMode: boolean
  setTvMode: (v: boolean) => void
}

const today = format(new Date(), 'yyyy-MM-dd')

function presetToRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date()
  switch (preset) {
    case 'today':     return { from: today, to: today }
    case 'yesterday': { const y = format(subDays(now, 1), 'yyyy-MM-dd'); return { from: y, to: y } }
    case 'week':      return { from: format(subDays(now, 6), 'yyyy-MM-dd'), to: today }
    case 'month':     return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: today }
    default:          return { from: today, to: today }
  }
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  html.classList.remove('dark', 'light')
  html.classList.add(theme)
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      },

      // Date filter
      dateRange: { preset: 'today', ...presetToRange('today') },
      dateField: 'created_date',

      setDatePreset: (preset) => {
        if (preset === 'custom') return
        set({ dateRange: { preset, ...presetToRange(preset) } })
      },
      setCustomRange: (from, to) => set({ dateRange: { preset: 'custom', from, to } }),
      setDateField: (field) => set({ dateField: field }),
      isLive: () => {
        const { preset } = get().dateRange
        return preset === 'today' || preset === 'yesterday' || preset === 'week' || preset === 'month'
      },

      // Active filters
      filters: { agentId: null, region: null, paymentType: null, deliveryManId: null, statusFilter: null },
      setFilter: (key, value) => set(s => ({ filters: { ...s.filters, [key]: value } })),
      clearFilters: () => set({ filters: { agentId: null, region: null, paymentType: null, deliveryManId: null, statusFilter: null } }),

      // Refresh
      lastRefresh: null,
      setLastRefresh: (d) => set({ lastRefresh: d }),
      wsConnected: false,
      setWsConnected: (v) => set({ wsConnected: v }),

      // Notifications
      notifications: [],
      addNotification: (n) => {
        const notification: Notification = {
          ...n, id: crypto.randomUUID(), timestamp: new Date(), dismissed: false,
        }
        set(s => ({ notifications: [notification, ...s.notifications].slice(0, 20) }))
        if (n.type === 'info' || n.type === 'success') {
          setTimeout(() => get().dismissNotification(notification.id), 8000)
        }
      },
      dismissNotification: (id) =>
        set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, dismissed: true } : n) })),
      clearNotifications: () => set({ notifications: [] }),

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
      tvMode: false,
      setTvMode: (v) => set({ tvMode: v }),
    }),
    {
      name: 'essi-store',
      partialize: (s) => ({
        theme: s.theme,
        sidebarCollapsed: s.sidebarCollapsed,
        dateField: s.dateField,      // sana turi tanlovi eslab qolinadi
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)

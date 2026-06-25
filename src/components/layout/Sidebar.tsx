import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Users, BarChart3, Tv2, ChevronLeft, ChevronRight, Activity, X, Database, Truck, UserCheck, Monitor } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { useT } from '../../i18n'
import { cn } from '../../utils/cn'

const navItems = [
  { path: '/',            key: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/agents',      key: 'nav.agents',    icon: Users },
  { path: '/deliveries',  key: 'nav.deliveries',icon: Truck },
  { path: '/clients',     key: 'nav.clients',   icon: UserCheck },
  { path: '/analytics',   key: 'nav.analytics', icon: BarChart3 },
  { path: '/screen',      key: 'nav.screen',    icon: Monitor },
  { path: '/orders',      key: 'nav.orders',    icon: ShoppingCart },
  { path: '/tv',          key: 'nav.tv_mode',   icon: Tv2 },
  { path: '/data',        key: 'data.title',    icon: Database },
]

function SidebarContent({ collapsed, onClose }: { collapsed: boolean; onClose?: () => void }) {
  const location = useLocation()
  const { toggleSidebar } = useAppStore()
  const t = useT()

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-sidebar)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Activity size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">ESSI</p>
            <p className="text-white/40 text-xs">Sales Dashboard</p>
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className="ml-auto text-white/50 hover:text-white p-1 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ path, key, icon: Icon }) => {
          const active = location.pathname === path
          const label = t(key)
          return (
            <Link
              key={path}
              to={path}
              title={label}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded text-sm font-medium transition-all duration-200 mb-0.5',
                active
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && (
                <span className="truncate leading-tight">{label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-white/30 text-xs">OOO Milkolino Products</p>
        </div>
      )}

      {/* Desktop collapse toggle */}
      {!onClose && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full
                     bg-slate-700 border border-slate-600 flex items-center justify-center
                     text-white/60 hover:text-white transition-all z-10"
        >
          {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
        </button>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'relative hidden md:flex flex-col h-screen flex-shrink-0 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}>
        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-64 shadow-2xl">
            <SidebarContent collapsed={false} onClose={() => setMobileSidebarOpen(false)} />
          </aside>
        </div>
      )}
    </>
  )
}

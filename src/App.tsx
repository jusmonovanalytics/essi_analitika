/**
 * ESSI — bitta sayt, uch bo'lim.
 *
 *   Savdo analitikasi — RITM API dan real vaqtli buyurtmalar (orders_cache)
 *   Savdo prognozi    — Excel savdo hisobotlaridan 2 haftalik reja (fakt/yakuniy_savdo)
 *   Ma'lumotlar       — ikkala manbani boshqarish
 *
 * Ikkala bo'lim ham BITTA `essi` bazasidan va BITTA backenddan foydalanadi.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { BarChart3, Database, TrendingUp } from 'lucide-react'

import ScreenAnalytics from './pages/ScreenAnalytics'
import Malumotlar from './pages/Malumotlar'
import Prognoz from './pages/Prognoz'
import { ParolModal } from './components/prognoz/ParolModal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false },
  },
})

type Page = 'analytics' | 'prognoz' | 'data'

const NAV: { key: Page; label: string; icon: typeof BarChart3 }[] = [
  { key: 'analytics', label: 'Savdo analitikasi', icon: BarChart3 },
  { key: 'prognoz',   label: 'Savdo prognozi',    icon: TrendingUp },
  { key: 'data',      label: "Ma'lumotlar",       icon: Database },
]

export default function App() {
  const [page, setPage] = useState<Page>('analytics')

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  // Savdo analitikasi — TV rejimi, o'zining to'liq ekrani bor (menyusiz)
  if (page === 'analytics') {
    return (
      <QueryClientProvider client={queryClient}>
        <ScreenAnalytics onGoToData={() => setPage('data')} />
        <QuickNav page={page} setPage={setPage} />
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#050a14' }}>

        {/* ═══ Menyu ═══ */}
        <header className="flex items-center gap-1 px-4 py-2 flex-shrink-0"
          style={{ background: 'rgba(5,10,20,0.98)', borderBottom: '1px solid rgba(59,130,246,0.1)' }}>

          <div className="flex items-center gap-2 mr-4">
            <div className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: '#EB6834' }}>E</div>
            <span className="font-semibold text-slate-200 text-sm">ESSI</span>
          </div>

          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setPage(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              style={page === key
                ? { background: 'rgba(59,130,246,0.14)', color: '#93c5fd' }
                : { color: '#64748b' }}>
              <Icon size={13} />{label}
            </button>
          ))}
        </header>

        <main className="flex-1 overflow-hidden">
          {page === 'prognoz' && <Prognoz />}
          {page === 'data' && <Malumotlar onBack={() => setPage('analytics')} />}
        </main>
      </div>

      {/* Bazani o'zgartiradigan amal parol so'raganda o'zi ochiladi. */}
      <ParolModal />
    </QueryClientProvider>
  )
}

/** Analitika to'liq ekranda — menyu o'rniga suzuvchi tugmalar. */
function QuickNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-1 p-1 rounded-xl"
      style={{ background: 'rgba(5,10,20,0.92)', border: '1px solid rgba(59,130,246,0.18)',
               backdropFilter: 'blur(8px)' }}>
      {NAV.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => setPage(key)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          style={page === key
            ? { background: 'rgba(59,130,246,0.16)', color: '#93c5fd' }
            : { color: '#64748b' }}>
          <Icon size={13} />{label}
        </button>
      ))}
    </div>
  )
}

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
import {
  BarChart3, Database, PanelLeftClose, PanelLeftOpen, TrendingUp,
} from 'lucide-react'

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

const NAV: { key: Page; label: string; izoh: string; icon: typeof BarChart3 }[] = [
  { key: 'analytics', label: 'Savdo analitikasi', izoh: 'RITM — jonli buyurtmalar', icon: BarChart3 },
  { key: 'prognoz',   label: 'Savdo prognozi',    izoh: '2 haftalik reja',          icon: TrendingUp },
  { key: 'data',      label: "Ma'lumotlar",       izoh: 'Excel yuklash · arxiv',    icon: Database },
]

const KALIT = 'essi_panel'
const KENG = 212   // ochiq
const TOR = 52     // yig'ilgan — faqat belgilar

export default function App() {
  const [page, setPage] = useState<Page>('analytics')
  const [yigilgan, setYigilgan] = useState(
    () => localStorage.getItem(KALIT) === 'yigilgan')

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  // Analitika — televizorga chiqariladi, ekran kerak. Unga o'tganda panel
  // o'zi yig'iladi; chiqqanda saqlangan holat tiklanadi.
  useEffect(() => {
    setYigilgan(page === 'analytics' || localStorage.getItem(KALIT) === 'yigilgan')
  }, [page])

  const almashtir = () => {
    const y = !yigilgan
    setYigilgan(y)
    // Analitikadagi ochish vaqtinchalik — saqlanmaydi.
    if (page !== 'analytics') localStorage.setItem(KALIT, y ? 'yigilgan' : 'ochiq')
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen overflow-hidden" style={{ background: '#050a14' }}>

        {/* ═══ Boshqaruv paneli ═══ */}
        <nav className="flex flex-col flex-shrink-0 py-2.5"
          style={{
            width: yigilgan ? TOR : KENG,
            transition: 'width .18s ease',
            background: 'rgba(5,10,20,0.98)',
            borderRight: '1px solid rgba(59,130,246,0.1)',
          }}>

          {/* Logotip */}
          <div className="flex items-center gap-2 px-3 mb-4 h-7 flex-shrink-0">
            <div className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: '#EB6834' }}>E</div>
            {!yigilgan && (
              <span className="font-semibold text-slate-200 text-sm whitespace-nowrap">ESSI</span>
            )}
          </div>

          {/* Bo'limlar */}
          <div className="flex flex-col gap-0.5 px-2">
            {NAV.map(({ key, label, izoh, icon: Icon }) => {
              const faol = page === key
              return (
                <button key={key} onClick={() => setPage(key)}
                  title={yigilgan ? `${label} — ${izoh}` : izoh}
                  className="flex items-center gap-2.5 rounded-lg transition text-left"
                  style={{
                    padding: yigilgan ? '8px' : '8px 10px',
                    justifyContent: yigilgan ? 'center' : undefined,
                    background: faol ? 'rgba(59,130,246,0.14)' : undefined,
                    color: faol ? '#93c5fd' : '#64748b',
                  }}>
                  <Icon size={15} className="flex-shrink-0" />
                  {!yigilgan && (
                    <span className="min-w-0">
                      <span className="block text-xs font-medium whitespace-nowrap">{label}</span>
                      <span className="block text-[10px] whitespace-nowrap"
                        style={{ color: faol ? 'rgba(147,197,253,0.55)' : '#475569' }}>
                        {izoh}
                      </span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex-1" />

          {/* Yig'ish / ochish */}
          <div className="px-2">
            <button onClick={almashtir}
              title={yigilgan ? 'Panelni ochish' : "Panelni yig'ish"}
              className="flex items-center gap-2.5 w-full rounded-lg transition text-slate-600 hover:text-slate-400"
              style={{
                padding: yigilgan ? '8px' : '8px 10px',
                justifyContent: yigilgan ? 'center' : undefined,
              }}>
              {yigilgan
                ? <PanelLeftOpen size={15} className="flex-shrink-0" />
                : <PanelLeftClose size={15} className="flex-shrink-0" />}
              {!yigilgan && <span className="text-[11px] whitespace-nowrap">Panelni yig'ish</span>}
            </button>
          </div>
        </nav>

        <main className="flex-1 min-w-0 overflow-hidden">
          {page === 'analytics' && <ScreenAnalytics onGoToData={() => setPage('data')} />}
          {page === 'prognoz' && <Prognoz />}
          {page === 'data' && <Malumotlar onBack={() => setPage('analytics')} />}
        </main>
      </div>

      {/* Bazani o'zgartiradigan amal parol so'raganda o'zi ochiladi. */}
      <ParolModal />
    </QueryClientProvider>
  )
}

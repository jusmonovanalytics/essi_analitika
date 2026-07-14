/**
 * ESSI — bitta sayt, uch bo'lim.
 *
 *   Savdo analitikasi — RITM API dan real vaqtli buyurtmalar (orders_cache)
 *   Savdo prognozi    — Excel savdo hisobotlaridan 2 haftalik reja (fakt/yakuniy_savdo)
 *   Ma'lumotlar       — ikkala manbani boshqarish
 *
 * Ikkala bo'lim ham BITTA `essi` bazasidan va BITTA backenddan foydalanadi.
 *
 * Ikki rol:
 *   MEHMON — faqat savdo analitikasini KO'RADI. Boshqa bo'limlar unga
 *            ko'rinmaydi va API ham ularni bermaydi.
 *   ADMIN  — parol bilan kiradi, hamma narsadan to'liq foydalanadi.
 *
 * Rol brauzerda emas, SERVERDA hal qilinadi: prognoz endpointlari va bazani
 * o'zgartiruvchi amallar parolsiz 401 qaytaradi. Bu yerdagi yashirish faqat
 * interfeys qulayligi uchun.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  BarChart3, Database, LogIn, LogOut, PanelLeftClose, PanelLeftOpen,
  ShieldCheck, TrendingUp,
} from 'lucide-react'

import ScreenAnalytics from './pages/ScreenAnalytics'
import Malumotlar from './pages/Malumotlar'
import Prognoz from './pages/Prognoz'
import { ParolModal } from './components/prognoz/ParolModal'
import { adminmi, parolniUnut, parolOl, ParolBekor } from './api/admin'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false },
  },
})

type Page = 'analytics' | 'prognoz' | 'data'

const NAV: {
  key: Page; label: string; izoh: string
  icon: typeof BarChart3; faqatAdmin: boolean
}[] = [
  { key: 'analytics', label: 'Savdo analitikasi', izoh: 'RITM — jonli buyurtmalar', icon: BarChart3,  faqatAdmin: false },
  { key: 'prognoz',   label: 'Savdo prognozi',    izoh: '2 haftalik reja',          icon: TrendingUp, faqatAdmin: true  },
  { key: 'data',      label: "Ma'lumotlar",       izoh: 'Excel yuklash · arxiv',    icon: Database,   faqatAdmin: true  },
]

const KALIT = 'essi_panel'
const KENG = 212   // ochiq
const TOR = 52     // yig'ilgan — faqat belgilar

export default function App() {
  const [page, setPage] = useState<Page>('analytics')
  const [admin, setAdmin] = useState(false)
  const [yigilgan, setYigilgan] = useState(
    () => localStorage.getItem(KALIT) === 'yigilgan')

  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.classList.remove('light')
  }, [])

  // Sessiyada parol qolgan bo'lsa — serverda tekshiramiz.
  useEffect(() => { adminmi().then(setAdmin) }, [])

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

  const kir = async () => {
    try {
      await parolOl()          // oyna ochiladi va parolni serverda tekshiradi
      setAdmin(true)
    } catch (e) {
      if (!(e instanceof ParolBekor)) throw e   // bekor qilindi — hech narsa qilmaymiz
    }
  }

  const chiq = () => {
    parolniUnut()
    setAdmin(false)
    setPage('analytics')
    queryClient.clear()        // prognoz ma'lumotlari keshda qolmasin
  }

  const bolimlar = NAV.filter(n => admin || !n.faqatAdmin)

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
            {bolimlar.map(({ key, label, izoh, icon: Icon }) => {
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

          {/* Rol */}
          <div className="px-2 pb-1">
            {admin ? (
              <>
                {!yigilgan && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 mb-1 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <ShieldCheck size={12} style={{ color: '#34d399' }} className="flex-shrink-0" />
                    <span className="text-[10.5px] whitespace-nowrap" style={{ color: '#34d399' }}>
                      Admin — to'liq huquq
                    </span>
                  </div>
                )}
                <button onClick={chiq} title="Chiqish — mehmon rejimiga qaytish"
                  className="flex items-center gap-2.5 w-full rounded-lg transition text-slate-600 hover:text-slate-400"
                  style={{
                    padding: yigilgan ? '8px' : '8px 10px',
                    justifyContent: yigilgan ? 'center' : undefined,
                  }}>
                  <LogOut size={15} className="flex-shrink-0" />
                  {!yigilgan && <span className="text-[11px] whitespace-nowrap">Chiqish</span>}
                </button>
              </>
            ) : (
              <button onClick={kir} title="Admin sifatida kirish"
                className="flex items-center gap-2.5 w-full rounded-lg transition"
                style={{
                  padding: yigilgan ? '8px' : '8px 10px',
                  justifyContent: yigilgan ? 'center' : undefined,
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  color: '#93c5fd',
                }}>
                <LogIn size={15} className="flex-shrink-0" />
                {!yigilgan && (
                  <span className="min-w-0 text-left">
                    <span className="block text-[11px] font-medium whitespace-nowrap">Admin kirish</span>
                    <span className="block text-[10px] whitespace-nowrap"
                      style={{ color: 'rgba(147,197,253,0.5)' }}>
                      Mehmon — faqat analitika
                    </span>
                  </span>
                )}
              </button>
            )}
          </div>

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
          {/* Mehmon uchun faqat analitika. Admin bo'lmasa boshqa sahifa
              ko'rsatilmaydi — chiqib ketganda ham ochiq qolib ketmasin. */}
          {(page === 'analytics' || !admin) && (
            <ScreenAnalytics onGoToData={admin ? () => setPage('data') : undefined} />
          )}
          {page === 'prognoz' && admin && <Prognoz />}
          {page === 'data' && admin && <Malumotlar onBack={() => setPage('analytics')} />}
        </main>
      </div>

      {/* Parol so'ralganda o'zi ochiladi. */}
      <ParolModal />
    </QueryClientProvider>
  )
}

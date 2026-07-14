/**
 * Admin paroli oynasi.
 *
 * App da bir marta joylashtiriladi. O'zi hech qachon ochilmaydi — bazani
 * o'zgartiradigan so'rov parol talab qilganda `parolSorovchisi` orqali
 * chaqiriladi va javob kelguncha so'rovni kutdiradi.
 *
 * Kiritilgan parol serverda tekshiriladi (`POST /parol`) — noto'g'ri parol
 * saqlanib qolmasligi uchun.
 */
import { useEffect, useState } from 'react'
import { Loader2, Lock, X } from 'lucide-react'

import { parolSorovchisi } from '../../api/admin'

type Soro = { xato: string | null; hal: (parol: string | null) => void }

export function ParolModal() {
  const [soro, setSoro] = useState<Soro | null>(null)
  const [qiymat, setQiymat] = useState('')
  const [xato, setXato] = useState<string | null>(null)
  const [tekshirilmoqda, setTekshirilmoqda] = useState(false)

  useEffect(() => {
    parolSorovchisi(x => new Promise(hal => {
      setQiymat('')
      setXato(x)
      setSoro({ xato: x, hal })
    }))
    return () => parolSorovchisi(null)
  }, [])

  if (!soro) return null

  const yop = (parol: string | null) => {
    soro.hal(parol)
    setSoro(null)
    setQiymat('')
    setXato(null)
  }

  const yubor = async () => {
    if (!qiymat || tekshirilmoqda) return
    setTekshirilmoqda(true)
    setXato(null)
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8001'
      const res = await fetch(`${base}/api/prognoz/parol`, {
        method: 'POST',
        headers: { 'X-Admin-Parol': qiymat },
      })
      if (res.ok) {
        yop(qiymat)
      } else {
        const j = await res.json().catch(() => ({}))
        setXato(j.detail ?? "Parol noto'g'ri.")
        setQiymat('')
      }
    } catch {
      setXato('Serverga ulanib bo\'lmadi.')
    } finally {
      setTekshirilmoqda(false)
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) yop(null) }}
      onKeyDown={e => { if (e.key === 'Escape') yop(null) }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(2,6,16,0.82)', backdropFilter: 'blur(3px)' }}>

      <div className="w-full rounded-xl px-5 py-4" style={{
        maxWidth: 380,
        background: '#0b1220', border: '1px solid rgba(148,163,184,0.14)',
      }}>
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-slate-500" />
          <span className="text-slate-100 font-medium text-sm">Admin paroli</span>
          <div className="flex-1" />
          <button onClick={() => yop(null)} className="text-slate-500 hover:text-slate-300">
            <X size={15} />
          </button>
        </div>

        <div className="text-[11px] text-slate-500 leading-relaxed mb-3">
          Bu amal bazani o'zgartiradi — prognozni qayta hisoblash, qo'lda tahrir,
          arxivdagi rejaga qaytish va Excel ma'lumotlarini yuklash/o'chirish
          parol talab qiladi. Parol brauzer varag'i yopilguncha eslab qolinadi.
        </div>

        <input
          type="password" autoFocus value={qiymat}
          onChange={e => { setQiymat(e.target.value); setXato(null) }}
          onKeyDown={e => { if (e.key === 'Enter') yubor() }}
          placeholder="Parol"
          className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none tracking-widest"
          style={{
            background: 'rgba(15,23,42,0.6)',
            border: `1px solid ${xato ? 'rgba(239,68,68,0.5)' : 'rgba(148,163,184,0.18)'}`,
            color: '#e2e8f0',
          }} />

        {xato && <div className="text-[11px] text-red-400 mt-1.5">{xato}</div>}

        <div className="flex gap-2 mt-3">
          <button onClick={() => yop(null)}
            className="flex-1 px-3 py-2 rounded-lg text-xs"
            style={{ border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}>
            Bekor qilish
          </button>
          <button onClick={yubor} disabled={!qiymat || tekshirilmoqda}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40"
            style={{ background: '#3B82F6' }}>
            {tekshirilmoqda && <Loader2 size={12} className="animate-spin" />}
            Tasdiqlash
          </button>
        </div>
      </div>
    </div>
  )
}

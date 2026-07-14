/**
 * Admin paroli — bazani o'zgartiradigan amallar uchun.
 *
 * Parol sessiyada saqlanadi (sessionStorage): bir marta kiritiladi, brauzer
 * varag'i yopilguncha qayta so'ralmaydi.
 *
 * Asosiy tekshiruv BACKEND da — bu yerdagisi faqat qulaylik uchun. Parol
 * so'rovga `X-Admin-Parol` sarlavhasida qo'shiladi; server 401 qaytarsa,
 * saqlangan parol o'chiriladi va qaytadan so'raladi.
 */
const KALIT = 'essi_admin_parol'

/** Saqlangan parol yoki null. Har bir so'rovga sarlavha sifatida qo'shiladi. */
export const parolQiymati = () => sessionStorage.getItem(KALIT)
export const parolBor = () => parolQiymati() != null
export const parolniUnut = () => sessionStorage.removeItem(KALIT)

/** Saqlangan parolni serverda tekshiradi. Sahifa ochilganda chaqiriladi. */
export async function adminmi(): Promise<boolean> {
  const p = parolQiymati()
  if (!p) return false
  try {
    const base = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8001'
    const res = await fetch(`${base}/api/prognoz/parol`, {
      method: 'POST', headers: { 'X-Admin-Parol': p },
    })
    if (res.ok) return true
    parolniUnut()          // eskirgan yoki noto'g'ri — saqlab turishning ma'nosi yo'q
    return false
  } catch {
    return false           // server yiqilgan — admin deb hisoblamaymiz
  }
}

/** Har qanday so'rovga qo'shiladigan sarlavha (parol bo'lmasa — bo'sh). */
export const adminSarlavha = (): Record<string, string> => {
  const p = parolQiymati()
  return p ? { 'X-Admin-Parol': p } : {}
}

/** Foydalanuvchi hech narsa kiritmasdan oynani yopganda tashlanadi. */
export class ParolBekor extends Error {
  constructor() {
    super('Parol kiritilmadi — amal bajarilmadi.')
    this.name = 'ParolBekor'
  }
}

/** Parol oynasini ochadigan funksiya. ParolModal ishga tushganda ro'yxatdan o'tadi. */
type Sorovchi = (xato: string | null) => Promise<string | null>
let sorovchi: Sorovchi | null = null
export const parolSorovchisi = (f: Sorovchi | null) => { sorovchi = f }

/**
 * Saqlangan parolni qaytaradi; yo'q bo'lsa foydalanuvchidan so'raydi.
 * `qayta` — server parolni rad etdi, demak saqlangani noto'g'ri.
 */
export async function parolOl(qayta = false): Promise<string> {
  if (qayta) parolniUnut()
  else {
    const saqlangan = sessionStorage.getItem(KALIT)
    if (saqlangan) return saqlangan
  }

  if (!sorovchi) throw new ParolBekor()
  const p = await sorovchi(qayta ? "Parol noto'g'ri." : null)
  if (!p) throw new ParolBekor()

  sessionStorage.setItem(KALIT, p)
  return p
}

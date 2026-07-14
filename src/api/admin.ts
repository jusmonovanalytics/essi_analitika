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

export const parolBor = () => sessionStorage.getItem(KALIT) != null
export const parolniUnut = () => sessionStorage.removeItem(KALIT)

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

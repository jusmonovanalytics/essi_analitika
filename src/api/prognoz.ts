/**
 * Savdo prognozi — API klienti.
 *
 * Backend: /api/prognoz/*  (server/prognoz/)
 *
 * Uchta qat'iy qoida (backendda amal qiladi):
 *   1. Excel yuklanishi prognozni O'ZGARTIRMAYDI — faqat "eskirgan" deb belgilaydi
 *   2. Qayta hisoblash faqat QO'LDA — hisobla()
 *   3. Arxiv o'zgarmas — har hisob va tahrir yangi versiya yaratadi
 *   4. Bazani o'zgartiradigan har bir amal admin parolini talab qiladi
 */
import { parolOl } from './admin'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8001'
const P = `${BASE}/api/prognoz`

async function get<T>(path: string, params: Record<string, string | number | boolean | null | undefined> = {}): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v))
  }
  const res = await fetch(`${P}${path}${q.toString() ? '?' + q : ''}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? `${res.status}`)
  return res.json()
}

/**
 * Bazani o'zgartiradigan so'rov — admin paroli bilan.
 *
 * Parol yo'q bo'lsa oyna ochiladi. Server 401 qaytarsa (saqlangan parol
 * noto'g'ri), bir marta qaytadan so'raladi va so'rov takrorlanadi.
 */
async function send<T>(path: string, method: 'POST' | 'DELETE', body?: unknown,
                       params: Record<string, string | number | boolean | null | undefined> = {}): Promise<T> {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v))
  }
  const url = `${P}${path}${q.toString() ? '?' + q : ''}`

  const urin = async (parol: string) => fetch(url, {
    method,
    headers: {
      'X-Admin-Parol': parol,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  let res = await urin(await parolOl())
  if (res.status === 401) res = await urin(await parolOl(true))

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.detail ?? `${res.status}`)
  return json as T
}

// ─── Tiplar ───────────────────────────────────────────────────────────────────

export type Summary = {
  run: {
    run_id: number; created_at: string; data_last_day: string; method: string
    zaxira: number; ustama: boolean; gorizont: number
    qolda: boolean; asos_run: number | null
  }
  fakt: { rows: number; qty: number; amount: number; dan: string; gacha: string; kunlar: number }
  reja: { qty: number; dan: string; gacha: string; kunlar: number; mahsulot: number }
  oldingi_qty: number
  wape: number
  chegara: number
  kesim: { talab: number; sotilgan: number; yoqotilgan: number; pct: number }
  eskirgan: { eskirgan: boolean; sabab?: string; oxirgi_kun?: string; reja_kuni?: string }
}

export type PlanItem = {
  product_id: number; name: string; type: string
  total: number; wk1: number; wk2: number; lo: number; hi: number
  xato: number | null; kesim: number | null; ustama: number
  mavsumiy: boolean; qolda: boolean
  prev: number | null; delta: number | null
}
export type Plan = {
  run_id: number; items: PlanItem[]; types: string[]; gorizont: number
  prev_dan: string; prev_gacha: string
}

export type PivotCol = { date: string; dow: number; reja: boolean }
export type PivotRow = {
  product_id: number; name: string; type: string
  values: (number | null)[]; model: (number | null)[]; edited: boolean[]
  total: number
}
export type Pivot = {
  run_id: number; round_to: number
  columns: PivotCol[]; rows: PivotRow[]; totals: (number | null)[]
  jami: number
  dokon: string | null; usul: string | null
  tahrirlanadi: boolean
}

export type DokonUsul = { kod: string; nomi: string; wape: number; izoh: string }
export type Dokon = {
  usul: string; usul_nomi: string; wape: number; izoh: string
  usullar: DokonUsul[]
  mahsulot_wape: number
  jami: number
  items: { shop_type: string; qty: number; ulush: number; mahsulot: number }[]
}

export type ArxivItem = {
  run_id: number; created_at: string; faol: boolean; data_last_day: string
  gorizont: number; ustama: boolean; zaxira: number
  mahsulot: number; jami: number; dan: string; gacha: string
  fakt_kunlar: number; fakt_fayllar: number; yak_kunlar: number
  qolda: boolean; asos_run: number | null; ozgartirilgan: number
  farq: number | null; izoh: string | null
}

export type ArxivRun = {
  run: ArxivItem & { ozgartirilgan: number }
  items: {
    product_id: number; name: string; type: string
    total: number; lo: number; hi: number; qolda_farq: number
  }[]
}

export type Holat = {
  fakt: { rows: number; qty: number; amount: number; orders: number
          kunlar: number; fayllar: number; dan: string | null; gacha: string | null }
  yakuniy: { rows: number; qty: number; kunlar: number; fayllar: number
             dan: string | null; gacha: string | null }
  olchov: { products: number; shops: number; zones: number }
}

export type FaylItem = {
  key: string; fayl: string; sana: string; rows: number; qty: number
  yuklangan: string
  dan?: string; gacha?: string; kunlar?: number
  amount?: number; buyurtma?: number; dokon?: number
}
export type Fayllar = { manba: string; gaps: string[]; count: number; items: FaylItem[] }

export type Chiqarilgan = {
  product_id: number | null; name: string; type: string; holat: string
  kunlar: number; jami: number; yaqinda: number
  oxirgi_sotuv: string | null; sabab: string
}

export type Mahsulot = {
  product: { product_id: number; name: string; product_type: string }
  tarix: { date: string; dow: number; qty: number; amount: number; sotilgan: number | null }[]
  reja: { date: string; dow: number; step: number; qty: number; model: number; qolda: boolean
          lo: number; hi: number; daraja: number; mavsum: number; dow_ix: number }[]
  dow: { dow: number; qty: number }[]
  mavsum: { oy: number; ix: number }[]
  dokon: { shop_type: string; ulush: number }[]
  aniqlik: { cv: number | null; xato: number | null; kunlar: number | null } | null
  holat: { holat: string; kesim: number; talab: number; sotilgan: number } | null
}

export type Tahrir = { product_id: number; target_date: string; qty: number }

// ─── So'rovlar ────────────────────────────────────────────────────────────────

export const fetchSummary = () => get<Summary>('/summary')
export const fetchPlan = (ptype?: string) => get<Plan>('/plan', { ptype })
export const fetchPivot = (p: { ptype?: string; dokon?: string; usul?: string; round_to: number }) =>
  get<Pivot>('/pivot', p)
export const fetchKunlik = (ptype?: string) =>
  get<{ tarix: { date: string; dow: number; qty: number }[]
        reja: { date: string; dow: number; qty: number; lo: number; hi: number }[] }>('/kunlik', { ptype })
export const fetchDokon = (usul = 'aralash') => get<Dokon>('/dokon', { usul })
export const fetchArxiv = () => get<ArxivItem[]>('/arxiv')
export const fetchArxivRun = (id: number) => get<ArxivRun>(`/arxiv/${id}`)

/** Arxivdagi rejaning TO'LIQ kunlik jadvali (mahsulot × kun). */
export const fetchArxivPivot = (id: number, round_to = 50) =>
  get<Pivot & { faol: boolean; qolda: boolean; ozgartirilgan: number }>(
    `/arxiv/${id}/pivot`, { round_to })

export const arxivEksportURL = (id: number) => `${P}/arxiv/${id}/eksport`
export const fetchHolat = () => get<Holat>('/holat')
export const fetchFayllar = (manba: 'fakt' | 'yakuniy') => get<Fayllar>('/fayllar', { manba })
export const fetchChiqarilgan = () => get<Chiqarilgan[]>('/chiqarilgan')
export const fetchMahsulot = (pid: number) => get<Mahsulot>(`/product/${pid}`)

/** QAYTA HISOBLASH — yagona nuqta. Eski reja arxivda qoladi.
 *
 *  `boshlanish` — reja qaysi kundan boshlanadi (YYYY-MM-DD).
 *  Bo'sh qoldirilsa, ma'lumotdan keyingi ish kunidan boshlanadi. */
export const hisobla = (p: {
  gorizont: number; ustama: boolean; zaxira: number
  izoh?: string; boshlanish?: string
}) =>
  send<{
    run_id: number; jami: number; mahsulot: number
    dan: string; gacha: string; farq: number | null
  }>('/hisobla', 'POST', undefined, p)

/** QO'LDA TAHRIR — eski rejani o'zgartirmaydi, yangi versiya yaratadi. */
export const tahrirla = (changes: Tahrir[], izoh?: string) =>
  send<{ run_id: number; asos_run: number; jami: number; ozgartirilgan: number; farq: number }>(
    '/tahrir', 'POST', { changes, izoh: izoh || null })

export const faollashtir = (runId: number) =>
  send<{ ok: boolean; message: string }>(`/arxiv/${runId}/faollashtir`, 'POST')

export const ochirBitta = (manba: 'fakt' | 'yakuniy', key: string) =>
  send<{ ochirildi: Record<string, unknown> }>(
    `/fayllar/${manba}/${encodeURIComponent(key)}`, 'DELETE')

export const ochirHammasi = (manba: 'fakt' | 'yakuniy') =>
  send<{ ochirildi: Record<string, unknown> }>('/fayllar', 'DELETE', undefined,
    { manba, tasdiq: 'HAMMASINI OCHIRISH' })

export type YuklashNatija = {
  natija: { fayl: string; status: string; manba: string | null; sana?: string
            kunlar?: number; rows?: number; qty?: number; xabar?: string }[]
  jami: { yuklandi: number; qayta: number; otkazildi: number; xato: number }
  qayta_hisoblash_kerak: boolean
  xabar: string | null
}

export async function yukla(files: File[], manba: 'fakt' | 'yakuniy', replace: boolean) {
  const url = `${P}/yukla?manba=${manba}&replace=${replace}`

  // FormData yuboriladi, shuning uchun send() dan alohida — lekin parol
  // mantig'i bir xil: yo'q bo'lsa so'raladi, 401 bo'lsa qayta so'raladi.
  const urin = async (parol: string) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f, f.name))
    return fetch(url, { method: 'POST', body: fd, headers: { 'X-Admin-Parol': parol } })
  }

  let res = await urin(await parolOl())
  if (res.status === 401) res = await urin(await parolOl(true))

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.detail ?? `${res.status}`)
  return json as YuklashNatija
}

export const eksportURL = (dokon?: string | null, usul?: string | null) => {
  const q = new URLSearchParams()
  if (dokon) { q.set('dokon', dokon); if (usul) q.set('usul', usul) }
  return `${P}/eksport${q.toString() ? '?' + q : ''}`
}

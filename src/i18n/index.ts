import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Lang } from './translations'
import { T } from './translations'

interface LangStore {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLangStore = create<LangStore>()(
  persist(
    (set) => ({
      lang: 'uz',
      setLang: (lang) => set({ lang }),
    }),
    { name: 'essi-lang' }
  )
)

export function useT() {
  const lang = useLangStore(s => s.lang)
  return (key: string, fallback?: string): string =>
    T[lang][key] ?? T['uz'][key] ?? fallback ?? key
}

export type { Lang }

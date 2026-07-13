/**
 * Ma'lumotlarni boshqarish — ikkita manba.
 *
 *   Excel savdo  — fakt_savdo + yakuniy_savdo (prognoz uchun)
 *   RITM API     — orders_cache (real vaqtli analitika uchun)
 *
 * Ikkalasi ham BITTA `essi` bazasida yashaydi, lekin ular butunlay boshqa
 * narsalar: Excel — kunlik/haftalik hisobotlar, RITM — jonli buyurtmalar.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Database, FileSpreadsheet, History, Loader2, Radio } from 'lucide-react'

import DataManagement from './DataManagement'
import { Arxiv } from '../components/prognoz/Arxiv'
import { ExcelYuklash } from '../components/prognoz/ExcelYuklash'
import { Fayllar } from '../components/prognoz/Fayllar'
import { Chiqarilgan } from '../components/prognoz/Chiqarilgan'
import { fetchHolat } from '../api/prognoz'
import { fmt } from '../utils/formatters'

type Tab = 'excel' | 'ritm'

const TABS: { key: Tab; label: string; icon: typeof Database; note: string }[] = [
  { key: 'excel', label: 'Excel savdo (prognoz)', icon: FileSpreadsheet,
    note: 'Kunlik va haftalik hisobotlar — 2 haftalik reja shundan hisoblanadi' },
  { key: 'ritm', label: 'RITM API (analitika)', icon: Radio,
    note: 'Real vaqtli buyurtmalar — savdo analitikasi shundan o‘qiydi' },
]

export default function Malumotlar({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('excel')

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Yorliqlar */}
      <div className="flex items-center gap-1 px-4 py-2 flex-shrink-0"
        style={{ background: 'rgba(7,14,28,0.97)', borderBottom: '1px solid rgba(59,130,246,0.07)' }}>
        {TABS.map(({ key, label, icon: Icon, note }) => (
          <button key={key} onClick={() => setTab(key)} title={note}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={tab === key
              ? { background: 'rgba(59,130,246,0.14)', color: '#93c5fd' }
              : { color: '#64748b' }}>
            <Icon size={13} />{label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[10.5px] text-slate-600">
          {TABS.find(t => t.key === tab)!.note}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'excel' ? <ExcelTab /> : <DataManagement onBack={onBack} />}
      </div>
    </div>
  )
}

function ExcelTab() {
  const { data, isLoading } = useQuery({ queryKey: ['pr-holat'], queryFn: fetchHolat })

  return (
    <div className="flex flex-col gap-3 px-4 py-3">

      {/* Ikkala manbaning holati */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
        {isLoading && (
          <div className="col-span-full flex items-center gap-2 text-slate-600 text-sm py-4">
            <Loader2 size={13} className="animate-spin" /> Yuklanmoqda…
          </div>
        )}
        {data && (
          <>
            <Tile k="Fakt savdo" tag="TALAB" tagColor="#3B82F6"
              v={fmt(data.fakt.rows)}
              d={<>{data.fakt.kunlar} kun · {data.fakt.fayllar} fayl<br />
                {data.fakt.dan} → {data.fakt.gacha}</>} />
            <Tile k="Yakuniy savdo" tag="SOTILGAN" tagColor="#EB6834"
              v={fmt(data.yakuniy.rows)}
              d={data.yakuniy.rows
                ? <>{data.yakuniy.kunlar} kun · {data.yakuniy.fayllar} fayl<br />
                    {data.yakuniy.dan} → {data.yakuniy.gacha}</>
                : "Yo'q — kesim hisoblanmaydi"} />
            <Tile k="O'lchovlar" v={String(data.olchov.products)} u="mahsulot"
              d={`${fmt(data.olchov.shops)} do'kon · ${data.olchov.zones} zona`} />
            <Tile k="Jami hajm" v={fmt(data.fakt.qty)} u="dona"
              d={`${fmt(data.fakt.orders)} buyurtma`} />
          </>
        )}
      </div>

      {/* Ikki manba nima ekanini tushuntirish */}
      <div className="px-3.5 py-2.5 rounded-lg text-[11px] text-slate-400 leading-relaxed"
        style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
        <b className="text-slate-200">Ikki manba, bitta farq.</b>{' '}
        <b style={{ color: '#93c5fd' }}>Fakt savdo</b> — mijoz nima so'ragan (talab).{' '}
        <b style={{ color: '#fdba74' }}>Yakuniy savdo</b> — ombor yetmagani uchun
        kesilgandan keyin nima yetkazilgan. Ikkalasining farqi —{' '}
        <b className="text-slate-200">yo'qotilgan savdo</b> (talabning ~11% i).
        <br />
        Shuning uchun model <b>yakuniy savdoni bashorat qilmaydi</b> — aks holda
        o'tmishdagi kamchilik abadiylashardi: kam ishlab chiqariladi → yana kesiladi →
        yana kam sotiladi. Reja <b>talabni</b> qoplashi kerak, kesilayotgan
        mahsulotlarga esa qo'shimcha ustama beriladi.
      </div>

      <ExcelYuklash />
      <Fayllar />
      <Chiqarilgan />

      <div className="flex items-center gap-2 text-slate-500 text-xs mt-1">
        <History size={13} />
        <span>Prognoz tarixi</span>
      </div>
      <Arxiv />
    </div>
  )
}

function Tile({ k, tag, tagColor, v, u, d }: {
  k: string; tag?: string; tagColor?: string; v: string; u?: string; d?: React.ReactNode
}) {
  return (
    <div className="px-3.5 py-2.5 rounded-lg"
      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{k}</span>
        {tag && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
            style={{ background: `${tagColor}22`, color: tagColor }}>{tag}</span>
        )}
      </div>
      <div className="font-mono tabular-nums font-semibold text-slate-100" style={{ fontSize: 21 }}>
        {v}{u && <span className="text-[11px] font-sans text-slate-500 ml-1">{u}</span>}
      </div>
      {d && <div className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">{d}</div>}
    </div>
  )
}

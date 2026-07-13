/**
 * Rejaga kirmagan mahsulotlar va sababi.
 *
 *   o'lik  — buyurtma keladi, lekin oxirgi 30 kunda ishlab chiqarilmagan
 *            (yakuniy savdo nol). Reja bersak, ishlab chiqarilmaydigan narsaga
 *            reja tushardi. Ustama ham berilmaydi — aks holda kesim 100%
 *            ko'ringani uchun ×1.15 olib ketardi.
 *   siyrak — 30 kundan kam tarix
 *   tur    — Тара (qadoq) va Сырьё (xomashyo): ishlab chiqarish mahsuloti emas
 */
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { fetchChiqarilgan } from '../../api/prognoz'
import { fmt } from '../../utils/formatters'
import { Card } from './ExcelYuklash'

const HOLAT: Record<string, [string, string]> = {
  olik:   ["O'LIK",   '#f87171'],
  siyrak: ['SIYRAK',  '#fbbf24'],
  tur:    ['TUR',     '#94a3b8'],
}

export function Chiqarilgan() {
  const { data, isLoading } = useQuery({
    queryKey: ['pr-chiqarilgan'], queryFn: fetchChiqarilgan,
  })

  return (
    <Card title="Rejaga kirmagan mahsulotlar"
      note="Har biri uchun sabab ko'rsatilgan. O'lik mahsulotga ustama ham berilmaydi — aks holda ishlab chiqarilmaydigan narsaga reja tushardi.">
      <div className="rounded-lg overflow-auto" style={{ maxHeight: 300, border: '1px solid rgba(148,163,184,0.08)' }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0" style={{ background: '#0d1526' }}>
            <tr className="text-slate-500">
              <th className="text-left px-2.5 py-2 font-normal">Mahsulot</th>
              <th className="text-left px-2.5 py-2 font-normal">Turi</th>
              <th className="text-right px-2.5 py-2 font-normal">Yaqinda</th>
              <th className="text-right px-2.5 py-2 font-normal">Jami</th>
              <th className="text-left px-2.5 py-2 font-normal">Sabab</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="text-center py-6 text-slate-600">
                <Loader2 size={13} className="animate-spin inline" /></td></tr>
            )}
            {data?.map((r, i) => {
              const h = HOLAT[r.holat] ?? [r.holat.toUpperCase(), '#94a3b8']
              return (
                <tr key={i} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                  <td className="px-2.5 py-1.5 text-slate-300">
                    {r.name}
                    <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                      style={{ background: `${h[1]}1e`, color: h[1] }}>{h[0]}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-600">{r.type}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono"
                    style={{ color: r.yaqinda > 0 ? '#cbd5e1' : '#475569' }}>{fmt(r.yaqinda)}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-slate-500">{fmt(r.jami)}</td>
                  <td className="px-2.5 py-1.5 text-slate-500" style={{ whiteSpace: 'normal' }}>
                    {r.sabab}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

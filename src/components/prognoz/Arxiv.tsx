/**
 * Prognoz arxivi.
 *
 * Uchta qat'iy qoida:
 *   1. Har bir hisoblash va har bir qo'lda tahrir YANGI versiya yaratadi
 *   2. Eski versiyalar HECH QACHON o'chirilmaydi — baza triggeri himoya qiladi
 *   3. Istalgan eski rejaga qaytish mumkin; joriysi arxivda qoladi
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Pencil } from 'lucide-react'

import { fetchArxiv } from '../../api/prognoz'
import { ArxivModal } from './ArxivModal'
import { fmt } from '../../utils/formatters'
import { Card } from './ExcelYuklash'

export function Arxiv() {
  const [ochiq, setOchiq] = useState<number | null>(null)
  const { data, isLoading } = useQuery({ queryKey: ['pr-arxiv'], queryFn: fetchArxiv })

  return (
    <>
      <Card title="Prognoz arxivi"
        note="Har bir hisoblash va qo'lda tahrir yangi versiya yaratadi. Eski versiyalar hech qachon o'chirilmaydi — baza triggeri himoya qiladi. Qatorni bosing: to'liq tarkib, joriy reja bilan farq va unga qaytish tugmasi.">

        <div className="rounded-lg overflow-auto" style={{ maxHeight: 340, border: '1px solid rgba(148,163,184,0.08)' }}>
          <table className="w-full text-[11px]">
            <thead className="sticky top-0" style={{ background: '#0d1526' }}>
              <tr className="text-slate-500">
                <th className="text-left px-2.5 py-2 font-normal">#</th>
                <th className="text-left px-2.5 py-2 font-normal">Hisoblangan</th>
                <th className="text-right px-2.5 py-2 font-normal">Gorizont</th>
                <th className="text-right px-2.5 py-2 font-normal">Zaxira</th>
                <th className="text-right px-2.5 py-2 font-normal">Mahsulot</th>
                <th className="text-right px-2.5 py-2 font-normal">Jami reja</th>
                <th className="text-right px-2.5 py-2 font-normal">Oldingidan</th>
                <th className="text-left px-2.5 py-2 font-normal">Izoh</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-6 text-slate-600">
                  <Loader2 size={13} className="animate-spin inline" /></td></tr>
              )}
              {!isLoading && !data?.length && (
                <tr><td colSpan={8} className="text-center py-6 text-slate-600">
                  Hali prognoz hisoblanmagan</td></tr>
              )}
              {data?.map(r => (
                <tr key={r.run_id} onClick={() => setOchiq(r.run_id)}
                  className="cursor-pointer hover:bg-slate-800/40"
                  style={{
                    borderTop: '1px solid rgba(148,163,184,0.06)',
                    background: r.faol ? 'rgba(59,130,246,0.06)' : undefined,
                  }}>
                  <td className="px-2.5 py-1.5">
                    <span className="font-semibold text-slate-200">{r.run_id}</span>
                    {r.faol && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                        style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd' }}>joriy</span>
                    )}
                    {r.qolda && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium inline-flex items-center gap-0.5"
                        title={`${r.ozgartirilgan} ta hujayra qo'lda o'zgartirilgan (run ${r.asos_run} asosida)`}
                        style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24' }}>
                        <Pencil size={8} />QO'LDA
                      </span>
                    )}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-slate-400">
                    {new Date(r.created_at).toLocaleString('ru-RU',
                      { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-slate-500">{r.gorizont} kun</td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">{r.zaxira.toFixed(2)}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono text-slate-500">{r.mahsulot}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono font-semibold" style={{ color: '#EB6834' }}>
                    {fmt(r.jami)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-mono"
                    style={{ color: !r.farq ? '#475569' : r.farq > 0 ? '#34d399' : '#f87171' }}>
                    {r.farq == null ? '—'
                      : (r.farq > 0 ? '+' : '−') + fmt(Math.abs(Math.round(r.farq)))}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-500 truncate" style={{ maxWidth: 220 }}>
                    {r.izoh ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {ochiq != null && <ArxivModal runId={ochiq} onClose={() => setOchiq(null)} />}
    </>
  )
}

/**
 * Arxivdagi bitta prognozni TO'LIQ ko'rish.
 *
 *   Jami        — mahsulot kesimida, joriy reja bilan farq
 *   Kunlik      — to'liq svod jadval (mahsulot × kun), o'sha paytdagi holat
 *
 * Arxiv o'zgarmas — bu yerda hech narsa tahrirlanmaydi.
 * Qo'lda o'zgartirilgan hujayralar sariq; sichqoncha ustiga olsangiz
 * modelning asl qiymati chiqadi.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, History, Loader2, RotateCcw, X } from 'lucide-react'

import {
  arxivEksportURL, faollashtir, fetchArxivPivot, fetchArxivRun,
} from '../../api/prognoz'
import { fmt } from '../../utils/formatters'

const DOW = ['', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba']

type Vid = 'jami' | 'kunlik'

export function ArxivModal({ runId, onClose }: { runId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [vid, setVid] = useState<Vid>('jami')
  const [round, setRound] = useState(50)

  const run = useQuery({ queryKey: ['pr-arxiv-run', runId], queryFn: () => fetchArxivRun(runId) })
  const pivot = useQuery({
    queryKey: ['pr-arxiv-pivot', runId, round],
    queryFn: () => fetchArxivPivot(runId, round),
    enabled: vid === 'kunlik',
  })

  const m = useMutation({
    mutationFn: () => faollashtir(runId),
    onSuccess: () => { onClose(); qc.invalidateQueries() },
  })

  const r = run.data?.run

  // joriy reja bilan solishtirish (cache'dagi joriy reja)
  const joriy = new Map(
    (qc.getQueryData(['pr-plan', '']) as { items?: { product_id: number; total: number }[] } | undefined)
      ?.items?.map(i => [i.product_id, i.total]) ?? [])

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-50 flex items-start justify-center p-5 overflow-auto"
      style={{ background: 'rgba(2,6,16,0.82)', backdropFilter: 'blur(3px)' }}>

      <div className="w-full rounded-xl my-3" style={{
        maxWidth: vid === 'kunlik' ? 1500 : 900,
        background: '#0b1220', border: '1px solid rgba(148,163,184,0.14)',
      }}>

        {/* ═══ Sarlavha ═══ */}
        <div className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <History size={14} className="text-slate-500" />
              <span className="text-slate-100 font-medium">Prognoz — run {runId}</span>
              {r?.faol && (
                <Chip c="#3B82F6">joriy reja</Chip>
              )}
              {r?.qolda && (
                <Chip c="#F59E0B">
                  QO'LDA · {r.ozgartirilgan} hujayra (run {r.asos_run} asosida)
                </Chip>
              )}
            </div>
            {r && (
              <div className="text-[11px] text-slate-500 mt-1">
                {new Date(r.created_at).toLocaleString('ru-RU')} · ma'lumot{' '}
                <b className="text-slate-400">{r.data_last_day}</b> gacha · zaxira{' '}
                <b className="text-slate-400">{r.zaxira.toFixed(2)}</b> · kesim ustamasi{' '}
                <b className="text-slate-400">{r.ustama ? 'yoqilgan' : "o'chirilgan"}</b>
                {r.izoh && <> · {r.izoh}</>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        {run.isLoading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-16 text-sm">
            <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
          </div>
        )}

        {run.data && r && (
          <div className="p-5 flex flex-col gap-4">

            {/* ═══ Ko'rsatkichlar ═══ */}
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))' }}>
              <Kpi k="Jami reja" v={fmt(r.jami)} u="dona" accent="#EB6834"
                d={`${run.data.items.length} mahsulot`} />
              <Kpi k="Davr" v={r.dan} d={`→ ${r.gacha} · ${r.gorizont} ish kuni`} />
              <Kpi k="Ma'lumot" v={`${r.fakt_kunlar} kun`} d={`fakt · ${r.yak_kunlar} kun yakuniy`} />
              {r.farq != null && (
                <Kpi k="Oldingi versiyadan" v={`${r.farq > 0 ? '+' : '−'}${fmt(Math.abs(Math.round(r.farq)))}`}
                  u="dona" accent={r.farq > 0 ? '#34d399' : '#f87171'} />
              )}
            </div>

            {/* ═══ Boshqaruv ═══ */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(15,23,42,0.6)' }}>
                {(['jami', 'kunlik'] as Vid[]).map(v => (
                  <button key={v} onClick={() => setVid(v)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium transition"
                    style={vid === v
                      ? { background: 'rgba(59,130,246,0.16)', color: '#93c5fd' }
                      : { color: '#64748b' }}>
                    {v === 'jami' ? 'Mahsulot jamilari' : 'To\'liq kunlik jadval'}
                  </button>
                ))}
              </div>

              {vid === 'kunlik' && (
                <select value={round} onChange={e => setRound(+e.target.value)}
                  className="px-2 py-1 rounded-lg text-[11px] outline-none cursor-pointer"
                  style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', color: '#93c5fd' }}>
                  {[[1, 'Aniq'], [10, '10 ga'], [50, '50 ga'], [100, '100 ga']].map(([v, l]) => (
                    <option key={v} value={v} style={{ background: '#0f172a' }}>{l}</option>
                  ))}
                </select>
              )}

              <div className="flex-1" />

              <a href={arxivEksportURL(runId)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
                <Download size={11} /> Excel
              </a>

              {!r.faol && (
                <button onClick={() => m.mutate()} disabled={m.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white disabled:opacity-50"
                  style={{ background: '#3B82F6' }}>
                  {m.isPending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                  Shu rejaga qaytish
                </button>
              )}
            </div>

            {!r.faol && (
              <div className="text-[10.5px] text-slate-600 -mt-2">
                «Shu rejaga qaytish» — joriy reja arxivda qoladi, hech narsa o'chmaydi.
                Arxiv o'zgarmas: bu yerda hech narsa tahrirlanmaydi.
              </div>
            )}

            {m.isError && <div className="text-[11px] text-red-400">{(m.error as Error).message}</div>}

            {/* ═══ JAMI ═══ */}
            {vid === 'jami' && (
              <div className="rounded-lg overflow-auto"
                style={{ maxHeight: 460, border: '1px solid rgba(148,163,184,0.08)' }}>
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0" style={{ background: '#0d1526' }}>
                    <tr className="text-slate-500">
                      <th className="text-left px-2.5 py-2 font-normal">Mahsulot</th>
                      <th className="text-left px-2.5 py-2 font-normal">Turi</th>
                      <th className="text-right px-2.5 py-2 font-normal">Jami</th>
                      <th className="text-right px-2.5 py-2 font-normal">Past</th>
                      <th className="text-right px-2.5 py-2 font-normal">Yuqori</th>
                      {joriy.size > 0 && !r.faol && (
                        <>
                          <th className="text-right px-2.5 py-2 font-normal">Joriy reja</th>
                          <th className="text-right px-2.5 py-2 font-normal">Farq</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {run.data.items.map(i => {
                      const j = joriy.get(i.product_id)
                      const f = j != null ? i.total - j : null
                      return (
                        <tr key={i.product_id} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                          <td className="px-2.5 py-1.5 text-slate-200">
                            {i.name}
                            {i.qolda_farq !== 0 && (
                              <span className="ml-1.5 text-[9px] font-mono" style={{ color: '#fbbf24' }}>
                                {i.qolda_farq > 0 ? '+' : '−'}{fmt(Math.abs(i.qolda_farq))} qo'lda
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-slate-600">{i.type}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono font-semibold text-slate-200">
                            {fmt(i.total)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-slate-600">{fmt(i.lo)}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-slate-600">{fmt(i.hi)}</td>
                          {joriy.size > 0 && !r.faol && (
                            <>
                              <td className="px-2.5 py-1.5 text-right font-mono text-slate-500">
                                {j != null ? fmt(j) : '—'}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-semibold"
                                style={{ color: !f ? '#475569' : f > 0 ? '#34d399' : '#f87171' }}>
                                {f == null || f === 0 ? '—' : (f > 0 ? '+' : '−') + fmt(Math.abs(f))}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ═══ TO'LIQ KUNLIK JADVAL ═══ */}
            {vid === 'kunlik' && (
              <>
                {pivot.isLoading && (
                  <div className="flex items-center gap-2 text-slate-500 text-xs py-10 justify-center">
                    <Loader2 size={13} className="animate-spin" /> Jadval yuklanmoqda…
                  </div>
                )}

                {pivot.data && (
                  <>
                    {pivot.data.ozgartirilgan > 0 && (
                      <div className="px-3 py-2 rounded-lg text-[11px] text-slate-400"
                        style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
                        <b className="text-amber-300">{pivot.data.ozgartirilgan} ta hujayra qo'lda o'zgartirilgan</b>
                        {' '}— sariq bilan belgilangan. Sichqonchani ustiga olsangiz modelning asl qiymati chiqadi.
                      </div>
                    )}

                    {/* Mahsulot ustuni, sana sarlavhasi va JAMI qotib turadi.
                        borderCollapse: separate — aks holda qotgan hujayralarda
                        chegaralar yo'qoladi; chegaralar inset shadow bilan. */}
                    <div className="rounded-lg overflow-auto"
                      style={{ maxHeight: 520, border: '1px solid rgba(148,163,184,0.1)' }}>
                      <table className="text-[11px]"
                        style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                        <thead>
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-slate-400"
                              style={{
                                position: 'sticky', left: 0, top: 0, zIndex: 30,
                                background: '#0d1526', minWidth: 250,
                                boxShadow: 'inset -1px -1px 0 rgba(148,163,184,0.14)',
                              }}>
                              Mahsulot
                            </th>
                            {pivot.data.columns.map(c => (
                              <th key={c.date} className="px-2 py-1.5 text-center font-normal"
                                style={{
                                  position: 'sticky', top: 0, zIndex: 20,
                                  background: c.dow === 1 ? '#101c33' : '#0d1526',
                                  minWidth: c.dow === 7 ? 28 : 68,
                                  boxShadow: 'inset 0 -1px 0 rgba(148,163,184,0.14)',
                                }}>
                                {c.dow !== 7 && (
                                  <>
                                    <div className="text-[9.5px] text-slate-500 leading-tight">
                                      {c.dow} - {DOW[c.dow]}
                                    </div>
                                    <div className="font-mono text-[9.5px] text-slate-600 leading-tight">
                                      {c.date.slice(8)}.{c.date.slice(5, 7)}
                                    </div>
                                  </>
                                )}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-right font-medium text-slate-400"
                              style={{
                                position: 'sticky', right: 0, top: 0, zIndex: 30,
                                background: '#0d1526', minWidth: 86,
                                boxShadow: 'inset 1px -1px 0 rgba(148,163,184,0.14)',
                              }}>
                              JAMI
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {pivot.data.rows.map(row => (
                            <tr key={row.product_id}>
                              <td className="px-3 py-1.5"
                                style={{
                                  position: 'sticky', left: 0, zIndex: 10,
                                  background: '#0b1220',
                                  boxShadow: 'inset -1px 0 0 rgba(148,163,184,0.14), ' +
                                             'inset 0 -1px 0 rgba(148,163,184,0.06)',
                                }}>
                                <div className="text-slate-200">{row.name}</div>
                                <div className="text-[9.5px] text-slate-600">{row.type}</div>
                              </td>

                              {row.values.map((v, i) => {
                                const c = pivot.data!.columns[i]
                                if (c.dow === 7 || v == null) {
                                  return <td key={i} className="text-center text-slate-700"
                                    style={{ boxShadow: 'inset 0 -1px 0 rgba(148,163,184,0.06)' }}>—</td>
                                }
                                const ed = row.edited[i]
                                const chiziq = 'inset 0 -1px 0 rgba(148,163,184,0.06)'
                                return (
                                  <td key={i}
                                    title={ed ? `Model: ${fmt(row.model[i] ?? 0)} → qo'lda: ${fmt(v)}` : undefined}
                                    className="px-2 py-1.5 text-right font-mono tabular-nums"
                                    style={{
                                      background: ed ? 'rgba(245,158,11,0.18)'
                                        : c.dow === 1 ? 'rgba(59,130,246,0.04)' : undefined,
                                      boxShadow: ed ? `inset 2px 0 0 #F59E0B, ${chiziq}` : chiziq,
                                      color: ed ? '#fbbf24' : v ? '#cbd5e1' : '#475569',
                                      fontWeight: ed ? 600 : 400,
                                    }}>
                                    {v ? fmt(v) : '—'}
                                  </td>
                                )
                              })}

                              <td className="px-3 py-1.5 text-right font-mono tabular-nums font-semibold text-slate-200"
                                style={{
                                  position: 'sticky', right: 0, zIndex: 10,
                                  background: '#101a2e',
                                  boxShadow: 'inset 1px 0 0 rgba(148,163,184,0.14), ' +
                                             'inset 0 -1px 0 rgba(148,163,184,0.06)',
                                }}>
                                {fmt(row.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        <tfoot>
                          <tr>
                            <td className="px-3 py-2 font-medium text-slate-300"
                              style={{
                                position: 'sticky', left: 0, bottom: 0, zIndex: 30,
                                background: '#0d1526',
                                boxShadow: 'inset -1px 1px 0 rgba(148,163,184,0.14)',
                              }}>
                              JAMI — {pivot.data.rows.length} mahsulot
                            </td>
                            {pivot.data.totals.map((t, i) => (
                              <td key={i} className="px-2 py-2 text-right font-mono tabular-nums text-slate-300"
                                style={{
                                  position: 'sticky', bottom: 0, zIndex: 20,
                                  background: pivot.data!.columns[i].dow === 1 ? '#101c33' : '#0d1526',
                                  boxShadow: 'inset 0 1px 0 rgba(148,163,184,0.14)',
                                }}>
                                {t == null ? '—' : fmt(t)}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-mono tabular-nums font-bold"
                              style={{
                                position: 'sticky', right: 0, bottom: 0, zIndex: 30,
                                background: '#0d1526', color: '#EB6834',
                                boxShadow: 'inset 1px 1px 0 rgba(148,163,184,0.14)',
                              }}>
                              {fmt(pivot.data.jami)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({ c, children }: { c: string; children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium"
      style={{ background: `${c}2e`, color: c }}>{children}</span>
  )
}

function Kpi({ k, v, u, d, accent }: {
  k: string; v: string; u?: string; d?: string; accent?: string
}) {
  return (
    <div className="px-3 py-2 rounded-lg"
      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div>
      <div className="font-mono tabular-nums font-semibold mt-0.5"
        style={{ fontSize: 17, color: accent ?? '#e2e8f0' }}>
        {v}{u && <span className="text-[10px] font-sans text-slate-500 ml-1">{u}</span>}
      </div>
      {d && <div className="text-[10px] text-slate-600 mt-0.5">{d}</div>}
    </div>
  )
}

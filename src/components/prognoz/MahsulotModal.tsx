/**
 * Mahsulot kartasi — tarix, reja, mavsumiylik, kesim, do'kon taqsimoti.
 *
 * Bu yerda modelning ichi ko'rinadi: daraja × mavsum × hafta-kuni × ustama.
 */
import { useQuery } from '@tanstack/react-query'
import {
  Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, Cell,
} from 'recharts'
import { Loader2, X } from 'lucide-react'

import { fetchMahsulot } from '../../api/prognoz'
import { fmt } from '../../utils/formatters'

const DOW = ['', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sha', 'Yak']
const OY = ['', 'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

const HOLAT: Record<string, [string, string]> = {
  tirik:  ['Tirik',  '#34d399'],
  olik:   ["O'lik",  '#f87171'],
  siyrak: ['Siyrak', '#fbbf24'],
}

export function MahsulotModal({ pid, onClose }: { pid: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pr-mahsulot', pid],
    queryFn: () => fetchMahsulot(pid),
  })

  // tarix (talab + sotilgan) va reja bitta grafikda
  const chart = [
    ...(data?.tarix ?? []).slice(-42).map(t => ({
      date: t.date.slice(5), talab: t.qty, sotilgan: t.sotilgan, reja: null as number | null,
    })),
    ...(data?.reja ?? []).map(r => ({
      date: r.date.slice(5), talab: null as number | null, sotilgan: null as number | null,
      reja: r.qty, lo: r.lo, hi: r.hi,
    })),
  ]

  const h = data?.holat
  const a = data?.aniqlik
  const holat = h ? HOLAT[h.holat] ?? [h.holat, '#94a3b8'] : null

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-50 flex items-start justify-center p-6 overflow-auto"
      style={{ background: 'rgba(2,6,16,0.8)', backdropFilter: 'blur(3px)' }}>

      <div className="w-full max-w-5xl rounded-xl my-4"
        style={{ background: '#0b1220', border: '1px solid rgba(148,163,184,0.14)' }}>

        {/* Sarlavha */}
        <div className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
          <div>
            <div className="text-slate-100 font-medium">{data?.product.name ?? '…'}</div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{data?.product.product_type}</span>
              {holat && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ background: `${holat[1]}20`, color: holat[1] }}>{holat[0]}</span>
              )}
              {data?.mavsum.length ? (
                <span className="px-1.5 py-0.5 rounded text-[10px]"
                  style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>mavsumiy</span>
              ) : null}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 py-16 text-sm">
            <Loader2 size={14} className="animate-spin" /> Yuklanmoqda…
          </div>
        )}

        {data && (
          <div className="p-5 flex flex-col gap-5">

            {/* Ko'rsatkichlar */}
            <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
              <Kpi k="Reja (12 kun)"
                v={fmt(data.reja.reduce((s, r) => s + r.qty, 0))} u="dona" accent="#EB6834" />
              <Kpi k="Kutilayotgan xato" v={a?.xato != null ? `${a.xato}%` : '—'}
                d={a?.cv != null ? `kunlik tebranish ${Math.round(a.cv * 100)}%` : undefined} />
              <Kpi k="Kesim" v={h ? `${h.kesim}%` : '—'}
                accent={h && h.kesim >= 20 ? '#f87171' : h && h.kesim >= 10 ? '#fbbf24' : undefined}
                d={h ? `${fmt(h.talab)} talab → ${fmt(h.sotilgan)} sotilgan` : undefined} />
              <Kpi k="Daraja (kunlik)" v={fmt(data.reja[0]?.daraja ?? 0)} u="dona"
                d="so'nggi 24 ish kuni, chekkalari kesilgan" />
            </div>

            {/* Tarix + reja */}
            <Card title="Talab, sotilgan va reja"
              note="Ko'k — talab (fakt savdo). Yashil — sotilgan (yakuniy savdo). Orasidagi farq — ombor yetmagani uchun yo'qotilgan savdo. To'q sariq — reja.">
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                  <Area dataKey="hi" stroke="none" fill="#EB6834" fillOpacity={0.12} />
                  <Area dataKey="lo" stroke="none" fill="#0b1220" fillOpacity={1} />
                  <Line dataKey="talab" stroke="#3B82F6" strokeWidth={1.6} dot={false} name="Talab" />
                  <Line dataKey="sotilgan" stroke="#10B981" strokeWidth={1.4} dot={false} name="Sotilgan" />
                  <Line dataKey="reja" stroke="#EB6834" strokeWidth={2} dot={{ r: 2 }} name="Reja" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>

              {/* Hafta kuni */}
              <Card title="Hafta kuni profili" note="So'nggi 8 hafta. Dushanba odatda cho'qqi — yakshanbadagi buyurtmalar unga yig'iladi.">
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={data.dow.map(d => ({ ...d, nom: DOW[d.dow] }))}
                    margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                    <XAxis dataKey="nom" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="qty" radius={[3, 3, 0, 0]}>
                      {data.dow.map((d, i) => (
                        <Cell key={i} fill={d.dow === 1 ? '#3B82F6' : 'rgba(59,130,246,0.35)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Mavsumiylik */}
              {data.mavsum.length > 0 ? (
                <Card title="Mavsumiylik" note="Oylik indeks (1.00 = o'rtacha). Faqat amplitudasi kuchli mahsulotlarga qo'llanadi — qolganlarida u shovqindan iborat.">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={data.mavsum.map(m => ({ ...m, nom: OY[m.oy] }))}
                      margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                      <XAxis dataKey="nom" tick={{ fontSize: 9, fill: '#64748b' }} />
                      <YAxis domain={[0, 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="ix" radius={[3, 3, 0, 0]}>
                        {data.mavsum.map((m, i) => (
                          <Cell key={i} fill={m.ix >= 1.15 ? '#EB6834' : m.ix <= 0.85 ? '#334155' : '#8B5CF6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              ) : (
                <Card title="Mavsumiylik"
                  note="Bu mahsulotda mavsumiylik ISHLATILMAYDI — uning amplitudasi zaif, ya'ni o'lchangan tebranish shovqindan iborat. Modelga qo'shsak, aniqlik yomonlashadi.">
                  <div className="text-slate-600 text-xs py-8 text-center">Mavsumiy emas</div>
                </Card>
              )}
            </div>

            {/* Do'kon taqsimoti */}
            {data.dokon.length > 0 && (
              <Card title="Do'kon turi bo'yicha taqsimot"
                note="So'nggi 24 ish kunidagi ulush. Bu prognoz emas — jami rejaning taxminiy bo'linishi.">
                <div className="flex flex-wrap gap-1.5">
                  {data.dokon.map(d => (
                    <div key={d.shop_type} className="px-2 py-1 rounded text-[11px] flex items-center gap-1.5"
                      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                      <span className="text-slate-300">{d.shop_type}</span>
                      <span className="font-mono text-blue-300">{d.ulush}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Kunlik reja */}
            <Card title="Kunlik reja"
              note="Bashorat = daraja × mavsum × hafta-kuni × ustama × zaxira. Qo'lda o'zgartirilgan kunlar sariq.">
              <div className="overflow-x-auto">
                <table className="text-[11px] w-full">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left py-1.5 font-normal">Sana</th>
                      <th className="text-left py-1.5 font-normal">Kun</th>
                      <th className="text-right py-1.5 font-normal">Reja</th>
                      <th className="text-right py-1.5 font-normal">Model</th>
                      <th className="text-right py-1.5 font-normal">Past</th>
                      <th className="text-right py-1.5 font-normal">Yuqori</th>
                      <th className="text-right py-1.5 font-normal">Mavsum</th>
                      <th className="text-right py-1.5 font-normal">Hafta-kuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.reja.map(r => (
                      <tr key={r.date} style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                        <td className="py-1.5 font-mono text-slate-300">{r.date}</td>
                        <td className="py-1.5 text-slate-500">{DOW[r.dow]}</td>
                        <td className="py-1.5 text-right font-mono font-semibold"
                          style={{ color: r.qolda ? '#fbbf24' : '#e2e8f0' }}>{fmt(r.qty)}</td>
                        <td className="py-1.5 text-right font-mono text-slate-600">
                          {r.qolda ? fmt(r.model) : '—'}</td>
                        <td className="py-1.5 text-right font-mono text-slate-600">{fmt(r.lo)}</td>
                        <td className="py-1.5 text-right font-mono text-slate-600">{fmt(r.hi)}</td>
                        <td className="py-1.5 text-right font-mono text-slate-500">{r.mavsum.toFixed(2)}</td>
                        <td className="py-1.5 text-right font-mono text-slate-500">{r.dow_ix.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3.5"
      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
      <div className="text-xs font-medium text-slate-300 mb-0.5">{title}</div>
      {note && <div className="text-[11px] text-slate-600 mb-2.5 leading-relaxed">{note}</div>}
      {children}
    </div>
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
      {d && <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">{d}</div>}
    </div>
  )
}

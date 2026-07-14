/**
 * Savdo prognozi — 2 haftalik reja.
 *
 * Model butunlay PostgreSQL da. Bu sahifa faqat ko'rsatadi va tahrirlaydi.
 *
 * Uchta qoida:
 *   1. Excel yuklanishi prognozni o'zgartirmaydi — "eskirgan" deb ogohlantiradi
 *   2. Qayta hisoblash faqat qo'lda
 *   3. Har tahrir yangi versiya yaratadi; eski reja arxivda qoladi
 */
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, Calculator, Check, Download, Loader2, Pencil,
  RotateCcw, Save, X,
} from 'lucide-react'

import {
  fetchDokon, fetchPivot, fetchPlan, fetchSummary,
  hisobla, rejaEksport, tahrirla, type Tahrir,
} from '../api/prognoz'
import { MahsulotModal } from '../components/prognoz/MahsulotModal'
import { fmt } from '../utils/formatters'

const DOW = ['', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba']

type Dirty = Map<string, { pid: number; date: string; qty: number; orig: number }>
const key = (pid: number, date: string) => `${pid}|${date}`

/** Sanani YYYY-MM-DD ga o'giradi — mahalliy vaqt bo'yicha.
 *  toISOString() ni ishlatib bo'lmaydi: u UTC ga o'tkazadi va Toshkent
 *  vaqtida sana bir kun orqaga surilib ketadi. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** n hafta keyingi dushanba (n=0 — shu haftaning dushanbasi). */
function dushanba(n: number): string {
  const d = new Date()
  const kun = (d.getDay() + 6) % 7        // 0 = dushanba … 6 = yakshanba
  d.setDate(d.getDate() - kun + n * 7)
  return iso(d)
}

/** «Davr» ro'yxati. Qiymat — boshlanish sanasi; '' = ma'lumotdan keyin. */
const DAVRLAR: [string, string][] = [
  ['', 'Ma’lumotdan keyin'],
  [dushanba(0), 'Bu hafta'],
  [dushanba(1), 'Keyingi hafta'],
  [dushanba(2), 'Undan keyingi hafta'],
]

export default function Prognoz() {
  const qc = useQueryClient()

  // ── filtrlar
  const [ptype, setPtype] = useState('')
  const [dokon, setDokon] = useState('')
  const [usul, setUsul] = useState('aralash')
  const [round, setRound] = useState(50)

  // ── qayta hisoblash parametrlari
  const [gorizont, setGorizont] = useState(12)
  const [zaxira, setZaxira] = useState(1.03)
  const [ustama, setUstama] = useState(true)
  // '' = ma'lumotdan keyingi ish kunidan boshlanadi (sukut)
  const [boshlanish, setBoshlanish] = useState('')

  // ── qo'lda tahrir
  const [dirty, setDirty] = useState<Dirty>(new Map())
  const [izoh, setIzoh] = useState('')
  const [xabar, setXabar] = useState<string | null>(null)
  const [ochiq, setOchiq] = useState<number | null>(null)

  const summary = useQuery({ queryKey: ['pr-summary'], queryFn: fetchSummary, retry: 0 })
  const plan = useQuery({ queryKey: ['pr-plan', ptype], queryFn: () => fetchPlan(ptype), retry: 0 })
  const pivot = useQuery({
    queryKey: ['pr-pivot', ptype, dokon, usul, round],
    queryFn: () => fetchPivot({ ptype, dokon: dokon || undefined, usul, round_to: round }),
    retry: 0,
  })
  const dk = useQuery({ queryKey: ['pr-dokon', usul], queryFn: () => fetchDokon(usul), retry: 0 })

  const s = summary.data
  const p = pivot.data

  // summary kelganda parametrlarni sinxronlaymiz (bir marta)
  const synced = useRef(false)
  if (s && !synced.current) {
    synced.current = true
    setGorizont(s.run.gorizont)
    setZaxira(s.run.zaxira)
    setUstama(s.run.ustama)
  }

  const reset = () => { setDirty(new Map()); setIzoh('') }

  const mHisobla = useMutation({
    mutationFn: () => hisobla({
      gorizont, ustama, zaxira,
      izoh: izoh || undefined,
      boshlanish: boshlanish || undefined,
    }),
    onSuccess: (r) => {
      reset()
      setXabar(`Hisoblandi — run ${r.run_id}: ${r.dan} → ${r.gacha}, ` +
               `${fmt(Math.round(r.jami))} dona` +
               (r.farq != null ? ` (${r.farq >= 0 ? '+' : '−'}${fmt(Math.abs(Math.round(r.farq)))})` : ''))
      qc.invalidateQueries({ queryKey: ['pr-summary'] })
      qc.invalidateQueries({ queryKey: ['pr-plan'] })
      qc.invalidateQueries({ queryKey: ['pr-pivot'] })
      qc.invalidateQueries({ queryKey: ['pr-arxiv'] })
    },
  })

  const mTahrir = useMutation({
    mutationFn: () => tahrirla(
      [...dirty.values()].map<Tahrir>(e => ({ product_id: e.pid, target_date: e.date, qty: e.qty })),
      izoh || undefined),
    onSuccess: (r) => {
      reset()
      setXabar(`Saqlandi — yangi versiya run ${r.run_id} (${r.asos_run}-reja asosida), ` +
               `${r.ozgartirilgan} hujayra o'zgartirildi. Eski reja arxivda qoldi.`)
      qc.invalidateQueries({ queryKey: ['pr-summary'] })
      qc.invalidateQueries({ queryKey: ['pr-plan'] })
      qc.invalidateQueries({ queryKey: ['pr-pivot'] })
      qc.invalidateQueries({ queryKey: ['pr-arxiv'] })
    },
  })

  const delta = useMemo(
    () => [...dirty.values()].reduce((a, e) => a + (e.qty - e.orig), 0),
    [dirty])

  const canEdit = p?.tahrirlanadi !== false

  // Reja ma'lumot oxiridan KEYIN boshlanishi shart — o'tgan kunga reja tuzilmaydi.
  // Backend ham shuni tekshiradi; bu faqat sana maydonini cheklaydi.
  const eng_erta = useMemo(() => {
    if (!s?.fakt.gacha) return undefined
    const d = new Date(`${s.fakt.gacha}T00:00:00`)
    d.setDate(d.getDate() + 1)
    return iso(d)
  }, [s?.fakt.gacha])

  // ── hujayra tahriri
  function onCell(e: React.FocusEvent<HTMLTableCellElement>, pid: number, date: string, orig: number) {
    const raw = (e.target.textContent ?? '').replace(/\D/g, '')
    const k = key(pid, date)
    const next = new Map(dirty)

    if (raw === '') {
      e.target.textContent = orig ? fmt(orig) : '—'
      next.delete(k)
    } else {
      const v = Math.max(0, parseInt(raw, 10))
      e.target.textContent = v ? fmt(v) : '—'
      if (v === orig) next.delete(k)
      else next.set(k, { pid, date, qty: v, orig })
    }
    setDirty(next)
  }

  if (summary.isLoading) {
    return <div className="flex items-center justify-center h-full text-slate-500 gap-2">
      <Loader2 size={16} className="animate-spin" /> Yuklanmoqda…
    </div>
  }

  // Prognoz hali hisoblanmagan
  if (summary.isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <Calculator size={40} className="text-slate-700" />
        <div className="text-center">
          <div className="text-slate-300 font-medium mb-1">Prognoz hali hisoblanmagan</div>
          <div className="text-slate-500 text-sm max-w-md">
            Excel savdo hisobotlarini yuklang va quyidagi tugmani bosing.
            Hisoblash <b>hech qachon avtomatik</b> bo'lmaydi.
          </div>
        </div>
        <button onClick={() => mHisobla.mutate()} disabled={mHisobla.isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#3B82F6' }}>
          {mHisobla.isPending ? 'Hisoblanmoqda…' : 'Prognozni hisoblash'}
        </button>
        {mHisobla.isError && (
          <div className="text-red-400 text-xs">{(mHisobla.error as Error).message}</div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ═══ Toolbar ═══ */}
      <div className="flex flex-wrap items-end gap-2 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'rgba(7,14,28,0.97)', borderBottom: '1px solid rgba(59,130,246,0.07)' }}>

        <Sel label="Mahsulot turi" value={ptype} onChange={setPtype}
          options={[['', 'Hammasi'], ...(plan.data?.types ?? []).map(t => [t, t] as [string, string])]} />

        <Sel label="Do'kon turi" value={dokon} onChange={setDokon}
          options={[['', 'Hammasi (jami reja)'],
            ...(dk.data?.items ?? []).map(i => [i.shop_type, `${i.shop_type} — ${i.ulush}%`] as [string, string])]} />

        {dokon && (
          <Sel label="Usul" value={usul} onChange={setUsul}
            options={(dk.data?.usullar ?? []).map(u => [u.kod, `${u.nomi} — ${u.wape}%`] as [string, string])} />
        )}

        <Sel label="Yaxlitlash" value={String(round)} onChange={v => setRound(+v)}
          options={[['1', 'Aniq'], ['10', '10 ga'], ['50', '50 ga'], ['100', '100 ga']]} />

        <div className="flex-1" />

        {/* Reja qaysi kundan boshlanadi. Ro'yxat sanani to'ldiradi, sanani
            qo'lda ham o'zgartirish mumkin — u holda ro'yxat «Boshqa sana» ga o'tadi. */}
        <Sel label="Davr" value={DAVRLAR.some(([v]) => v === boshlanish) ? boshlanish : '?'}
          onChange={v => setBoshlanish(v === '?' ? '' : v)}
          options={DAVRLAR.some(([v]) => v === boshlanish)
            ? DAVRLAR
            : [...DAVRLAR, ['?', 'Boshqa sana'] as [string, string]]} />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Boshlanish</label>
          <input type="date" value={boshlanish} min={eng_erta}
            onChange={e => setBoshlanish(e.target.value)}
            title={boshlanish
              ? `Reja ${boshlanish} dan boshlanadi`
              : `Bo'sh — ma'lumotdan keyingi ish kunidan (${s?.fakt.gacha ?? '…'} dan keyin)`}
            className="px-2 py-1.5 rounded-lg text-xs font-mono outline-none"
            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', color: '#93c5fd', colorScheme: 'dark' }} />
        </div>

        <Sel label="Gorizont" value={String(gorizont)} onChange={v => setGorizont(+v)}
          options={[['6', '6 kun (1 hafta)'], ['12', '12 kun (2 hafta)'], ['18', '18 kun (3 hafta)']]} />

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-slate-500">Zaxira ustamasi</label>
          <input type="number" step="0.01" min="0.5" max="1.5" value={zaxira}
            onChange={e => setZaxira(+e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs font-mono outline-none w-20"
            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', color: '#93c5fd' }} />
        </div>

        <button onClick={() => mHisobla.mutate()} disabled={mHisobla.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ background: '#3B82F6' }}>
          {mHisobla.isPending ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />}
          Qayta hisoblash
        </button>

        <button onClick={() => rejaEksport(dokon || null, dokon ? usul : null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }}>
          <Download size={12} /> Excel
        </button>
      </div>

      {/* ═══ Kontent ═══
          Sahifa emas, JADVALNING O'ZI aylanadi — shundagina mahsulot ustuni va
          sana sarlavhasi qotib tura oladi (position: sticky ishlashi uchun
          aylanadigan konteyner jadvalning eng yaqin ota-onasi bo'lishi shart). */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 flex flex-col">

        {/* Eskirgan ogohlantirish */}
        {s?.eskirgan.eskirgan && (
          <Banner tone="warn" icon={<AlertTriangle size={14} />}>
            <b>Prognoz eskirgan.</b> {s.eskirgan.sabab}.
            Yangilash uchun <b>«Qayta hisoblash»</b> tugmasini bosing —
            avtomatik hech narsa hisoblanmaydi.
          </Banner>
        )}

        {xabar && (
          <Banner tone="ok" icon={<Check size={14} />} onClose={() => setXabar(null)}>{xabar}</Banner>
        )}
        {(mHisobla.isError || mTahrir.isError) && (
          <Banner tone="err" icon={<X size={14} />}>
            {((mHisobla.error ?? mTahrir.error) as Error)?.message}
          </Banner>
        )}

        {/* Ko'rsatkichlar */}
        {s && <Tiles s={s} jami={p?.jami ?? 0} dokon={dokon} />}

        {/* Tahrir paneli */}
        {dirty.size > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 mb-3 px-3.5 py-2.5 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Pencil size={13} className="text-amber-400" />
            <span className="text-xs text-slate-300">
              <b className="text-amber-300">{dirty.size}</b> ta hujayra o'zgartirildi · jami{' '}
              <b style={{ color: delta >= 0 ? '#34d399' : '#f87171' }}>
                {delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))}
              </b> dona
            </span>
            <input value={izoh} onChange={e => setIzoh(e.target.value)}
              placeholder="Izoh (ixtiyoriy) — arxivda ko'rinadi"
              className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.15)', color: '#e2e8f0' }} />
            <button onClick={reset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}>
              <RotateCcw size={11} /> Bekor qilish
            </button>
            <button onClick={() => mTahrir.mutate()} disabled={mTahrir.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: '#F59E0B' }}>
              {mTahrir.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Yangi versiya sifatida saqlash
            </button>
          </div>
        )}

        {/* ═══ Svod jadval ═══ */}
        {pivot.isLoading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
            <Loader2 size={14} className="animate-spin" /> Jadval yuklanmoqda…
          </div>
        )}

        {p && p.rows.length > 0 && (
          <div className="flex-1 min-h-0 rounded-lg overflow-auto"
            style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
            {/* borderCollapse: separate — collapse rejimida qotgan (sticky)
                hujayralarning chegaralari yo'qoladi, shuning uchun chegaralar
                inset box-shadow orqali chiziladi. */}
            <table className="text-xs"
              style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
              <thead>
                <tr>
                  {/* Burchak — ikkala yo'nalishda ham qotadi */}
                  <th className="text-left px-3 py-2 font-medium text-slate-400"
                    style={{
                      position: 'sticky', left: 0, top: 0, zIndex: 30,
                      background: '#0d1526', minWidth: 260,
                      boxShadow: 'inset -1px -1px 0 rgba(148,163,184,0.14)',
                    }}>
                    Mahsulot
                  </th>

                  {p.columns.map(c => (
                    <th key={c.date} className="px-2 py-1.5 text-center font-normal"
                      style={{
                        position: 'sticky', top: 0, zIndex: 20,
                        background: c.dow === 1 ? '#101c33' : '#0d1526',
                        minWidth: c.dow === 7 ? 30 : 76,
                        boxShadow: 'inset 0 -1px 0 rgba(148,163,184,0.14)',
                      }}>
                      {c.dow !== 7 && (
                        <>
                          <div className="text-[10px] text-slate-500 leading-tight">
                            {c.dow} - {DOW[c.dow]}
                          </div>
                          <div className="font-mono text-[10px] text-slate-600 leading-tight">
                            {c.date.slice(8)}.{c.date.slice(5, 7)}
                          </div>
                        </>
                      )}
                    </th>
                  ))}

                  <th className="px-3 py-2 text-right font-medium text-slate-400"
                    style={{
                      position: 'sticky', right: 0, top: 0, zIndex: 30,
                      background: '#0d1526', minWidth: 92,
                      boxShadow: 'inset 1px -1px 0 rgba(148,163,184,0.14)',
                    }}>
                    JAMI
                  </th>
                </tr>
              </thead>

              <tbody>
                {p.rows.map(r => (
                  <tr key={r.product_id}>
                    <td onClick={() => setOchiq(r.product_id)}
                      className="px-3 py-1.5 cursor-pointer"
                      style={{
                        position: 'sticky', left: 0, zIndex: 10,
                        background: '#0b1220',
                        boxShadow: 'inset -1px 0 0 rgba(148,163,184,0.14), ' +
                                   'inset 0 -1px 0 rgba(148,163,184,0.06)',
                      }}>
                      <div className="text-slate-200">{r.name}</div>
                      <div className="text-[10px] text-slate-600">{r.type}</div>
                    </td>

                    {r.values.map((v, i) => {
                      const c = p.columns[i]
                      if (c.dow === 7 || v == null) {
                        return <td key={i} className="text-center text-slate-700"
                          style={{ boxShadow: 'inset 0 -1px 0 rgba(148,163,184,0.06)' }}>—</td>
                      }
                      const k = key(r.product_id, c.date)
                      const isDirty = dirty.has(k)
                      const isEdited = r.edited[i]
                      const chiziq = 'inset 0 -1px 0 rgba(148,163,184,0.06)'
                      return (
                        <td key={i}
                          contentEditable={canEdit}
                          suppressContentEditableWarning
                          onBlur={canEdit ? e => onCell(e, r.product_id, c.date, v) : undefined}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() }
                          }}
                          title={isEdited ? `Model: ${fmt(r.model[i] ?? 0)} → qo'lda: ${fmt(v)}` : undefined}
                          className={`px-2 py-1.5 text-right font-mono tabular-nums outline-none ${
                            canEdit ? 'cursor-text focus:ring-1 focus:ring-blue-500' : ''}`}
                          style={{
                            background: isDirty ? 'rgba(245,158,11,0.22)'
                              : isEdited ? 'rgba(235,104,52,0.16)'
                              : c.dow === 1 ? 'rgba(59,130,246,0.04)' : undefined,
                            boxShadow: isDirty ? `inset 2px 0 0 #F59E0B, ${chiziq}`
                              : isEdited ? `inset 2px 0 0 #EB6834, ${chiziq}` : chiziq,
                            color: isDirty || isEdited ? '#fbbf24' : v ? '#cbd5e1' : '#475569',
                            fontWeight: isDirty || isEdited ? 600 : 400,
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
                      {fmt(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Pastdagi jami qatori ham qotadi — aylantirganda ko'rinib turadi */}
              <tfoot>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-300"
                    style={{
                      position: 'sticky', left: 0, bottom: 0, zIndex: 30,
                      background: '#0d1526',
                      boxShadow: 'inset -1px 1px 0 rgba(148,163,184,0.14)',
                    }}>
                    JAMI — {p.rows.length} mahsulot
                  </td>
                  {p.totals.map((t, i) => (
                    <td key={i} className="px-2 py-2 text-right font-mono tabular-nums text-slate-300"
                      style={{
                        position: 'sticky', bottom: 0, zIndex: 20,
                        background: p.columns[i].dow === 1 ? '#101c33' : '#0d1526',
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
                    {fmt(p.jami)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {ochiq != null && <MahsulotModal pid={ochiq} onClose={() => setOchiq(null)} />}
    </div>
  )
}

// ─── Yordamchi komponentlar ───────────────────────────────────────────────────

function Sel({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wide text-slate-500">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
        style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', color: '#93c5fd' }}>
        {options.map(([v, l]) => <option key={v} value={v} style={{ background: '#0f172a' }}>{l}</option>)}
      </select>
    </div>
  )
}

function Banner({ tone, icon, children, onClose }: {
  tone: 'warn' | 'ok' | 'err'; icon: React.ReactNode
  children: React.ReactNode; onClose?: () => void
}) {
  const c = {
    warn: ['rgba(245,158,11,0.08)', 'rgba(245,158,11,0.3)', '#fbbf24'],
    ok:   ['rgba(16,185,129,0.08)', 'rgba(16,185,129,0.3)', '#34d399'],
    err:  ['rgba(239,68,68,0.08)',  'rgba(239,68,68,0.3)',  '#f87171'],
  }[tone]
  return (
    <div className="flex items-start gap-2 mb-3 px-3.5 py-2.5 rounded-lg text-xs text-slate-300 flex-shrink-0"
      style={{ background: c[0], border: `1px solid ${c[1]}` }}>
      <span style={{ color: c[2], flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div className="flex-1 leading-relaxed">{children}</div>
      {onClose && (
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={13} /></button>
      )}
    </div>
  )
}

function Tiles({ s, jami, dokon }: {
  s: import('../api/prognoz').Summary; jami: number; dokon: string
}) {
  const oldingi = s.oldingi_qty
  const rejaTot = dokon ? jami : Math.round(s.reja.qty)
  const delta = oldingi ? 100 * (Math.round(s.reja.qty) / oldingi - 1) : null

  return (
    <div className="grid gap-2.5 mb-3 flex-shrink-0" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
      <Tile
        k={dokon ? `${dokon} ulushi` : `Reja: ${s.reja.dan} → ${s.reja.gacha}`}
        v={fmt(rejaTot)} u="dona"
        d={`${s.reja.kunlar} ish kuni · ${s.reja.mahsulot} mahsulot`}
        accent="#EB6834" />
      <Tile k="Oldingi 12 ish kuni (fakt)" v={fmt(oldingi)}
        d={delta == null ? '—'
          : <>reja <span style={{ color: delta >= 0 ? '#34d399' : '#f87171' }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span></>} />
      <Tile k="Model aniqligi (WAPE)" v={`${s.wape}%`} accent="#34d399"
        d={<>shovqin chegarasi <b>{s.chegara}%</b> — model amaliy maksimumga yaqin</>} />
      <Tile k="Zaxira ustamasi" v={s.run.zaxira.toFixed(2)}
        d={<>{delta != null && <>talabdan <b>{delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)}%</b> yuqori · </>}
          kesim ustamasi {s.run.ustama ? 'yoqilgan' : "o'chirilgan"}</>} />
    </div>
  )
}

function Tile({ k, v, u, d, accent }: {
  k: string; v: string; u?: string; d?: React.ReactNode; accent?: string
}) {
  return (
    <div className="px-3.5 py-2.5 rounded-lg"
      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{k}</div>
      <div className="font-mono tabular-nums font-semibold" style={{ fontSize: 22, color: accent ?? '#e2e8f0' }}>
        {v}{u && <span className="text-[11px] font-sans text-slate-500 ml-1">{u}</span>}
      </div>
      {d && <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{d}</div>}
    </div>
  )
}

/**
 * Excel yuklash — fakt savdo va yakuniy savdo.
 *
 * Ikkala manba ham bir xil 16 ustunli formatda keladi. Farqi — kunlar soni:
 *   fakt savdo    — bitta kun  (TALAB: mijoz nima so'ragan)
 *   yakuniy savdo — bir necha kun (SOTILGAN: ombor kesimidan keyin)
 *
 * Sana fayl nomidan emas, ICHIDAN o'qiladi — nom ahamiyatsiz.
 *
 * MUHIM: yuklash prognozni O'ZGARTIRMAYDI. Sayt faqat "eskirgan" deb
 * ogohlantiradi; qayta hisoblashni foydalanuvchi bosadi.
 */
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react'

import { yukla, type YuklashNatija } from '../../api/prognoz'
import { fmt } from '../../utils/formatters'

const MANBA = [
  { kod: 'fakt' as const, nom: 'Fakt savdo',
    izoh: 'Kunlik hisobot — bitta kun. Talab: mijoz nima so\'ragan.' },
  { kod: 'yakuniy' as const, nom: 'Yakuniy savdo',
    izoh: 'Haftalik hisobot — bir necha kun. Ombor kesimidan keyin nima yetkazilgan.' },
]

export function ExcelYuklash() {
  const qc = useQueryClient()
  const inp = useRef<HTMLInputElement>(null)
  const [manba, setManba] = useState<'fakt' | 'yakuniy'>('fakt')
  const [replace, setReplace] = useState(false)
  const [drag, setDrag] = useState(false)
  const [natija, setNatija] = useState<YuklashNatija | null>(null)

  const m = useMutation({
    mutationFn: (files: File[]) => yukla(files, manba, replace),
    onSuccess: (r) => {
      setNatija(r)
      qc.invalidateQueries({ queryKey: ['pr-holat'] })
      qc.invalidateQueries({ queryKey: ['pr-fayllar'] })
      qc.invalidateQueries({ queryKey: ['pr-summary'] })
    },
  })

  function pick(list: FileList | null) {
    if (!list?.length) return
    const files = [...list].filter(f => /\.(xlsx|xlsm)$/i.test(f.name))
    if (!files.length) {
      setNatija({
        natija: [{ fayl: [...list][0].name, status: 'error', manba: null,
                   xabar: 'Faqat .xlsx fayl qabul qilinadi' }],
        jami: { yuklandi: 0, qayta: 0, otkazildi: 0, xato: 1 },
        qayta_hisoblash_kerak: false, xabar: null,
      })
      return
    }
    setNatija(null)
    m.mutate(files)
  }

  return (
    <Card title="Excel yuklash"
      note="Sana faylning ICHIDAN o'qiladi — fayl nomi ahamiyatsiz. Bir vaqtda bir nechta fayl bo'lishi mumkin.">

      {/* Manba tanlash */}
      <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
        {MANBA.map(x => (
          <button key={x.kod} onClick={() => setManba(x.kod)}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition"
            style={manba === x.kod
              ? { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.4)' }
              : { background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(148,163,184,0.1)' }}>
            <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
              style={{ border: `1.5px solid ${manba === x.kod ? '#3B82F6' : '#475569'}` }}>
              {manba === x.kod && <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#3B82F6' }} />}
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: manba === x.kod ? '#93c5fd' : '#cbd5e1' }}>
                {x.nom}
              </div>
              <div className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">{x.izoh}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tashlash maydoni */}
      <div
        onClick={() => inp.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files) }}
        className="flex flex-col items-center justify-center gap-1.5 py-8 rounded-lg cursor-pointer transition"
        style={{
          border: `1.5px dashed ${drag ? '#3B82F6' : 'rgba(148,163,184,0.2)'}`,
          background: drag ? 'rgba(59,130,246,0.06)' : 'rgba(15,23,42,0.3)',
        }}>
        <input ref={inp} type="file" accept=".xlsx,.xlsm" multiple hidden
          onChange={e => { pick(e.target.files); e.target.value = '' }} />
        {m.isPending ? (
          <>
            <Loader2 size={22} className="animate-spin text-blue-400" />
            <div className="text-xs text-slate-400">Yuklanmoqda…</div>
            <div className="text-[10.5px] text-slate-600">
              Yirik fayl bir necha soniya olishi mumkin
            </div>
          </>
        ) : (
          <>
            <Upload size={22} className="text-slate-600" />
            <div className="text-xs text-slate-300 font-medium">
              Fayllarni shu yerga tashlang
            </div>
            <div className="text-[10.5px] text-slate-600">
              yoki bosing — <b style={{ color: '#93c5fd' }}>
                {MANBA.find(x => x.kod === manba)!.nom}
              </b> sifatida yuklanadi
            </div>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 mt-2.5 cursor-pointer">
        <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}
          className="accent-blue-500" />
        <span className="text-[11px] text-slate-400">
          Allaqachon yuklangan ma'lumotni qayta yozish
          <span className="text-slate-600"> (belgilanmasa — o'tkazib yuboriladi, dublikat oldini olinadi)</span>
        </span>
      </label>

      {/* Xato */}
      {m.isError && (
        <div className="mt-3 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {(m.error as Error).message}
        </div>
      )}

      {/* Natija */}
      {natija && (
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
            <span>
              <b className="text-slate-200">Natija:</b> {natija.jami.yuklandi} yuklandi ·{' '}
              {natija.jami.qayta} qayta yozildi · {natija.jami.otkazildi} o'tkazildi ·{' '}
              <span style={{ color: natija.jami.xato ? '#f87171' : undefined }}>
                {natija.jami.xato} xato</span>
            </span>
            <button onClick={() => setNatija(null)} className="text-slate-600 hover:text-slate-400">
              <X size={12} />
            </button>
          </div>

          {natija.natija.map((r, i) => {
            const tone = r.status === 'error' ? 'err' : r.status === 'skipped' ? 'skip' : 'ok'
            const c = { ok: '#34d399', skip: '#94a3b8', err: '#f87171' }[tone]
            const bg = { ok: 'rgba(16,185,129,0.06)', skip: 'rgba(148,163,184,0.05)',
                         err: 'rgba(239,68,68,0.06)' }[tone]
            return (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[11px]"
                style={{ background: bg }}>
                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold flex-shrink-0"
                  style={{ background: `${c}22`, color: c }}>
                  {{ loaded: 'YUKLANDI', replaced: 'QAYTA YOZILDI',
                     skipped: "O'TKAZILDI", error: 'XATO' }[r.status] ?? r.status}
                </span>
                {r.manba && (
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] flex-shrink-0"
                    style={{ background: r.manba === 'fakt' ? 'rgba(59,130,246,0.14)' : 'rgba(235,104,52,0.14)',
                             color: r.manba === 'fakt' ? '#93c5fd' : '#fdba74' }}>
                    {r.manba === 'fakt' ? 'FAKT' : 'YAKUNIY'}
                  </span>
                )}
                <FileSpreadsheet size={11} className="text-slate-600 flex-shrink-0" />
                <span className="text-slate-300 truncate flex-1">{r.fayl}</span>
                {r.sana && (
                  <span className="font-mono text-slate-500 flex-shrink-0">
                    {r.sana}{r.kunlar ? ` · ${r.kunlar} kun` : ''}
                  </span>
                )}
                {r.rows != null && (
                  <span className="font-mono text-slate-500 flex-shrink-0">
                    {fmt(r.rows)} qator · {fmt(r.qty ?? 0)} dona
                  </span>
                )}
                {r.xabar && (
                  <span className="text-slate-500 truncate" style={{ maxWidth: 380 }}>{r.xabar}</span>
                )}
              </div>
            )
          })}

          {natija.qayta_hisoblash_kerak && (
            <div className="flex items-start gap-2 mt-1.5 px-3 py-2.5 rounded-lg text-[11px]"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-px" />
              <span className="text-slate-300 leading-relaxed">
                <b>Prognoz O'ZGARMADI.</b> Yangi ma'lumot bazaga tushdi, lekin reja eski
                holicha qoldi — bu ataylab. Yangilash uchun{' '}
                <b>«Savdo prognozi» → «Qayta hisoblash»</b> tugmasini bosing.
                Eski reja arxivda saqlanib qoladi.
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function Card({ title, note, children, right }: {
  title: string; note?: string; children: React.ReactNode; right?: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-4"
      style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)' }}>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <div className="text-sm font-medium text-slate-200">{title}</div>
          {note && <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed max-w-3xl">{note}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

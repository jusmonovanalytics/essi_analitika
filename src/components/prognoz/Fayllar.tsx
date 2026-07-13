/**
 * Yuklangan ma'lumot: fakt (kun bo'yicha) va yakuniy (fayl bo'yicha).
 * Har birini alohida ko'rish va o'chirish mumkin.
 *
 * O'chirish prognozni o'zgartirmaydi — arxiv o'zgarmas.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Search, Trash2 } from 'lucide-react'

import { fetchFayllar, ochirBitta, ochirHammasi, type FaylItem } from '../../api/prognoz'
import { fmt } from '../../utils/formatters'
import { Card } from './ExcelYuklash'

export function Fayllar() {
  const qc = useQueryClient()
  const [manba, setManba] = useState<'fakt' | 'yakuniy'>('fakt')
  const [term, setTerm] = useState('')
  const [tasdiq, setTasdiq] = useState('')
  const [ochirmoq, setOchirmoq] = useState<FaylItem | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['pr-fayllar', manba],
    queryFn: () => fetchFayllar(manba),
  })

  const inval = () => {
    qc.invalidateQueries({ queryKey: ['pr-fayllar'] })
    qc.invalidateQueries({ queryKey: ['pr-holat'] })
    qc.invalidateQueries({ queryKey: ['pr-summary'] })
  }

  const mBitta = useMutation({
    mutationFn: (key: string) => ochirBitta(manba, key),
    onSuccess: () => { setOchirmoq(null); inval() },
  })
  const mHamma = useMutation({
    mutationFn: () => ochirHammasi(manba),
    onSuccess: () => { setTasdiq(''); inval() },
  })

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase()
    return (data?.items ?? []).filter(x =>
      !t || x.sana.toLowerCase().includes(t) || x.fayl.toLowerCase().includes(t))
  }, [data, term])

  const fakt = manba === 'fakt'
  const kunlar = (data?.items ?? []).reduce((a, x) => a + (x.kunlar ?? 1), 0)

  return (
    <Card title="Yuklangan ma'lumot"
      note={fakt
        ? "Har bir kun bitta faylga to'g'ri keladi — bir xil sanani ikki marta yuklab bo'lmaydi."
        : "Har bir fayl bir necha kunni o'z ichiga oladi — o'chirish fayl bo'yicha."}
      right={
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(15,23,42,0.6)' }}>
          {(['fakt', 'yakuniy'] as const).map(k => (
            <button key={k} onClick={() => { setManba(k); setTerm('') }}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition"
              style={manba === k
                ? { background: 'rgba(59,130,246,0.16)', color: '#93c5fd' }
                : { color: '#64748b' }}>
              {k === 'fakt' ? 'Fakt savdo' : 'Yakuniy savdo'}
            </button>
          ))}
        </div>
      }>

      {/* Bo'shliqlar */}
      {fakt && data && data.gaps.length > 0 && (
        <div className="flex items-start gap-2 mb-2.5 px-3 py-2 rounded-lg text-[11px]"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-px" />
          <span className="text-slate-400">
            <b className="text-amber-300">Yetishmayotgan ish kunlari: {data.gaps.length} ta.</b>{' '}
            {data.gaps.join(', ')}. Yakshanbalar hisobga olinmaydi (savdo yo'q).
          </span>
        </div>
      )}

      {/* Qidirish + hammasini o'chirish */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-1 px-2.5 py-1.5 rounded-lg"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.12)' }}>
          <Search size={12} className="text-slate-600" />
          <input value={term} onChange={e => setTerm(e.target.value)}
            placeholder="Sana yoki fayl nomi…"
            className="flex-1 bg-transparent outline-none text-xs text-slate-300" />
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          {data?.count ?? 0} {fakt ? 'kun' : `fayl · ${kunlar} kun`}
        </span>
      </div>

      {/* Jadval */}
      <div className="rounded-lg overflow-auto" style={{ maxHeight: 340, border: '1px solid rgba(148,163,184,0.08)' }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0" style={{ background: '#0d1526' }}>
            <tr className="text-slate-500">
              <th className="text-left px-2.5 py-2 font-normal">{fakt ? 'Sana' : 'Fayl'}</th>
              <th className="text-left px-2.5 py-2 font-normal">{fakt ? 'Fayl' : 'Davr'}</th>
              {!fakt && <th className="text-right px-2.5 py-2 font-normal">Kun</th>}
              <th className="text-right px-2.5 py-2 font-normal">Qatorlar</th>
              <th className="text-right px-2.5 py-2 font-normal">Dona</th>
              <th className="text-left px-2.5 py-2 font-normal">Yuklangan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-6 text-slate-600">
                <Loader2 size={13} className="animate-spin inline" /></td></tr>
            )}
            {!isLoading && !rows.length && (
              <tr><td colSpan={7} className="text-center py-6 text-slate-600">
                {data?.count ? 'Topilmadi' : "Ma'lumot yo'q"}</td></tr>
            )}
            {rows.map(x => (
              <tr key={x.key} className="hover:bg-slate-800/30"
                style={{ borderTop: '1px solid rgba(148,163,184,0.06)' }}>
                <td className="px-2.5 py-1.5 font-mono text-slate-200">
                  {fakt ? x.sana : x.fayl}
                </td>
                <td className="px-2.5 py-1.5 text-slate-500 truncate" style={{ maxWidth: 280 }}>
                  {fakt ? x.fayl : `${x.dan} → ${x.gacha}`}
                </td>
                {!fakt && <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">{x.kunlar}</td>}
                <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">{fmt(x.rows)}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-slate-400">{fmt(x.qty)}</td>
                <td className="px-2.5 py-1.5 text-slate-600 font-mono">
                  {new Date(x.yuklangan).toLocaleString('ru-RU',
                    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button onClick={() => setOchirmoq(x)}
                    className="p-1 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hammasini o'chirish */}
      <div className="flex items-center gap-2 mt-2.5">
        <input value={tasdiq} onChange={e => setTasdiq(e.target.value)}
          placeholder="HAMMASINI OCHIRISH"
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono outline-none w-52"
          style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.12)', color: '#e2e8f0' }} />
        <button
          disabled={tasdiq !== 'HAMMASINI OCHIRISH' || mHamma.isPending || !data?.count}
          onClick={() => mHamma.mutate()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium disabled:opacity-30"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          {mHamma.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Barcha {fakt ? 'fakt' : 'yakuniy'} savdoni o'chirish
        </button>
        <span className="text-[10.5px] text-slate-600">
          Prognoz arxiviga tegilmaydi — u o'zgarmas
        </span>
      </div>

      {/* Bitta yozuvni o'chirish tasdiqi */}
      {ochirmoq && (
        <div onClick={e => { if (e.target === e.currentTarget) setOchirmoq(null) }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(2,6,16,0.8)', backdropFilter: 'blur(3px)' }}>
          <div className="w-full max-w-md rounded-xl p-5"
            style={{ background: '#0b1220', border: '1px solid rgba(148,163,184,0.14)' }}>
            <div className="text-slate-100 font-medium mb-3">
              {fakt ? "Kunni o'chirish" : "Faylni o'chirish"}
            </div>
            <div className="text-[11px] text-slate-400 mb-3 space-y-1">
              <Row k={fakt ? 'Sana' : 'Fayl'} v={fakt ? ochirmoq.sana : ochirmoq.fayl} />
              {!fakt && <Row k="Davr" v={`${ochirmoq.dan} → ${ochirmoq.gacha} (${ochirmoq.kunlar} kun)`} />}
              <Row k="Qatorlar" v={fmt(ochirmoq.rows)} />
              <Row k="Dona" v={fmt(ochirmoq.qty)} />
            </div>
            <div className="px-3 py-2 rounded-lg text-[11px] text-slate-400 mb-4"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
              Prognoz o'zgarmaydi — u arxivdan o'qiladi.
              Ma'lumot Excel fayldan qayta yuklanishi mumkin.
            </div>
            {mBitta.isError && (
              <div className="text-[11px] text-red-400 mb-2">{(mBitta.error as Error).message}</div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setOchirmoq(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-400"
                style={{ border: '1px solid rgba(148,163,184,0.15)' }}>Bekor qilish</button>
              <button onClick={() => mBitta.mutate(ochirmoq.key)} disabled={mBitta.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#dc2626' }}>
                {mBitta.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                O'chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-600">{k}</span>
      <span className="text-slate-200 font-mono truncate">{v}</span>
    </div>
  )
}

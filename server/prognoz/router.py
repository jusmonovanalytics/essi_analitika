"""Savdo prognozi — API.

Barcha endpointlar `/api/prognoz/*` ostida. Mavjud savdo analitikasi
(`/api/kpis`, `/api/orders` …) bilan to'qnashmaydi.

Asosiy qoidalar:
  * Yangi Excel yuklanishi prognozni O'ZGARTIRMAYDI — faqat "eskirgan" deb
    ogohlantiradi; qayta hisoblashni foydalanuvchi bosadi.
  * Har bir hisob va har bir qo'lda tahrir ARXIVGA yoziladi. Arxiv o'zgarmas —
    o'chirib ham, tahrirlab ham bo'lmaydi (baza triggeri himoya qiladi).
  * Reja har safar qayta hisoblanmaydi — saqlangan arxivdan o'qiladi.
"""
import asyncio
import io
import json
import os
from datetime import timedelta

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse

from . import db
from .auth import admin
from .loader import BadFile, load_fakt, load_yakuniy, read_workbook

# BUTUN prognoz bo'limi admin uchun — o'qish ham, yozish ham.
# Mehmon faqat savdo analitikasini ko'radi; prognoz unga umuman ochilmaydi.
# Faqat interfeysda yashirish yetarli emas: API manzili ochiq, kimdir
# to'g'ridan-to'g'ri so'rov yuborishi mumkin edi.
router = APIRouter(prefix="/api/prognoz", tags=["prognoz"],
                   dependencies=[Depends(admin)])

# Do'kon turi bo'yicha bo'lish usullari (backtest: 36 origin, 720 mahsulot × tur)
USULLAR = {
    "aralash":  ("Aralash (50/50)", 25.13,
                 "Taqsimot va alohida prognozning o'rtachasi. Eng aniq."),
    "taqsimot": ("Taqsimot", 25.51,
                 "So'nggi 24 ish kunidagi haqiqiy ulush bo'yicha bo'lish."),
    "alohida":  ("Alohida prognoz", 25.39,
                 "Har mahsulot × do'kon turi uchun mustaqil model."),
}


async def _run():
    r = await db.joriy_run()
    if not r:
        raise HTTPException(
            404,
            "Prognoz hali hisoblanmagan. «Qayta hisoblash» tugmasini bosing.",
        )
    return r


# ═══════════════════════════════════════════════════════════════════════════
#   UMUMIY
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/summary")
async def summary():
    run = await _run()

    fact = await db.q("""
        SELECT count(*) n, sum(qty) qty, sum(amount) amount,
               min(sale_date) d0, max(sale_date) d1, count(DISTINCT sale_date) days
        FROM fakt_savdo
    """, one=True)

    fc = await db.q("""
        SELECT sum(qty) qty, min(target_date) d0, max(target_date) d1,
               count(DISTINCT target_date) days, count(DISTINCT product_id) products
        FROM v_joriy_reja
    """, one=True)

    prev = await db.q("""
        SELECT sum(qty) qty FROM mv_talab
        WHERE sale_date IN (SELECT DISTINCT sale_date FROM mv_talab
                            ORDER BY 1 DESC LIMIT %s)
    """, (run["gorizont"],), one=True)

    kesim = await db.q("""
        SELECT sum(talab) talab, sum(sotilgan) sotilgan, sum(kesim) kesim
        FROM v_kesim
    """, one=True)

    return {
        "run": {
            "run_id": run["run_id"],
            "created_at": run["created_at"].isoformat(),
            "data_last_day": run["data_last_day"].isoformat(),
            "method": db.MODEL,
            "zaxira": float(run["kalibr"]),
            "ustama": run["ustama"],
            "gorizont": run["gorizont"],
            "qolda": run.get("qolda", False),
            "asos_run": run.get("asos_run"),
        },
        "fakt": {
            "rows": fact["n"], "qty": int(fact["qty"] or 0),
            "amount": float(fact["amount"] or 0),
            "dan": fact["d0"].isoformat() if fact["d0"] else None,
            "gacha": fact["d1"].isoformat() if fact["d1"] else None,
            "kunlar": fact["days"],
        },
        "reja": {
            "qty": float(fc["qty"]), "dan": fc["d0"].isoformat(),
            "gacha": fc["d1"].isoformat(), "kunlar": fc["days"],
            "mahsulot": fc["products"],
        },
        "oldingi_qty": int(prev["qty"] or 0),
        "wape": db.WAPE,
        "chegara": db.CHEGARA,
        "kesim": {
            "talab": int(kesim["talab"] or 0),
            "sotilgan": int(kesim["sotilgan"] or 0),
            "yoqotilgan": int(kesim["kesim"] or 0),
            "pct": round(100 * float(kesim["kesim"] or 0)
                         / max(float(kesim["talab"] or 1), 1), 1),
        },
        "eskirgan": await db.eskirganmi(),
    }


# ═══════════════════════════════════════════════════════════════════════════
#   REJA
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/plan")
async def plan(ptype: str = Query(None)):
    """Reja — mahsulot kesimida."""
    run = await _run()
    horizon = run["gorizont"]

    days = [r["sale_date"] for r in await db.q(
        "SELECT DISTINCT sale_date FROM mv_talab ORDER BY 1 DESC LIMIT %s", (horizon,))]

    where = "" if not ptype else "AND j.product_type = %(ptype)s"
    rows = await db.q(f"""
        WITH prev AS (
            SELECT product, sum(qty) qty FROM mv_talab
            WHERE sale_date = ANY(%(days)s) GROUP BY 1
        )
        SELECT j.product_id, j.product AS name, j.product_type AS type,
               sum(j.qty)                                   AS total,
               sum(j.qty) FILTER (WHERE j.step <= %(half)s) AS wk1,
               sum(j.qty) FILTER (WHERE j.step >  %(half)s) AS wk2,
               sum(j.qty_past)                              AS lo,
               sum(j.qty_yuqori)                            AS hi,
               max(a.xato)                                  AS xato,
               max(h.kesim_pct)                             AS kesim,
               max(u.ustama)                                AS ustama,
               bool_or(m.product IS NOT NULL)               AS mavsumiy,
               bool_or(j.ozgartirilgan)                     AS qolda,
               max(p.qty)                                   AS prev_qty
        FROM v_joriy_reja j
        LEFT JOIN v_mahsulot_aniqlik a ON a.product = j.product
        LEFT JOIN v_mahsulot_holati  h ON h.product = j.product
        LEFT JOIN v_ustama           u ON u.product = j.product
        LEFT JOIN (SELECT DISTINCT product FROM mv_mavsum) m ON m.product = j.product
        LEFT JOIN prev p ON p.product = j.product
        WHERE TRUE {where}
        GROUP BY j.product_id, j.product, j.product_type
        ORDER BY total DESC
    """, {"days": days, "half": horizon // 2, "ptype": ptype})

    items = []
    for r in rows:
        prev_q = float(r["prev_qty"]) if r["prev_qty"] else None
        items.append({
            "product_id": r["product_id"], "name": r["name"], "type": r["type"],
            "total": round(float(r["total"])),
            "wk1": round(float(r["wk1"] or 0)), "wk2": round(float(r["wk2"] or 0)),
            "lo": round(float(r["lo"])), "hi": round(float(r["hi"])),
            "xato": round(100 * float(r["xato"]), 1) if r["xato"] else None,
            "kesim": float(r["kesim"]) if r["kesim"] is not None else None,
            "ustama": float(r["ustama"]) if r["ustama"] else 1.0,
            "mavsumiy": bool(r["mavsumiy"]),
            "qolda": bool(r["qolda"]),
            "prev": round(prev_q) if prev_q else None,
            "delta": round(100 * (float(r["total"]) / prev_q - 1), 1) if prev_q else None,
        })

    types = [r["product_type"] for r in await db.q(
        "SELECT DISTINCT product_type FROM v_joriy_reja ORDER BY 1")]

    return {
        "run_id": run["run_id"], "items": items, "types": types,
        "gorizont": horizon,
        "prev_dan": min(days).isoformat(), "prev_gacha": max(days).isoformat(),
    }


@router.get("/pivot")
async def pivot(
    ptype: str = Query(None),
    dokon: str = Query(None),
    usul: str = Query("aralash", pattern="^(aralash|taqsimot|alohida)$"),
    round_to: int = Query(50, ge=1, le=500),
):
    """Svod jadval: qatorlar = mahsulot, ustunlar = kun.

    `dokon` berilsa — jami rejaning shu do'kon turiga to'g'ri keladigan ULUSHI.
    Bu rejimda hujayralar TAHRIRLANMAYDI.
    """
    run = await _run()
    w = "" if not ptype else "AND product_type = %(ptype)s"

    if dokon:
        rows = await db.q(f"""
            SELECT product_id, product, product_type, target_date, qty,
                   qty AS qty_model, FALSE AS ozgartirilgan
            FROM fn_reja_dokon(%(usul)s)
            WHERE shop_type = %(dokon)s {w}
            ORDER BY product_type, product, target_date
        """, {"ptype": ptype, "dokon": dokon, "usul": usul})
    else:
        rows = await db.q(f"""
            SELECT product_id, product, product_type, target_date, qty, qty_model,
                   ozgartirilgan
            FROM v_joriy_reja WHERE TRUE {w}
            ORDER BY product_type, product, target_date
        """, {"ptype": ptype})

    cells, model, edited, meta, dates = {}, {}, {}, {}, set()
    for r in rows:
        pid, td = r["product_id"], r["target_date"]
        cells.setdefault(pid, {})[td] = float(r["qty"])
        model.setdefault(pid, {})[td] = float(r["qty_model"] or r["qty"])
        edited.setdefault(pid, {})[td] = bool(r["ozgartirilgan"])
        meta[pid] = (r["product"], r["product_type"])
        dates.add(td)

    if not dates:
        return {"columns": [], "rows": [], "totals": [], "jami": 0,
                "tahrirlanadi": False}

    def rnd(v):
        return int(round(v / round_to) * round_to)

    d0, d1 = min(dates), max(dates)
    col_dates, d = [], d0
    while d <= d1:
        col_dates.append(d)
        d += timedelta(days=1)
    columns = [{"date": c.isoformat(), "dow": c.isoweekday(), "reja": c in dates}
               for c in col_dates]

    out = []
    for pid, (name, pt) in meta.items():
        vals = [rnd(cells[pid][c]) if c in cells[pid] else None for c in col_dates]
        out.append({
            "product_id": pid, "name": name, "type": pt, "values": vals,
            "model": [rnd(model[pid][c]) if c in model[pid] else None for c in col_dates],
            "edited": [bool(edited[pid].get(c)) if c in cells[pid] else False
                       for c in col_dates],
            "total": sum(v for v in vals if v),
        })
    out.sort(key=lambda r: r["name"])

    totals = [sum(r["values"][i] or 0 for r in out) if c["reja"] else None
              for i, c in enumerate(columns)]

    return {
        "run_id": run["run_id"], "round_to": round_to,
        "columns": columns, "rows": out, "totals": totals,
        "jami": sum(r["total"] for r in out),
        "dokon": dokon, "usul": usul if dokon else None,
        "tahrirlanadi": dokon is None,
    }


@router.get("/kunlik")
async def kunlik(ptype: str = Query(None)):
    """Kunlik reja + tarix — grafik uchun."""
    await _run()
    w = "" if not ptype else "AND product_type = %(ptype)s"

    fc = await db.q(f"""
        SELECT target_date d, dow, sum(qty) qty,
               sum(qty_past) lo, sum(qty_yuqori) hi
        FROM v_joriy_reja WHERE TRUE {w}
        GROUP BY 1, 2 ORDER BY 1
    """, {"ptype": ptype})

    hist = await db.q(f"""
        SELECT sale_date d, dow, sum(qty) qty FROM mv_talab
        WHERE TRUE {w}
        GROUP BY 1, 2 ORDER BY 1 DESC LIMIT 42
    """, {"ptype": ptype})

    return {
        "tarix": [{"date": r["d"].isoformat(), "dow": r["dow"], "qty": int(r["qty"])}
                  for r in reversed(hist)],
        "reja": [{"date": r["d"].isoformat(), "dow": r["dow"],
                  "qty": round(float(r["qty"])), "lo": round(float(r["lo"])),
                  "hi": round(float(r["hi"]))} for r in fc],
    }


@router.get("/dokon")
async def dokon(usul: str = Query("aralash", pattern="^(aralash|taqsimot|alohida)$")):
    """Do'kon turi bo'yicha reja.

    JAMI reja har doim mahsulot darajasidagi modeldan (WAPE 13.75%) — do'kon
    turi faqat o'sha jamini BO'LADI, ya'ni jami hech qachon buzilmaydi.

    Ogohlantirish: do'kon turi darajasida aniqlik ~25% — mahsulot darajasidan
    deyarli ikki barobar yomon (54 mahsulot 720 ta katakka bo'linadi).
    Ishlab chiqarish qarorini JAMI hajmga qarab qabul qiling.
    """
    rows = await db.q("""
        SELECT shop_type, sum(qty) qty, count(DISTINCT product) mahsulot
        FROM fn_reja_dokon(%s) GROUP BY 1 ORDER BY 2 DESC
    """, (usul,))
    jami = sum(float(r["qty"]) for r in rows) or 1
    nom, wape, izoh = USULLAR[usul]
    return {
        "usul": usul, "usul_nomi": nom, "wape": wape, "izoh": izoh,
        "usullar": [{"kod": k, "nomi": v[0], "wape": v[1], "izoh": v[2]}
                    for k, v in USULLAR.items()],
        "mahsulot_wape": db.WAPE,
        "jami": round(jami),
        "items": [{
            "shop_type": r["shop_type"], "qty": round(float(r["qty"])),
            "ulush": round(100 * float(r["qty"]) / jami, 1),
            "mahsulot": r["mahsulot"],
        } for r in rows],
    }


@router.get("/product/{pid}")
async def product(pid: int):
    """Bitta mahsulot: tarix, reja, mavsumiylik, aniqlik."""
    p = await db.q(
        "SELECT product_id, name, product_type FROM products WHERE product_id = %s",
        (pid,), one=True)
    if not p:
        raise HTTPException(404, "Mahsulot topilmadi")

    hist = await db.q("""
        SELECT t.sale_date d, t.dow, sum(t.qty) qty, sum(t.amount) amount,
               max(s.qty) sotilgan
        FROM mv_talab t
        LEFT JOIN mv_sotilgan s ON s.product = t.product AND s.sale_date = t.sale_date
        WHERE t.product = %s GROUP BY 1, 2 ORDER BY 1
    """, (p["name"],))

    fc = await db.q("""
        SELECT target_date d, dow, step, qty, qty_model, ozgartirilgan,
               qty_past lo, qty_yuqori hi, daraja, mavsum, dow_ix
        FROM v_joriy_reja WHERE product_id = %s ORDER BY target_date
    """, (pid,))

    dow = await db.q("""
        SELECT dow, round(avg(qty)) q FROM (
            SELECT dow, qty FROM mv_talab_zich
            WHERE product = %s ORDER BY sale_date DESC LIMIT 48
        ) t GROUP BY 1 ORDER BY 1
    """, (p["name"],))

    seas = await db.q("SELECT oy, ix FROM mv_mavsum WHERE product = %s ORDER BY oy",
                      (p["name"],))
    acc = await db.q("SELECT * FROM v_mahsulot_aniqlik WHERE product = %s",
                     (p["name"],), one=True)
    st = await db.q("SELECT * FROM v_mahsulot_holati WHERE product = %s",
                    (p["name"],), one=True)
    dk = await db.q("""
        SELECT shop_type, ulush_aralash u FROM mv_dokon_ulush
        WHERE product = %s AND ulush_aralash > 0.005 ORDER BY 2 DESC
    """, (p["name"],))

    return {
        "product": dict(p),
        "tarix": [{"date": r["d"].isoformat(), "dow": r["dow"], "qty": int(r["qty"]),
                   "amount": float(r["amount"]),
                   "sotilgan": int(r["sotilgan"]) if r["sotilgan"] is not None else None}
                  for r in hist],
        "reja": [{"date": r["d"].isoformat(), "dow": r["dow"], "step": r["step"],
                  "qty": round(float(r["qty"]), 1),
                  "model": round(float(r["qty_model"] or r["qty"]), 1),
                  "qolda": bool(r["ozgartirilgan"]),
                  "lo": round(float(r["lo"]), 1), "hi": round(float(r["hi"]), 1),
                  "daraja": float(r["daraja"] or 0), "mavsum": float(r["mavsum"] or 1),
                  "dow_ix": float(r["dow_ix"] or 1)} for r in fc],
        "dow": [{"dow": r["dow"], "qty": round(float(r["q"]))} for r in dow],
        "mavsum": [{"oy": r["oy"], "ix": float(r["ix"])} for r in seas],
        "dokon": [{"shop_type": r["shop_type"], "ulush": round(100 * float(r["u"]), 1)}
                  for r in dk],
        "aniqlik": {
            "cv": float(acc["cv"]) if acc and acc["cv"] else None,
            "xato": round(100 * float(acc["xato"]), 1) if acc and acc["xato"] else None,
            "kunlar": acc["n_kun"] if acc else None,
        } if acc else None,
        "holat": {
            "holat": st["holat"], "kesim": float(st["kesim_pct"] or 0),
            "talab": float(st["talab_jami"] or 0),
            "sotilgan": float(st["sotilgan_jami"] or 0),
        } if st else None,
    }

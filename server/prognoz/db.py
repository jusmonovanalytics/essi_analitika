"""Prognoz uchun baza qatlami.

Mavjud loyihaning ULANISH HAVZASIDAN foydalanadi (psycopg v3, async) —
alohida ulanish ochilmaydi.

Model butunlay PostgreSQL da:
    fn_prognoz()      — bashorat: daraja x mavsum x hafta-kuni x ustama x kalibrovka
    fn_reja_saqla()   — QO'LDA chaqiriladigan yagona hisoblash nuqtasi
    fn_reja_qolda()   — qo'lda tahrir (eski rejani o'zgartirmaydi)
    v_joriy_reja      — joriy reja, arxivdan o'qiladi
"""
import os
from pathlib import Path

from psycopg.rows import dict_row

import db as core

SQL_DIR = Path(__file__).parent.parent / "sql"

# Prognoz modelining backtest aniqligi (36 origin, out-of-sample)
WAPE = 13.75
CHEGARA = 13.69          # orakul chegarasi — bundan pastga tushib bo'lmaydi

MODEL = "daraja(trim24) × mavsum × hafta-kuni × ustama"

MATVIEWS = ("mv_talab", "mv_sotilgan", "mv_talab_zich", "mv_mavsum",
            "mv_dokon_zich", "mv_dokon_ulush")


async def q(sql: str, params=None, one: bool = False):
    """SELECT — dict qatorlar."""
    pool = await core.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(sql, params or ())
            rows = await cur.fetchall()
    if one:
        return dict(rows[0]) if rows else None
    return [dict(r) for r in rows]


async def x(sql: str, params=None):
    """INSERT/UPDATE/CALL — bitta qiymat qaytaradi (bo'lsa)."""
    pool = await core.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(sql, params or ())
            val = await cur.fetchone() if cur.description else None
    return val[0] if val else None


async def setup() -> None:
    """Sxema va modelni o'rnatadi. Ishga tushganda chaqiriladi.

    Fayllar qayta ishga tushirish uchun xavfsiz — faqat view/funksiyalarni
    qayta yaratadi, MA'LUMOTGA va ARXIVGA tegmaydi.
    """
    pool = await core.get_pool()
    for name in ("schema.sql", "model.sql", "dokon.sql"):
        path = SQL_DIR / name
        if not path.exists():
            continue
        sql = path.read_text(encoding="utf-8")
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql)


async def refresh_views() -> None:
    """Agregatlarni yangilash.

    DIQQAT: prognozni QAYTA HISOBLAMAYDI. Prognoz eski holicha qoladi,
    toki foydalanuvchi qo'lda qayta hisoblamaguncha.
    """
    pool = await core.get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            for v in MATVIEWS:
                await cur.execute(f"REFRESH MATERIALIZED VIEW {v}")
            await cur.execute("SELECT fn_products_sync()")
            await cur.execute("ANALYZE fakt_savdo")


async def joriy_run():
    """Joriy (faol) reja. Yo'q bo'lsa None."""
    return await q(
        "SELECT * FROM reja_runs WHERE faol ORDER BY run_id DESC LIMIT 1", one=True
    )


async def eskirganmi() -> dict:
    """Bazada joriy rejadan YANGIROQ ma'lumot bormi?

    Foydalanuvchini ogohlantirish uchun. Avtomatik hech narsa qilinmaydi.
    """
    r = await q("""
        SELECT (SELECT max(sale_date) FROM fakt_savdo) AS oxirgi_kun,
               (SELECT data_last_day FROM reja_runs WHERE faol
                ORDER BY run_id DESC LIMIT 1) AS reja_kuni
    """, one=True)

    if not r or not r["reja_kuni"]:
        return {"eskirgan": True, "sabab": "Prognoz hali hisoblanmagan"}
    if r["oxirgi_kun"] and r["oxirgi_kun"] > r["reja_kuni"]:
        return {
            "eskirgan": True,
            "sabab": (f"Bazada {r['oxirgi_kun']} gacha ma'lumot bor, "
                      f"joriy prognoz esa {r['reja_kuni']} ga asoslangan"),
            "oxirgi_kun": r["oxirgi_kun"].isoformat(),
            "reja_kuni": r["reja_kuni"].isoformat(),
        }
    return {"eskirgan": False}

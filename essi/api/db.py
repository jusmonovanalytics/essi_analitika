"""Baza ulanishi va prognoz modeliga kirish nuqtalari.

Model butunlay PostgreSQL da (essi bazasi). Bu yerda faqat so'rovlar.

Muhim qoida: yangi ma'lumot yuklanishi prognozni O'ZGARTIRMAYDI.
Qayta hisoblash faqat qo'lda — fn_reja_saqla() chaqirilganda. Har bir hisob
arxivga yoziladi va hech qachon o'chirilmaydi.
"""
import os

import psycopg2
import psycopg2.extras

DSN = os.environ.get(
    "ESSI_DSN",
    "host=localhost port=5432 dbname=essi user=postgres password=postgres123 "
    "client_encoding=UTF8",
)


def conn():
    return psycopg2.connect(DSN)


def q(sql, params=None, one=False):
    """SELECT — dict qatorlar qaytaradi."""
    c = conn()
    try:
        cur = c.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        return (dict(rows[0]) if rows else None) if one else [dict(r) for r in rows]
    finally:
        c.close()


def x(sql, params=None):
    """INSERT/UPDATE/CALL — bitta qiymat qaytaradi (bo'lsa)."""
    c = conn()
    try:
        cur = c.cursor()
        cur.execute(sql, params or ())
        val = cur.fetchone() if cur.description else None
        c.commit()
        return val[0] if val else None
    finally:
        c.close()


def refresh_views():
    """Agregatlarni yangilash. Yuklashdan keyin chaqiriladi.

    DIQQAT: bu prognozni QAYTA HISOBLAMAYDI — faqat xom agregatlarni yangilaydi.
    Prognoz eski holicha qoladi, toki foydalanuvchi qo'lda qayta hisoblamaguncha.
    """
    c = conn()
    try:
        cur = c.cursor()
        cur.execute("REFRESH MATERIALIZED VIEW mv_talab")
        cur.execute("REFRESH MATERIALIZED VIEW mv_sotilgan")
        cur.execute("REFRESH MATERIALIZED VIEW mv_talab_zich")
        cur.execute("REFRESH MATERIALIZED VIEW mv_mavsum")
        cur.execute("REFRESH MATERIALIZED VIEW mv_dokon_ulush")
        cur.execute("SELECT fn_products_sync()")
        cur.execute("ANALYZE fakt_savdo")
        c.commit()
    finally:
        c.close()


def joriy_run():
    """Joriy (faol) reja haqida ma'lumot. Yo'q bo'lsa None."""
    return q("SELECT * FROM reja_runs WHERE faol ORDER BY run_id DESC LIMIT 1", one=True)


def eskirganmi():
    """Bazada joriy rejadan YANGIROQ ma'lumot bormi?

    Bu foydalanuvchiga 'qayta hisoblash kerak' deb ogohlantirish uchun.
    Avtomatik hech narsa qilinmaydi.
    """
    r = q("""
        SELECT (SELECT max(sale_date) FROM fakt_savdo)                 AS oxirgi_kun,
               (SELECT data_last_day FROM reja_runs WHERE faol
                ORDER BY run_id DESC LIMIT 1)                          AS reja_kuni
    """, one=True)
    if not r or not r["reja_kuni"]:
        return {"eskirgan": True, "sabab": "Prognoz hali hisoblanmagan"}
    if r["oxirgi_kun"] and r["oxirgi_kun"] > r["reja_kuni"]:
        return {
            "eskirgan": True,
            "sabab": f"Bazada {r['oxirgi_kun']} gacha ma'lumot bor, "
                     f"joriy prognoz esa {r['reja_kuni']} ga asoslangan",
            "oxirgi_kun": r["oxirgi_kun"].isoformat(),
            "reja_kuni": r["reja_kuni"].isoformat(),
        }
    return {"eskirgan": False}

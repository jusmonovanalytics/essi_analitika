"""RITM delivery_product report -> PostgreSQL product-line cache."""
import asyncio
import json
import os
from datetime import date, datetime, timedelta

import httpx

import db
from psycopg.rows import dict_row

URL = "https://devessi.ritm.uz/ru/api/v1/saas/report_many/"
INTERVAL = 5 * 60

DIMS = ["date_delivery_day", "order_number", "product_name", "product_id",
        "product_type_id", "user_id", "delivery_man_id", "market_id",
        "market_type_id", "border_id", "payment_type"]
METRICS = ["fact_amount", "return_amount", "total_discount", "total_price",
           "total_fact_price"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS ritm_order_products_test (
 id BIGSERIAL PRIMARY KEY, sale_date DATE NOT NULL, order_created_at TIMESTAMPTZ,
 order_no BIGINT NOT NULL, product_id BIGINT NOT NULL, product_name TEXT,
 product_type TEXT, agent TEXT, delivery_man TEXT, market TEXT, market_type TEXT,
 border_name TEXT, payment_type TEXT, amount NUMERIC(18,3) NOT NULL DEFAULT 0,
 return_amount NUMERIC(18,3) NOT NULL DEFAULT 0,
 total_discount NUMERIC(18,2) NOT NULL DEFAULT 0,
 total_price NUMERIC(18,2) NOT NULL DEFAULT 0,
 total_fact_price NUMERIC(18,2) NOT NULL DEFAULT 0, raw JSONB NOT NULL,
 loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(sale_date,order_no,product_id));
CREATE INDEX IF NOT EXISTS idx_ritm_products_sale_date ON ritm_order_products_test(sale_date);
CREATE INDEX IF NOT EXISTS idx_ritm_products_order_no ON ritm_order_products_test(order_no);
CREATE TABLE IF NOT EXISTS product_sync_logs (
 id BIGSERIAL PRIMARY KEY, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 finished_at TIMESTAMPTZ, date_from DATE NOT NULL, date_to DATE NOT NULL,
 loaded INTEGER NOT NULL DEFAULT 0, status VARCHAR(20) NOT NULL DEFAULT 'running',
 error_msg TEXT);
"""


async def ensure_schema():
    pool = await db.get_pool()
    async with pool.connection() as conn:
        await conn.execute(SCHEMA); await conn.commit()


def _headers():
    token = os.getenv("RITM_API_TOKEN", "")
    if not token:
        raise RuntimeError("RITM_API_TOKEN sozlanmagan")
    return {"Authorization": token, "Accept": "application/json"}


def _payload(day: str):
    return {
        "model": "delivery_product",
        "filter": [
            {"field_name": {"value": "created_date"}, "operation": "greater_than", "value": day},
            {"field_name": {"value": "created_date"}, "operation": "less_than", "value": day},
        ],
        "select": ([{"field_name": x} for x in METRICS] +
                   [{"type": "vertical", "field_name": x} for x in DIMS]),
        "group_by": [{"type": "vertical", "field_name": x} for x in DIMS],
        "report_type": "table",
    }


async def fetch_day(client: httpx.AsyncClient, day: str) -> list[dict]:
    response = await client.post(URL, headers=_headers(), json=_payload(day), timeout=180)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise RuntimeError("RITM delivery_product javobi ro'yxat emas")
    return data


async def sync_range(date_from: str, date_to: str) -> int:
    start, end = date.fromisoformat(date_from), date.fromisoformat(date_to)
    log_id = await add_log(date_from, date_to)
    loaded = 0
    try:
        async with httpx.AsyncClient() as client:
            day = start
            while day <= end:
                rows = await fetch_day(client, day.isoformat())
                loaded += await replace_day(day, rows)
                await update_log(log_id, loaded)
                day += timedelta(days=1)
        await finish_log(log_id, loaded, "success")
        return loaded
    except asyncio.CancelledError:
        await finish_log(log_id, loaded, "cancelled", "Foydalanuvchi to'xtatdi")
        raise
    except Exception as exc:
        await finish_log(log_id, loaded, "error", str(exc))
        raise


async def sync_loop():
    while True:
        today = datetime.now().date().isoformat()
        try:
            await sync_range(today, today)
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        await asyncio.sleep(INTERVAL)


async def replace_day(day, rows):
    vals=[(day,int(r["order_number"]),int(r["product_name"]),r.get("product_id"),
      r.get("product_type_id"),r.get("user_id"),r.get("delivery_man_id"),r.get("market_id"),
      r.get("market_type_id"),r.get("border_id"),r.get("payment_type"),r.get("fact_amount") or 0,
      r.get("return_amount") or 0,r.get("total_discount") or 0,r.get("total_price") or 0,
      r.get("total_fact_price") or 0,json.dumps(r,ensure_ascii=False)) for r in rows]
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor() as cur:
        await cur.execute("DELETE FROM ritm_order_products_test WHERE sale_date=%s",[day])
        if vals: await cur.executemany("""INSERT INTO ritm_order_products_test
          (sale_date,order_no,product_id,product_name,product_type,agent,delivery_man,market,
           market_type,border_name,payment_type,amount,return_amount,total_discount,total_price,total_fact_price,raw)
          VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",vals)
        await cur.execute("""UPDATE ritm_order_products_test p SET order_created_at=o.created_date
          FROM orders_cache o WHERE p.sale_date=%s AND o.order_number=p.order_no""",[day])
      await conn.commit()
    return len(vals)


async def status():
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute("""SELECT count(*) rows,count(DISTINCT order_no) orders,
          count(DISTINCT product_id) products,min(sale_date) oldest_day,max(sale_date) newest_day,
          max(loaded_at) last_sync,count(*) FILTER(WHERE sale_date=CURRENT_DATE) today_rows,
          pg_size_pretty(pg_total_relation_size('ritm_order_products_test')) table_size
          FROM ritm_order_products_test"""); row=await cur.fetchone()
    return {k:(v.isoformat() if hasattr(v,'isoformat') else v) for k,v in row.items()}


async def delete_range(date_from,date_to):
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor() as cur:
        await cur.execute("DELETE FROM ritm_order_products_test WHERE sale_date BETWEEN %s AND %s",[date_from,date_to]); count=cur.rowcount
      await conn.commit()
    return count


async def add_log(a,b):
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor() as cur:
        await cur.execute("INSERT INTO product_sync_logs(date_from,date_to) VALUES(%s,%s) RETURNING id",[a,b]); n=(await cur.fetchone())[0]
      await conn.commit()
    return n


async def update_log(n,loaded):
    pool=await db.get_pool()
    async with pool.connection() as conn: await conn.execute("UPDATE product_sync_logs SET loaded=%s WHERE id=%s",[loaded,n]); await conn.commit()


async def finish_log(n,loaded,status_value,error=None):
    pool=await db.get_pool()
    async with pool.connection() as conn: await conn.execute("UPDATE product_sync_logs SET loaded=%s,status=%s,error_msg=%s,finished_at=NOW() WHERE id=%s",[loaded,status_value,error,n]); await conn.commit()


async def logs(limit=30):
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor(row_factory=dict_row) as cur: await cur.execute("SELECT * FROM product_sync_logs ORDER BY id DESC LIMIT %s",[limit]); rows=await cur.fetchall()
    return [{k:(v.isoformat() if hasattr(v,'isoformat') else v) for k,v in r.items()} for r in rows]

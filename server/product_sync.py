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
CREATED_DIMS = ["created_date_day", "order_id", "product_name", "product_id",
                "product_type_id", "user_id", "delivery_man_id", "market_id",
                "market_type_id", "border_id", "payment_type"]

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
CREATE INDEX IF NOT EXISTS idx_ritm_products_created_at ON ritm_order_products_test(order_created_at);
CREATE INDEX IF NOT EXISTS idx_ritm_products_product_id ON ritm_order_products_test(product_id);
CREATE TABLE IF NOT EXISTS ritm_order_products_created (
 id BIGSERIAL PRIMARY KEY, created_date DATE NOT NULL,
 order_no BIGINT NOT NULL, product_id BIGINT NOT NULL, product_name TEXT,
 product_type TEXT, agent TEXT, delivery_man TEXT, market TEXT, market_type TEXT,
 border_name TEXT, payment_type TEXT, amount NUMERIC(18,3) NOT NULL DEFAULT 0,
 return_amount NUMERIC(18,3) NOT NULL DEFAULT 0,
 total_discount NUMERIC(18,2) NOT NULL DEFAULT 0,
 total_price NUMERIC(18,2) NOT NULL DEFAULT 0,
 total_fact_price NUMERIC(18,2) NOT NULL DEFAULT 0, raw JSONB NOT NULL,
 loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(created_date,order_no,product_id));
CREATE INDEX IF NOT EXISTS idx_ritm_created_date ON ritm_order_products_created(created_date);
CREATE INDEX IF NOT EXISTS idx_ritm_created_order ON ritm_order_products_created(order_no);
CREATE INDEX IF NOT EXISTS idx_ritm_created_product ON ritm_order_products_created(product_id);
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


def _payload(day: str, model: str = "delivery_product"):
    dims = CREATED_DIMS if model == "order_product" else DIMS
    return {
        "model": model,
        "filter": [
            {"field_name": {"value": "created_date"}, "operation": "greater_than", "value": day},
            {"field_name": {"value": "created_date"}, "operation": "less_than", "value": day},
        ],
        "select": ([{"field_name": x} for x in METRICS] +
                   [{"type": "vertical", "field_name": x} for x in dims]),
        "group_by": [{"type": "vertical", "field_name": x} for x in dims],
        "report_type": "table",
    }


async def fetch_day(client: httpx.AsyncClient, day: str, model: str = "delivery_product") -> list[dict]:
    response = await client.post(URL, headers=_headers(), json=_payload(day, model), timeout=180)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise RuntimeError(f"RITM {model} javobi ro'yxat emas")
    return data


async def sync_range(date_from: str, date_to: str, full: bool = True) -> int:
    start, end = date.fromisoformat(date_from), date.fromisoformat(date_to)
    log_id = await add_log(date_from, date_to)
    loaded = 0
    try:
        async with httpx.AsyncClient() as client:
            day = start
            while day <= end:
                delivery_rows = await fetch_day(client, day.isoformat(), "delivery_product")
                created_rows = await fetch_day(client, day.isoformat(), "order_product")
                loaded += await replace_day(day, delivery_rows, full)
                loaded += await replace_created_day(day, created_rows, full)
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
    last_full = None
    while True:
        today = datetime.now().date().isoformat()
        try:
            now = datetime.now()
            full = last_full is None or (now - last_full).total_seconds() >= 30 * 60
            await sync_range(today, today, full=full)
            if full:
                last_full = now
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        await asyncio.sleep(INTERVAL)


async def replace_day(day, rows, full=True):
    vals=[(day,int(r["order_number"]),int(r["product_name"]),r.get("product_id"),
      r.get("product_type_id"),r.get("user_id"),r.get("delivery_man_id"),r.get("market_id"),
      r.get("market_type_id"),r.get("border_id"),r.get("payment_type"),r.get("fact_amount") or 0,
      r.get("return_amount") or 0,r.get("total_discount") or 0,r.get("total_price") or 0,
      r.get("total_fact_price") or 0,json.dumps(r,ensure_ascii=False)) for r in rows]
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor() as cur:
        if full:
          await cur.execute("DELETE FROM ritm_order_products_test WHERE sale_date=%s",[day])
        if vals: await cur.executemany("""INSERT INTO ritm_order_products_test
          (sale_date,order_no,product_id,product_name,product_type,agent,delivery_man,market,
           market_type,border_name,payment_type,amount,return_amount,total_discount,total_price,total_fact_price,raw)
          VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
          ON CONFLICT (sale_date,order_no,product_id) DO UPDATE SET
            product_name=EXCLUDED.product_name,product_type=EXCLUDED.product_type,
            agent=EXCLUDED.agent,delivery_man=EXCLUDED.delivery_man,market=EXCLUDED.market,
            market_type=EXCLUDED.market_type,border_name=EXCLUDED.border_name,
            payment_type=EXCLUDED.payment_type,amount=EXCLUDED.amount,
            return_amount=EXCLUDED.return_amount,total_discount=EXCLUDED.total_discount,
            total_price=EXCLUDED.total_price,total_fact_price=EXCLUDED.total_fact_price,
            raw=EXCLUDED.raw,loaded_at=NOW()""",vals)
        await cur.execute("""UPDATE ritm_order_products_test p SET order_created_at=o.created_date
          FROM orders_cache o WHERE p.sale_date=%s AND o.order_number=p.order_no""",[day])
      await conn.commit()
    return len(vals)


async def replace_created_day(day, rows, full=True):
    vals=[(day,int(r["order_id"]),int(r["product_name"]),r.get("product_id"),
      r.get("product_type_id"),r.get("user_id"),r.get("delivery_man_id"),r.get("market_id"),
      r.get("market_type_id"),r.get("border_id"),r.get("payment_type"),r.get("fact_amount") or 0,
      r.get("return_amount") or 0,r.get("total_discount") or 0,r.get("total_price") or 0,
      r.get("total_fact_price") or 0,json.dumps(r,ensure_ascii=False)) for r in rows]
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor() as cur:
        if full:
          await cur.execute("DELETE FROM ritm_order_products_created WHERE created_date=%s",[day])
        if vals: await cur.executemany("""INSERT INTO ritm_order_products_created
          (created_date,order_no,product_id,product_name,product_type,agent,delivery_man,market,
           market_type,border_name,payment_type,amount,return_amount,total_discount,total_price,total_fact_price,raw)
          VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
          ON CONFLICT (created_date,order_no,product_id) DO UPDATE SET
            product_name=EXCLUDED.product_name,product_type=EXCLUDED.product_type,
            agent=EXCLUDED.agent,delivery_man=EXCLUDED.delivery_man,market=EXCLUDED.market,
            market_type=EXCLUDED.market_type,border_name=EXCLUDED.border_name,
            payment_type=EXCLUDED.payment_type,amount=EXCLUDED.amount,
            return_amount=EXCLUDED.return_amount,total_discount=EXCLUDED.total_discount,
            total_price=EXCLUDED.total_price,total_fact_price=EXCLUDED.total_fact_price,
            raw=EXCLUDED.raw,loaded_at=NOW()""",vals)
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


async def analytics(date_from: str, date_to: str, date_field: str = "date_delivery",
                    agent_ids=None, regions=None, payment_types=None,
                    delivery_man_ids=None, statuses=None, limit: int = 200):
    """Product sales KPIs and ranking, aggregated entirely by PostgreSQL."""
    product_table = "ritm_order_products_created" if date_field == "created_date" else "ritm_order_products_test"
    product_date = "p.created_date" if date_field == "created_date" else "p.sale_date"
    header_date = "o.created_date::date" if date_field == "created_date" else "o.date_delivery"
    sql = f"""
    WITH latest_orders AS (
      SELECT DISTINCT ON (order_number)
        order_number, created_date, user_id, delivery_man_id, market_border,
        payment_type, status
      FROM orders_cache
      WHERE order_number IS NOT NULL
      ORDER BY order_number, synced_at DESC, id DESC
    ), selected_agents AS (
      SELECT DISTINCT user_name FROM orders_cache
      WHERE %s::int[] IS NOT NULL AND user_id = ANY(%s::int[])
    ), selected_deliveries AS (
      SELECT DISTINCT delivery_man_name FROM orders_cache
      WHERE %s::int[] IS NOT NULL AND delivery_man_id = ANY(%s::int[])
    ), filtered AS (
      SELECT p.*
      FROM {product_table} p
      JOIN latest_orders o ON o.order_number = p.order_no
      WHERE {product_date} BETWEEN %s::date AND %s::date
        AND (%s::int[] IS NULL OR o.user_id = ANY(%s::int[])
             OR p.agent IN (SELECT user_name FROM selected_agents))
        AND (%s::text[] IS NULL OR COALESCE(o.market_border,p.border_name) = ANY(%s::text[]))
        AND (%s::text[] IS NULL OR COALESCE(o.payment_type,p.payment_type) = ANY(%s::text[]))
        AND (%s::int[] IS NULL OR o.delivery_man_id = ANY(%s::int[])
             OR p.delivery_man IN (SELECT delivery_man_name FROM selected_deliveries))
        AND (%s::text[] IS NULL OR o.status = ANY(%s::text[]))
    ), header_totals AS (
      SELECT COUNT(DISTINCT o.order_number)::bigint all_order_count
      FROM latest_orders o
      WHERE {header_date} BETWEEN %s::date AND %s::date
        AND (%s::int[] IS NULL OR o.user_id = ANY(%s::int[]))
        AND (%s::text[] IS NULL OR o.market_border = ANY(%s::text[]))
        AND (%s::text[] IS NULL OR o.payment_type = ANY(%s::text[]))
        AND (%s::int[] IS NULL OR o.delivery_man_id = ANY(%s::int[]))
        AND (%s::text[] IS NULL OR o.status = ANY(%s::text[]))
    ), product_rows AS (
      SELECT product_id, COALESCE(product_name,'Noma\u2019lum mahsulot') product_name,
        COALESCE(product_type,'Noma\u2019lum') product_type,
        COUNT(DISTINCT order_no)::bigint order_count,
        SUM(amount)::numeric quantity,
        SUM(total_fact_price)::numeric total_sum,
        CASE WHEN SUM(amount) <> 0 THEN SUM(total_fact_price)/SUM(amount) ELSE 0 END::numeric avg_price
      FROM filtered
      GROUP BY product_id, product_name, product_type
    ), product_types AS (
      SELECT COALESCE(product_type,'Noma\u2019lum') product_type,
        COUNT(DISTINCT product_id)::bigint product_count,
        COUNT(DISTINCT order_no)::bigint order_count,
        SUM(amount)::numeric quantity,SUM(total_fact_price)::numeric total_sum
      FROM filtered GROUP BY product_type
    ), hourly AS (
      SELECT EXTRACT(HOUR FROM o.created_date)::int AS "hour",
        COUNT(DISTINCT f.order_no)::bigint order_count,
        SUM(f.total_fact_price)::numeric total_sum
      FROM filtered f LEFT JOIN latest_orders o ON o.order_number=f.order_no
      WHERE o.created_date IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM o.created_date)
    ), daily AS (
      SELECT {product_date} AS "day",COUNT(DISTINCT order_no)::bigint order_count,
        SUM(total_fact_price)::numeric total_sum
      FROM filtered p GROUP BY {product_date}
    ), agents AS (
      SELECT COALESCE(agent,'Noma\u2019lum') name,COUNT(DISTINCT order_no)::bigint order_count,
        SUM(total_fact_price)::numeric total_sum FROM filtered GROUP BY agent
    ), deliveries AS (
      SELECT COALESCE(delivery_man,'Noma\u2019lum') name,COUNT(DISTINCT order_no)::bigint order_count,
        SUM(total_fact_price)::numeric total_sum FROM filtered GROUP BY delivery_man
    ), regions_breakdown AS (
      SELECT COALESCE(border_name,'Noma\u2019lum') name,COUNT(DISTINCT order_no)::bigint order_count,
        SUM(total_fact_price)::numeric total_sum FROM filtered GROUP BY border_name
    ), departments AS (
      SELECT CASE
        WHEN market_type IN ('Диллеры','Наманган','Самарканд','Бухоро') THEN 'Диллеры'
        WHEN market_type IN ('Магазин','VIP','OSDO','A - маркет','B - маркет','С - маркет','Розница') THEN 'Розница'
        WHEN market_type IN ('Халк ретейл','Корзинка','Сеть','Сырная лавка','Макро','Урбант ретейл','Би-1','Магнум ретейл','Ассорти','Амирал Ритейл','Хавас') THEN 'Сеть'
        WHEN market_type IN ('Бюджетная орг.','Школа / Садик','Гостиница','Кафе / Ресторан','Доставщики') THEN 'Хорика'
        ELSE COALESCE(market_type,'Noma\u2019lum') END name,
        COUNT(DISTINCT order_no)::bigint order_count,SUM(total_fact_price)::numeric total_sum
      FROM filtered GROUP BY 1
    ), market_types AS (
      SELECT COALESCE(market_type,'Noma\u2019lum') name,COUNT(DISTINCT order_no)::bigint order_count,
        SUM(total_fact_price)::numeric total_sum FROM filtered GROUP BY market_type
    ), payments AS (
      SELECT COALESCE(payment_type,'Noma\u2019lum') name,COUNT(DISTINCT order_no)::bigint order_count,
        SUM(total_fact_price)::numeric total_sum FROM filtered GROUP BY payment_type
    ), totals AS (
      SELECT COUNT(DISTINCT order_no)::bigint order_count,
        COUNT(DISTINCT product_id)::bigint product_count,
        COALESCE(SUM(amount),0)::numeric quantity,
        COALESCE(SUM(total_fact_price),0)::numeric total_sum,
        COALESCE(SUM(return_amount),0)::numeric return_quantity,
        COALESCE(SUM(total_discount),0)::numeric discount_sum,
        COALESCE(SUM(total_price),0)::numeric gross_sum,
        MAX(loaded_at) refreshed_at
      FROM filtered
    )
    SELECT jsonb_build_object(
      'summary', (SELECT to_jsonb(t) || jsonb_build_object(
          'all_order_count', h.all_order_count,
          'orders_without_products', GREATEST(h.all_order_count-t.order_count,0),
          'avg_order_sum', CASE WHEN t.order_count>0 THEN t.total_sum/t.order_count ELSE 0 END,
          'avg_sku_per_order', COALESCE((SELECT AVG(s.sku_count) FROM
            (SELECT COUNT(DISTINCT product_id)::numeric sku_count FROM filtered GROUP BY order_no) s),0),
          'discount_rate_pct', CASE WHEN t.gross_sum>0 THEN t.discount_sum/t.gross_sum*100 ELSE 0 END,
          'return_rate_pct', CASE WHEN t.quantity<>0 THEN t.return_quantity/t.quantity*100 ELSE 0 END,
          'top10_share_pct', COALESCE((SELECT SUM(z.total_sum)/NULLIF(t.total_sum,0)*100
            FROM (SELECT total_sum FROM product_rows ORDER BY total_sum DESC LIMIT 10) z),0))
        FROM totals t CROSS JOIN header_totals h),
      'items', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC)
        FROM (SELECT r.*, CASE WHEN t.total_sum <> 0 THEN r.total_sum/t.total_sum*100 ELSE 0 END::numeric share_pct
              FROM product_rows r CROSS JOIN totals t
              ORDER BY r.total_sum DESC LIMIT %s) x), '[]'::jsonb),
      'types', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC)
        FROM (SELECT pt.*,CASE WHEN t.total_sum<>0 THEN pt.total_sum/t.total_sum*100 ELSE 0 END::numeric share_pct
              FROM product_types pt CROSS JOIN totals t ORDER BY pt.total_sum DESC) x),'[]'::jsonb),
      'hourly', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."hour") FROM hourly x),'[]'::jsonb),
      'daily', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x."day") FROM daily x),'[]'::jsonb),
      'agents', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC) FROM (SELECT * FROM agents ORDER BY total_sum DESC LIMIT 8) x),'[]'::jsonb),
      'deliveries', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC) FROM (SELECT * FROM deliveries ORDER BY total_sum DESC LIMIT 8) x),'[]'::jsonb),
      'regions', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC) FROM (SELECT * FROM regions_breakdown ORDER BY total_sum DESC LIMIT 8) x),'[]'::jsonb),
      'departments', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC) FROM departments x),'[]'::jsonb),
      'market_types', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC) FROM market_types x),'[]'::jsonb),
      'payments', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total_sum DESC) FROM payments x),'[]'::jsonb)
    ) result
    """
    args = [agent_ids, agent_ids, delivery_man_ids, delivery_man_ids,
            date_from, date_to, agent_ids, agent_ids, regions, regions,
            payment_types, payment_types, delivery_man_ids, delivery_man_ids,
            statuses, statuses,
            date_from, date_to, agent_ids, agent_ids, regions, regions,
            payment_types, payment_types, delivery_man_ids, delivery_man_ids,
            statuses, statuses, limit]
    pool = await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(sql, args)
        result = (await cur.fetchone())["result"]
    summary = result["summary"] or {}
    summary["refreshed_at"] = summary.get("refreshed_at")
    return {"summary": summary, "items": result["items"], "types": result["types"],
            "hourly": result["hourly"], "daily": result["daily"],
            "agents": result["agents"], "deliveries": result["deliveries"],
            "regions": result["regions"], "departments": result["departments"],
            "market_types": result["market_types"], "payments": result["payments"]}


async def delete_range(date_from,date_to):
    pool=await db.get_pool()
    async with pool.connection() as conn:
      async with conn.cursor() as cur:
        await cur.execute("DELETE FROM ritm_order_products_test WHERE sale_date BETWEEN %s AND %s",[date_from,date_to]); count=cur.rowcount
        await cur.execute("DELETE FROM ritm_order_products_created WHERE created_date BETWEEN %s AND %s",[date_from,date_to]); count += cur.rowcount
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

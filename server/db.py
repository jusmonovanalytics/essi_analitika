"""
PostgreSQL connection using psycopg v3 (async-native).
"""

import json
import os
from typing import Optional

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

_pool: Optional[AsyncConnectionPool] = None


async def get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is None:
        # statement_timeout=8000ms: protects against runaway queries on large date ranges
        _pool = AsyncConnectionPool(
            DB_URL + "?options=-c%20statement_timeout%3D8000",
            min_size=2,
            max_size=15,
            open=False,
        )
        await _pool.open()
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS orders_cache (
    id              INTEGER PRIMARY KEY,
    uuid            VARCHAR(36) UNIQUE,
    order_number    INTEGER,
    user_id         INTEGER,
    user_name       VARCHAR(200),
    delivery_man_id INTEGER,
    delivery_man_name VARCHAR(200),
    client_id       INTEGER,
    client_name     VARCHAR(500),
    market_border   VARCHAR(200),
    market_type     VARCHAR(200),
    status          VARCHAR(10),
    payment_type    VARCHAR(30),
    fact_price      NUMERIC(15,2),
    total_weight    NUMERIC(15,3),
    created_date    TIMESTAMPTZ,
    date_delivery   DATE,
    division_name   VARCHAR(200),
    raw             JSONB NOT NULL,
    synced_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_cache_created_date ON orders_cache (created_date);
CREATE INDEX IF NOT EXISTS idx_orders_cache_date_delivery ON orders_cache (date_delivery);
CREATE INDEX IF NOT EXISTS idx_orders_cache_user_id      ON orders_cache (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_cache_status       ON orders_cache (status);
CREATE TABLE IF NOT EXISTS sync_logs (
    id          SERIAL PRIMARY KEY,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    date_from   DATE,
    date_to     DATE,
    date_field  VARCHAR(30) DEFAULT 'created_date',
    loaded      INTEGER DEFAULT 0,
    skipped     INTEGER DEFAULT 0,
    status      VARCHAR(20) DEFAULT 'running',
    error_msg   TEXT,
    duration_ms INTEGER
);
ALTER TABLE sync_logs ADD COLUMN IF NOT EXISTS skipped INTEGER DEFAULT 0;
"""


async def init_db():
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(CREATE_TABLE_SQL)
        # Mark orphaned 'running' logs from previous server run as error
        await conn.execute("""
            UPDATE sync_logs
            SET status = 'error',
                error_msg = 'Server qayta ishga tushirildi (to''xtatildi)',
                finished_at = NOW()
            WHERE status = 'running'
        """)
        # Remove returned orders (status=4) that may have been loaded before filter was added
        await conn.execute("DELETE FROM orders_cache WHERE status = '4'")
        await conn.commit()


async def upsert_orders(orders: list[dict]) -> tuple[int, int]:
    """Insert new orders, update only if status/price/delivery changed.
    Returns (new_or_changed, skipped_unchanged).
    """
    orders = [o for o in orders if str(o.get("status", "")) != "4"]
    if not orders:
        return 0, 0

    pool = await get_pool()
    ids, rows = [], []
    for o in orders:
        dm   = o.get("delivery_man")
        user = o.get("user") or {}
        ids.append(o["id"])
        rows.append((
            o["id"],
            o.get("uuid"),
            o.get("order_number"),
            user.get("id"),
            f"{user.get('first_name', '')} {user.get('second_name', '')}".strip(),
            dm["id"] if dm else None,
            f"{dm.get('first_name', '')} {dm.get('second_name', '')}".strip() if dm else None,
            (o.get("client") or {}).get("id"),
            (o.get("client") or {}).get("name"),
            ((o.get("market") or {}).get("border") or {}).get("title"),
            ((o.get("market") or {}).get("market_type") or {}).get("name"),
            o.get("status"),
            o.get("payment_type"),
            float(o.get("fact_price") or 0),
            float(o.get("total_weight") or 0),
            o.get("created_date"),
            o.get("date_delivery"),
            (o.get("division") or {}).get("name"),
            json.dumps(o),
        ))

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            # Count already-existing IDs in this batch
            await cur.execute(
                "SELECT COUNT(*) FROM orders_cache WHERE id = ANY(%s)", [ids]
            )
            existing_count = (await cur.fetchone())[0]

            await cur.executemany("""
                INSERT INTO orders_cache (
                    id, uuid, order_number,
                    user_id, user_name,
                    delivery_man_id, delivery_man_name,
                    client_id, client_name,
                    market_border, market_type,
                    status, payment_type,
                    fact_price, total_weight,
                    created_date, date_delivery,
                    division_name, raw, synced_at
                ) VALUES (
                    %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    status            = EXCLUDED.status,
                    delivery_man_id   = EXCLUDED.delivery_man_id,
                    delivery_man_name = EXCLUDED.delivery_man_name,
                    fact_price        = EXCLUDED.fact_price,
                    total_weight      = EXCLUDED.total_weight,
                    raw               = EXCLUDED.raw,
                    synced_at         = NOW()
                WHERE (orders_cache.status, orders_cache.fact_price, orders_cache.delivery_man_id)
                    IS DISTINCT FROM (EXCLUDED.status, EXCLUDED.fact_price, EXCLUDED.delivery_man_id)
            """, rows)
        await conn.commit()

    new_count  = len(rows) - existing_count   # truly new orders
    skip_count = existing_count               # already existed (some updated, rest skipped)
    return new_count, skip_count


async def query_orders(
    date_from:  str | None = None,
    date_to:    str | None = None,
    date_field: str = "created_date",
    page:       int = 1,
    page_size:  int = 100,
    search:     str | None = None,
) -> dict:
    allowed = {"created_date", "date_delivery"}
    field = date_field if date_field in allowed else "created_date"

    conditions: list[str] = ["status != '4'"]
    args: list = []

    if date_from:
        conditions.append(f"{field}::date >= %s")
        args.append(date_from)
    if date_to:
        conditions.append(f"{field}::date <= %s")
        args.append(date_to)
    if search:
        conditions.append("(client_name ILIKE %s OR user_name ILIKE %s OR CAST(order_number AS TEXT) LIKE %s)")
        args += [f"%{search}%", f"%{search}%", f"%{search}%"]

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(f"SELECT COUNT(*) AS cnt FROM orders_cache {where}", args)
            row = await cur.fetchone()
            total: int = row["cnt"]  # type: ignore

            await cur.execute(
                f"SELECT raw FROM orders_cache {where} ORDER BY created_date DESC LIMIT %s OFFSET %s",
                args + [page_size, (page - 1) * page_size],
            )
            rows = await cur.fetchall()

    results = [r["raw"] for r in rows]
    next_page = page + 1 if page * page_size < total else None

    return {
        "count": total,
        "next": f"?page={next_page}" if next_page else None,
        "previous": f"?page={page - 1}" if page > 1 else None,
        "results": results,
    }


async def get_period_stats(date_from: str, date_to: str) -> dict:
    """Aggregated stats for a date range (used for comparison cards)."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("""
                SELECT
                    COUNT(*)                                     AS total_orders,
                    COALESCE(SUM(fact_price), 0)                AS total_sum,
                    COUNT(DISTINCT user_id)                      AS active_agents,
                    SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END) AS delivered,
                    COUNT(DISTINCT market_border)               AS regions
                FROM orders_cache
                WHERE created_date::date >= %s
                  AND created_date::date <= %s
            """, [date_from, date_to])
            row = await cur.fetchone()

            # Top agents
            await cur.execute("""
                SELECT user_name, COUNT(*) AS cnt, SUM(fact_price) AS total
                FROM orders_cache
                WHERE created_date::date >= %s AND created_date::date <= %s
                  AND user_name IS NOT NULL AND user_name != ''
                GROUP BY user_name ORDER BY cnt DESC LIMIT 5
            """, [date_from, date_to])
            agents = await cur.fetchall()

            # Regional breakdown
            await cur.execute("""
                SELECT market_border AS region, COUNT(*) AS cnt, SUM(fact_price) AS total
                FROM orders_cache
                WHERE created_date::date >= %s AND created_date::date <= %s
                  AND market_border IS NOT NULL AND market_border != ''
                GROUP BY market_border ORDER BY cnt DESC LIMIT 15
            """, [date_from, date_to])
            regions = await cur.fetchall()

    total = row["total_orders"] or 0  # type: ignore
    delivered = row["delivered"] or 0  # type: ignore
    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_orders": total,
        "total_sum": float(row["total_sum"] or 0),  # type: ignore
        "active_agents": row["active_agents"] or 0,  # type: ignore
        "delivered_orders": delivered,
        "pending_orders": total - delivered,
        "delivery_rate": round((delivered / total * 100), 1) if total > 0 else 0,
        "regions": row["regions"] or 0,  # type: ignore
        "top_agents": [{"name": a["user_name"], "count": a["cnt"], "sum": float(a["total"] or 0)} for a in agents],
        "regional": [{"name": r["region"], "count": r["cnt"], "sum": float(r["total"] or 0)} for r in regions],
    }


async def get_sync_stats() -> dict:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("""
                SELECT
                    COUNT(*)           AS total_orders,
                    MAX(synced_at)     AS last_sync,
                    MIN(created_date)  AS oldest_order,
                    MAX(created_date)  AS newest_order
                FROM orders_cache
            """)
            row = await cur.fetchone()

    return {
        "total_orders": row["total_orders"],                                         # type: ignore
        "last_sync":    row["last_sync"].isoformat()    if row["last_sync"]    else None,  # type: ignore
        "oldest_order": row["oldest_order"].isoformat() if row["oldest_order"] else None,  # type: ignore
        "newest_order": row["newest_order"].isoformat() if row["newest_order"] else None,  # type: ignore
    }


async def add_sync_log(date_from: str, date_to: str, date_field: str = 'created_date') -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "INSERT INTO sync_logs (date_from, date_to, date_field) VALUES (%s,%s,%s) RETURNING id",
                [date_from, date_to, date_field]
            )
            row = await cur.fetchone()
            await conn.commit()
            return row[0]


async def finish_sync_log(log_id: int, loaded: int, status: str, error: str | None = None, skipped: int = 0):
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute("""
            UPDATE sync_logs SET
                finished_at  = NOW(),
                loaded       = %s,
                skipped      = %s,
                status       = %s,
                error_msg    = %s,
                duration_ms  = EXTRACT(EPOCH FROM (NOW() - started_at))::int * 1000
            WHERE id = %s
        """, [loaded, skipped, status, error, log_id])
        await conn.commit()


async def update_sync_log_progress(log_id: int, loaded: int):
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute(
            "UPDATE sync_logs SET loaded = %s WHERE id = %s",
            [loaded, log_id]
        )
        await conn.commit()


async def get_sync_logs(limit: int = 30) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("""
                SELECT id, started_at, finished_at, date_from, date_to, date_field,
                       loaded, skipped, status, error_msg, duration_ms
                FROM sync_logs
                ORDER BY started_at DESC
                LIMIT %s
            """, [limit])
            rows = await cur.fetchall()
    return [
        {
            **r,
            'started_at':  r['started_at'].isoformat()  if r['started_at']  else None,
            'finished_at': r['finished_at'].isoformat() if r['finished_at'] else None,
            'date_from':   str(r['date_from'])   if r['date_from']  else None,
            'date_to':     str(r['date_to'])     if r['date_to']    else None,
        }
        for r in rows
    ]


async def get_data_status() -> dict:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("""
                SELECT
                    COUNT(*)                            AS total_orders,
                    MAX(synced_at)                      AS last_sync,
                    MIN(created_date::date)             AS oldest_day,
                    MAX(created_date::date)             AS newest_day,
                    COUNT(DISTINCT created_date::date)  AS distinct_days,
                    pg_size_pretty(pg_total_relation_size('orders_cache')) AS table_size,
                    COUNT(*) FILTER (WHERE created_date::date = CURRENT_DATE) AS today_count,
                    MAX(synced_at) FILTER (WHERE created_date::date = CURRENT_DATE) AS today_last_sync
                FROM orders_cache
                WHERE status != '4'
            """)
            row = await cur.fetchone()
    return {
        'total_orders':    row['total_orders'],
        'last_sync':       row['last_sync'].isoformat()        if row['last_sync']        else None,
        'oldest_day':      str(row['oldest_day'])              if row['oldest_day']       else None,
        'newest_day':      str(row['newest_day'])              if row['newest_day']       else None,
        'distinct_days':   row['distinct_days'],
        'table_size':      row['table_size'],
        'today_count':     row['today_count'],
        'today_last_sync': row['today_last_sync'].isoformat()  if row['today_last_sync'] else None,
    }


async def count_orders_for_date(date: str) -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT COUNT(*) FROM orders_cache WHERE created_date::date = %s", [date]
            )
            return (await cur.fetchone())[0]


async def delete_range(date_from: str, date_to: str, date_field: str = 'created_date') -> int:
    allowed = {'created_date', 'date_delivery'}
    field = date_field if date_field in allowed else 'created_date'
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                f"DELETE FROM orders_cache WHERE {field}::date >= %s AND {field}::date <= %s",
                [date_from, date_to]
            )
            count = cur.rowcount
        await conn.commit()
    return count


async def delete_all_orders() -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM orders_cache")
            count = cur.rowcount
        await conn.commit()
    return count


async def get_duplicate_stats() -> dict:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("""
                SELECT
                    COUNT(*)                           AS total_rows,
                    COUNT(DISTINCT id)                 AS unique_ids,
                    COUNT(*) - COUNT(DISTINCT id)      AS dup_by_id,
                    COUNT(DISTINCT order_number)       AS unique_order_numbers,
                    COUNT(*) - COUNT(DISTINCT order_number) AS dup_by_order_num
                FROM orders_cache
                WHERE order_number IS NOT NULL
            """)
            row = await cur.fetchone()
    return {
        'total_rows':          row['total_rows'],
        'unique_ids':          row['unique_ids'],
        'dup_by_id':           row['dup_by_id'],
        'unique_order_numbers': row['unique_order_numbers'],
        'dup_by_order_num':    max(0, row['dup_by_order_num'] or 0),
    }


async def clean_duplicates() -> int:
    """Keep one row per order_number (lowest id), delete the rest."""
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                DELETE FROM orders_cache
                WHERE id NOT IN (
                    SELECT MIN(id) FROM orders_cache
                    WHERE order_number IS NOT NULL
                    GROUP BY order_number
                )
                AND order_number IS NOT NULL
            """)
            count = cur.rowcount
        await conn.commit()
    return count


async def cancel_sync_log(log_id: int):
    """Force-mark a running log entry as cancelled (for stale/orphaned syncs)."""
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute("""
            UPDATE sync_logs SET
                status      = 'cancelled',
                finished_at = NOW(),
                error_msg   = 'Foydalanuvchi tomonidan to''xtatildi'
            WHERE id = %s AND status = 'running'
        """, [log_id])
        await conn.commit()


async def delete_sync_log(log_id: int):
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute("DELETE FROM sync_logs WHERE id = %s", [log_id])
        await conn.commit()


async def delete_all_sync_logs() -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute("DELETE FROM sync_logs")
            count = cur.rowcount
        await conn.commit()
    return count


async def cleanup_orders(before_date: str) -> int:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "DELETE FROM orders_cache WHERE created_date::date < %s",
                [before_date]
            )
            count = cur.rowcount
        await conn.commit()
    return count

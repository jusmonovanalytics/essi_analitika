"""
Analytics queries via PostgreSQL SQL functions (analytics.sql).
All business logic lives in the DB; Python only serialises results.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

from psycopg.rows import dict_row

from db import get_pool
from cache import analytics_cache


def _cache_key(*parts) -> str:
    return "|".join("" if p is None else str(p) for p in parts)


# ─── One-time setup ──────────────────────────────────────────────────────────

def _strip_leading_comments(stmt: str) -> str:
    """Ifodaning boshidagi izoh va bo'sh qatorlarni olib tashlaydi.

    Har bir ifoda oldingi `;` dan keyin boshlanadi, ya'ni bo'lakka keyingi
    ifodadan oldingi sarlavha izohlari ham tushadi:

        $$;
        -- ─── Agent Rankings ───
        CREATE FUNCTION fn_agent_stats(...)

    Bunday bo'lakni butunlay tashlab yuborish MUMKIN EMAS — u bilan birga
    CREATE FUNCTION ham yo'qoladi. Faqat boshidagi izohlarni kesamiz; ifoda
    ICHIDAGI izohlar joyida qoladi.
    """
    lines = stmt.splitlines()
    while lines and (not lines[0].strip() or lines[0].lstrip().startswith("--")):
        lines.pop(0)
    return "\n".join(lines).strip()


def _split_sql(sql: str) -> list[str]:
    """Split SQL into individual statements, respecting $$ body blocks."""
    stmts: list[str] = []
    buf: list[str] = []
    in_dollar = False
    i = 0
    while i < len(sql):
        if sql[i:i+2] == "$$":
            in_dollar = not in_dollar
            buf.append("$$")
            i += 2
        elif sql[i] == ";" and not in_dollar:
            stmt = _strip_leading_comments("".join(buf))
            if stmt:
                stmts.append(stmt)
            buf.clear()
            i += 1
        else:
            buf.append(sql[i])
            i += 1
    leftover = _strip_leading_comments("".join(buf))
    if leftover:
        stmts.append(leftover)
    return stmts


async def setup_analytics() -> None:
    """Create indexes, materialized view, and SQL functions (idempotent)."""
    sql = (Path(__file__).parent / "analytics.sql").read_text()
    stmts = _split_sql(sql)
    pool = await get_pool()
    async with pool.connection() as conn:
        for stmt in stmts:
            if stmt:
                await conn.execute(stmt)
        await conn.commit()


async def refresh_views() -> None:
    """Refresh materialized views and invalidate in-memory cache after each sync."""
    pool = await get_pool()
    async with pool.connection() as conn:
        await conn.execute("REFRESH MATERIALIZED VIEW mv_daily_totals")
        await conn.commit()
    analytics_cache.invalidate_prefix()  # clear all cached analytics


# ─── Period helpers ───────────────────────────────────────────────────────────

def prev_range(date_from: str, date_to: str) -> tuple[str, str]:
    """Return the equivalent preceding period for comparison."""
    d0 = date.fromisoformat(date_from)
    d1 = date.fromisoformat(date_to)
    n = (d1 - d0).days + 1
    prev_to = d0 - timedelta(days=1)
    prev_from = prev_to - timedelta(days=n - 1)
    return str(prev_from), str(prev_to)


def _int(v) -> int:
    return int(v) if v is not None else 0

def _float(v) -> float:
    return float(v) if v is not None else 0.0


# ─── KPI Summary ─────────────────────────────────────────────────────────────

async def get_kpis(
    date_from: str,
    date_to: str,
    agent_ids: list[int] | None = None,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    delivery_man_ids: list[int] | None = None,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> dict:
    ck = _cache_key(kun, "kpis", date_from, date_to, agent_ids, regions, payment_types, delivery_man_ids, statuses)
    cached = analytics_cache.get(ck)
    if cached is not None:
        return cached

    pf, pt = prev_range(date_from, date_to)
    args = [agent_ids, regions, payment_types, delivery_man_ids, statuses]
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM fn_kpis(%s,%s,%s::int[],%s::text[],%s::text[],%s::int[],%s::text[],%s::text)",
                [date_from, date_to] + args + [kun],
            )
            curr = await cur.fetchone()
            await cur.execute(
                "SELECT total_orders,total_sum,avg_check,active_agents,"
                "       delivered_orders,delivery_rate"
                " FROM fn_kpis(%s,%s,%s::int[],%s::text[],%s::text[],%s::int[],%s::text[],%s::text)",
                [pf, pt] + args + [kun],
            )
            prev = await cur.fetchone()

    result = {
        "total_orders":      _int(curr["total_orders"]),
        "total_sum":         _float(curr["total_sum"]),
        "avg_check":         _float(curr["avg_check"]),
        "active_agents":     _int(curr["active_agents"]),
        "active_deliveries": _int(curr["active_deliveries"]),
        "delivered_orders":  _int(curr["delivered_orders"]),
        "pending_orders":    _int(curr["pending_orders"]),
        "cancelled_orders":  _int(curr["cancelled_orders"]),
        "delivery_rate":     _float(curr["delivery_rate"]),
        "prev": {
            "total_orders":     _int(prev["total_orders"]),
            "total_sum":        _float(prev["total_sum"]),
            "avg_check":        _float(prev["avg_check"]),
            "active_agents":    _int(prev["active_agents"]),
            "delivered_orders": _int(prev["delivered_orders"]),
            "delivery_rate":    _float(prev["delivery_rate"]),
        },
        "period":      {"from": date_from, "to": date_to},
        "prev_period": {"from": pf, "to": pt},
    }
    analytics_cache.set(ck, result)
    return result


# ─── Agent Marathon ───────────────────────────────────────────────────────────

async def get_agents(
    date_from: str,
    date_to: str,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    delivery_man_ids: list[int] | None = None,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> list[dict]:
    ck = _cache_key(kun, "agents", date_from, date_to, regions, payment_types, delivery_man_ids, statuses)
    cached = analytics_cache.get(ck)
    if cached is not None:
        return cached

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM fn_agent_stats(%s,%s,%s::text[],%s::text[],%s::int[],%s::text[],%s::text)",
                [date_from, date_to, regions, payment_types, delivery_man_ids, statuses, kun],
            )
            rows = await cur.fetchall()
    result = [
        {
            "user_id":         r["user_id"],
            "user_name":       r["user_name"],
            "order_count":     _int(r["order_count"]),
            "total_sum":       _float(r["total_sum"]),
            "avg_check":       _float(r["avg_check"]),
            "client_count":    _int(r["client_count"]),
            "share_pct":       _float(r["share_pct"]),
            "daily_rank":      _int(r["daily_rank"]),
            "delivered_count": _int(r["delivered_count"]),
            "pending_count":   _int(r["pending_count"]),
            "total_weight":    _float(r["total_weight"]),
        }
        for r in rows
    ]
    analytics_cache.set(ck, result)
    return result


# ─── Delivery Rankings ────────────────────────────────────────────────────────

async def get_deliveries(
    date_from: str,
    date_to: str,
    agent_ids: list[int] | None = None,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM fn_delivery_stats(%s,%s,%s::int[],%s::text[],%s::text[],%s::text[],%s::text)",
                [date_from, date_to, agent_ids, regions, payment_types, statuses, kun],
            )
            rows = await cur.fetchall()
    return [
        {
            "delivery_man_id":   r["delivery_man_id"],
            "delivery_man_name": r["delivery_man_name"],
            "order_count":       _int(r["order_count"]),
            "total_sum":         _float(r["total_sum"]),
            "avg_order_sum":     _float(r["avg_order_sum"]),
            "rank":              _int(r["rank"]),
        }
        for r in rows
    ]


# ─── Live Orders ─────────────────────────────────────────────────────────────

async def get_live_orders(
    date_from: str,
    date_to: str,
    limit: int = 20,
    agent_ids: list[int] | None = None,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    delivery_man_ids: list[int] | None = None,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> list[dict]:
    ustun = "date_delivery" if kun == "date_delivery" else "created_date::date"
    conditions = [f"{ustun} BETWEEN %s AND %s", "status != '4'"]
    args: list = [date_from, date_to]
    if agent_ids:
        conditions.append("user_id = ANY(%s::int[])"); args.append(agent_ids)
    if regions:
        conditions.append("market_border = ANY(%s::text[])"); args.append(regions)
    if payment_types:
        conditions.append("payment_type = ANY(%s::text[])"); args.append(payment_types)
    if delivery_man_ids:
        conditions.append("delivery_man_id = ANY(%s::int[])"); args.append(delivery_man_ids)
    if statuses:
        conditions.append("status = ANY(%s::text[])"); args.append(statuses)

    where = "WHERE " + " AND ".join(conditions)
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                f"SELECT id, order_number, client_name, user_name, delivery_man_name,"
                f"       fact_price, status, payment_type, market_border, created_date"
                f" FROM orders_cache {where}"
                f" ORDER BY created_date DESC LIMIT %s",
                args + [limit],
            )
            rows = await cur.fetchall()
    return [
        {
            "id":                 r["id"],
            "order_number":       r["order_number"],
            "client_name":        r["client_name"] or "",
            "user_name":          r["user_name"] or "",
            "delivery_man_name":  r["delivery_man_name"],
            "fact_price":         _float(r["fact_price"]),
            "status":             r["status"] or "1",
            "payment_type":       r["payment_type"] or "cash",
            "market_border":      r["market_border"],
            "created_date":       r["created_date"].isoformat() if r["created_date"] else None,
        }
        for r in rows
    ]


# ─── Charts Bundle ────────────────────────────────────────────────────────────

async def get_charts(
    date_from: str,
    date_to: str,
    agent_ids: list[int] | None = None,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    delivery_man_ids: list[int] | None = None,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> dict:
    ck = _cache_key(kun, "charts", date_from, date_to, agent_ids, regions, payment_types, delivery_man_ids, statuses)
    cached = analytics_cache.get(ck)
    if cached is not None:
        return cached

    args_full = [date_from, date_to, agent_ids, regions, payment_types, delivery_man_ids, statuses]
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            sql_7 = "%s,%s,%s::int[],%s::text[],%s::text[],%s::int[],%s::text[]"
            await cur.execute(f"SELECT * FROM fn_hourly_stats({sql_7},%s::text)", args_full + [kun])
            hourly = await cur.fetchall()

            await cur.execute(f"SELECT * FROM fn_daily_stats({sql_7},%s::text)", args_full + [kun])
            daily = await cur.fetchall()

            await cur.execute(
                "SELECT * FROM fn_regional_stats(%s,%s,%s::int[],%s::text[],%s::int[],%s::text[],%s::text)",
                [date_from, date_to, agent_ids, payment_types, delivery_man_ids, statuses, kun],
            )
            regional = await cur.fetchall()

            await cur.execute(
                "SELECT * FROM fn_payment_stats(%s,%s,%s::int[],%s::text[],%s::int[],%s::text[],%s::text)",
                [date_from, date_to, agent_ids, regions, delivery_man_ids, statuses, kun],
            )
            payments = await cur.fetchall()

            await cur.execute(
                "SELECT user_name, order_count, total_sum"
                " FROM fn_agent_stats(%s,%s,%s::text[],%s::text[],%s::int[],%s::text[],%s::text) LIMIT 10",
                [date_from, date_to, regions, payment_types, delivery_man_ids, statuses, kun],
            )
            agent_chart = await cur.fetchall()

    charts_result = {
        "hourly": [
            {"hour": r["hour"], "order_count": _int(r["order_count"]), "total_sum": _float(r["total_sum"])}
            for r in hourly
        ],
        "daily": [
            {
                "day": str(r["day"]),
                "order_count": _int(r["order_count"]),
                "total_sum": _float(r["total_sum"]),
                "avg_check": _float(r["avg_check"]),
            }
            for r in daily
        ],
        "regional": [
            {
                "region": r["region"],
                "order_count": _int(r["order_count"]),
                "total_sum": _float(r["total_sum"]),
                "avg_check": _float(r["avg_check"]),
            }
            for r in regional
        ],
        "payments": [
            {
                "payment_type": r["payment_type"],
                "order_count": _int(r["order_count"]),
                "total_sum": _float(r["total_sum"]),
                "share_pct": _float(r["share_pct"]),
            }
            for r in payments
        ],
        "agent_chart": [
            {
                "user_name": r["user_name"],
                "order_count": _int(r["order_count"]),
                "total_sum": _float(r["total_sum"]),
            }
            for r in agent_chart
        ],
    }
    analytics_cache.set(ck, charts_result)
    return charts_result


# ─── Top Clients ─────────────────────────────────────────────────────────────

async def get_clients(
    date_from: str,
    date_to: str,
    agent_ids: list[int] | None = None,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    delivery_man_ids: list[int] | None = None,
    limit: int = 20,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> list[dict]:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM fn_client_stats(%s,%s,%s::int[],%s::text[],%s::text[],%s::int[],%s,%s::text[],%s::text)",
                [date_from, date_to, agent_ids, regions, payment_types, delivery_man_ids, limit, statuses, kun],
            )
            rows = await cur.fetchall()
    return [
        {
            "client_id":   r["client_id"],
            "client_name": r["client_name"],
            "order_count": _int(r["order_count"]),
            "total_sum":   _float(r["total_sum"]),
        }
        for r in rows
    ]


# ─── Extended Charts (weekday + market type) ────────────────────────────────

async def get_charts_extended(
    date_from: str,
    date_to: str,
    statuses: list[str] | None = None,
    kun: str = "created_date",
) -> dict:
    ck = _cache_key(kun, "charts_ext", date_from, date_to, statuses)
    cached = analytics_cache.get(ck)
    if cached is not None:
        return cached

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("SELECT * FROM fn_weekday_stats(%s,%s,%s::text[],%s::text)",
                              [date_from, date_to, statuses, kun])
            weekday = await cur.fetchall()
            await cur.execute("SELECT * FROM fn_market_type_stats(%s,%s,%s::text[],%s::text)",
                              [date_from, date_to, statuses, kun])
            market_types = await cur.fetchall()

    result = {
        "weekday": [
            {
                "weekday_num": _int(r["weekday_num"]),
                "order_count": _int(r["order_count"]),
                "total_sum":   _float(r["total_sum"]),
                "avg_check":   _float(r["avg_check"]),
                "day_count":   _int(r["day_count"]),
            }
            for r in weekday
        ],
        "market_types": [
            {
                "market_type": r["market_type"],
                "order_count": _int(r["order_count"]),
                "total_sum":   _float(r["total_sum"]),
                "share_pct":   _float(r["share_pct"]),
            }
            for r in market_types
        ],
    }
    analytics_cache.set(ck, result)
    return result


# ─── Extended Delivery Stats ─────────────────────────────────────────────────

async def get_deliveries_extended(
    date_from: str,
    date_to: str,
    agent_ids: list[int] | None = None,
    regions: list[str] | None = None,
    payment_types: list[str] | None = None,
    statuses: list[str] | None = None,
    limit: int = 30,
    kun: str = "created_date",
) -> list[dict]:
    ck = _cache_key(kun, "del_ext", date_from, date_to, agent_ids, regions, payment_types, statuses, limit)
    cached = analytics_cache.get(ck)
    if cached is not None:
        return cached

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM fn_delivery_extended(%s,%s,%s::int[],%s::text[],%s::text[],%s::text[],%s,%s::text)",
                [date_from, date_to, agent_ids, regions, payment_types, statuses, limit, kun],
            )
            rows = await cur.fetchall()

    result = [
        {
            "delivery_man_id":   r["delivery_man_id"],
            "delivery_man_name": r["delivery_man_name"],
            "order_count":       _int(r["order_count"]),
            "total_sum":         _float(r["total_sum"]),
            "avg_order_sum":     _float(r["avg_order_sum"]),
            "total_weight":      _float(r["total_weight"]),
            "region_count":      _int(r["region_count"]),
            "rank":              _int(r["rank"]),
        }
        for r in rows
    ]
    analytics_cache.set(ck, result)
    return result


# ─── Status Distribution ─────────────────────────────────────────────────────

async def get_status_stats(date_from: str, date_to: str, kun: str = "created_date") -> list[dict]:
    ck = _cache_key(kun, "status_stats", date_from, date_to)
    cached = analytics_cache.get(ck)
    if cached is not None:
        return cached

    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT * FROM fn_status_stats(%s,%s,%s::text)",
                [date_from, date_to, kun],
            )
            rows = await cur.fetchall()

    result = [
        {
            "status":      r["status"],
            "order_count": _int(r["order_count"]),
            "total_sum":   _float(r["total_sum"]),
            "share_pct":   _float(r["share_pct"]),
        }
        for r in rows
    ]
    analytics_cache.set(ck, result)
    return result


# ─── Filter Options ───────────────────────────────────────────────────────────

async def get_filter_options(date_from: str, date_to: str, kun: str = "created_date") -> dict:
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute("SELECT * FROM fn_filter_agents(%s,%s,%s::text)", [date_from, date_to, kun])
            agents = await cur.fetchall()

            await cur.execute("SELECT * FROM fn_filter_regions(%s,%s,%s::text)", [date_from, date_to, kun])
            regions = await cur.fetchall()

            await cur.execute("SELECT * FROM fn_filter_delivery_men(%s,%s,%s::text)", [date_from, date_to, kun])
            delivery_men = await cur.fetchall()

            # Payment types are a small distinct set — get globally
            await cur.execute(
                "SELECT DISTINCT COALESCE(payment_type,'other') AS pt FROM orders_cache"
                " WHERE created_date::date BETWEEN %s AND %s"
                " AND payment_type IS NOT NULL ORDER BY pt",
                [date_from, date_to],
            )
            payment_types = await cur.fetchall()

    return {
        "agents":        [{"user_id": r["user_id"], "user_name": r["user_name"]} for r in agents],
        "regions":       [r["region"] for r in regions],
        "delivery_men":  [{"delivery_man_id": r["delivery_man_id"], "delivery_man_name": r["delivery_man_name"]} for r in delivery_men],
        "payment_types": [r["pt"] for r in payment_types],
    }

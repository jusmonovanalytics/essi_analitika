"""
ESSI Sales Command Center — Backend API
Architecture: RITM API → PostgreSQL → FastAPI → Dashboard
"""

import asyncio
import sys

# psycopg v3 requires SelectorEventLoop on Windows (WindowsSelectorEventLoopPolicy deprecated in 3.14)
if sys.platform == "win32":
    import selectors as _sel
    asyncio.set_event_loop(asyncio.SelectorEventLoop(_sel.SelectSelector()))

import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

# Load .env
_env = Path(__file__).parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

from fastapi import (
    Depends, FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

import db
import db_analytics as analytics
import sync as syncer
import prognoz

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("main")

DISABLE_SYNC = os.getenv("DISABLE_SYNC", "").lower() in ("1", "true", "yes")


# ─── WebSocket manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)

    def disconnect(self, ws: WebSocket):
        try:
            self.clients.remove(ws)
        except ValueError:
            pass

    async def broadcast(self, payload: dict):
        dead = []
        for ws in self.clients:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
sync_task: Optional[asyncio.Task] = None
active_load_task: Optional[asyncio.Task] = None
_load_lock = asyncio.Lock()


async def _maybe_start_today_autosync():
    """Start daily 5-min auto-sync loop if today has data and loop is not running."""
    global sync_task
    today = _today()
    today_count = await db.count_orders_for_date(today)
    if today_count > 0 and (sync_task is None or sync_task.done()):
        sync_task = asyncio.create_task(syncer.sync_loop(on_sync_done))
        logger.info(f"Auto-sync started: today ({today}) has {today_count} orders")


async def on_sync_done(count: int):
    if count > 0:
        try:
            await analytics.refresh_views()
        except Exception as e:
            logger.warning(f"View refresh failed: {e}")
        stats = await db.get_sync_stats()
        await manager.broadcast({"type": "sync_done", "count": count, "stats": stats})
        logger.info(f"Sync done: {count} orders, views refreshed")
    await _maybe_start_today_autosync()


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI):
    global sync_task
    await db.init_db()
    try:
        await analytics.setup_analytics()
        logger.info("Analytics layer ready")
    except Exception as e:
        logger.error(f"Analytics setup failed: {e}")

    # Prognoz: sxema + model (qayta ishga tushirish xavfsiz — ma'lumotga tegmaydi)
    try:
        await prognoz.db.setup()
        logger.info("Prognoz layer ready")
    except Exception as e:
        logger.error(f"Prognoz setup failed: {e}")

    if DISABLE_SYNC:
        logger.info("Sync disabled via DISABLE_SYNC env var (cloud deployment mode)")
    else:
        # Start today's auto-sync ONLY if today's data is already in DB.
        await _maybe_start_today_autosync()

    yield

    if sync_task:
        sync_task.cancel()
    await db.close_pool()


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="ESSI Sales Command Center API", version="3.0.0", lifespan=lifespan)

class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response

app.add_middleware(NoCacheMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Savdo prognozi (/api/prognoz/*) ──────────────────────────────────────────

app.include_router(prognoz.router)


# ─── Common filter params ─────────────────────────────────────────────────────

def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")

def _validate_date(value: str, name: str = "date") -> str:
    try:
        datetime.fromisoformat(value)
        return value
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{name} format noto'g'ri: {value!r} (YYYY-MM-DD kerak)")


# ─── Analytics endpoints ──────────────────────────────────────────────────────

def _ints(s: Optional[str]) -> list[int] | None:
    """Parse '1,2,3' → [1,2,3] or None."""
    if not s: return None
    vals = [v.strip() for v in s.split(',') if v.strip()]
    return [int(v) for v in vals] if vals else None

def _strs(s: Optional[str]) -> list[str] | None:
    """Parse 'a,b,c' → ['a','b','c'] or None."""
    if not s: return None
    vals = [v.strip() for v in s.split(',') if v.strip()]
    return vals if vals else None


@app.get("/api/kpis")
async def kpis(
    date_from:       str           = Query(_today(), alias="dateFrom"),
    date_to:         str           = Query(_today(), alias="dateTo"),
    agent_id:        Optional[str] = Query(None, alias="agentId"),
    region:          Optional[str] = Query(None),
    payment_type:    Optional[str] = Query(None, alias="paymentType"),
    delivery_man_id: Optional[str] = Query(None, alias="deliveryManId"),
    status:          Optional[str] = Query(None),
):
    """KPI summary + comparison vs previous equivalent period."""
    return await analytics.get_kpis(date_from, date_to, _ints(agent_id), _strs(region), _strs(payment_type), _ints(delivery_man_id), _strs(status))


@app.get("/api/agents")
async def agents(
    date_from:       str           = Query(_today(), alias="dateFrom"),
    date_to:         str           = Query(_today(), alias="dateTo"),
    region:          Optional[str] = Query(None),
    payment_type:    Optional[str] = Query(None, alias="paymentType"),
    delivery_man_id: Optional[str] = Query(None, alias="deliveryManId"),
    status:          Optional[str] = Query(None),
):
    """Agent marathon — rankings with order counts, sums, delivered/pending."""
    return await analytics.get_agents(date_from, date_to, _strs(region), _strs(payment_type), _ints(delivery_man_id), _strs(status))


@app.get("/api/deliveries")
async def deliveries(
    date_from:    str           = Query(_today(), alias="dateFrom"),
    date_to:      str           = Query(_today(), alias="dateTo"),
    agent_id:     Optional[str] = Query(None, alias="agentId"),
    region:       Optional[str] = Query(None),
    payment_type: Optional[str] = Query(None, alias="paymentType"),
    status:       Optional[str] = Query(None),
):
    """Top-10 delivery men by order count."""
    return await analytics.get_deliveries(date_from, date_to, _ints(agent_id), _strs(region), _strs(payment_type), _strs(status))


@app.get("/api/live")
async def live_orders(
    date_from:       str           = Query(_today(), alias="dateFrom"),
    date_to:         str           = Query(_today(), alias="dateTo"),
    limit:           int           = Query(20, ge=1, le=50),
    agent_id:        Optional[str] = Query(None, alias="agentId"),
    region:          Optional[str] = Query(None),
    payment_type:    Optional[str] = Query(None, alias="paymentType"),
    delivery_man_id: Optional[str] = Query(None, alias="deliveryManId"),
    status:          Optional[str] = Query(None),
):
    """Latest N orders for the live feed."""
    return await analytics.get_live_orders(
        date_from, date_to, limit, _ints(agent_id), _strs(region), _strs(payment_type), _ints(delivery_man_id), _strs(status)
    )


@app.get("/api/charts")
async def charts(
    date_from:       str           = Query(_today(), alias="dateFrom"),
    date_to:         str           = Query(_today(), alias="dateTo"),
    agent_id:        Optional[str] = Query(None, alias="agentId"),
    region:          Optional[str] = Query(None),
    payment_type:    Optional[str] = Query(None, alias="paymentType"),
    delivery_man_id: Optional[str] = Query(None, alias="deliveryManId"),
    status:          Optional[str] = Query(None),
):
    """All chart data: hourly, daily, regional, payments, agent chart."""
    return await analytics.get_charts(date_from, date_to, _ints(agent_id), _strs(region), _strs(payment_type), _ints(delivery_man_id), _strs(status))


@app.get("/api/clients")
async def clients(
    date_from:       str           = Query(_today(), alias="dateFrom"),
    date_to:         str           = Query(_today(), alias="dateTo"),
    agent_id:        Optional[str] = Query(None, alias="agentId"),
    region:          Optional[str] = Query(None),
    payment_type:    Optional[str] = Query(None, alias="paymentType"),
    delivery_man_id: Optional[str] = Query(None, alias="deliveryManId"),
    limit:           int           = Query(20, ge=1, le=50),
    status:          Optional[str] = Query(None),
):
    """Top-N clients by total sum."""
    return await analytics.get_clients(
        date_from, date_to, _ints(agent_id), _strs(region), _strs(payment_type), _ints(delivery_man_id), limit, _strs(status)
    )


@app.get("/api/charts-extended")
async def charts_extended(
    date_from: str           = Query(_today(), alias="dateFrom"),
    date_to:   str           = Query(_today(), alias="dateTo"),
    status:    Optional[str] = Query(None),
):
    """Weekday distribution + market type breakdown."""
    return await analytics.get_charts_extended(date_from, date_to, _strs(status))


@app.get("/api/deliveries-extended")
async def deliveries_extended(
    date_from:    str           = Query(_today(), alias="dateFrom"),
    date_to:      str           = Query(_today(), alias="dateTo"),
    agent_id:     Optional[str] = Query(None, alias="agentId"),
    region:       Optional[str] = Query(None),
    payment_type: Optional[str] = Query(None, alias="paymentType"),
    status:       Optional[str] = Query(None),
    limit:        int           = Query(30, ge=1, le=100),
):
    """Full delivery men list with weight and zone stats."""
    return await analytics.get_deliveries_extended(
        date_from, date_to, _ints(agent_id), _strs(region), _strs(payment_type), _strs(status), limit
    )


@app.get("/api/status-stats")
async def status_stats(
    date_from: str = Query(_today(), alias="dateFrom"),
    date_to:   str = Query(_today(), alias="dateTo"),
):
    """Order count breakdown by status (excluding status=4 Returned)."""
    return await analytics.get_status_stats(date_from, date_to)


@app.get("/api/filters")
async def filter_options(
    date_from: str = Query(_today(), alias="dateFrom"),
    date_to:   str = Query(_today(), alias="dateTo"),
):
    """Available filter values for the current period."""
    return await analytics.get_filter_options(date_from, date_to)


# ─── Orders (paginated raw list for Orders page) ─────────────────────────────

@app.get("/api/orders")
async def get_orders(
    date_from:  Optional[str] = Query(None, alias="dateFrom"),
    date_to:    Optional[str] = Query(None, alias="dateTo"),
    date_field: str           = Query("created_date", alias="dateField"),
    page:       int           = Query(1, ge=1),
    page_size:  int           = Query(50, ge=1, le=200, alias="pageSize"),
    search:     Optional[str] = Query(None),
):
    """Paginated raw orders for the Orders table page."""
    return await db.query_orders(
        date_from=date_from,
        date_to=date_to,
        date_field=date_field,
        page=page,
        page_size=page_size,
        search=search,
    )


# ─── Sync ─────────────────────────────────────────────────────────────────────

@app.get("/api/sync/status")
async def sync_status():
    return await db.get_sync_stats()



# ─── Data Management ──────────────────────────────────────────────────────────

@app.get("/api/data/status")
async def data_status():
    """Database status: total orders, date range, table size."""
    return await db.get_data_status()


@app.post("/api/data/load", dependencies=[Depends(prognoz.admin)])
async def data_load(
    date_from:       str = Query(...,    alias="dateFrom"),
    date_to:         str = Query(...,    alias="dateTo"),
    date_field:      str = Query("created_date", alias="dateField"),
    exclude_statuses: str = Query("4",  alias="excludeStatuses"),
):
    """Manually trigger sync for a specific date range.
    excludeStatuses: comma-separated status values to skip (default: '4' = Qaytarilgan)
    """
    _validate_date(date_from, "dateFrom")
    _validate_date(date_to, "dateTo")
    global active_load_task
    async with _load_lock:
        if active_load_task and not active_load_task.done():
            return {"status": "already_running"}
        skip = [s.strip() for s in exclude_statuses.split(",") if s.strip()] if exclude_statuses else []
        active_load_task = asyncio.create_task(
            syncer.sync_range(date_from, date_to, date_field, on_sync_done, exclude_statuses=skip)
        )
    return {"status": "started", "date_from": date_from, "date_to": date_to, "date_field": date_field}


@app.post("/api/data/stop", dependencies=[Depends(prognoz.admin)])
async def data_stop():
    """Cancel the currently running sync task."""
    global active_load_task
    if active_load_task and not active_load_task.done():
        active_load_task.cancel()
        return {"status": "stopping"}
    return {"status": "no_active_sync"}


@app.post("/api/data/stop/{log_id}", dependencies=[Depends(prognoz.admin)])
async def data_stop_log(log_id: int):
    """Force-cancel a specific running log entry (e.g. orphaned from previous run)."""
    await db.cancel_sync_log(log_id)
    return {"status": "cancelled", "log_id": log_id}


@app.post("/api/data/cleanup", dependencies=[Depends(prognoz.admin)])
async def data_cleanup(
    before_date: str = Query(..., alias="beforeDate"),
):
    """Delete orders older than beforeDate, then refresh views."""
    deleted = await db.cleanup_orders(before_date)
    if deleted > 0:
        try:
            await analytics.refresh_views()
        except Exception as e:
            logger.warning(f"View refresh after cleanup failed: {e}")
    return {"deleted": deleted, "before_date": before_date}


@app.post("/api/data/refresh-views", dependencies=[Depends(prognoz.admin)])
async def data_refresh_views():
    """Manually refresh all materialized views."""
    await analytics.refresh_views()
    return {"status": "refreshed"}


@app.get("/api/data/logs")
async def data_logs(limit: int = Query(30, ge=1, le=500)):
    return await db.get_sync_logs(limit)


@app.delete("/api/data/logs/{log_id}", dependencies=[Depends(prognoz.admin)])
async def delete_log(log_id: int):
    await db.delete_sync_log(log_id)
    return {"deleted": log_id}


@app.delete("/api/data/logs", dependencies=[Depends(prognoz.admin)])
async def delete_all_logs():
    count = await db.delete_all_sync_logs()
    return {"deleted": count}


@app.get("/api/data/autosync")
async def data_autosync_status():
    """Is today's 5-min auto-sync loop running?"""
    running = sync_task is not None and not sync_task.done()
    today_count = await db.count_orders_for_date(_today())
    return {"running": running, "today": _today(), "today_count": today_count}


@app.delete("/api/data/range", dependencies=[Depends(prognoz.admin)])
async def data_delete_range(
    date_from:  str = Query(..., alias="dateFrom"),
    date_to:    str = Query(..., alias="dateTo"),
    date_field: str = Query("created_date", alias="dateField"),
):
    """Delete orders within a date range. Stops auto-sync if today's data is removed."""
    global sync_task
    deleted = await db.delete_range(date_from, date_to, date_field)
    # Stop auto-sync if today's data was wiped
    if date_field == 'created_date' and date_from <= _today() <= date_to:
        today_count = await db.count_orders_for_date(_today())
        if today_count == 0 and sync_task and not sync_task.done():
            sync_task.cancel()
            sync_task = None
            logger.info("Auto-sync stopped: today data deleted")
    if deleted > 0:
        try: await analytics.refresh_views()
        except Exception as e: logger.warning(f"View refresh failed: {e}")
    return {"deleted": deleted, "date_from": date_from, "date_to": date_to}


@app.delete("/api/data/all", dependencies=[Depends(prognoz.admin)])
async def data_delete_all(confirm: str = Query("")):
    """Delete ALL orders. Requires confirm=yes. Stops auto-sync."""
    global sync_task
    if confirm != "yes":
        raise HTTPException(status_code=400, detail="confirm=yes parametri talab etiladi")
    if sync_task and not sync_task.done():
        sync_task.cancel()
        sync_task = None
    deleted = await db.delete_all_orders()
    logger.info(f"All orders deleted: {deleted} rows")
    return {"deleted": deleted}


@app.get("/api/data/duplicates")
async def data_duplicates():
    return await db.get_duplicate_stats()


@app.post("/api/data/duplicates/clean", dependencies=[Depends(prognoz.admin)])
async def data_clean_duplicates():
    cleaned = await db.clean_duplicates()
    if cleaned > 0:
        try: await analytics.refresh_views()
        except Exception as e: logger.warning(f"View refresh failed: {e}")
    return {"cleaned": cleaned}


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    stats = await db.get_sync_stats()
    return {"status": "ok", "ws_clients": len(manager.clients), **stats}


# ─── WebSocket ────────────────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        stats = await db.get_sync_stats()
        await websocket.send_text(json.dumps({"type": "connected", "stats": stats}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

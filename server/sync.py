"""
Sync orders from devessi.ritm.uz API into PostgreSQL.
Strategy:
  - Startup: sync last 36 hours (catch yesterday's pending orders)
  - Background loop: sync TODAY only, every 5 minutes
  - Historical data: manual trigger only via /api/data/load
"""

import asyncio
import httpx
import logging
from datetime import datetime
from typing import Callable, Awaitable

logger = logging.getLogger("sync")

import os
API_BASE  = "https://devessi.ritm.uz/ru/api/v1"
API_TOKEN = os.getenv("RITM_API_TOKEN", "")
HEADERS   = {"Authorization": API_TOKEN}
PAGE_SIZE    = 200
SYNC_INTERVAL = 5 * 60    # 5 minutes — today only
HTTP_TIMEOUT  = 60         # seconds per request

OnSyncDone = Callable[[int], Awaitable[None]] | None


async def _fetch_page(client: httpx.AsyncClient, page: int, params: dict, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            resp = await client.get(
                f"{API_BASE}/sales/order/",
                params={**params, "page": page, "page_size": PAGE_SIZE},
                headers=HEADERS,
                timeout=HTTP_TIMEOUT,
            )
            resp.raise_for_status()
            return resp.json()
        except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
            if attempt == retries - 1:
                raise
            wait = 5 * (attempt + 1)
            logger.warning(f"  page {page} attempt {attempt+1} failed ({type(e).__name__}), retry in {wait}s")
            await asyncio.sleep(wait)
    raise RuntimeError("unreachable")


async def sync_range(
    date_from: str,
    date_to: str,
    date_field: str = "created_date",
    on_done: OnSyncDone = None,
    exclude_statuses: list[str] | None = None,
) -> int:
    """Fetch orders page-by-page. New orders inserted, changed orders updated,
    unchanged existing orders skipped entirely (no DB write)."""
    from db import upsert_orders, add_sync_log, finish_sync_log, update_sync_log_progress

    log_id = await add_sync_log(date_from, date_to, date_field)

    # RITM API uses begin_date/end_date for created_date range.
    # For date_delivery, use the delivery-specific params.
    if date_field == "created_date":
        params = {"begin_date": date_from, "end_date": date_to, "exclude_cancelled": "True"}
    else:
        params = {
            f"{date_field}__gte": date_from,
            f"{date_field}__lte": date_to,
            "exclude_cancelled": "True",
        }

    total_new  = 0
    total_skip = 0
    page = 1
    empty_pages = 0

    logger.info(f"Sync start: {date_field} [{date_from} → {date_to}]")

    try:
        async with httpx.AsyncClient() as client:
            while True:
                try:
                    data = await _fetch_page(client, page, params)
                except Exception as e:
                    logger.error(f"Sync stopped at page {page}: {type(e).__name__}: {e}")
                    break

                results = data.get("results", [])

                if exclude_statuses:
                    results = [o for o in results if str(o.get("status", "")) not in exclude_statuses]

                if results:
                    new, skip = await upsert_orders(results)
                    total_new  += new
                    total_skip += skip
                    empty_pages = 0
                else:
                    empty_pages += 1
                    if empty_pages >= 3:
                        logger.info(f"  3 ta bo'sh sahifa — to'xtatildi (page {page})")
                        break

                if page % 5 == 0:
                    logger.info(f"  page {page}: +{total_new} new, {total_skip} skipped")
                    await update_sync_log_progress(log_id, total_new)

                if not data.get("next"):
                    break
                page += 1

        logger.info(
            f"Sync done [{date_from}→{date_to}]: "
            f"{total_new} new/changed, {total_skip} skipped"
        )
        await finish_sync_log(log_id, total_new, 'success', skipped=total_skip)
        if on_done and total_new > 0:
            await on_done(total_new)
    except asyncio.CancelledError:
        logger.info(f"Sync cancelled at page {page}: {total_new} saved, {total_skip} skipped")
        await finish_sync_log(log_id, total_new, 'cancelled', skipped=total_skip)
        raise
    except Exception as e:
        logger.error(f"Sync failed: {type(e).__name__}: {e}")
        await finish_sync_log(log_id, total_new, 'error', str(e), skipped=total_skip)
        raise

    return total_new


async def initial_sync(on_done: OnSyncDone = None):
    today = datetime.now().strftime("%Y-%m-%d")
    logger.info(f"Initial sync: today only ({today})")
    await sync_range(today, today, "created_date", on_done)


async def sync_loop(on_done: OnSyncDone = None):
    """Background: sync TODAY only every 5 minutes. Historical data is manual-only."""
    while True:
        await asyncio.sleep(SYNC_INTERVAL)
        today = datetime.now().strftime("%Y-%m-%d")
        logger.info(f"Auto-sync: today ({today})")
        await sync_range(today, today, "created_date", on_done)

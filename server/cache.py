"""
Simple in-memory TTL cache for analytics query results.
Reduces PostgreSQL load when multiple requests hit the same endpoint within the TTL window.
"""

import time
from typing import Any


class TTLCache:
    def __init__(self, ttl: int = 30):
        self._store: dict[str, tuple[float, Any]] = {}
        self._ttl = ttl

    def get(self, key: str) -> Any:
        entry = self._store.get(key)
        if entry is None:
            return None
        ts, val = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        return val

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (time.monotonic(), value)

    def invalidate_prefix(self, prefix: str = '') -> int:
        if not prefix:
            n = len(self._store)
            self._store.clear()
            return n
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]
        return len(keys)

    def size(self) -> int:
        return len(self._store)


# Shared instance — TTL 30 seconds for analytics data
analytics_cache = TTLCache(ttl=30)

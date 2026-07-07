-- =============================================================================
-- ESSI Sales Command Center — PostgreSQL Analytics Layer
-- =============================================================================

-- ─── Performance Indexes ─────────────────────────────────────────────────────

-- idx_orders_cache_created_date already covers TIMESTAMPTZ range scans
-- (TIMESTAMPTZ::date cast is not IMMUTABLE, so no functional index possible)

CREATE INDEX IF NOT EXISTS idx_oc_created_user
    ON orders_cache (created_date, user_id);

CREATE INDEX IF NOT EXISTS idx_oc_created_border
    ON orders_cache (created_date, market_border);

CREATE INDEX IF NOT EXISTS idx_oc_created_payment
    ON orders_cache (created_date, payment_type);

CREATE INDEX IF NOT EXISTS idx_oc_created_delivery_man
    ON orders_cache (created_date, delivery_man_id);

CREATE INDEX IF NOT EXISTS idx_oc_client_id
    ON orders_cache (client_id);

CREATE INDEX IF NOT EXISTS idx_oc_active
    ON orders_cache (created_date)
    WHERE status != '4';

-- ─── Materialized View: Daily Aggregates ─────────────────────────────────────
-- Refreshed after each sync. Used for monthly/weekly charts.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_totals AS
SELECT
    created_date::date              AS day,
    COUNT(*)                        AS order_count,
    COALESCE(SUM(fact_price), 0)   AS total_sum,
    ROUND(AVG(fact_price)::numeric, 2) AS avg_check,
    COUNT(DISTINCT user_id)         AS active_agents,
    COUNT(DISTINCT delivery_man_id) AS active_deliveries
FROM orders_cache
WHERE status != '4'
GROUP BY created_date::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_day ON mv_daily_totals (day);

-- ─── Analytics Functions ──────────────────────────────────────────────────────
-- All filter params use arrays so callers can pass multiple values.
-- Pass NULL to skip a filter, pass an array to restrict to those values.

-- Drop all overloads of analytics functions (handles multiple signatures cleanly).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = ANY(ARRAY[
      'fn_kpis','fn_agent_stats','fn_delivery_stats','fn_hourly_stats',
      'fn_daily_stats','fn_regional_stats','fn_client_stats','fn_payment_stats',
      'fn_weekday_stats','fn_market_type_stats','fn_delivery_extended'
    ])
    AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END $$;

-- ─── KPI Summary ─────────────────────────────────────────────────────────────
CREATE FUNCTION fn_kpis(
    p_from DATE, p_to DATE,
    p_user_ids      INT[]   DEFAULT NULL,
    p_borders       TEXT[]  DEFAULT NULL,
    p_payment_types TEXT[]  DEFAULT NULL,
    p_delivery_ids  INT[]   DEFAULT NULL,
    p_statuses      TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
    total_orders      BIGINT,
    total_sum         NUMERIC,
    avg_check         NUMERIC,
    active_agents     BIGINT,
    active_deliveries BIGINT,
    delivered_orders  BIGINT,
    pending_orders    BIGINT,
    cancelled_orders  BIGINT,
    delivery_rate     NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    COUNT(*)                                          AS total_orders,
    COALESCE(SUM(fact_price), 0)                     AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2)  AS avg_check,
    COUNT(DISTINCT user_id)                           AS active_agents,
    COUNT(DISTINCT delivery_man_id)                   AS active_deliveries,
    SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END)    AS delivered_orders,
    SUM(CASE WHEN status NOT IN ('4','5','6') THEN 1 ELSE 0 END) AS pending_orders,
    SUM(CASE WHEN status = '6' THEN 1 ELSE 0 END)    AS cancelled_orders,
    ROUND(
        CASE WHEN COUNT(*) > 0
             THEN SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
             ELSE 0 END::numeric, 1
    )                                                 AS delivery_rate
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND (p_user_ids      IS NULL OR user_id         = ANY(p_user_ids))
  AND (p_borders       IS NULL OR market_border   = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type    = ANY(p_payment_types))
  AND (p_delivery_ids  IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses      IS NULL OR status          = ANY(p_statuses));
$$;

-- ─── Agent Rankings ───────────────────────────────────────────────────────────
CREATE FUNCTION fn_agent_stats(
    p_from DATE, p_to DATE,
    p_borders       TEXT[]  DEFAULT NULL,
    p_payment_types TEXT[]  DEFAULT NULL,
    p_delivery_ids  INT[]   DEFAULT NULL,
    p_statuses      TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
    user_id         INT,
    user_name       TEXT,
    order_count     BIGINT,
    total_sum       NUMERIC,
    avg_check       NUMERIC,
    client_count    BIGINT,
    share_pct       NUMERIC,
    daily_rank      BIGINT,
    delivered_count BIGINT,
    pending_count   BIGINT,
    total_weight    NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    user_id,
    user_name,
    COUNT(*)                                              AS order_count,
    COALESCE(SUM(fact_price), 0)                         AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2)      AS avg_check,
    COUNT(DISTINCT client_id)                             AS client_count,
    ROUND(
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0)::numeric, 2
    )                                                     AS share_pct,
    RANK() OVER (ORDER BY COUNT(*) DESC)                  AS daily_rank,
    SUM(CASE WHEN status = '5' THEN 1 ELSE 0 END)        AS delivered_count,
    SUM(CASE WHEN status != '5' THEN 1 ELSE 0 END)       AS pending_count,
    ROUND(COALESCE(SUM(total_weight), 0)::numeric, 1)    AS total_weight
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND user_name IS NOT NULL AND user_name != ''
  AND (p_borders       IS NULL OR market_border   = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type    = ANY(p_payment_types))
  AND (p_delivery_ids  IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses      IS NULL OR status          = ANY(p_statuses))
GROUP BY user_id, user_name
ORDER BY order_count DESC;
$$;

-- ─── Delivery Rankings ────────────────────────────────────────────────────────
CREATE FUNCTION fn_delivery_stats(
    p_from DATE, p_to DATE,
    p_user_ids      INT[]  DEFAULT NULL,
    p_borders       TEXT[] DEFAULT NULL,
    p_payment_types TEXT[] DEFAULT NULL,
    p_statuses      TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    delivery_man_id   INT,
    delivery_man_name TEXT,
    order_count       BIGINT,
    total_sum         NUMERIC,
    avg_order_sum     NUMERIC,
    rank              BIGINT
) LANGUAGE SQL STABLE AS $$
SELECT
    delivery_man_id,
    delivery_man_name,
    COUNT(*)                                          AS order_count,
    COALESCE(SUM(fact_price), 0)                     AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2)  AS avg_order_sum,
    RANK() OVER (ORDER BY COUNT(*) DESC)              AS rank
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND delivery_man_id IS NOT NULL
  AND delivery_man_name IS NOT NULL AND delivery_man_name != ''
  AND (p_user_ids      IS NULL OR user_id       = ANY(p_user_ids))
  AND (p_borders       IS NULL OR market_border = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type  = ANY(p_payment_types))
  AND (p_statuses      IS NULL OR status        = ANY(p_statuses))
GROUP BY delivery_man_id, delivery_man_name
ORDER BY order_count DESC;
$$;

-- ─── Hourly Distribution ─────────────────────────────────────────────────────
CREATE FUNCTION fn_hourly_stats(
    p_from DATE, p_to DATE,
    p_user_ids      INT[]  DEFAULT NULL,
    p_borders       TEXT[] DEFAULT NULL,
    p_payment_types TEXT[] DEFAULT NULL,
    p_delivery_ids  INT[]  DEFAULT NULL,
    p_statuses      TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    hour        INT,
    order_count BIGINT,
    total_sum   NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    EXTRACT(HOUR FROM created_date)::int   AS hour,
    COUNT(*)                               AS order_count,
    COALESCE(SUM(fact_price), 0)          AS total_sum
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND (p_user_ids      IS NULL OR user_id         = ANY(p_user_ids))
  AND (p_borders       IS NULL OR market_border   = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type    = ANY(p_payment_types))
  AND (p_delivery_ids  IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses      IS NULL OR status          = ANY(p_statuses))
GROUP BY EXTRACT(HOUR FROM created_date)::int
ORDER BY hour;
$$;

-- ─── Daily Chart Data ─────────────────────────────────────────────────────────
CREATE FUNCTION fn_daily_stats(
    p_from DATE, p_to DATE,
    p_user_ids      INT[]  DEFAULT NULL,
    p_borders       TEXT[] DEFAULT NULL,
    p_payment_types TEXT[] DEFAULT NULL,
    p_delivery_ids  INT[]  DEFAULT NULL,
    p_statuses      TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    day         DATE,
    order_count BIGINT,
    total_sum   NUMERIC,
    avg_check   NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    created_date::date                                  AS day,
    COUNT(*)                                            AS order_count,
    COALESCE(SUM(fact_price), 0)                       AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2)    AS avg_check
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND (p_user_ids      IS NULL OR user_id         = ANY(p_user_ids))
  AND (p_borders       IS NULL OR market_border   = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type    = ANY(p_payment_types))
  AND (p_delivery_ids  IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses      IS NULL OR status          = ANY(p_statuses))
GROUP BY created_date::date
ORDER BY day;
$$;

-- ─── Regional Breakdown ──────────────────────────────────────────────────────
CREATE FUNCTION fn_regional_stats(
    p_from DATE, p_to DATE,
    p_user_ids      INT[]  DEFAULT NULL,
    p_payment_types TEXT[] DEFAULT NULL,
    p_delivery_ids  INT[]  DEFAULT NULL,
    p_statuses      TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    region      TEXT,
    order_count BIGINT,
    total_sum   NUMERIC,
    avg_check   NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    COALESCE(NULLIF(market_border, ''), 'Noma''lum')    AS region,
    COUNT(*)                                             AS order_count,
    COALESCE(SUM(fact_price), 0)                        AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2)     AS avg_check
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND (p_user_ids      IS NULL OR user_id         = ANY(p_user_ids))
  AND (p_payment_types IS NULL OR payment_type    = ANY(p_payment_types))
  AND (p_delivery_ids  IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses      IS NULL OR status          = ANY(p_statuses))
GROUP BY COALESCE(NULLIF(market_border, ''), 'Noma''lum')
ORDER BY order_count DESC;
$$;

-- ─── Top Clients ─────────────────────────────────────────────────────────────
CREATE FUNCTION fn_client_stats(
    p_from DATE, p_to DATE,
    p_user_ids      INT[]  DEFAULT NULL,
    p_borders       TEXT[] DEFAULT NULL,
    p_payment_types TEXT[] DEFAULT NULL,
    p_delivery_ids  INT[]  DEFAULT NULL,
    p_limit         INT    DEFAULT 20,
    p_statuses      TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    client_id   INT,
    client_name TEXT,
    order_count BIGINT,
    total_sum   NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    client_id,
    client_name,
    COUNT(*)                      AS order_count,
    COALESCE(SUM(fact_price), 0) AS total_sum
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND client_name IS NOT NULL AND client_name != ''
  AND (p_user_ids      IS NULL OR user_id         = ANY(p_user_ids))
  AND (p_borders       IS NULL OR market_border   = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type    = ANY(p_payment_types))
  AND (p_delivery_ids  IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses      IS NULL OR status          = ANY(p_statuses))
GROUP BY client_id, client_name
ORDER BY total_sum DESC
LIMIT p_limit;
$$;

-- ─── Payment Type Breakdown ───────────────────────────────────────────────────
CREATE FUNCTION fn_payment_stats(
    p_from DATE, p_to DATE,
    p_user_ids     INT[]  DEFAULT NULL,
    p_borders      TEXT[] DEFAULT NULL,
    p_delivery_ids INT[]  DEFAULT NULL,
    p_statuses     TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    payment_type TEXT,
    order_count  BIGINT,
    total_sum    NUMERIC,
    share_pct    NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    COALESCE(payment_type, 'other')                     AS payment_type,
    COUNT(*)                                             AS order_count,
    COALESCE(SUM(fact_price), 0)                        AS total_sum,
    ROUND(
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0)::numeric, 2
    )                                                    AS share_pct
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND (p_user_ids     IS NULL OR user_id         = ANY(p_user_ids))
  AND (p_borders      IS NULL OR market_border   = ANY(p_borders))
  AND (p_delivery_ids IS NULL OR delivery_man_id = ANY(p_delivery_ids))
  AND (p_statuses     IS NULL OR status          = ANY(p_statuses))
GROUP BY payment_type
ORDER BY order_count DESC;
$$;

-- ─── Live Orders ─────────────────────────────────────────────────────────────
-- (No function needed — direct query with LIMIT is fast enough)

-- ─── Filter Options ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_filter_agents(p_from DATE, p_to DATE)
RETURNS TABLE (user_id INT, user_name TEXT) LANGUAGE SQL STABLE AS $$
SELECT DISTINCT user_id, user_name
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND user_name IS NOT NULL AND user_name != ''
ORDER BY user_name;
$$;

CREATE OR REPLACE FUNCTION fn_filter_regions(p_from DATE, p_to DATE)
RETURNS TABLE (region TEXT) LANGUAGE SQL STABLE AS $$
SELECT DISTINCT market_border AS region
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND market_border IS NOT NULL AND market_border != ''
ORDER BY market_border;
$$;

CREATE OR REPLACE FUNCTION fn_filter_delivery_men(p_from DATE, p_to DATE)
RETURNS TABLE (delivery_man_id INT, delivery_man_name TEXT) LANGUAGE SQL STABLE AS $$
SELECT DISTINCT delivery_man_id, delivery_man_name
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND delivery_man_id IS NOT NULL
  AND delivery_man_name IS NOT NULL AND delivery_man_name != ''
ORDER BY delivery_man_name;
$$;

-- ─── Status Distribution ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_status_stats(p_from DATE, p_to DATE)
RETURNS TABLE (
    status      TEXT,
    order_count BIGINT,
    total_sum   NUMERIC,
    share_pct   NUMERIC
) LANGUAGE SQL STABLE AS $$
SELECT
    status,
    COUNT(*)                                              AS order_count,
    COALESCE(SUM(fact_price), 0)                         AS total_sum,
    ROUND(
        COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0)::numeric, 2
    )                                                     AS share_pct
FROM orders_cache
WHERE created_date::date BETWEEN p_from AND p_to
  AND status != '4'
GROUP BY status
ORDER BY order_count DESC;
$$;

-- ─── Weekday Distribution ────────────────────────────────────────────────────
CREATE FUNCTION fn_weekday_stats(
    p_from DATE, p_to DATE,
    p_statuses TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    weekday_num INT,
    order_count BIGINT,
    total_sum   NUMERIC,
    avg_check   NUMERIC,
    day_count   BIGINT
) LANGUAGE SQL STABLE AS $$
SELECT
    EXTRACT(ISODOW FROM created_date)::INT          AS weekday_num,
    COUNT(*)::BIGINT                                 AS order_count,
    COALESCE(SUM(fact_price), 0)                    AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2) AS avg_check,
    COUNT(DISTINCT created_date::date)::BIGINT       AS day_count
FROM orders_cache
WHERE status != '4'
  AND created_date::DATE BETWEEN p_from AND p_to
  AND (p_statuses IS NULL OR status = ANY(p_statuses))
GROUP BY weekday_num
ORDER BY weekday_num;
$$;

-- ─── Market Type Breakdown (via raw JSONB) ───────────────────────────────────
CREATE FUNCTION fn_market_type_stats(
    p_from DATE, p_to DATE,
    p_statuses TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    market_type TEXT,
    order_count BIGINT,
    total_sum   NUMERIC,
    share_pct   NUMERIC
) LANGUAGE SQL STABLE AS $$
WITH base AS (
    SELECT COALESCE(NULLIF(raw->'market'->'market_type'->>'name', ''), 'Noma''lum') AS mtype, fact_price
    FROM orders_cache
    WHERE status != '4' AND created_date::DATE BETWEEN p_from AND p_to
      AND (p_statuses IS NULL OR status = ANY(p_statuses))
),
agg AS (
    SELECT mtype AS market_type, COUNT(*)::BIGINT AS order_count, COALESCE(SUM(fact_price), 0) AS total_sum,
           ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS rn
    FROM base GROUP BY mtype
),
top7 AS (
    SELECT market_type, order_count, total_sum, FALSE AS is_other FROM agg WHERE rn <= 7
    UNION ALL
    SELECT 'Boshqa', SUM(order_count)::BIGINT, SUM(total_sum), TRUE
    FROM agg WHERE rn > 7 HAVING SUM(order_count) > 0
)
SELECT market_type, order_count, total_sum,
    ROUND(order_count * 100.0 / NULLIF(SUM(order_count) OVER(), 0)::numeric, 2) AS share_pct
FROM top7 ORDER BY is_other, order_count DESC;
$$;

-- ─── Extended Delivery Stats ─────────────────────────────────────────────────
CREATE FUNCTION fn_delivery_extended(
    p_from          DATE,
    p_to            DATE,
    p_user_ids      INT[]  DEFAULT NULL,
    p_borders       TEXT[] DEFAULT NULL,
    p_payment_types TEXT[] DEFAULT NULL,
    p_statuses      TEXT[] DEFAULT NULL,
    p_limit         INT    DEFAULT 30
)
RETURNS TABLE (
    delivery_man_id   INT,
    delivery_man_name TEXT,
    order_count       BIGINT,
    total_sum         NUMERIC,
    avg_order_sum     NUMERIC,
    total_weight      NUMERIC,
    region_count      BIGINT,
    rank              BIGINT
) LANGUAGE SQL STABLE AS $$
SELECT
    delivery_man_id,
    delivery_man_name,
    COUNT(*)::BIGINT                                      AS order_count,
    COALESCE(SUM(fact_price), 0)                         AS total_sum,
    ROUND(COALESCE(AVG(fact_price), 0)::numeric, 2)      AS avg_order_sum,
    ROUND(COALESCE(SUM(total_weight), 0)::numeric, 1)    AS total_weight,
    COUNT(DISTINCT market_border)::BIGINT                 AS region_count,
    RANK() OVER (ORDER BY COUNT(*) DESC)                  AS rank
FROM orders_cache
WHERE status != '4'
  AND created_date::date BETWEEN p_from AND p_to
  AND delivery_man_id IS NOT NULL
  AND delivery_man_name IS NOT NULL AND delivery_man_name != ''
  AND (p_user_ids      IS NULL OR user_id       = ANY(p_user_ids))
  AND (p_borders       IS NULL OR market_border = ANY(p_borders))
  AND (p_payment_types IS NULL OR payment_type  = ANY(p_payment_types))
  AND (p_statuses      IS NULL OR status        = ANY(p_statuses))
GROUP BY delivery_man_id, delivery_man_name
ORDER BY order_count DESC
LIMIT p_limit;
$$;

-- ─── Trigger: status=4 ni DB ga kirishidan to'sish ──────────────────────────

CREATE OR REPLACE FUNCTION fn_block_returned_orders()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = '4' THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_returned ON public.orders_cache;
DROP TRIGGER IF EXISTS trg_block_returned ON public.orders_cache;

CREATE TRIGGER trg_block_returned
    BEFORE INSERT OR UPDATE ON public.orders_cache
    FOR EACH ROW
    EXECUTE FUNCTION fn_block_returned_orders();

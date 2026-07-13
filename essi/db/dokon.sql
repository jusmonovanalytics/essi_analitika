-- ===========================================================================
-- DO'KON TURI BO'YICHA PROGNOZ
--
-- MUHIM: JAMI reja har doim mahsulot darajasidagi modeldan olinadi (WAPE 13.75%).
-- Do'kon turi faqat o'sha jamini BO'LADI — ya'ni jami hech qachon buzilmaydi.
-- Ishlab chiqarish qarori jami hajmga bog'liq, shuning uchun bu muhim.
--
-- Bo'lish uchun ULUSH kerak. Uchta usul (backtest, 36 origin, 720 mahsulot x tur):
--
--   taqsimot  25.51%  — so'nggi 24 ish kunidagi haqiqiy ulush
--   alohida   25.39%  — har mahsulot x tur uchun mustaqil model (trim24)
--   aralash   25.13%  — 50/50   <- eng yaxshi, standart
--
-- OGOHLANTIRISH: do'kon turi darajasida aniqlik ~25% — mahsulot darajasidagi
-- 13.75% dan deyarli IKKI BAROBAR yomon. Sabab: 54 mahsulot 720 ta katakka
-- bo'linadi, har biri kichik va shovqinli. Bu model kamchiligi emas, statistika.
-- Ishlab chiqarish qarorini JAMI hajmga qarab qabul qiling.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Kunlik seriya: mahsulot x do'kon turi (zich — sotilmagan kun = 0)
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_dokon_zich CASCADE;
CREATE MATERIALIZED VIEW mv_dokon_zich AS
WITH kunlar AS (SELECT DISTINCT sale_date FROM mv_talab),
juft AS (           -- faqat REJAGA kiradigan mahsulotlar
    SELECT DISTINCT f.product,
           COALESCE(NULLIF(TRIM(f.shop_type), ''), 'Noma''lum') AS shop_type,
           min(f.sale_date) OVER (PARTITION BY f.product,
               COALESCE(NULLIF(TRIM(f.shop_type), ''), 'Noma''lum')) AS birinchi
    FROM fakt_savdo f
    JOIN v_mahsulot_holati h ON h.product = f.product AND h.holat = 'tirik'
    WHERE f.product_type NOT IN ('Тара', 'Сырьё')
),
q AS (
    SELECT f.product,
           COALESCE(NULLIF(TRIM(f.shop_type), ''), 'Noma''lum') AS shop_type,
           f.sale_date, sum(f.qty)::numeric AS qty
    FROM fakt_savdo f
    WHERE f.product_type NOT IN ('Тара', 'Сырьё')
    GROUP BY 1, 2, 3
)
SELECT j.product, j.shop_type, k.sale_date, COALESCE(q.qty, 0)::numeric AS qty
FROM juft j
CROSS JOIN kunlar k
LEFT JOIN q ON q.product = j.product AND q.shop_type = j.shop_type
           AND q.sale_date = k.sale_date
WHERE k.sale_date >= j.birinchi;
CREATE UNIQUE INDEX ON mv_dokon_zich (product, shop_type, sale_date);
CREATE INDEX ON mv_dokon_zich (sale_date);

-- ---------------------------------------------------------------------------
-- ULUSHLAR — uchta usul bo'yicha. Har biri mahsulot ichida 1.0 ga yig'iladi,
-- shuning uchun JAMI reja hech qachon buzilmaydi.
-- ---------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_dokon_ulush CASCADE;
CREATE MATERIALIZED VIEW mv_dokon_ulush AS
WITH oxirgi AS (
    SELECT sale_date FROM (
        SELECT DISTINCT sale_date FROM mv_talab
        WHERE sale_date NOT IN (SELECT kun FROM kalendar)
        ORDER BY sale_date DESC LIMIT 24
    ) x
),
raqam AS (
    SELECT z.product, z.shop_type, z.qty,
           ROW_NUMBER() OVER (PARTITION BY z.product, z.shop_type
                              ORDER BY z.sale_date DESC) AS rn
    FROM mv_dokon_zich z
    WHERE z.sale_date NOT IN (SELECT kun FROM kalendar)
),
-- (a) TAQSIMOT: so'nggi 24 ish kunidagi haqiqiy hajm
xom AS (
    SELECT z.product, z.shop_type, sum(z.qty) AS q24
    FROM mv_dokon_zich z JOIN oxirgi o USING (sale_date)
    GROUP BY 1, 2
),
-- (b) ALOHIDA: har mahsulot x tur uchun chidamli daraja (trim24)
chek AS (
    SELECT product, shop_type,
           PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY qty) AS lo,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY qty) AS hi
    FROM raqam WHERE rn <= 24 GROUP BY 1, 2
),
lvl AS (
    SELECT r.product, r.shop_type, avg(r.qty) AS daraja
    FROM raqam r JOIN chek c USING (product, shop_type)
    WHERE r.rn <= 24 AND r.qty BETWEEN c.lo AND c.hi
    GROUP BY 1, 2
),
birga AS (
    SELECT COALESCE(x.product, l.product)     AS product,
           COALESCE(x.shop_type, l.shop_type) AS shop_type,
           COALESCE(x.q24, 0)                 AS q24,
           COALESCE(l.daraja, 0)              AS daraja
    FROM xom x FULL JOIN lvl l USING (product, shop_type)
),
jami AS (
    SELECT product, sum(q24) AS t_q24, sum(daraja) AS t_daraja
    FROM birga GROUP BY 1
)
SELECT b.product,
       b.shop_type,
       b.q24                                                    AS oxirgi_24_kun,
       COALESCE(b.q24    / NULLIF(j.t_q24, 0),    0)::numeric(9,6) AS ulush_taqsimot,
       COALESCE(b.daraja / NULLIF(j.t_daraja, 0), 0)::numeric(9,6) AS ulush_alohida,
       (0.5 * COALESCE(b.q24    / NULLIF(j.t_q24, 0),    0)
      + 0.5 * COALESCE(b.daraja / NULLIF(j.t_daraja, 0), 0))::numeric(9,6) AS ulush_aralash
FROM birga b JOIN jami j USING (product)
WHERE j.t_q24 > 0 OR j.t_daraja > 0;
CREATE UNIQUE INDEX ON mv_dokon_ulush (product, shop_type);
CREATE INDEX ON mv_dokon_ulush (shop_type);

-- ---------------------------------------------------------------------------
-- fn_reja_dokon — joriy rejani do'kon turi bo'yicha bo'ladi
--   p_usul: 'aralash' (standart) | 'taqsimot' | 'alohida'
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_reja_dokon(text);
CREATE FUNCTION fn_reja_dokon(p_usul text DEFAULT 'aralash')
RETURNS TABLE (
    run_id       int,
    product_id   int,
    product      text,
    product_type text,
    shop_type    text,
    target_date  date,
    dow          int,
    step         int,
    qty          numeric,
    ulush        numeric
) AS $$
SELECT j.run_id, j.product_id, j.product, j.product_type,
       COALESCE(u.shop_type, 'Taqsimlanmagan') AS shop_type,
       j.target_date, j.dow, j.step,
       ROUND(j.qty * COALESCE(
           CASE p_usul
               WHEN 'taqsimot' THEN u.ulush_taqsimot
               WHEN 'alohida'  THEN u.ulush_alohida
               ELSE                 u.ulush_aralash
           END, 1.0), 1)                       AS qty,
       COALESCE(
           CASE p_usul
               WHEN 'taqsimot' THEN u.ulush_taqsimot
               WHEN 'alohida'  THEN u.ulush_alohida
               ELSE                 u.ulush_aralash
           END, 1.0)                           AS ulush
FROM v_joriy_reja j
LEFT JOIN mv_dokon_ulush u ON u.product = j.product;
$$ LANGUAGE sql STABLE;

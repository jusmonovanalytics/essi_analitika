-- ===========================================================================
-- ESSI PROGNOZ MODELI
--
--   Bashorat = DARAJA x MAVSUM x HAFTA-KUNI x USTAMA x KALIBROVKA
--
--   Backtest: WAPE 13.75%  (36 origin, out-of-sample)
--   Orakul chegarasi: 13.69%  -> model amaliy maksimumga yetgan
--
--   SINALGAN va RAD ETILGAN (hammasi xatoni oshirdi):
--       trend | kanal segmentatsiyasi (Хавас/Корзинка/ABC) | do'kon soni o'sishi
--       oy sanasi indeksi | bayram koeffitsienti
--       qisqa oynalar (3..21 kun) va ularning aralashmalari
--
--   psql -U postgres -d essi -f db/model.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- products ni fakt/yakuniy savdodan to'ldirish
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_products_sync() RETURNS int AS $$
DECLARE n int;
BEGIN
    INSERT INTO products (name, product_type)
    SELECT DISTINCT product, product_type FROM fakt_savdo WHERE product IS NOT NULL
    ON CONFLICT (name) DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;

    INSERT INTO products (name, product_type)
    SELECT DISTINCT product, product_type FROM yakuniy_savdo WHERE product IS NOT NULL
    ON CONFLICT (name) DO NOTHING;
    RETURN n;
END;
$$ LANGUAGE plpgsql;

-- Do'kon segmenti (tahlil uchun; modelga KIRMAYDI — backtest foyda bermadi)
CREATE OR REPLACE FUNCTION fn_segment(p_shop_type text) RETURNS text AS $$
    SELECT CASE p_shop_type
        WHEN 'Хавас'       THEN 'XAVAS'
        WHEN 'Халк ретейл' THEN 'HALK'
        WHEN 'Корзинка'    THEN 'KORZINKA'
        ELSE 'MAYDA'
    END;
$$ LANGUAGE sql IMMUTABLE;

-- ===========================================================================
-- 1) AGREGATLAR
-- ===========================================================================

-- TALAB: kun x mahsulot x segment  (fakt savdo)
--
-- Rejaga KIRMAYDI: Тара (yashik/bidon), Сырьё (xomashyo) — ishlab chiqarish
-- mahsuloti emas.
--
-- Мехрибон REJAGA KIRADI (2026-07-13 dan). Ilgari u chiqarib tashlangan edi
-- ("alohida liniyada rejalashtiriladi"), lekin bu qoida bekor qilindi.
-- Мехрибон hajmining 99.8% i Хавас ga ketadi (2 ta do'kon), kesimi 20.3%.
DROP MATERIALIZED VIEW IF EXISTS mv_talab CASCADE;
CREATE MATERIALIZED VIEW mv_talab AS
SELECT f.sale_date,
       f.product,
       f.product_type,
       fn_segment(f.shop_type)                 AS segment,
       EXTRACT(ISODOW FROM f.sale_date)::int   AS dow,
       EXTRACT(DAY   FROM f.sale_date)::int    AS dom,
       SUM(f.qty)::numeric                     AS qty,
       SUM(f.amount)                           AS amount
FROM fakt_savdo f
WHERE f.product_type NOT IN ('Тара', 'Сырьё')
GROUP BY 1, 2, 3, 4, 5, 6;
CREATE UNIQUE INDEX ON mv_talab (product, segment, sale_date);
CREATE INDEX ON mv_talab (sale_date);

-- SOTILGAN: kun x mahsulot  (yakuniy savdo) — kesim va tiriklik uchun
DROP MATERIALIZED VIEW IF EXISTS mv_sotilgan CASCADE;
CREATE MATERIALIZED VIEW mv_sotilgan AS
SELECT y.sale_date, y.product, SUM(y.qty)::numeric AS qty
FROM yakuniy_savdo y
WHERE y.product_type NOT IN ('Тара', 'Сырьё')
GROUP BY 1, 2;
CREATE UNIQUE INDEX ON mv_sotilgan (product, sale_date);
CREATE INDEX ON mv_sotilgan (sale_date);

-- ZICH SERIYA — sotilmagan kun = 0
--
-- MUHIM: mv_talab da faqat SOTILGAN kunlar bor. Nol kunlarni hisobga olmasa:
--   1) "oxirgi 24 kun" siyrak mahsulot uchun 48 kalendar kunni qamraydi ->
--      DARAJA sun'iy oshadi
--   2) mahsulot biror hafta kunida sotilmasa, dow indeksi uchun qator bo'lmaydi ->
--      o'sha kunga ARVOH reja tushadi
-- Masalan Кефир 3.2% (250 гр) faqat Du/Ch/Ju sotiladi.
DROP MATERIALIZED VIEW IF EXISTS mv_talab_zich CASCADE;
CREATE MATERIALIZED VIEW mv_talab_zich AS
WITH kunlar AS (
    SELECT DISTINCT sale_date, EXTRACT(ISODOW FROM sale_date)::int AS dow FROM mv_talab
),
chegara AS (SELECT product, min(sale_date) AS birinchi FROM mv_talab GROUP BY 1),
kun_qty AS (SELECT product, sale_date, sum(qty) AS qty FROM mv_talab GROUP BY 1, 2)
SELECT c.product, k.sale_date, k.dow, COALESCE(q.qty, 0)::numeric AS qty
FROM chegara c
CROSS JOIN kunlar k
LEFT JOIN kun_qty q ON q.product = c.product AND q.sale_date = k.sale_date
WHERE k.sale_date >= c.birinchi;
CREATE UNIQUE INDEX ON mv_talab_zich (product, sale_date);
CREATE INDEX ON mv_talab_zich (sale_date);

-- ===========================================================================
-- 2) MAVSUMIY INDEKS: mahsulot x oy
--
-- Bozor ULUSHI asosida -> biznesning umumiy pasayish trendidan xoli.
-- Kam kuzatuv -> 1.0 ga tortiladi (shrink k=24).
-- Amplituda < 0.45 -> mavsumiylik ISHLATILMAYDI (indeks = 1.0), chunki u shovqin.
-- ===========================================================================
DROP MATERIALIZED VIEW IF EXISTS mv_mavsum CASCADE;
CREATE MATERIALIZED VIEW mv_mavsum AS
WITH kun AS (
    SELECT s.sale_date, s.product, s.qty
    FROM mv_sotilgan s
    WHERE EXTRACT(ISODOW FROM s.sale_date) <> 7
      AND s.sale_date NOT IN (SELECT kun FROM kalendar)
),
bozor AS (SELECT sale_date, sum(qty) AS tot FROM kun GROUP BY 1),
ulush AS (
    SELECT k.product, EXTRACT(MONTH FROM k.sale_date)::int AS oy, k.qty / b.tot AS sh
    FROM kun k JOIN bozor b USING (sale_date) WHERE b.tot > 0
),
ort   AS (SELECT product, avg(sh) AS m, count(*) AS n FROM ulush GROUP BY 1),
oylik AS (SELECT product, oy, count(*) AS n, avg(sh) AS m FROM ulush GROUP BY 1, 2),
setka AS (                       -- har mahsulot uchun 12 oy (kuzatuvsiz oy -> 1.0)
    SELECT o.product, g.oy,
           COALESCE(l.n, 0)                    AS n,
           COALESCE(l.m / NULLIF(o.m, 0), 1.0) AS xom
    FROM ort o
    CROSS JOIN generate_series(1, 12) AS g(oy)
    LEFT JOIN oylik l ON l.product = o.product AND l.oy = g.oy
    WHERE o.n >= 90                            -- kamida 90 kunlik tarix
),
amp AS (
    SELECT product, max(xom) - min(xom) AS amplituda,
           count(*) FILTER (WHERE n > 0) AS oylar
    FROM setka GROUP BY 1
),
tortilgan AS (
    SELECT s.product, s.oy, 1 + (s.xom - 1) * (s.n::numeric / (s.n + 24)) AS ix
    FROM setka s JOIN amp a USING (product)
    WHERE a.amplituda >= 0.45 AND a.oylar >= 8      -- faqat MAVSUMIY mahsulotlar
),
norm AS (SELECT product, avg(ix) AS c FROM tortilgan GROUP BY 1)
SELECT t.product, t.oy, ROUND(t.ix / n.c, 4) AS ix
FROM tortilgan t JOIN norm n USING (product)
WHERE n.c > 0;
CREATE UNIQUE INDEX ON mv_mavsum (product, oy);

-- Kunlik mavsumiy koeffitsient — oy o'rtasidan oy o'rtasiga chiziqli
-- interpolyatsiya (oy chegarasida sakrash bo'lmasin).
CREATE OR REPLACE FUNCTION fn_mavsum(p_product text, p_kun date)
RETURNS numeric AS $$
DECLARE
    v_d int := EXTRACT(DAY   FROM p_kun)::int;
    v_m int := EXTRACT(MONTH FROM p_kun)::int;
    m1 int; m2 int; t numeric; i1 numeric; i2 numeric;
BEGIN
    IF v_d >= 15 THEN
        m1 := v_m;  m2 := (v_m % 12) + 1;  t := (v_d - 15) / 30.0;
    ELSE
        m1 := ((v_m - 2 + 12) % 12) + 1;  m2 := v_m;  t := (v_d + 15) / 30.0;
    END IF;
    SELECT ix INTO i1 FROM mv_mavsum WHERE product = p_product AND oy = m1;
    SELECT ix INTO i2 FROM mv_mavsum WHERE product = p_product AND oy = m2;
    IF i1 IS NULL OR i2 IS NULL THEN
        RETURN 1.0;                    -- mavsumiy emas -> tegmaymiz
    END IF;
    RETURN i1 * (1 - t) + i2 * t;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================================================================
-- 3) MAHSULOT HOLATI va USTAMA
-- ===========================================================================

-- tirik  = oxirgi 30 kunda yakuniy savdosi bor (ishlab chiqarilyapti)
-- olik   = buyurtma bor, lekin ishlab chiqarilmayapti -> rejaga KIRMAYDI
-- siyrak = 30 kundan kam tarix
CREATE OR REPLACE VIEW v_mahsulot_holati AS
WITH oxirgi AS (SELECT max(sale_date) AS d FROM mv_talab),
talab AS (
    SELECT product, product_type,
           sum(qty)                                                       AS talab_jami,
           sum(qty) FILTER (WHERE sale_date > (SELECT d - 30 FROM oxirgi)) AS talab_30k,
           count(DISTINCT sale_date)                                      AS kun_soni,
           max(sale_date)                                                 AS oxirgi_buyurtma
    FROM mv_talab GROUP BY 1, 2
),
sotilgan AS (
    SELECT s.product,
           sum(s.qty) FILTER (WHERE s.sale_date > (SELECT d - 30 FROM oxirgi)) AS sotilgan_30k,
           sum(s.qty) FILTER (WHERE s.sale_date >= (SELECT min(sale_date) FROM mv_talab))
                                                                          AS sotilgan_jami,
           max(s.sale_date) FILTER (WHERE s.qty > 0)                      AS oxirgi_sotuv
    FROM mv_sotilgan s GROUP BY 1
)
SELECT t.product, t.product_type, t.kun_soni,
       t.talab_jami, t.talab_30k,
       COALESCE(s.sotilgan_jami, 0) AS sotilgan_jami,
       COALESCE(s.sotilgan_30k, 0)  AS sotilgan_30k,
       s.oxirgi_sotuv,
       CASE WHEN t.talab_jami > 0
            THEN ROUND(100 * (t.talab_jami - COALESCE(s.sotilgan_jami, 0)) / t.talab_jami, 1)
       END AS kesim_pct,
       CASE
           WHEN COALESCE(s.sotilgan_30k, 0) <= 0 THEN 'olik'
           WHEN t.kun_soni < 30                  THEN 'siyrak'
           ELSE 'tirik'
       END AS holat
FROM talab t LEFT JOIN sotilgan s USING (product);

-- KESIM USTAMASI: ombor yetmagani uchun talab bo'g'ilgan -> ko'proq sotish mumkin.
-- Faqat TIRIK mahsulotga (o'likka ustama bersak, ishlab chiqarilmaydigan narsaga
-- reja tushib qolardi).
CREATE OR REPLACE VIEW v_ustama AS
SELECT h.product, h.kesim_pct,
       CASE
           WHEN h.holat <> 'tirik' THEN 1.00
           WHEN h.kesim_pct >= 20  THEN 1.15
           WHEN h.kesim_pct >= 10  THEN 1.10
           ELSE 1.00
       END AS ustama
FROM v_mahsulot_holati h;

-- MAHSULOT ANIQLIGI -> ishonch oralig'i.
-- Kichik hajmli mahsulot tabiatan shovqinli; bu model bilan tuzatilmaydi,
-- faqat KENG oraliq va zaxira bilan boshqariladi.
CREATE OR REPLACE VIEW v_mahsulot_aniqlik AS
WITH d AS (
    SELECT t.product, t.dow, sum(t.qty) AS q
    FROM mv_talab t
    JOIN v_mahsulot_holati h USING (product)
    WHERE h.holat = 'tirik' AND t.sale_date NOT IN (SELECT kun FROM kalendar)
    GROUP BY 1, 2, t.sale_date
),
dw AS (SELECT product, dow, avg(q) AS m FROM d GROUP BY 1, 2),
r  AS (SELECT d.product, d.q / NULLIF(dw.m, 0) AS rel FROM d JOIN dw USING (product, dow))
SELECT product,
       count(*)                                                    AS n_kun,
       ROUND((stddev_pop(rel) / NULLIF(avg(rel), 0))::numeric, 3)  AS cv,
       LEAST(0.50, GREATEST(0.05,
           ROUND((stddev_pop(rel) / NULLIF(avg(rel), 0) / sqrt(12))::numeric, 4)
       ))                                                          AS xato
FROM r GROUP BY 1;

-- ===========================================================================
-- 4) PROGNOZ
-- ===========================================================================
DROP FUNCTION IF EXISTS fn_prognoz(date, int, boolean, numeric);
DROP FUNCTION IF EXISTS fn_prognoz(date, int, boolean, numeric, date);
CREATE FUNCTION fn_prognoz(
    p_origin    date    DEFAULT NULL,   -- oxirgi ma'lum kun (NULL = eng so'nggi)
    p_gorizont  int     DEFAULT 12,     -- ish kuni (12 = 2 hafta)
    p_ustama    boolean DEFAULT TRUE,
    p_kalibr    numeric DEFAULT 1.03,   -- trim ning -2.8% qiyshiqligini qoplaydi
    p_boshlanish date   DEFAULT NULL    -- reja qaysi kundan boshlanadi
                                        -- (NULL = ma'lumotdan keyingi ish kuni)
)
RETURNS TABLE (
    product      text,
    product_type text,
    target_date  date,
    dow          int,
    step         int,
    qty          numeric,
    daraja       numeric,
    mavsum       numeric,
    dow_ix       numeric,
    ustama       numeric
) AS $$
WITH o AS (
    SELECT COALESCE(p_origin, (SELECT max(sale_date) FROM mv_talab)) AS d
),
-- tarix: tirik mahsulotlar, bayramsiz, mavsumiylikdan tozalangan, ZICH
tarix AS (
    SELECT z.product, h.product_type, z.sale_date, z.dow,
           z.qty / GREATEST(fn_mavsum(z.product, z.sale_date), 0.15) AS q
    FROM mv_talab_zich z
    JOIN v_mahsulot_holati h USING (product)
    WHERE h.holat = 'tirik'
      AND z.sale_date <= (SELECT d FROM o)
      AND z.sale_date NOT IN (SELECT kun FROM kalendar)
),
raqam AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY product ORDER BY sale_date DESC) AS rn
    FROM tarix
),
-- DARAJA: 10% chekka kesilgan o'rtacha, ikki oynada
chek24 AS (
    SELECT product,
           PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY q) AS lo,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY q) AS hi
    FROM raqam WHERE rn <= 24 GROUP BY 1
),
chek72 AS (
    SELECT product,
           PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY q) AS lo,
           PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY q) AS hi
    FROM raqam WHERE rn <= 72 GROUP BY 1
),
lvl AS (
    SELECT r.product,
           max(r.product_type) AS ptype,
           avg(r.q) FILTER (WHERE r.rn <= 24 AND r.q BETWEEN c24.lo AND c24.hi) AS yaqin,
           avg(r.q) FILTER (WHERE r.rn <= 72 AND r.q BETWEEN c72.lo AND c72.hi) AS uzoq
    FROM raqam r
    JOIN chek24 c24 USING (product)
    JOIN chek72 c72 USING (product)
    GROUP BY 1
),
-- TUR guruhining harakati: ko'p mahsulot ustida o'lchanadi -> ancha aniq
harakat AS (
    SELECT ptype,
           CASE WHEN sum(uzoq) > 0 THEN sum(yaqin) / sum(uzoq) ELSE 1.0 END AS k
    FROM lvl GROUP BY 1
),
daraja AS (
    SELECT l.product,
           CASE WHEN l.uzoq IS NULL OR l.uzoq <= 0 THEN l.yaqin
                ELSE 0.5 * l.yaqin + 0.5 * (l.uzoq * h.k) END AS lvl   -- ierarxik siqish
    FROM lvl l JOIN harakat h ON h.ptype = l.ptype
),
-- HAFTA-KUNI: nol kunlar ham kiradi -> mahsulot shanba sotilmasa, ix = 0.
-- Sum(dow_ix) = 12 gorizont bo'ylab, ya'ni JAMINI o'zgartirmaydi.
dow_ix AS (
    SELECT r.product, r.dow,
           avg(r.q) / NULLIF(avg(avg(r.q)) OVER (PARTITION BY r.product), 0) AS ix
    FROM raqam r WHERE r.rn <= 48 GROUP BY 1, 2
),
-- Reja qaysi kundan boshlanadi. Sukut bo'yicha — ma'lumotdan keyingi kun.
-- Boshqa sana berilsa (masalan keyingi dushanba), tarix baribir origin gacha
-- o'qiladi, faqat nishon kunlar suriladi: modelda trend yo'q, koeffitsientlar
-- nishon sanaga bog'lanadi.
kelajak AS (
    SELECT g::date AS target_date,
           EXTRACT(ISODOW FROM g)::int AS dow,
           ROW_NUMBER() OVER (ORDER BY g) AS step
    FROM o, generate_series(COALESCE(p_boshlanish, o.d + 1),
                            COALESCE(p_boshlanish, o.d + 1) + 45,
                            INTERVAL '1 day') g
    WHERE EXTRACT(ISODOW FROM g) <> 7
      AND g::date NOT IN (SELECT kun FROM kalendar WHERE turi = 'yopiq')
    LIMIT p_gorizont
)
SELECT h.product, h.product_type, k.target_date, k.dow, k.step::int,
       ROUND(GREATEST(
           d.lvl
           * fn_mavsum(h.product, k.target_date)
           * COALESCE(di.ix, 0.0)          -- kun yo'q -> reja ham yo'q (1.0 EMAS!)
           * CASE WHEN p_ustama THEN u.ustama ELSE 1.0 END
           * p_kalibr
       , 0), 1)                                        AS qty,
       ROUND(d.lvl, 1)                                 AS daraja,
       ROUND(fn_mavsum(h.product, k.target_date), 3)   AS mavsum,
       ROUND(COALESCE(di.ix, 0.0), 3)                  AS dow_ix,
       CASE WHEN p_ustama THEN u.ustama ELSE 1.0 END   AS ustama
FROM daraja d
JOIN v_mahsulot_holati h USING (product)
JOIN v_ustama u         USING (product)
CROSS JOIN kelajak k
LEFT JOIN dow_ix di ON di.product = h.product AND di.dow = k.dow
ORDER BY h.product, k.target_date;
$$ LANGUAGE sql STABLE;

-- Reja: mahsulot kesimida, hafta bo'yicha, ishonch oralig'i bilan
DROP FUNCTION IF EXISTS fn_reja(date, int, boolean, numeric);
DROP FUNCTION IF EXISTS fn_reja(date, int, boolean, numeric, date);
CREATE FUNCTION fn_reja(
    p_origin   date    DEFAULT NULL,
    p_gorizont int     DEFAULT 12,
    p_ustama   boolean DEFAULT TRUE,
    p_kalibr   numeric DEFAULT 1.03,
    p_boshlanish date  DEFAULT NULL
)
RETURNS TABLE (
    product text, product_type text, jami numeric,
    hafta_1 numeric, hafta_2 numeric, past numeric, yuqori numeric,
    ustama numeric, kesim_pct numeric, mavsumiy boolean
) AS $$
WITH f AS (SELECT * FROM fn_prognoz(p_origin, p_gorizont, p_ustama, p_kalibr,
                                    p_boshlanish))
SELECT f.product, f.product_type,
       ROUND(sum(f.qty)),
       ROUND(sum(f.qty) FILTER (WHERE f.step <= p_gorizont / 2)),
       ROUND(sum(f.qty) FILTER (WHERE f.step >  p_gorizont / 2)),
       ROUND(sum(f.qty) * (1 - COALESCE(a.xato, 0.20))),
       ROUND(sum(f.qty) * (1 + COALESCE(a.xato, 0.20))),
       max(f.ustama), max(h.kesim_pct),
       bool_or(m.product IS NOT NULL)
FROM f
JOIN v_mahsulot_holati h USING (product)
LEFT JOIN v_mahsulot_aniqlik a USING (product)
LEFT JOIN (SELECT DISTINCT product FROM mv_mavsum) m ON m.product = f.product
GROUP BY f.product, f.product_type, a.xato
ORDER BY 3 DESC;
$$ LANGUAGE sql STABLE;

-- ===========================================================================
-- 5) ARXIV — QO'LDA hisoblash
-- ===========================================================================
DROP FUNCTION IF EXISTS fn_reja_saqla(int, boolean, numeric, text);
DROP FUNCTION IF EXISTS fn_reja_saqla(int, boolean, numeric, text, date);
CREATE FUNCTION fn_reja_saqla(
    p_gorizont int     DEFAULT 12,
    p_ustama   boolean DEFAULT TRUE,
    p_kalibr   numeric DEFAULT 1.03,
    p_izoh     text    DEFAULT NULL,
    p_boshlanish date  DEFAULT NULL    -- NULL = ma'lumotdan keyingi ish kuni
) RETURNS integer AS $$
DECLARE
    v_run integer; v_last date;
    v_fq bigint; v_fk int; v_ff int; v_yq bigint; v_yk int;
    C_WAPE constant numeric := 13.75;   -- backtest: 36 origin, out-of-sample
BEGIN
    SELECT max(sale_date) INTO v_last FROM mv_talab;
    IF v_last IS NULL THEN
        RAISE EXCEPTION 'mv_talab bo''sh — avval fakt savdo yuklang.';
    END IF;
    IF p_boshlanish IS NOT NULL AND p_boshlanish <= v_last THEN
        RAISE EXCEPTION 'Boshlanish sanasi (%) ma''lumot oxiridan (%) keyin bo''lishi kerak — o''tgan kunga reja tuzilmaydi.',
                        p_boshlanish, v_last;
    END IF;
    SELECT count(*), count(DISTINCT sale_date), count(DISTINCT source_file)
      INTO v_fq, v_fk, v_ff FROM fakt_savdo;
    SELECT count(*), count(DISTINCT sale_date) INTO v_yq, v_yk FROM yakuniy_savdo;

    UPDATE reja_runs SET faol = FALSE WHERE faol;     -- eskisi ARXIVDA qoladi

    INSERT INTO reja_runs (data_last_day, gorizont, ustama, kalibr, n_mahsulot,
                           jami_qty, dan, gacha, fakt_qatorlar, fakt_kunlar,
                           fakt_fayllar, yak_qatorlar, yak_kunlar, wape, izoh)
    SELECT v_last, p_gorizont, p_ustama, p_kalibr,
           count(DISTINCT product), sum(qty), min(target_date), max(target_date),
           v_fq, v_fk, v_ff, v_yq, v_yk, C_WAPE, p_izoh
    FROM fn_prognoz(NULL, p_gorizont, p_ustama, p_kalibr, p_boshlanish)
    RETURNING run_id INTO v_run;

    INSERT INTO reja_daily (run_id, product_id, target_date, dow, step,
                            qty, qty_model, qty_past, qty_yuqori,
                            daraja, mavsum, dow_ix, ustama)
    SELECT v_run, pr.product_id, f.target_date, f.dow, f.step,
           f.qty, f.qty,                        -- yangi hisobda ikkalasi teng
           ROUND(f.qty * (1 - COALESCE(a.xato, 0.20)), 2),
           ROUND(f.qty * (1 + COALESCE(a.xato, 0.20)), 2),
           f.daraja, f.mavsum, f.dow_ix, f.ustama
    FROM fn_prognoz(NULL, p_gorizont, p_ustama, p_kalibr, p_boshlanish) f
    JOIN products pr ON pr.name = f.product
    LEFT JOIN v_mahsulot_aniqlik a ON a.product = f.product;

    RETURN v_run;
END;
$$ LANGUAGE plpgsql;

-- Arxivdagi eski rejaga qaytish
CREATE OR REPLACE FUNCTION fn_reja_faollashtir(p_run int) RETURNS text AS $$
DECLARE v text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM reja_runs WHERE run_id = p_run) THEN
        RAISE EXCEPTION 'run_id=% arxivda yo''q', p_run;
    END IF;
    UPDATE reja_runs SET faol = FALSE WHERE faol;
    UPDATE reja_runs SET faol = TRUE  WHERE run_id = p_run;
    SELECT format('run %s faollashtirildi: %s dona, %s .. %s (ma''lumot %s gacha)',
                  run_id, round(jami_qty), dan, gacha, data_last_day)
      INTO v FROM reja_runs WHERE run_id = p_run;
    RETURN v;
END;
$$ LANGUAGE plpgsql;

DROP VIEW IF EXISTS v_joriy_reja CASCADE;
CREATE VIEW v_joriy_reja AS
SELECT r.run_id, r.created_at, r.data_last_day, r.gorizont, r.ustama, r.kalibr,
       r.qolda, r.asos_run,
       p.product_id, p.name AS product, p.product_type,
       d.target_date, d.dow, d.step,
       d.qty, d.qty_model,
       (d.qty <> COALESCE(d.qty_model, d.qty))  AS ozgartirilgan,
       d.qty - COALESCE(d.qty_model, d.qty)     AS farq,
       d.qty_past, d.qty_yuqori, d.daraja, d.mavsum, d.dow_ix
FROM reja_runs r
JOIN reja_daily d USING (run_id)
JOIN products   p USING (product_id)
WHERE r.faol;

DROP VIEW IF EXISTS v_arxiv;
CREATE VIEW v_arxiv AS
SELECT r.run_id, r.created_at, r.faol, r.data_last_day, r.gorizont,
       r.ustama, r.kalibr, r.n_mahsulot, r.jami_qty, r.dan, r.gacha,
       r.fakt_kunlar, r.fakt_fayllar, r.yak_kunlar, r.wape,
       r.qolda, r.asos_run, r.izoh,
       (SELECT count(*) FROM reja_daily d
         WHERE d.run_id = r.run_id
           AND d.qty <> COALESCE(d.qty_model, d.qty))   AS ozgartirilgan_qator,
       r.jami_qty - LAG(r.jami_qty) OVER (ORDER BY r.run_id) AS farq_oldingidan
FROM reja_runs r ORDER BY r.run_id DESC;


-- ---------------------------------------------------------------------------
-- fn_reja_qolda — rejani QO'LDA tahrirlash
--
-- Arxiv o'zgarmas, shuning uchun tahrir eski runni O'ZGARTIRMAYDI —
-- undan YANGI versiya yaratiladi. Modelning asl qiymati (qty_model) saqlanadi,
-- shunda "nimani, qachon, qancha o'zgartirdik" savoli doim javobli.
--
--   p_ozgarishlar: [{"product_id":1,"target_date":"2026-07-13","qty":500}, ...]
--   p_asos       : qaysi rejadan (NULL = joriy faol)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_reja_qolda(
    p_ozgarishlar jsonb,
    p_asos        int  DEFAULT NULL,
    p_izoh        text DEFAULT NULL
) RETURNS integer AS $$
DECLARE
    v_asos int; v_run int; v_n int;
BEGIN
    v_asos := COALESCE(p_asos, (SELECT run_id FROM reja_runs WHERE faol
                                ORDER BY run_id DESC LIMIT 1));
    IF v_asos IS NULL THEN
        RAISE EXCEPTION 'Asos reja yo''q — avval prognozni hisoblang.';
    END IF;
    IF jsonb_typeof(p_ozgarishlar) <> 'array' OR jsonb_array_length(p_ozgarishlar) = 0 THEN
        RAISE EXCEPTION 'O''zgarishlar bo''sh.';
    END IF;

    CREATE TEMP TABLE _ozg ON COMMIT DROP AS
    SELECT (x->>'product_id')::int           AS product_id,
           (x->>'target_date')::date         AS target_date,
           GREATEST((x->>'qty')::numeric, 0) AS qty
    FROM jsonb_array_elements(p_ozgarishlar) x;

    SELECT count(*) INTO v_n FROM _ozg o
    WHERE NOT EXISTS (SELECT 1 FROM reja_daily d
                      WHERE d.run_id = v_asos
                        AND d.product_id = o.product_id
                        AND d.target_date = o.target_date);
    IF v_n > 0 THEN
        RAISE EXCEPTION '% ta o''zgarish asos rejada (run %) topilmadi', v_n, v_asos;
    END IF;

    UPDATE reja_runs SET faol = FALSE WHERE faol;      -- eskisi ARXIVDA qoladi

    INSERT INTO reja_runs (data_last_day, gorizont, ustama, kalibr, n_mahsulot,
                           jami_qty, dan, gacha, fakt_qatorlar, fakt_kunlar,
                           fakt_fayllar, yak_qatorlar, yak_kunlar, wape,
                           qolda, asos_run, izoh)
    SELECT r.data_last_day, r.gorizont, r.ustama, r.kalibr, r.n_mahsulot,
           (SELECT sum(COALESCE(o.qty, d.qty))
              FROM reja_daily d
              LEFT JOIN _ozg o ON o.product_id = d.product_id
                              AND o.target_date = d.target_date
             WHERE d.run_id = v_asos),
           r.dan, r.gacha, r.fakt_qatorlar, r.fakt_kunlar, r.fakt_fayllar,
           r.yak_qatorlar, r.yak_kunlar, r.wape,
           TRUE, v_asos,
           COALESCE(p_izoh, format('Qo''lda tahrir (run %s asosida)', v_asos))
    FROM reja_runs r WHERE r.run_id = v_asos
    RETURNING run_id INTO v_run;

    INSERT INTO reja_daily (run_id, product_id, target_date, dow, step,
                            qty, qty_model, qty_past, qty_yuqori,
                            daraja, mavsum, dow_ix, ustama)
    SELECT v_run, d.product_id, d.target_date, d.dow, d.step,
           COALESCE(o.qty, d.qty),              -- yakuniy qiymat
           COALESCE(d.qty_model, d.qty),        -- modelning ASL qiymati saqlanadi
           d.qty_past, d.qty_yuqori,
           d.daraja, d.mavsum, d.dow_ix, d.ustama
    FROM reja_daily d
    LEFT JOIN _ozg o ON o.product_id = d.product_id AND o.target_date = d.target_date
    WHERE d.run_id = v_asos;

    RETURN v_run;
END;
$$ LANGUAGE plpgsql;


-- ===========================================================================
-- 6) KESIM — yo'qotilgan savdo
--
-- DIQQAT: mahsulot butunlay kesilgan kun (yakuniyda qator YO'Q) ham hisobga
-- olinishi SHART. Aks holda eng katta kesimlar sanalmay qoladi.
-- ===========================================================================
CREATE OR REPLACE VIEW v_kesim AS
WITH yak_kunlar AS (SELECT DISTINCT sale_date FROM mv_sotilgan)
SELECT t.sale_date, t.product,
       sum(t.qty)                           AS talab,
       COALESCE(max(s.qty), 0)              AS sotilgan,
       sum(t.qty) - COALESCE(max(s.qty), 0) AS kesim
FROM mv_talab t
JOIN yak_kunlar yk ON yk.sale_date = t.sale_date
LEFT JOIN mv_sotilgan s ON s.product = t.product AND s.sale_date = t.sale_date
GROUP BY 1, 2;

-- Sayt uchun yordamchi ko'rinishlar
CREATE OR REPLACE VIEW v_kunlik_jami AS
SELECT t.sale_date, EXTRACT(ISODOW FROM t.sale_date)::int AS dow,
       sum(t.qty) AS qty, sum(t.amount) AS amount
FROM mv_talab t GROUP BY 1, 2;

CREATE OR REPLACE VIEW v_kunlar AS
SELECT f.sale_date,
       min(f.source_file)         AS source_file,
       count(*)                   AS qatorlar,
       sum(f.qty)                 AS qty,
       sum(f.amount)              AS amount,
       count(DISTINCT f.order_no) AS buyurtma,
       count(DISTINCT f.shop_no)  AS dokon,
       min(f.loaded_at)           AS loaded_at
FROM fakt_savdo f GROUP BY 1;

SELECT fn_products_sync();

-- ===========================================================================
-- ESSI — baza sxemasi (jadvallar)
--
--   psql -U postgres -c "CREATE DATABASE essi ENCODING 'UTF8' TEMPLATE template0"
--   psql -U postgres -d essi -f db/schema.sql
--   psql -U postgres -d essi -f db/model.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- TALAB — kunlik Excel hisobotlar (fakt savdo)
-- Mijoz nima SO'RAGAN. Har fayl bitta kun.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fakt_savdo (
    id            BIGSERIAL PRIMARY KEY,
    sale_date     DATE          NOT NULL,   -- По дням
    agent         TEXT,                     -- Ответственный агент магазина
    orderer       TEXT,                     -- Заказ оформил
    courier       TEXT,                     -- Доставщик
    zone          TEXT,                     -- Зона
    shop_type     TEXT,                     -- Тип магазина
    shop_name     TEXT,                     -- Магазин
    shop_no       INTEGER,                  -- № Магазина
    product_type  TEXT,                     -- Тип продукта
    product       TEXT          NOT NULL,   -- Продукт
    order_no      INTEGER,                  -- № заказа
    pay_type      TEXT,                     -- Тип оплаты
    discount_pct  NUMERIC(6,2)  DEFAULT 0,  -- Процент скидки
    qty           INTEGER       NOT NULL,   -- Колв.продуктов БВ
    amount        NUMERIC(14,2) NOT NULL,   -- Общ.сумма БВ
    source_file   TEXT          NOT NULL,
    loaded_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fakt_date         ON fakt_savdo (sale_date);
CREATE INDEX IF NOT EXISTS idx_fakt_product_date ON fakt_savdo (product, sale_date);
CREATE INDEX IF NOT EXISTS idx_fakt_shop_date    ON fakt_savdo (shop_no, sale_date);
CREATE INDEX IF NOT EXISTS idx_fakt_order        ON fakt_savdo (order_no);

-- ---------------------------------------------------------------------------
-- SOTILGAN — haftalik Excel (yakuniy savdo)
-- Ombor yetmagani uchun KESILGANDAN KEYIN nima yetkazilgan.
-- Bir faylda bir necha kun bo'lishi mumkin.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS yakuniy_savdo (
    id            BIGSERIAL PRIMARY KEY,
    sale_date     DATE          NOT NULL,   -- По дням (HAQIQIY kunlik sana)
    week_range    TEXT          NOT NULL,   -- fayl nomidagi hafta oralig'i
    agent         TEXT,
    orderer       TEXT,
    courier       TEXT,
    zone          TEXT,
    shop_type     TEXT,
    shop_name     TEXT,
    shop_no       INTEGER,
    product_type  TEXT,
    product       TEXT          NOT NULL,
    order_no      INTEGER,
    pay_type      TEXT,
    discount_pct  NUMERIC(6,2)  DEFAULT 0,
    qty           NUMERIC(12,2) NOT NULL,   -- kasrli bo'lishi mumkin (og'irlik)
    amount        NUMERIC(16,2) NOT NULL,
    source_file   TEXT          NOT NULL,
    loaded_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_yak_date         ON yakuniy_savdo (sale_date);
CREATE INDEX IF NOT EXISTS idx_yak_product_date ON yakuniy_savdo (product, sale_date);
CREATE INDEX IF NOT EXISTS idx_yak_shop_date    ON yakuniy_savdo (shop_no, sale_date);
CREATE INDEX IF NOT EXISTS idx_yak_week         ON yakuniy_savdo (week_range);

-- ---------------------------------------------------------------------------
-- MAHSULOTLAR — barqaror ID (sayt uchun)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    product_id   SERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    product_type TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_type ON products (product_type);

-- ---------------------------------------------------------------------------
-- KALENDAR — bayramlar
--   yopiq      = savdo umuman yo'q (prognozdan chiqariladi)
--   tiklanish  = bayramdan keyingi past kun (~2 barobar past)
-- Ikkalasi ham DARAJANI hisoblashda chiqarib tashlanadi.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kalendar (
    kun   DATE PRIMARY KEY,
    nomi  TEXT NOT NULL,
    turi  TEXT NOT NULL CHECK (turi IN ('yopiq', 'tiklanish'))
);

INSERT INTO kalendar (kun, nomi, turi) VALUES
    ('2025-06-06', 'Qurbon hayiti',            'yopiq'),
    ('2025-09-01', 'Mustaqillik kuni',         'yopiq'),
    ('2025-10-01', 'Ustoz-murabbiylar kuni',   'yopiq'),
    ('2025-12-31', 'Yangi yil arafasi',        'yopiq'),
    ('2026-01-01', 'Yangi yil',                'yopiq'),
    ('2026-01-02', 'Yangi yil',                'yopiq'),
    ('2026-03-20', 'Ramazon hayiti',           'yopiq'),
    ('2026-03-21', 'Ramazon hayiti / Navruz',  'yopiq'),
    ('2026-05-27', 'Qurbon hayiti',            'yopiq'),
    ('2026-05-28', 'Qurbon hayiti',            'yopiq'),
    ('2025-12-29', 'Yangi yil arafasi',        'tiklanish'),
    ('2026-01-03', 'Yangi yildan keyin',       'tiklanish'),
    ('2026-01-05', 'Yangi yildan keyin',       'tiklanish'),
    ('2026-01-06', 'Yangi yildan keyin',       'tiklanish'),
    ('2026-01-07', 'Yangi yildan keyin',       'tiklanish'),
    ('2026-01-08', 'Yangi yildan keyin',       'tiklanish'),
    ('2026-03-09', '8-martdan keyin',          'tiklanish')
ON CONFLICT (kun) DO NOTHING;

-- ===========================================================================
-- PROGNOZ ARXIVI
--
-- QOIDALAR:
--   1. Yangi ma'lumot yuklanishi prognozni O'ZGARTIRMAYDI.
--   2. Qayta hisoblash faqat QO'LDA — fn_reja_saqla().
--   3. Arxiv O'ZGARMAS — o'chirib ham, tahrirlab ham bo'lmaydi (trigger himoyasi).
--      Yangi hisob eskisini almashtirmaydi, uning YONIGA qo'shiladi.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS reja_runs (
    run_id         SERIAL PRIMARY KEY,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    faol           BOOLEAN      NOT NULL DEFAULT TRUE,   -- joriy rejami?

    data_last_day  DATE         NOT NULL,   -- qaysi kungacha ma'lumotga asoslangan
    gorizont       INTEGER      NOT NULL,
    ustama         BOOLEAN      NOT NULL,
    kalibr         NUMERIC(6,4) NOT NULL,   -- ZAXIRA ustamasi (aniqlik vositasi EMAS)

    n_mahsulot     INTEGER      NOT NULL,
    jami_qty       NUMERIC(14,2) NOT NULL,
    dan            DATE         NOT NULL,
    gacha          DATE         NOT NULL,

    -- ma'lumot holati (audit: "nega bunday chiqqan?")
    fakt_qatorlar  BIGINT,
    fakt_kunlar    INTEGER,
    fakt_fayllar   INTEGER,
    yak_qatorlar   BIGINT,
    yak_kunlar     INTEGER,

    wape           NUMERIC(5,2),   -- modelning backtest aniqligi

    -- qo'lda tahrir: eski runni O'ZGARTIRMAYDI, undan yangi versiya yaratiladi
    qolda          BOOLEAN      NOT NULL DEFAULT FALSE,
    asos_run       INTEGER      REFERENCES reja_runs (run_id),

    izoh           TEXT
);
COMMENT ON COLUMN reja_runs.kalibr IS
  'ZAXIRA ustamasi. Aniqlikni YOMONLASHTIRADI (backtest: 14.49% -> 14.71% da 1.03), '
  'lekin sut mahsulotida kam ishlab chiqarish chiqindidan qimmatroq — bu biznes qarori.';
COMMENT ON COLUMN reja_runs.qolda    IS 'Qo''lda tahrirlangan versiyami?';
COMMENT ON COLUMN reja_runs.asos_run IS 'Qaysi rejadan nusxa olingan (qo''lda tahrir)';
CREATE INDEX IF NOT EXISTS idx_runs_faol ON reja_runs (faol) WHERE faol;
CREATE INDEX IF NOT EXISTS idx_runs_kun  ON reja_runs (created_at DESC);

COMMENT ON COLUMN reja_runs.wape IS
  'Backtest aniqligi (WAPE %, mahsulot x 12-kunlik jami). 36 origin, out-of-sample. '
  'Orakul chegarasi 13.69%.';

CREATE TABLE IF NOT EXISTS reja_daily (
    run_id       INTEGER  NOT NULL REFERENCES reja_runs (run_id) ON DELETE RESTRICT,
    product_id   INTEGER  NOT NULL REFERENCES products (product_id),
    target_date  DATE     NOT NULL,
    dow          SMALLINT NOT NULL,
    step         SMALLINT NOT NULL,
    qty          NUMERIC(12,2) NOT NULL,     -- YAKUNIY qiymat (qo'lda o'zgargan bo'lishi mumkin)
    qty_model    NUMERIC(12,2),              -- modelning ASL qiymati
    qty_past     NUMERIC(12,2) NOT NULL,     -- ishonch oralig'i (past)
    qty_yuqori   NUMERIC(12,2) NOT NULL,     -- ishonch oralig'i (yuqori)
    daraja       NUMERIC(12,2),
    mavsum       NUMERIC(6,3),
    dow_ix       NUMERIC(6,3),
    ustama       NUMERIC(5,2),
    PRIMARY KEY (run_id, product_id, target_date)
);
COMMENT ON COLUMN reja_daily.qty_model IS
  'Modelning asl qiymati. qty <> qty_model bo''lsa — qo''lda o''zgartirilgan.';
CREATE INDEX IF NOT EXISTS idx_rd_run  ON reja_daily (run_id);
CREATE INDEX IF NOT EXISTS idx_rd_prod ON reja_daily (product_id, target_date);

-- --- ARXIV HIMOYASI: o'chirib/tahrirlab bo'lmaydi ---------------------------
CREATE OR REPLACE FUNCTION fn_arxiv_himoya() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        'Prognoz arxivini o''chirib bo''lmaydi (run_id=%). Arxiv o''zgarmas.', OLD.run_id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_runs_no_delete ON reja_runs;
CREATE TRIGGER trg_runs_no_delete BEFORE DELETE ON reja_runs
    FOR EACH ROW EXECUTE FUNCTION fn_arxiv_himoya();

CREATE OR REPLACE FUNCTION fn_arxiv_himoya_daily() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Prognoz arxivi o''zgarmas — qatorni o''zgartirib/o''chirib bo''lmaydi.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_daily_no_change ON reja_daily;
CREATE TRIGGER trg_daily_no_change BEFORE UPDATE OR DELETE ON reja_daily
    FOR EACH ROW EXECUTE FUNCTION fn_arxiv_himoya_daily();

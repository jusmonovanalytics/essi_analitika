# ESSI — yangi kompyuterga o'rnatish

---

## 0. Nima kerak

| Dastur | Versiya |
|---|---|
| **PostgreSQL** | 15 yoki yuqori |
| **Python** | 3.10 yoki yuqori |

O'rnatishda PostgreSQL `postgres` foydalanuvchi uchun **parol** so'raydi — uni eslab qoling.

---

## 1. Kutubxonalar

```bash
python -m pip install -r requirements.txt
```

---

## 2. Bazani qurish

`psql` PATH da bo'lmasa, u odatda `C:\Program Files\PostgreSQL\17\bin` da.

```bash
psql -U postgres -c "CREATE DATABASE essi ENCODING 'UTF8' TEMPLATE template0"
psql -U postgres -d essi -f db/schema.sql    # jadvallar + arxiv
psql -U postgres -d essi -f db/model.sql     # model (view va funksiyalar)
```

`db/model.sql` ni istalgan vaqtda **qayta ishga tushirish xavfsiz** — u faqat
view/funksiyalarni qayta yaratadi, ma'lumotga va arxivga tegmaydi.

---

## 3. Parolni sozlash

Standart parol — `postgres123`. Boshqacha bo'lsa:

**PowerShell:**
```powershell
$env:ESSI_DSN = "host=localhost port=5432 dbname=essi user=postgres password=SIZNING_PAROL client_encoding=UTF8"
```

**CMD:**
```cmd
set ESSI_DSN=host=localhost port=5432 dbname=essi user=postgres password=SIZNING_PAROL client_encoding=UTF8
```

**Linux / macOS:**
```bash
export ESSI_DSN="host=localhost port=5432 dbname=essi user=postgres password=SIZNING_PAROL client_encoding=UTF8"
```

Doimiy qilish uchun Windows'da: *Tizim → Muhit o'zgaruvchilari*.

Excel papkalari boshqa joyda bo'lsa: `ESSI_DATA_DIR` (fakt savdo), `ESSI_YAK_DIR` (yakuniy savdo).

---

## 4. Ma'lumotni yuklash

```bash
python db/load_excel.py             # fakt savdo  (126 fayl, ~2 daqiqa)
python db/load_excel.py --yakuniy   # yakuniy savdo (75 fayl, ~6 daqiqa)
```

### Tekshirish

```bash
psql -U postgres -d essi -c "SELECT count(*), min(sale_date), max(sale_date) FROM fakt_savdo"
psql -U postgres -d essi -c "SELECT count(*), min(sale_date), max(sale_date) FROM yakuniy_savdo"
```

Kutilgan natija:

```
  724823 | 2026-02-10 | 2026-07-11     -- fakt_savdo
 2459767 | 2025-04-09 | 2026-07-11     -- yakuniy_savdo
```

---

## 5. Prognozni hisoblash

**Prognoz hech qachon avtomatik hisoblanmaydi.** Uni siz chaqirasiz:

```bash
psql -U postgres -d essi -c "SELECT fn_reja_saqla(12, TRUE, 1.03, 'birinchi hisob')"
```

| Parametr | Ma'nosi |
|---|---|
| `12` | gorizont — ish kuni (12 = 2 hafta, Du–Sha) |
| `TRUE` | kesim ustamasini qo'llash (×1.10 / ×1.15) |
| `1.03` | kalibrovka koeffitsienti |
| `'...'` | izoh — arxivda ko'rinadi |

Har bir chaqiruv **yangi run** yaratadi. Eskisi arxivda qoladi va **o'chirilmaydi**.

---

## 6. Saytni ishga tushirish

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Brauzerda: **http://127.0.0.1:8000**

To'xtatish — `Ctrl+C`.

---

## Kundalik ishlatish

**Yangi kunlik hisobot keldi:**

1. Faylni saytdagi *Ma'lumotlarni boshqarish* bo'limiga tashlang
   (yoki `python db/load_excel.py`)
2. **Prognoz o'zgarmaydi** — sayt "eskirgan" deb ogohlantiradi
3. Tayyor bo'lsangiz *Savdo prognozi* bo'limida **"Qayta hisoblash"** ni bosing
4. Eski reja arxivda qoladi, yangisi uning yoniga qo'shiladi

**Rejani Excel'ga chiqarish:** saytdagi eksport tugmasi, yoki
`GET /api/export/excel` — `потребность` formatida chiqadi.

---

## Arxiv bilan ishlash

```sql
-- butun tarix
SELECT run_id, faol, created_at, data_last_day, jami_qty, izoh FROM v_arxiv;

-- bitta hisobning tafsiloti
SELECT * FROM reja_daily WHERE run_id = 3;

-- eski rejaga qaytish
SELECT fn_reja_faollashtir(3);
```

Arxivni **o'chirib bo'lmaydi** — baza triggeri to'xtatadi:

```
ОШИБКА: Prognoz arxivini o'chirib bo'lmaydi (run_id=1). Arxiv o'zgarmas.
```

---

## Muammo chiqsa

| Xato | Sabab / yechim |
|---|---|
| `psql: not recognized` | PostgreSQL `bin` papkasi PATH da yo'q. To'liq yo'l bilan chaqiring |
| `password authentication failed` | `ESSI_DSN` dagi parol noto'g'ri (3-qadam) |
| `Prognoz hali hisoblanmagan` | `SELECT fn_reja_saqla(...)` ni ishga tushiring (5-qadam) |
| `mv_talab bo'sh` | Fakt savdo yuklanmagan (4-qadam) |
| Saytda `Internal Server Error` | Baza ishlayaptimi? `ESSI_DSN` to'g'rimi? |
| Port band | Boshqa portda: `--port 8080` |
| Reja g'alati chiqdi | `REFRESH MATERIALIZED VIEW mv_talab, mv_talab_zich, mv_sotilgan, mv_mavsum` va qayta hisoblang |

---

## Papka tuzilishi

```
essi/
├── api/
│   ├── main.py         FastAPI — endpointlar
│   └── db.py           baza ulanishi
├── db/
│   ├── schema.sql      jadvallar + arxiv (triggerlar bilan)
│   ├── model.sql       MODEL — view va funksiyalar
│   ├── loader.py       Excel o'qish va yuklash
│   └── load_excel.py   buyruq qatori orqali yuklash
├── web/
│   └── index.html      butun sayt (bitta fayl)
├── fakt savdo/         126 ta kunlik Excel
├── yakuniy savdo/      75 ta haftalik Excel
├── mening prognozim/   qo'lda tuzilgan reja (taqqoslash uchun)
├── README.md           model va topilmalar
└── SETUP.md            shu fayl
```

Prognoz **butunlay `db/model.sql`** da — alohida Python modeli yo'q.

# ESSI — savdo prognozi

Fakt savdo va yakuniy savdo asosida **2 haftalik savdo prognozini** beradigan tizim.
Model butunlay PostgreSQL da (`essi` bazasi).

---

## Ikki manba va ular orasidagi farq

| Manba | Nima | Davr |
|---|---|---|
| **fakt savdo** | Mijoz nima **so'ragan** — haqiqiy talab | 2026-02-10 … 2026-07-11 (126 kun) |
| **yakuniy savdo** | Ombor yetmagani uchun **kesilgandan keyin** nima yetkazilgan | 2025-04-09 … 2026-07-11 (445 kun) |

Farqi — **yo'qotilgan savdo**: agar ombor bo'lganda sotilishi mumkin bo'lgan hajm.
Ustma-ust davrda bu **750 830 dona = talabning 11.1 % i** (~8.9 mlrd so'm).

Ba'zi mahsulotda kesim juda katta: `Творог 5% 400гр` — **31.6 %**,
`Айран 2.0% 280гр` — **53.6 %**.

> **Model yakuniy savdoni bashorat qilmaydi.** Agar reja yakuniyga qarab tuzilsa,
> o'tmishdagi kamchilik abadiylashadi: kam ishlab chiqariladi → yana kesiladi →
> yana kam sotiladi. Reja **talabni** qoplashi kerak.

---

## Model

```
Bashorat = DARAJA × MAVSUM × HAFTA-KUNI × USTAMA × KALIBROVKA
```

**DARAJA (ierarxik siqish):**

```
yaqin   = trim24(mavsumiylikdan tozalangan seriya)   — o'zining so'nggi 4 haftasi
uzoq    = trim72(...)                                 — o'zining 12 haftasi
harakat = Σyaqin / Σuzoq  o'z TUR guruhi bo'yicha     — guruhdan "qarz olingan" harakat
daraja  = 0.5 × yaqin + 0.5 × (uzoq × harakat)
```

`trim24` — oxirgi 24 ish kunining **chekkalari kesilgan** o'rtachasi (10 % pastdan,
10 % yuqoridan). Chekkalarni kesish partiyali buyurtmalardan kelib chiqadigan
sakrashlarni yumshatadi.

**MAVSUM** — mahsulotning oylik indeksi. Faqat **amplitudasi ≥ 0.45** bo'lgan 25 ta
mahsulotga qo'llanadi; qolganlariga tegilmaydi, chunki ularda mavsumiylik shovqindan iborat.

Айран yozgi ichimlik (iyun 1.46, noyabr 0.71), Каймак qishki. Umumiy mavsumiylik zaif
chiqadi, chunki ular bir-birini yo'q qiladi — shuning uchun **faqat mahsulot darajasida**
ishlaydi.

**HAFTA-KUNI** — kunlik taqsimot uchun. 12 ish kunida har kun 2 martadan kelgani uchun
`Σ dow_ix = 12` — ya'ni jamini **o'zgartirmaydi**, faqat kunlarga bo'ladi.

**USTAMA** — kesilgan mahsulotga qo'shimcha: kesim ≥ 20 % → ×1.15, 10–20 % → ×1.10.
Faqat **tirik** mahsulotga (oxirgi 30 kunda yakuniy savdosi bor).

**KALIBROVKA** — 1.03. Trim ning −2.8 % lik kam bashorat qilish qiyshiqligini qoplaydi.

---

## Aniqlik

Backtest: **36 origin**, 12 ish kunlik gorizont, halol (out-of-sample) o'lchov.

| Usul | WAPE (mahsulot × 12-kunlik jami) |
|---|---|
| naive (o'tgan hafta) | 17.98 % |
| eski model (E2_top5 ansambl) | 14.62 % |
| + chidamli daraja (trim24) | 14.27 % |
| + tanlab mavsumiylik | 13.93 % |
| **+ ierarxik siqish** | **13.75 %** |
| *orakul chegarasi* | *13.69 %* |

**Orakul** — maqsad davrining atrofidagi darajani (18 kun oldin + 18 kun **keyin**)
mukammal biladigan, lekin maqsad kunlarini ko'rmaydigan model. Ya'ni u **kelajakka
qaraydi**. Bizning model undan atigi **0.06 punkt** orqada.

> **Model amaliy chegaraga yetdi.** Qolgan xato — bashorat qilib bo'lmaydigan shovqin.

### Sinalgan va RAD ETILGAN

Bularning **hammasi** xatoni oshirdi yoki foyda bermadi:

| G'oya | Natija |
|---|---|
| Trend (to'liq, yarim, jilovlangan) | 14.3 → **16.3 %** |
| Kanal segmentatsiyasi (Хавас / Корзинка / ABC) | 14.0 → **14.6 %** |
| Do'kon soni o'sishini ekstrapolyatsiya | 14.0 → **14.8 %** |
| Oy sanasi indeksi | foyda yo'q |
| Bayram koeffitsienti | foyda yo'q |
| Qisqa oynalar (3, 6, 9, 12, 15, 18, 21 kun) | 13.9 → **14.1–21.8 %** |
| Oynalar aralashmasi (6+12+24 va h.k.) | 13.9 → **14.4–16.4 %** |

Oyna uzunligi bo'yicha xato **bir tekis kamayadi 24 kungacha**, keyin yana o'sadi.
Minimum — **24–26 ish kuni** (≈ 30 kalendar kun). Yaqin kunlarda qo'shimcha ma'lumot
yo'q, faqat shovqin.

### Aniqlik mahsulotga qarab keskin farq qiladi

| Hajm | Mahsulot | O'rtacha chegara |
|---|---|---|
| > 200 000 dona | 15 | **10.9 %** |
| 50–200 ming | 16 | 14.7 % |
| 10–50 ming | 10 | 18.4 % |
| < 10 000 | 5 | **31.9 %** |

Beqarorlikning asosiy sababi — **hajm** (r = −0.73), keyin **mavsumiylik** (r = +0.59).
Tarmoq ulushining ta'siri **yo'q** (yirik mahsulotlar ichida r = +0.09).

Kichik mahsulotlarga aniqlik quvish behuda — ularni **keng ishonch oralig'i va zaxira**
bilan boshqarish kerak.

---

## Prognoz arxivi — uchta qat'iy qoida

1. **Yangi ma'lumot yuklanishi prognozni O'ZGARTIRMAYDI.** Agregatlar yangilanadi,
   prognoz eski holicha qoladi. Sayt faqat "eskirgan" deb ogohlantiradi.
2. **Qayta hisoblash faqat QO'LDA** — `fn_reja_saqla()` yoki saytdagi tugma.
3. **Arxiv o'zgarmas.** Har bir hisob saqlanadi; o'chirib ham, tahrirlab ham bo'lmaydi —
   baza triggeri himoya qiladi. Yangi hisob eskisini almashtirmaydi, uning **yoniga**
   qo'shiladi.

```sql
-- qayta hisoblash (yangi run yaratadi, eskisi arxivda qoladi)
SELECT fn_reja_saqla(12, TRUE, 1.03, 'iyul 2-yarmi');

-- arxiv
SELECT run_id, faol, created_at, data_last_day, jami_qty, izoh FROM v_arxiv;

-- eski rejaga qaytish
SELECT fn_reja_faollashtir(3);
```

---

## Ishga tushirish

```bash
# 1. Excel yuklash
python db/load_excel.py             # fakt savdo
python db/load_excel.py --yakuniy   # yakuniy savdo

# 2. Prognozni hisoblash (QO'LDA)
psql -U postgres -d essi -c "SELECT fn_reja_saqla(12, TRUE, 1.03, 'birinchi hisob')"

# 3. Sayt
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
# -> http://127.0.0.1:8000
```

Ulanish satri — `ESSI_DSN`. Excel papkalari — `ESSI_DATA_DIR`, `ESSI_YAK_DIR`.

### Yangi kunlik hisobot keldi

1. Faylni saytga tashlang (yoki `python db/load_excel.py`)
2. **Prognoz o'zgarmaydi** — sayt "eskirgan" deb ogohlantiradi
3. Tayyor bo'lsangiz — **"Qayta hisoblash"** tugmasini bosing
4. Eski reja arxivda qoladi

---

## Sayt

| Bo'lim | Nima |
|---|---|
| **Savdo prognozi** | Svod jadval, kunlik prognoz, ishonch oralig'i, Excel eksport |
| **Yo'qotilgan savdo** | Kesim: talab vs sotilgan, mahsulot kesimida, pul bahosi |
| **Ma'lumotlarni boshqarish** | Excel yuklash, yuklangan kunlar, chiqarilgan mahsulotlar, **prognoz arxivi** |

Excel eksport `потребность` formatida — qo'lda tuzilgan reja bilan bir xil tuzilish.

---

## Baza tuzilishi

### Ma'lumot

| Jadval | Nima |
|---|---|
| `fakt_savdo` | Talab — kunlik Excel (724 823 qator, 126 kun) |
| `yakuniy_savdo` | Sotilgan — haftalik Excel (2 459 767 qator, 445 kun) |
| `products` | Barqaror ID (sayt uchun) |
| `kalendar` | Bayramlar: `yopiq` (savdo yo'q) / `tiklanish` (past kun) |

### Agregatlar

| View | Nima |
|---|---|
| `mv_talab` | Kun × mahsulot × segment — talab |
| `mv_talab_zich` | **Nol bilan to'ldirilgan** — sotilmagan kun = 0 |
| `mv_sotilgan` | Kun × mahsulot — yakuniy savdo |
| `mv_mavsum` | Mavsumiy indeks (25 mahsulot × 12 oy) |

> `mv_talab_zich` **muhim**: `mv_talab` da faqat sotilgan kunlar bor. Nol kunlarni
> hisobga olmasa, siyrak mahsulotning darajasi ikki barobar oshib ketadi va
> sotilmaydigan kunlarga arvoh reja tushadi. (Masalan `Кефир 3.2% (250 гр)` faqat
> Du/Ch/Ju kunlari sotiladi.)

### Model

| Obyekt | Nima |
|---|---|
| `fn_prognoz(origin, gorizont, ustama, kalibr)` | Kunlik bashorat + omillar |
| `fn_reja(...)` | Reja: jami, 1-hafta, 2-hafta, ishonch oralig'i |
| `fn_mavsum(product, kun)` | Kunlik mavsumiy koeffitsient |
| `fn_reja_saqla(...)` | **Yagona hisoblash nuqtasi** — arxivga yozadi |
| `fn_reja_faollashtir(run_id)` | Eski rejaga qaytish |
| `v_mahsulot_holati` | tirik / o'lik / siyrak + kesim % |
| `v_ustama` | Kesim ustamasi |
| `v_mahsulot_aniqlik` | Kutilayotgan xato → ishonch oralig'i |
| `v_kesim` | Yo'qotilgan savdo (kun × mahsulot) |

### Arxiv

| Jadval | Nima |
|---|---|
| `reja_runs` | Har bir hisob: parametrlar, natija, ma'lumot holati |
| `reja_daily` | Run × mahsulot × kun |
| `v_joriy_reja` | Joriy (faol) reja |
| `v_arxiv` | Butun tarix + oldingidan farq |

---

## Rejaga kirmaydigan mahsulotlar

| Sabab | Nima |
|---|---|
| `Тара`, `Сырьё` | Qadoq va xomashyo — ishlab chiqarish mahsuloti emas |
| **o'lik** | Buyurtma bor, lekin oxirgi 30 kunda yakuniy savdo **nol** — ishlab chiqarilmayapti (masalan `Йогурт Банан-Киви`) |
| **siyrak** | 30 kundan kam tarix |

O'lik mahsulotga **ustama ham berilmaydi** — aks holda ishlab chiqarilmaydigan narsaga
reja tushib qolardi.

### Мехрибон — 2026-07-13 dan rejaga KIRADI

Ilgari u "alohida liniyada rejalashtiriladi" deb chiqarib tashlangan edi. Bu qoida
bekor qilindi.

- 7 mahsulot, talabning **6.5 %** i (471 267 dona)
- Hajmining **99.8 % i Хавас** ga ketadi (atigi 2 ta do'kon)
- Kesim **20.3 %** — beshtasi ×1.15 ustama oladi
  (`Кефир Mehribon нежирный` — talabning **31 %** i kesilgan)

> ⚠️ **Мехрибон tez qisqaryapti**: martda 5 049 dona/kun → iyulda 2 603 (−48 %).
> Model trendsiz, so'nggi 4 haftaning darajasini oladi. Agar pasayish davom etsa,
> reja biroz yuqori chiqadi. Kuzatib turing.

---

## Bayramlar va yakshanba

Savdo umuman bo'lmagan kunlar `kalendar` jadvalida: Ramazon hayiti, Qurbon hayiti,
Yangi yil, Mustaqillik kuni, Ustoz-murabbiylar kuni.

Bayramdan keyingi kunlar ham past bo'ladi (yangi yildan keyin savdo bir hafta davomida
**ikki barobar** kam). Bu kunlar **darajani hisoblashda chiqarib tashlanadi** — aks holda
ular darajani pastga tortadi. Prognozda `yopiq` kunlar gorizontdan chiqariladi.

Yakuniy savdoda yakshanba yozuvlari bor, lekin ular butun hajmning **0.35 %** i
(kuniga ~800 dona). Reja Du–Sha kunlariga tuziladi: **2 hafta = 12 ish kuni**.

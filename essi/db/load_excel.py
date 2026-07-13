"""ESSI — Excel fayllarni papkadan `essi` bazasiga yuklaydi.

    python db/load_excel.py                  # fakt savdo (yangi kunlar)
    python db/load_excel.py --yakuniy        # yakuniy savdo
    python db/load_excel.py --replace        # mavjud kunni qayta yozish
    python db/load_excel.py --dir "D:\\..."   # boshqa papka

MUHIM: yuklash PROGNOZNI QAYTA HISOBLAMAYDI. Agregatlar yangilanadi, prognoz
eski holicha qoladi. Yangilash uchun:

    psql -d essi -c "SELECT fn_reja_saqla(12, TRUE, 1.03, 'izoh')"

yoki saytdagi «Qayta hisoblash» tugmasi. Har bir hisob arxivga yoziladi.
"""
import argparse
import glob
import os
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from loader import (  # noqa: E402
    DSN, DATA_DIR, YAK_DIR, BadFile, load_fakt, load_yakuniy, read_workbook,
    refresh_views,
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yakuniy", action="store_true", help="yakuniy savdo yuklash")
    ap.add_argument("--replace", action="store_true", help="mavjudini qayta yozish")
    ap.add_argument("--dir", default=None, help="Excel fayllar papkasi")
    args = ap.parse_args()

    folder = args.dir or (YAK_DIR if args.yakuniy else DATA_DIR)
    files = sorted(glob.glob(os.path.join(folder, "*.xlsx")))
    if not files:
        sys.exit(f"Fayl topilmadi: {folder}")

    nom = "YAKUNIY SAVDO" if args.yakuniy else "FAKT SAVDO"
    print(f"{nom}: {folder}")
    print(f"Papkada {len(files)} fayl\n")

    conn = psycopg2.connect(DSN)
    stats = {"loaded": 0, "replaced": 0, "skipped": 0, "error": 0}
    total = 0

    for n, path in enumerate(files, 1):
        base = os.path.basename(path)
        try:
            rows = read_workbook(path)
            if args.yakuniy:
                res = load_yakuniy(base, rows, replace=args.replace, conn=conn)
            else:
                res = load_fakt(base, rows, replace=args.replace, conn=conn)
        except BadFile as e:
            conn.rollback()
            stats["error"] += 1
            print(f"  [{n}/{len(files)}] {base}: XATO — {e}")
            continue

        stats[res["status"]] += 1
        total += res["rows"]
        if res["status"] == "skipped":
            print(f"  [{n}/{len(files)}] {base}: o'tkazildi — {res['reason']}")
        elif args.yakuniy:
            print(f"  [{n}/{len(files)}] {base}  {res['kunlar']} kun  "
                  f"{res['dan']} .. {res['gacha']}  {res['rows']:,} qator")
        else:
            print(f"  [{n}/{len(files)}] {base}  {res['sale_date']}  "
                  f"{res['rows']:,} qator  ({res['status']})")

    if total:
        print("\nAgregatlarni yangilash...")
        refresh_views(conn)

    print(f"\nYuklandi: {stats['loaded']} yangi, {stats['replaced']} qayta yozilgan, "
          f"{stats['skipped']} o'tkazilgan, {stats['error']} xato")

    cur = conn.cursor()
    tbl = "yakuniy_savdo" if args.yakuniy else "fakt_savdo"
    cur.execute(f"SELECT count(*), count(DISTINCT sale_date), min(sale_date), max(sale_date) "
                f"FROM {tbl}")
    c, d, a, b = cur.fetchone()
    print(f"`{tbl}`: {c:,} qator, {d} kun, {a} .. {b}")

    if total:
        cur.execute("SELECT run_id, data_last_day, round(jami_qty) FROM reja_runs "
                    "WHERE faol ORDER BY run_id DESC LIMIT 1")
        r = cur.fetchone()
        print("\n" + "=" * 68)
        if r:
            print(f"PROGNOZ O'ZGARMADI — joriy reja run={r[0]}, {r[1]} gacha "
                  f"ma'lumotga asoslangan, {int(r[2]):,} dona.")
        else:
            print("PROGNOZ hali hisoblanmagan.")
        print("Yangilash uchun (QO'LDA):")
        print("   psql -d essi -c \"SELECT fn_reja_saqla(12, TRUE, 1.03, 'izoh')\"")
        print("   yoki saytdagi «Qayta hisoblash» tugmasi")
        print("Eski reja arxivda saqlanadi.")
        print("=" * 68)
    conn.close()


if __name__ == "__main__":
    main()

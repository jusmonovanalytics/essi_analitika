"""Savdo prognozi moduli.

Model butunlay PostgreSQL da (server/sql/):
    schema.sql  — jadvallar + o'zgarmas arxiv (triggerlar bilan)
    model.sql   — prognoz modeli (WAPE 13.75%, orakul chegarasi 13.69%)
    dokon.sql   — do'kon turi bo'yicha bo'lish

Ma'lumot manbalari:
    fakt_savdo    — TALAB (mijoz nima so'ragan), kunlik Excel
    yakuniy_savdo — SOTILGAN (ombor kesimidan keyin), haftalik Excel
    farqi         — YO'QOTILGAN savdo (talabning ~11%)

Uchta qat'iy qoida:
  1. Yangi ma'lumot yuklanishi prognozni O'ZGARTIRMAYDI
  2. Qayta hisoblash faqat QO'LDA
  3. Arxiv o'zgarmas — o'chirib ham, tahrirlab ham bo'lmaydi

Ruxsat:
  Butun prognoz bo'limi ADMIN uchun. Mehmon faqat savdo analitikasini ko'radi.
  `admin` qo'riqchisi analitika tomonidagi yozuvchi endpointlarda ham ishlatiladi.
"""
from . import db                    # noqa: F401
from .auth import admin             # noqa: F401  (main.py ham foydalanadi)
from .router import router          # noqa: F401
from . import router2               # noqa: F401  (endpointlarni router'ga qo'shadi)

__all__ = ["router", "db", "admin"]

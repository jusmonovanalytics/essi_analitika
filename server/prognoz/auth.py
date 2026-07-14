"""Admin paroli — bazani o'zgartiradigan amallar uchun.

Nima uchun BACKEND da:
    Faqat interfeysda tekshirsak, kimdir API ga to'g'ridan-to'g'ri so'rov
    yuborib chetlab o'tadi. Shuning uchun parolni server tekshiradi.

Nimadan himoya QILMAYDI:
    Parol umumiy va brauzerdan yuboriladi — devtools da ko'rinadi. Bu
    TASODIFIY o'zgarishlardan himoya, jiddiy hujumdan emas. Haqiqiy
    himoya kerak bo'lsa, foydalanuvchi hisoblari va token kerak.

Parol `ADMIN_PAROL` muhit o'zgaruvchisidan olinadi (server/.env).
Sozlanmagan bo'lsa — hamma yozish amali RAD ETILADI (fail-closed), chunki
"parol yo'q = hamma narsa ruxsat" eng xavfli sukut bo'lardi.
"""
import hmac
import os

from fastapi import Header, HTTPException


async def admin(x_admin_parol: str = Header(None)) -> None:
    """Yozish amallari uchun qo'riqchi. `Depends(admin)` bilan ishlatiladi."""
    kutilgan = os.getenv("ADMIN_PAROL")
    if not kutilgan:
        raise HTTPException(
            503, "ADMIN_PAROL sozlanmagan — serverning .env fayliga qo'shing.")
    if not x_admin_parol or not hmac.compare_digest(x_admin_parol, kutilgan):
        raise HTTPException(401, "Admin paroli noto'g'ri.")

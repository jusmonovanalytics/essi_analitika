@echo off
title ESSI Analytics - Sync
color 0B
chcp 65001 >nul

echo.
echo  ============================================
echo     ESSI Analytics - Sinxronizatsiya
echo  ============================================
echo.
echo  Render: https://essi-analitika.onrender.com
echo  Sayt  : https://essi-analitika-9elz.vercel.app
echo.

:: 1. Eski jarayonlarni to'xtatish
echo  [1/2] Eski jarayonlar to'xtatilmoqda...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM cloudflared.exe /T 2>nul
ping -n 3 127.0.0.1 >nul

:: 2. Backend ishga tushirish (faqat sync uchun — Neon'ga yozadi)
echo  [2/2] Backend (sync) ishga tushirilmoqda...
start "ESSI Sync" /min python "D:\ESSI\server\run.py"
ping -n 5 127.0.0.1 >nul

echo.
echo  ============================================
echo   Tayyor! Backend sinxronizatsiya qilmoqda.
echo   Ma'lumotlar har 5 daqiqada yangilanadi.
echo   Bu oynani yoping - fon rejimida ishlaydi.
echo  ============================================
echo.

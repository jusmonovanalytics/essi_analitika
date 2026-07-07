@echo off
title ESSI Analytics - Ishga tushirish
color 0B
chcp 65001 >nul

echo.
echo  ============================================
echo     ESSI Analytics - Ishga tushirilmoqda
echo  ============================================
echo.

:: 1. Eski jarayonlarni to'xtatish
echo  [1/5] Eski jarayonlar to'xtatilmoqda...
taskkill /F /IM cloudflared.exe /T 2>nul
taskkill /F /IM python.exe /T 2>nul
ping -n 3 127.0.0.1 >nul

:: 2. Backend ishga tushirish
echo  [2/5] Backend (FastAPI) ishga tushirilmoqda...
start "ESSI Backend" /min python "D:\ESSI\server\run.py"
ping -n 8 127.0.0.1 >nul

:: 3. Cloudflare tunnel ochish
echo  [3/5] Cloudflare tunnel ochilmoqda...
if exist "D:\ESSI\cf_url.log" del /f /q "D:\ESSI\cf_url.log"
start "CF Tunnel" /min cmd /c ""D:\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8001 > "D:\ESSI\cf_url.log" 2>&1"
ping -n 22 127.0.0.1 >nul

:: 4. Tunnel URL ni aniqlash
echo  [4/5] Tunnel URL aniqlanmoqda...
for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$m = Select-String -Path 'D:\ESSI\cf_url.log' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com'; if ($m) { ([regex]::Match($m[0].Line, 'https://[a-z0-9-]+\.trycloudflare\.com')).Value }"`) do set TUNNEL_URL=%%U

if not defined TUNNEL_URL (
    echo.
    echo  XATO: Tunnel URL topilmadi!
    echo  D:\ESSI\cf_url.log faylini tekshiring.
    pause
    exit /b 1
)
echo  Tunnel URL: %TUNNEL_URL%

:: 5. Vercel yangilash va redeploy
echo  [5/5] Vercel yangilanmoqda...
cd /d "D:\ESSI"
call npx vercel env rm VITE_API_URL production --yes 2>nul
echo %TUNNEL_URL%| call npx vercel env add VITE_API_URL production
call npx vercel --prod --yes

echo.
echo  ============================================
echo   Hammasi tayyor!
echo   Tunnel : %TUNNEL_URL%
echo   Sayt   : https://essi-analitika-9elz.vercel.app
echo  ============================================
echo.
pause

@echo off
cd /d %~dp0
echo Installing dependencies...
pip install -r requirements.txt
echo.
set DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/essi
echo Starting ESSI Dashboard backend on port 8001...
echo PostgreSQL: %DATABASE_URL%
echo.
python run.py

@echo off
REM ============================================================
REM  VisionTrack - development mode (hot reload)
REM  Backend  : http://localhost:8000
REM  Frontend : http://localhost:5173  <- open this one
REM ============================================================
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
    echo Run START-HERE.bat once first to set everything up.
    pause
    exit /b 1
)

start "VisionTrack backend" backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload --app-dir backend
timeout /t 3 >nul
start "VisionTrack frontend" cmd /c "cd frontend && npm run dev"
timeout /t 4 >nul
start "" http://localhost:5173
echo Two windows were opened. Close them to stop VisionTrack.

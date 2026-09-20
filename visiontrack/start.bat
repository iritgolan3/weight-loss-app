@echo off
REM ============================================================
REM  VisionTrack - one-click start for Windows
REM  Creates the Python environment, installs dependencies,
REM  builds the UI and launches the app at http://localhost:8000
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo  ==========================================
echo   VISIONTRACK - AI VIDEO ANALYSIS
echo  ==========================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found on your PATH.
    echo         Install Python 3.10 - 3.12 from https://www.python.org/downloads/
    echo         and tick "Add python.exe to PATH" during setup.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found on your PATH.
    echo         Install the LTS build from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [1/4] Creating the Python virtual environment...
    python -m venv backend\.venv
    if errorlevel 1 (
        echo [ERROR] Could not create the virtual environment.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Python environment found.
)

echo [2/4] Installing Python dependencies (first run downloads ~500 MB)...
backend\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
if errorlevel 1 (
    echo [ERROR] Installing Python dependencies failed. See the messages above.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [3/4] Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
) else (
    echo [3/4] Frontend dependencies found.
)

echo [4/4] Building the user interface...
pushd frontend
call npm run build
if errorlevel 1 (
    echo [ERROR] The frontend build failed. See the messages above.
    popd
    pause
    exit /b 1
)
popd

echo.
echo  Starting VisionTrack on http://localhost:8000
echo  Close this window to stop the server.
echo.
start "" http://localhost:8000
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend

pause

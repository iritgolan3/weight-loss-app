<#
    VisionTrack - one-click start for Windows PowerShell.
    Usage:  Right-click -> "Run with PowerShell", or in a terminal:
              powershell -ExecutionPolicy Bypass -File .\windows-powershell.ps1
            Add -Dev to run the Vite dev server with hot reload instead.
#>
param([switch]$Dev)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Require-Command($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] '$name' was not found on your PATH." -ForegroundColor Red
        Write-Host "        $hint" -ForegroundColor Yellow
        Read-Host 'Press Enter to exit'
        exit 1
    }
}

Write-Host ''
Write-Host ' VISIONTRACK - AI VIDEO ANALYSIS' -ForegroundColor Green
Write-Host ' ===============================' -ForegroundColor DarkGreen
Write-Host ''

Require-Command 'python' 'Install Python 3.10-3.12 from https://www.python.org/downloads/ (tick "Add python.exe to PATH").'
Require-Command 'node'   'Install the Node.js LTS build from https://nodejs.org/'

$python = Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    Write-Host '[1/4] Creating the Python virtual environment...'
    python -m venv backend\.venv
} else {
    Write-Host '[1/4] Python environment found.'
}

Write-Host '[2/4] Installing Python dependencies (first run downloads ~500 MB)...'
& $python -m pip install --upgrade pip --quiet
& $python -m pip install -r backend\requirements.txt
if ($LASTEXITCODE -ne 0) { Read-Host 'Dependency install failed. Press Enter to exit'; exit 1 }

if (-not (Test-Path 'frontend\node_modules')) {
    Write-Host '[3/4] Installing frontend dependencies...'
    Push-Location frontend; npm install; Pop-Location
} else {
    Write-Host '[3/4] Frontend dependencies found.'
}

if ($Dev) {
    Write-Host '[4/4] Starting backend + Vite dev server...'
    Start-Process -FilePath $python -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--reload','--app-dir','backend'
    Start-Sleep -Seconds 3
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','cd frontend && npm run dev'
    Start-Sleep -Seconds 4
    Start-Process 'http://localhost:5173'
    Write-Host 'Dev servers running. Open http://localhost:5173'
    exit 0
}

Write-Host '[4/4] Building the user interface...'
Push-Location frontend; npm run build; Pop-Location
if ($LASTEXITCODE -ne 0) { Read-Host 'Frontend build failed. Press Enter to exit'; exit 1 }

Write-Host ''
Write-Host ' Starting VisionTrack on http://localhost:8000' -ForegroundColor Green
Start-Process 'http://localhost:8000'
& $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend

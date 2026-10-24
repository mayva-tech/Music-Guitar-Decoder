# Music Decoder - Windows launcher (equivalent of scripts/dev.sh)
# Starts FastAPI backend on http://localhost:8000 and Next.js frontend on http://localhost:3000
# Usage (from the project root, or anywhere):
#   powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

# ffmpeg installed via winget needs a refreshed PATH in older terminals
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    throw "Backend venv not found at $Python - run: cd backend; python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
}
if (-not (Test-Path (Join-Path $Root "frontend\node_modules"))) {
    throw "Frontend dependencies not found - run: cd frontend; npm ci"
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Warning "ffmpeg not found on PATH - WebM/MP3/M4A uploads and browser recordings will fail (WAV still works). Install: winget install --id Gyan.FFmpeg -e"
}

$env:MUSIC_DECODER_DB = Join-Path $Root "backend\data\music_decoder.sqlite3"
$env:MUSIC_DECODER_API = "http://127.0.0.1:8000"

Write-Host "Music Decoder: open http://localhost:3000  (API docs: http://localhost:8000/docs)" -ForegroundColor Green
Write-Host "Press Ctrl+C in each window / close the windows to stop." -ForegroundColor DarkGray

$backend = Start-Process powershell -PassThru -WorkingDirectory (Join-Path $Root "backend") -ArgumentList @(
    "-NoExit", "-Command", "& '$Python' -m uvicorn app.main:app --reload --port 8000"
)
$frontend = Start-Process powershell -PassThru -WorkingDirectory (Join-Path $Root "frontend") -ArgumentList @(
    "-NoExit", "-Command", "npm run dev"
)

Write-Host "Backend PID $($backend.Id) | Frontend PID $($frontend.Id)"
Wait-Process -Id $backend.Id, $frontend.Id

# Music Decoder - Windows test runner (equivalent of scripts/test-all.sh)
# Backend pytest, frontend vitest, type-check and production build.
# Browser tests need both servers running: cd frontend; npm run test:e2e
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"

Write-Host "== backend (pytest)" -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend"); & $Python -m pytest; if ($LASTEXITCODE) { throw "backend tests failed" }; Pop-Location

Write-Host "== frontend (vitest)" -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend"); npm test; if ($LASTEXITCODE) { throw "frontend tests failed" }; Pop-Location

Write-Host "== type-check" -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend"); npm run typecheck; if ($LASTEXITCODE) { throw "typecheck failed" }; Pop-Location

Write-Host "== build" -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend"); npm run build; if ($LASTEXITCODE) { throw "build failed" }; Pop-Location

Write-Host "All checks passed." -ForegroundColor Green

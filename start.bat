@echo off
setlocal
cd /d "%~dp0"

if "%LIMBO_LAUNCH_DIR%"=="" set "LIMBO_LAUNCH_DIR=%CD%"

if exist "node_modules\electron\dist\electron.exe" (
  "node_modules\electron\dist\electron.exe" . %*
  exit /b %errorlevel%
)

where npx >nul 2>nul
if errorlevel 1 (
  echo [LIMBO] Electron bulunamadi. Once "npm install" calistirin.
  pause
  exit /b 1
)

call npx --no-install electron . %*
exit /b %errorlevel%

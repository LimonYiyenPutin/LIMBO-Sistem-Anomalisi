@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\electron\dist\electron.exe" (
  echo [LIMBO] Bagimliliklar eksik. Once "npm install" calistirin.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\electron-builder.cmd" (
  echo [LIMBO] electron-builder bulunamadi. Once "npm install" calistirin.
  pause
  exit /b 1
)

call "node_modules\.bin\electron-builder.cmd" --win --x64
if errorlevel 1 exit /b %errorlevel%

echo.
echo [LIMBO] Windows ciktisi hazir:
dir /b "dist\*.exe"

@echo off
REM Zendoria local launcher. Starts a tiny HTTP server and opens the game.
REM ES modules require HTTP (not file://), so this is the easiest way to run.
REM Cache-busting is handled per-import via ?v=YYYYMMDD-tag in index.html and
REM js/main.js -- this launcher doesn't append a global tag.

set PORT=8765
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
    start "Zendoria Server" /min python -m http.server %PORT% --bind 127.0.0.1
    timeout /t 1 /nobreak >nul
    start "" "http://127.0.0.1:%PORT%/"
    exit /b
)

where py >nul 2>&1
if %errorlevel%==0 (
    start "Zendoria Server" /min py -m http.server %PORT% --bind 127.0.0.1
    timeout /t 1 /nobreak >nul
    start "" "http://127.0.0.1:%PORT%/"
    exit /b
)

echo Python not found. Install Python 3 or run any static server on this folder.
pause

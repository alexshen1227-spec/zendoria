@echo off
REM Zendoria local launcher. Starts a tiny HTTP server and opens the game.
REM ES modules require HTTP (not file://), so this is the easiest way to run.

set PORT=8765
set BUILD_TAG=20260414-no-bridge-pass2
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
    start "" "http://127.0.0.1:%PORT%/?v=%BUILD_TAG%"
    python serve.py %PORT%
    exit /b
)

where py >nul 2>&1
if %errorlevel%==0 (
    start "" "http://127.0.0.1:%PORT%/?v=%BUILD_TAG%"
    py serve.py %PORT%
    exit /b
)

echo Python not found. Install Python 3 or run any static server on this folder.
pause

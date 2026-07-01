@echo off
setlocal
title Rogue Game Launcher
cd /d "%~dp0"

if not exist "index.html" (
    echo.
    echo ERROR: index.html was not found.
    echo Keep this launcher inside the unzipped game folder.
    echo.
    pause
    exit /b 1
)

echo.
echo Starting Rogue...
echo Your browser will open automatically.
echo Keep this window open while playing.
echo Close this window to stop the game server.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\launcher-server.ps1"

if errorlevel 1 (
    echo.
    echo The game server could not start.
    echo Make sure the whole game folder was extracted before launching.
    echo.
    pause
)


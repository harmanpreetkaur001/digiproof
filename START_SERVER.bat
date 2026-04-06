@echo off
title LockBox Backend Server
color 0A
echo.
echo  ==========================================
echo   LockBox - Digital Evidence Vault
echo   Backend Server Starting...
echo  ==========================================
echo.

cd /d "%~dp0backend"

echo  Checking Node.js...
"C:\Progra~1\nodejs\node.exe" --version
if errorlevel 1 (
    echo  ERROR: Node.js not found. Please install from https://nodejs.org
    pause
    exit
)

echo  Installing dependencies...
"C:\Progra~1\nodejs\npm.cmd" install

echo.
echo  Starting server on http://localhost:5000
echo  Press Ctrl+C to stop
echo.
"C:\Progra~1\nodejs\node.exe" server.js
pause

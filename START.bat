@echo off
title Up to Ten Social Media Manager

echo =====================================
echo   UP TO TEN SOCIAL MEDIA MANAGER
echo =====================================
echo.

:: Check if server is already running
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Server already running!
    goto :open_dashboard
)

:: Start server
echo [..] Starting backend server...
cd backend
start cmd /k "npm start"
cd ..

:: Wait for server
echo [..] Waiting for server initialization...
:wait_server
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000/api/health >nul 2>&1
if %errorlevel% neq 0 goto :wait_server

echo [OK] Server started successfully!

:open_dashboard
echo [..] Opening dashboard...
start social-media-dashboard.html

echo.
echo =====================================
echo   Application started!
echo   Dashboard opening in browser...
echo =====================================
echo.
echo   To setup Supabase database:
echo   1. Open https://supabase.com/dashboard
echo   2. Run SQL from: backend\setup-all-tables.sql
echo.
echo Press any key to exit...
pause >nul
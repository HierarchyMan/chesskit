@echo off
cd /d "%~dp0"
where npm >nul 2>nul || (echo Install Node.js 22.11 or newer. & pause & exit /b 1)
if not exist node_modules call npm ci
if errorlevel 1 exit /b 1
call npm start

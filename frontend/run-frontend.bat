@echo off
setlocal EnableExtensions
cd /d "%~dp0"
call npm run dev -- --host 127.0.0.1
echo.
echo Frontend stopped. Read the message above if it was unexpected.
pause

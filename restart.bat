@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo Stopping the current RAG services...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /c:":8000" ^| findstr /c:"LISTENING"') do taskkill /PID %%P /F >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /c:":5173" ^| findstr /c:"LISTENING"') do taskkill /PID %%P /F >nul 2>&1
timeout /t 2 /nobreak >nul
call "%~dp0start.bat"
endlocal

@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [1/4] Checking Python environment...
if not exist "backend\.venv\Scripts\python.exe" (
  py -3.12 -m venv backend\.venv
  if errorlevel 1 goto :error
)

echo [2/4] Checking backend dependencies...
"backend\.venv\Scripts\python.exe" -c "import fastapi, langchain, chromadb" >nul 2>&1
if errorlevel 1 (
  "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
  if errorlevel 1 goto :error
)

if not exist "backend\.env" (
  copy /y ".env.example" "backend\.env" >nul
  echo Created backend\.env. Add DASHSCOPE_API_KEY before using model answers.
)

echo [3/4] Building frontend...
if not exist "frontend\node_modules\vite" (
  pushd frontend
  call npm install
  if errorlevel 1 (
    popd
    goto :error
  )
  popd
)
pushd frontend
call npm run build
if errorlevel 1 (
  popd
  goto :error
)
popd

echo [4/4] Starting services...
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if errorlevel 1 (
  start "RAG Backend" "%ROOT%backend\run-backend.bat"
) else (
  echo Backend is already running.
)

timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8000"
echo.
echo Started. Open http://127.0.0.1:8000 in your browser.
pause
exit /b 0

:error
echo.
echo Startup failed. Read the message above and send me a screenshot.
pause
exit /b 1

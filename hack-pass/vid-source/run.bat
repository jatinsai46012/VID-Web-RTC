@echo off
setlocal EnableDelayedExpansion
title VID - Voice Deepfake Detector
cd /d "%~dp0"

REM ===========================================================================
REM  Starts VID in ONE window:
REM
REM    backend  - FastAPI   http://127.0.0.1:8001   -> logs\backend.log
REM    frontend - React dev http://localhost:3000   -> logs\frontend.log
REM
REM  Both servers run hidden in the background, so this window only shows the
REM  startup report below. Press any key in this window to stop both servers.
REM
REM  The hidden windows are started by scripts\start-hidden.ps1 (which hands us
REM  their PIDs); if PowerShell is unavailable the script falls back to
REM  `start /b` and still frees the ports on exit.
REM ===========================================================================

set "BACKEND_PORT=8001"
set "FRONTEND_PORT=3000"
set "BACKEND_URL=http://127.0.0.1:%BACKEND_PORT%"
set "FRONTEND_URL=http://localhost:%FRONTEND_PORT%"

echo ============================================================
echo   VID - starting local environment
echo ============================================================
echo.

REM ---------------------------------------------------------------------------
REM  [1/6] Python interpreter
REM  Prefer the backend venv. NOTE: the repo-root .venv is ignored on purpose -
REM  it was built under a different Windows user and its python.exe is broken.
REM ---------------------------------------------------------------------------
set "PY="
if exist "backend\.venv\Scripts\python.exe" set "PY=backend\.venv\Scripts\python.exe"
if not defined PY if exist ".venv\Scripts\python.exe" (
    REM Only trust the root venv if its interpreter actually runs.
    ".venv\Scripts\python.exe" --version >nul 2>&1
    if not errorlevel 1 set "PY=.venv\Scripts\python.exe"
)
if not defined PY set "PY=python"

"%PY%" --version >nul 2>&1
if errorlevel 1 (
    echo   [FAIL] No working Python found. Install Python 3.11+ and re-run.
    echo.
    pause
    exit /b 1
)
echo   [1/6] Python            %PY%

REM ---------------------------------------------------------------------------
REM  Environment
REM  server.py calls load_dotenv(backend\.env), so a real .env always wins.
REM  We only set inline defaults when NO .env exists, so the app is runnable
REM  out of the box. Create backend\.env to override anything below.
REM ---------------------------------------------------------------------------
if not exist "backend\.env" (
    echo   [WARN] backend\.env not found - using built-in DEVELOPMENT defaults.
    echo          SMTP is unset, so sign-in codes go to logs\backend.log.
    echo.

    if not defined MONGO_URL set "MONGO_URL=mongodb://localhost:27017"
    if not defined DB_NAME set "DB_NAME=hackpass"
    if not defined EMAIL_FROM_NAME set "EMAIL_FROM_NAME=VID"

    REM Ephemeral per-run secret: every restart signs everyone out. Set a real
    REM JWT_SECRET in backend\.env for anything beyond local development.
    if not defined JWT_SECRET (
        for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "JWT_SECRET=%%i"
    )
)

REM Always needed by the frontend build, and by CORS on the backend.
set "REACT_APP_BACKEND_URL=%BACKEND_URL%"
if not defined CORS_ORIGINS set "CORS_ORIGINS=%FRONTEND_URL%,http://127.0.0.1:%FRONTEND_PORT%"

REM Don't write .pyc/__pycache__ on every import. They'd otherwise regrow the
REM venv (~40 MB of bytecode) after each start; skipping them costs at most a
REM fraction of a second of recompilation at boot.
set "PYTHONDONTWRITEBYTECODE=1"

REM ---------------------------------------------------------------------------
REM  [2/6] Backend packages
REM ---------------------------------------------------------------------------
"%PY%" -c "import uvicorn, fastapi, motor, bcrypt, jwt, dotenv" >nul 2>&1
if errorlevel 1 (
    echo   [2/6] Backend packages  missing - installing, this can take a minute...
    "%PY%" -m pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo   [FAIL] pip install failed. Try manually:
        echo     %PY% -m pip install fastapi starlette uvicorn motor pymongo bcrypt PyJWT python-dotenv python-multipart
        echo.
        pause
        exit /b 1
    )
    echo   [2/6] Backend packages  ready
) else (
    echo   [2/6] Backend packages  ready
)

REM ---------------------------------------------------------------------------
REM  [3/6] MongoDB reachability
REM ---------------------------------------------------------------------------
netstat -ano | findstr /r /c:":27017 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   [3/6] MongoDB           NOT reachable - start MongoDB, or point
    echo          MONGO_URL at your Atlas cluster in backend\.env.
) else (
    echo   [3/6] MongoDB           checked
)

REM ---------------------------------------------------------------------------
REM  [4/6] Frontend packages
REM ---------------------------------------------------------------------------
if not exist "frontend\node_modules" (
    echo   [4/6] Frontend packages missing - installing with yarn, this can
    echo          take several minutes the first time...
    pushd frontend
    call corepack yarn install --network-timeout 600000
    set "YARN_ERR=!errorlevel!"
    popd
    if not "!YARN_ERR!"=="0" (
        echo   [FAIL] yarn install failed. Try manually:
        echo     cd frontend ^&^& corepack yarn install
        echo.
        pause
        exit /b 1
    )
    echo   [4/6] Frontend packages ready
) else (
    echo   [4/6] Frontend packages ready
)

REM ---------------------------------------------------------------------------
REM  [5/6] + [6/6] Start both servers, hidden, writing to logs\
REM ---------------------------------------------------------------------------
if not exist "logs" mkdir "logs"

REM  Who already holds the ports? (prints the process name when a port is busy)
set "BACKEND_HOLD="
for /f "delims=" %%p in ('powershell -NoProfile -Command "$c = Get-NetTCPConnection -State Listen -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue; if ($c) { $q = Get-Process -Id $c[0].OwningProcess -ErrorAction SilentlyContinue; if ($q) { Write-Output $q.Name } }"') do set "BACKEND_HOLD=%%p"
if defined BACKEND_HOLD echo   [WARN] Port %BACKEND_PORT% is already used by !BACKEND_HOLD! - the backend may fail to start.

set "FRONTEND_HOLD="
for /f "delims=" %%p in ('powershell -NoProfile -Command "$c = Get-NetTCPConnection -State Listen -LocalPort %FRONTEND_PORT% -ErrorAction SilentlyContinue; if ($c) { $q = Get-Process -Id $c[0].OwningProcess -ErrorAction SilentlyContinue; if ($q) { Write-Output $q.Name } }"') do set "FRONTEND_HOLD=%%p"
if defined FRONTEND_HOLD echo   [WARN] Port %FRONTEND_PORT% is already used by !FRONTEND_HOLD! - the frontend may fail to start.

echo   [5/6] Starting the backend  -  log: logs\backend.log
set "BACKEND_PID="
for /f "delims=" %%i in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-hidden.ps1" -WorkDir "%~dp0." -Line "%PY% -m uvicorn server:app --host 127.0.0.1 --port %BACKEND_PORT% --app-dir backend > logs\backend.log 2>&1"') do set "BACKEND_PID=%%i"
if not defined BACKEND_PID (
    echo   [WARN] PowerShell helper did not return a PID - using start /b instead.
    start /b /D "%~dp0" cmd /c "%PY% -m uvicorn server:app --host 127.0.0.1 --port %BACKEND_PORT% --app-dir backend > logs\backend.log 2>&1"
)

echo   [6/6] Starting the frontend -  log: logs\frontend.log
set "FRONTEND_PID="
for /f "delims=" %%i in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-hidden.ps1" -WorkDir "%~dp0frontend" -Line "set BROWSER=none&& set PORT=%FRONTEND_PORT%&& corepack yarn start > ..\logs\frontend.log 2>&1"') do set "FRONTEND_PID=%%i"
if not defined FRONTEND_PID (
    echo   [WARN] PowerShell helper did not return a PID - using start /b instead.
    start /b /D "%~dp0frontend" cmd /c "set BROWSER=none&& set PORT=%FRONTEND_PORT%&& corepack yarn start > ..\logs\frontend.log 2>&1"
)

REM Open the frontend once it is actually accepting connections (skipped when
REM VID_NO_BROWSER is set, e.g. by scripts and CI).
if not defined VID_NO_BROWSER (
    start /b powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-frontend.ps1" -Url "%FRONTEND_URL%" -Port %FRONTEND_PORT%
)

echo.
echo ------------------------------------------------------------
echo   backend   %BACKEND_URL%    API docs: /docs
echo   frontend  %FRONTEND_URL%
echo ------------------------------------------------------------
echo.
echo   Sign-in codes appear in logs\backend.log while SMTP is unset.
echo.
echo   Press any key in this window to stop the servers ...
pause >nul

REM ---------------------------------------------------------------------------
REM  Stop everything: kill the trees we started, then free the ports.
REM ---------------------------------------------------------------------------
echo.
if defined BACKEND_PID taskkill /F /T /PID %BACKEND_PID% >nul 2>&1
if defined FRONTEND_PID taskkill /F /T /PID %FRONTEND_PID% >nul 2>&1
ping -n 2 127.0.0.1 >nul
call :kill_port %BACKEND_PORT%
call :kill_port %FRONTEND_PORT%
echo   Both servers stopped.
endlocal
exit /b 0

REM ---- free a TCP port (and its process tree) ------------------------------
:kill_port
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do taskkill /F /T /PID %%p >nul 2>&1
exit /b 0

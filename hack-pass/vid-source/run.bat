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
REM  [1/7] Python interpreter
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
echo   [1/7] Python            %PY%

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
REM  [2/7] Backend packages
REM ---------------------------------------------------------------------------
"%PY%" -c "import uvicorn, fastapi, motor, bcrypt, jwt, dotenv" >nul 2>&1
if errorlevel 1 (
    echo   [2/7] Backend packages  missing - installing, this can take a minute...
    "%PY%" -m pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo   [FAIL] pip install failed. Try manually:
        echo     %PY% -m pip install fastapi starlette uvicorn motor pymongo bcrypt PyJWT python-dotenv python-multipart
        echo.
        pause
        exit /b 1
    )
    echo   [2/7] Backend packages  ready
) else (
    echo   [2/7] Backend packages  ready
)

REM ---------------------------------------------------------------------------
REM  [3/7] Deepfake model weights (~327 MB)
REM  The ONNX model is too big for git (GitHub rejects files over 100 MB), so
REM  it ships as a release asset and is fetched on first run. Without it the
REM  app still runs - it just falls back to the acoustic heuristics.
REM ---------------------------------------------------------------------------
call :ensure_model

REM ---------------------------------------------------------------------------
REM  [4/7] MongoDB reachability
REM ---------------------------------------------------------------------------
netstat -ano | findstr /r /c:":27017 .*LISTENING" >nul 2>&1
if errorlevel 1 (
    echo   [4/7] MongoDB           NOT reachable - start MongoDB, or point
    echo          MONGO_URL at your Atlas cluster in backend\.env.
) else (
    echo   [4/7] MongoDB           checked
)

REM ---------------------------------------------------------------------------
REM  [5/7] Frontend packages
REM ---------------------------------------------------------------------------
if not exist "frontend\node_modules" (
    echo   [5/7] Frontend packages missing - installing with yarn, this can
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
    echo   [5/7] Frontend packages ready
) else (
    echo   [5/7] Frontend packages ready
)

REM ---------------------------------------------------------------------------
REM  [6/7] + [7/7] Start both servers, hidden, writing to logs\
REM ---------------------------------------------------------------------------
if not exist "logs" mkdir "logs"

REM  Who already holds the ports? (prints the process name when a port is busy)
set "BACKEND_HOLD="
for /f "delims=" %%p in ('powershell -NoProfile -Command "$c = Get-NetTCPConnection -State Listen -LocalPort %BACKEND_PORT% -ErrorAction SilentlyContinue; if ($c) { $q = Get-Process -Id $c[0].OwningProcess -ErrorAction SilentlyContinue; if ($q) { Write-Output $q.Name } }"') do set "BACKEND_HOLD=%%p"
if defined BACKEND_HOLD echo   [WARN] Port %BACKEND_PORT% is already used by !BACKEND_HOLD! - the backend may fail to start.

set "FRONTEND_HOLD="
for /f "delims=" %%p in ('powershell -NoProfile -Command "$c = Get-NetTCPConnection -State Listen -LocalPort %FRONTEND_PORT% -ErrorAction SilentlyContinue; if ($c) { $q = Get-Process -Id $c[0].OwningProcess -ErrorAction SilentlyContinue; if ($q) { Write-Output $q.Name } }"') do set "FRONTEND_HOLD=%%p"
if defined FRONTEND_HOLD echo   [WARN] Port %FRONTEND_PORT% is already used by !FRONTEND_HOLD! - the frontend may fail to start.

echo   [6/7] Starting the backend  -  log: logs\backend.log
set "BACKEND_PID="
for /f "delims=" %%i in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-hidden.ps1" -WorkDir "%~dp0." -Line "%PY% -m uvicorn server:app --host 127.0.0.1 --port %BACKEND_PORT% --app-dir backend > logs\backend.log 2>&1"') do set "BACKEND_PID=%%i"
if not defined BACKEND_PID (
    echo   [WARN] PowerShell helper did not return a PID - using start /b instead.
    start /b /D "%~dp0" cmd /c "%PY% -m uvicorn server:app --host 127.0.0.1 --port %BACKEND_PORT% --app-dir backend > logs\backend.log 2>&1"
)

echo   [7/7] Starting the frontend -  log: logs\frontend.log
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

REM ---- fetch the ONNX model on first run -----------------------------------
REM  best_model.onnx is ~327 MB, which git cannot hold (GitHub caps files at
REM  100 MB), so it lives on the v1.0.0 release instead. If you republish the
REM  model, update MODEL_URL's tag and re-compute MODEL_SHA (Get-FileHash).
:ensure_model
set "MODEL_FILE=backend\models\best_model.onnx"
set "MODEL_URL=https://github.com/jatinsai46012/VID-Web-RTC/releases/download/v1.0.0/best_model.onnx"
set "MODEL_SHA=30FFE8F5B73A68420337D13172E306692CC679D1BCAC9404BFFA542D945EBDF6"

if exist "%MODEL_FILE%" (
    echo   [3/7] Model weights     ready
    exit /b 0
)
if defined VID_SKIP_MODEL_DOWNLOAD (
    echo   [3/7] Model weights     missing - detector uses heuristics only
    exit /b 0
)

echo   [3/7] Model weights     missing - downloading ~327 MB, please wait...
if not exist "backend\models" mkdir "backend\models"

REM curl.exe ships with Windows 10 1803+; fall back to PowerShell otherwise.
where curl.exe >nul 2>&1
if not errorlevel 1 (
    curl.exe -L --fail --retry 2 --connect-timeout 20 -o "%MODEL_FILE%.part" "%MODEL_URL%"
) else (
    powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%MODEL_URL%' -OutFile '%MODEL_FILE%.part' -UseBasicParsing } catch { exit 1 }"
)

if not exist "%MODEL_FILE%.part" goto model_fetch_failed

REM Verify before trusting a 327 MB blob - catches truncation and corruption.
powershell -NoProfile -Command "if ((Get-FileHash -Algorithm SHA256 '%MODEL_FILE%.part').Hash -eq '%MODEL_SHA%') { exit 0 } else { exit 1 }"
if errorlevel 1 (
    echo   [WARN] Downloaded model failed its checksum - discarding it.
    del "%MODEL_FILE%.part" >nul 2>&1
    goto model_fetch_failed
)

move /y "%MODEL_FILE%.part" "%MODEL_FILE%" >nul 2>&1
if exist "%MODEL_FILE%" (
    echo   [3/7] Model weights     ready
) else (
    echo   [WARN] Could not save the model - detector uses heuristics only.
)
exit /b 0

:model_fetch_failed
echo   [WARN] Model download failed - detector uses heuristics only.
echo          Download it by hand and save it as %MODEL_FILE%:
echo          %MODEL_URL%
echo          (set VID_SKIP_MODEL_DOWNLOAD=1 to stop run.bat retrying)
exit /b 0

@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages for the first time...
  call npm install || goto :err
)
if not exist Frontend\.env.local (
  echo Missing Frontend\.env.local
  goto :err
)
rem First run only: the desktop database starts from the client data copy
set NELLY_SEED_DB=%~dp0client-data\client-copy.db
cd Frontend
if not exist out\index.html goto :build
if not exist electron\backend.cjs goto :build
if not exist electron\native\better-sqlite3 goto :build
call npx electron .
goto :end
:build
echo Building the desktop app - first time only...
call npm run desktop || goto :err
goto :end
:err
echo.
echo ERROR: read the message above.
:end
pause

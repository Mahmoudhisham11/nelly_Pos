@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages for the first time...
  call npm install || goto :err
)
if not exist client-data\client-copy.db (
  echo Missing client-data\client-copy.db - run file 0 first.
  goto :err
)
if not exist Frontend\serviceAccount.json (
  echo Missing Frontend\serviceAccount.json
  goto :err
)
cd Frontend
node scripts\setup-cloud.mjs ..\client-data\client-copy.db || goto :err
goto :end
:err
echo.
echo ERROR: read the message above.
:end
pause

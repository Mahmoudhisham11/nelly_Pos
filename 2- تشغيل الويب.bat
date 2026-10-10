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
cd Frontend
if not exist .next\BUILD_ID (
  echo Building the web version - about a minute...
  call npm run build:web || goto :err
)
echo.
echo Nelly web is running on http://localhost:3000  - KEEP THIS WINDOW OPEN
start "" http://localhost:3000
call npm run start:web
goto :end
:err
echo.
echo ERROR: read the message above.
:end
pause

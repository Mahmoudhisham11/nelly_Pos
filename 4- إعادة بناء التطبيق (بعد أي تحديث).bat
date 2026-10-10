@echo off
cd /d "%~dp0"
call npm install || goto :err
cd Frontend
echo Rebuilding the web version...
call npm run build:web || goto :err
echo Rebuilding the desktop version...
call npm run prepare:electron || goto :err
call npm run build:electron-backend || goto :err
call npm run build:desktop || goto :err
echo.
echo DONE. Now open the app with file 2 (web) or file 3 (desktop).
goto :end
:err
echo.
echo ERROR: read the message above.
:end
pause

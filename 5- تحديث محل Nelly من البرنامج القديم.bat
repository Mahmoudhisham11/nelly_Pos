@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages for the first time...
  call npm install || goto :err
)
if not exist Frontend\serviceAccount.json (
  echo Missing Frontend\serviceAccount.json
  goto :err
)
cd Frontend
echo Step 1/3: reading a READ-ONLY copy of the latest data from the OLD Firebase project...
node scripts\dump-client-firestore.mjs ..\client-data\client-dump.json || goto :err
node scripts\build-client-db.mjs ..\client-data\client-dump.json ..\client-data\client-copy.db || goto :err
echo.
echo Step 2/3: comparing with shop "nelly-shop" in the NEW project (nothing is written yet)...
node scripts\refresh-shop-from-copy.mjs ..\client-data\client-copy.db nelly-shop || goto :err
echo.
echo Step 3/3: press any key to UPDATE the new project with these changes, or close this window to cancel.
pause >nul
node scripts\refresh-shop-from-copy.mjs ..\client-data\client-copy.db nelly-shop --apply || goto :err
echo.
echo DONE. Open the app: every device downloads the changes by itself.
goto :end
:err
echo.
echo ERROR: read the message above.
:end
pause

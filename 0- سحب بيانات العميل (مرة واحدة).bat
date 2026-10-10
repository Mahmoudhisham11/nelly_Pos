@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Installing packages for the first time...
  call npm install || goto :err
)
echo Reading a READ-ONLY copy of the client data from the old Firebase. Nothing is written there.
cd Frontend
node scripts\dump-client-firestore.mjs ..\client-data\client-dump.json || goto :err
echo.
echo Converting it to the app database format...
node scripts\build-client-db.mjs ..\client-data\client-dump.json ..\client-data\client-copy.db || goto :err
echo.
echo DONE: client-data\client-copy.db is ready.
goto :end
:err
echo.
echo ERROR: read the message above.
:end
pause

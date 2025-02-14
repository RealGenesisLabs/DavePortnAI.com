@echo off
echo Installing dependencies...
call npm install
echo.
echo Starting server...
echo.
node server.js
pause 
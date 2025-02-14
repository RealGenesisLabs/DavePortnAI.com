@echo off
echo Starting server and ngrok tunnel...

:: Start the Node.js server in a new window
start "Node.js Server" cmd /c "node server.js"

:: Wait a moment for the server to start
timeout /t 3 /nobreak

:: Start ngrok and connect to localhost:3000
start "" ngrok http http://localhost:3000

echo Server and ngrok tunnel are running...
echo Check the ngrok window for your public URL
echo Press any key to stop the server and tunnel...
pause >nul

:: Kill both the Node.js server and ngrok processes
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1 
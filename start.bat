@echo off
REM Starts the local server for the Charlie Kirk Case Evidence & Claims Explorer
REM and opens it in the default browser.

setlocal
set PORT=8790
cd /d "%~dp0"

echo Starting server on port %PORT% ...
start "CK_CASE server" /min cmd /c "python -m http.server %PORT%"

REM Give the server a moment to bind before opening the browser
timeout /t 2 /nobreak >nul

echo Opening http://localhost:%PORT% ...
start "" "http://localhost:%PORT%"

echo.
echo Server is running in a minimized window titled "CK_CASE server".
echo Close that window (or press Ctrl+C in it) to stop the server.
endlocal

@echo off
rem Remove the built files in firmware\output (never your games).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0clean.ps1" %*
set RC=%ERRORLEVEL%
pause
exit /b %RC%

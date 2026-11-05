@echo off
rem Build pm: reads firmware\games\pm and the games root set at the top of build.ps1. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -System pm
set RC=%ERRORLEVEL%
if /i not "%~1"=="/nopause" pause
exit /b %RC%

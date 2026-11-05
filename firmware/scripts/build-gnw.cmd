@echo off
rem Build gnw: reads firmware\games\gnw and the games root set at the top of build.ps1. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -System gnw
set RC=%ERRORLEVEL%
if /i not "%~1"=="/nopause" pause
exit /b %RC%

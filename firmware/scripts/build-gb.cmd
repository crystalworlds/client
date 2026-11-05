@echo off
rem Build gb (with gbc): reads firmware\games\gb and the games root set at the top of build.ps1. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -System gb
set RC=%ERRORLEVEL%
if /i not "%~1"=="/nopause" pause
exit /b %RC%

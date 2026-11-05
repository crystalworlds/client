@echo off
rem Build atari5200: reads firmware\games\atari5200 and the games root set at the top of build.ps1. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -System atari5200
set RC=%ERRORLEVEL%
if /i not "%~1"=="/nopause" pause
exit /b %RC%

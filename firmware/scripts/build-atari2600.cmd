@echo off
rem Build atari2600: reads firmware\games\atari2600 and the games root set at the top of build.ps1. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -System atari2600
set RC=%ERRORLEVEL%
if /i not "%~1"=="/nopause" pause
exit /b %RC%

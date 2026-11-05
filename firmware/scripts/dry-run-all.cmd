@echo off
rem List what every build would read (firmware\games and the games root set at the top of build.ps1). Opens, hashes and writes nothing.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" -System all -DryRun
set RC=%ERRORLEVEL%
if /i not "%~1"=="/nopause" pause
exit /b %RC%

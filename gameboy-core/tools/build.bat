@echo off
REM ===========================================================================
REM  build.bat — compile the Game Boy core to freestanding wasm32 for the browser.
REM  Toolchain: clang --target=wasm32 -nostdlib -Wl,--no-entry.
REM  No Emscripten, no libc.
REM
REM  Requires a clang WITH the WebAssembly backend + wasm-ld on PATH.
REM  The Visual Studio-bundled clang does NOT have the wasm target compiled in.
REM  Install a full LLVM:  scoop install llvm
REM ===========================================================================
setlocal enabledelayedexpansion
set ROOT=%~dp0..
set SRC=%ROOT%\src\gb.c
set OUTDIR=%ROOT%\build
set OUT=%OUTDIR%\gb.wasm

REM git cannot track an empty folder, so a fresh clone has no build\ and
REM the linker would fail with "cannot open output file". Make it here.
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

REM GB_DEFS passes -D flags through, as in tools/build.sh, so a build option
REM can be set without editing the source:
REM   set GB_DEFS=FRAME_BUDGET=1  &&  tools/build.bat
set DEFARGS=
if not "%GB_DEFS%"=="" (for %%D in (%GB_DEFS%) do set DEFARGS=!DEFARGS! -D%%D)

set CLANG=%USERPROFILE%\scoop\apps\llvm\current\bin\clang.exe
if not exist "%CLANG%" (
  echo [build] ERROR: wasm-capable clang not found at %CLANG%
  echo         Install a full LLVM:  scoop install llvm
  exit /b 1
)

echo [build] "%CLANG%" --target=wasm32 -O2 -nostdlib ... -^> build\gb.wasm
"%CLANG%" ^
  --target=wasm32 ^
  -nostdlib -O2 -flto -Wall -Wextra -ffreestanding ^
  -Wl,--no-entry ^
  -Wl,--strip-all ^
  -Wl,--export-dynamic ^
  -Wl,-z,stack-size=131072 ^
  -Wl,--allow-undefined %DEFARGS% ^
  -o "%OUT%" "%SRC%"

if errorlevel 1 ( echo [build] FAILED & exit /b 1 )
for %%F in ("%OUT%") do echo [build] OK: %%~zF bytes -^> %OUT%
endlocal

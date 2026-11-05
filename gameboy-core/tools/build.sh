#!/usr/bin/env bash
# build.sh — compile the Game Boy core to freestanding wasm32 for the browser.
# Toolchain: clang --target=wasm32 -nostdlib -Wl,--no-entry.
# No Emscripten, no libc.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# GB_SRC builds from a copy of the core instead of src/gb.c, so a build can
# be made from a fixed snapshot while the tree is being edited.
SRC="${GB_SRC:-$ROOT/src/gb.c}"

# GB_DEFS passes -D flags through to the compiler, so a build option can be
# set without editing the source. For example, the frame-boundary check
# builds both FRAME_BUDGET=1 and FRAME_BUDGET=0:
#
#   GB_DEFS="FRAME_BUDGET=1" bash tools/build.sh
GB_DEFS="${GB_DEFS:-}"
DEFARGS=()
for d in $GB_DEFS; do DEFARGS+=("-D$d"); done
OUTDIR="$ROOT/build"
OUT="$OUTDIR/gb.wasm"
# A fresh clone has no build/ folder (git does not track empty folders) and
# wasm-ld does not create one, so make it here.
mkdir -p "$OUTDIR"

# The clang that comes with Visual Studio has no wasm backend, and a new
# scoop install may not be on the PATH of an already open shell. So the
# wasm-capable scoop LLVM is used by its full path when it is there.
SCOOP_LLVM="${SCOOP_LLVM:-$HOME/scoop/apps/llvm/current/bin}"
if [ -x "$SCOOP_LLVM/clang.exe" ]; then
  CLANG="$SCOOP_LLVM/clang.exe"
elif command -v clang >/dev/null 2>&1 && clang --print-targets 2>/dev/null | grep -q wasm32; then
  CLANG="clang"
else
  echo "[build] ERROR: no wasm-capable clang. Expected $SCOOP_LLVM/clang.exe (scoop install llvm)." >&2
  exit 1
fi

echo "[build] $CLANG --target=wasm32 -O2 -nostdlib ${GB_DEFS:+[-D$GB_DEFS] }... -> build/gb.wasm"
"$CLANG" \
  --target=wasm32 \
  -nostdlib -O2 -flto -Wall -Wextra -ffreestanding \
  -Wl,--no-entry \
  -Wl,--strip-all \
  -Wl,--export-dynamic \
  -Wl,-z,stack-size=131072 \
  -Wl,--allow-undefined \
  ${DEFARGS[@]+"${DEFARGS[@]}"} \
  -o "$OUT" "$SRC"

echo "[build] OK: $(stat -c%s "$OUT" 2>/dev/null || wc -c < "$OUT") bytes -> $OUT"

#!/usr/bin/env bash
# Build a single-file Linux AppImage.  The produced artifact bundles Electron,
# the renderer, all fonts, and the game code; no Node/Electron install is
# required on the target machine.
set -euo pipefail
cd "$(dirname "$0")"

BUILDER=""
if [ -x node_modules/.bin/electron-builder ]; then
  BUILDER="node_modules/.bin/electron-builder"
elif command -v electron-builder >/dev/null 2>&1; then
  BUILDER="$(command -v electron-builder)"
elif [ -x "../DADA (kopya)/node_modules/.bin/electron-builder" ]; then
  # Local development fallback: use the sibling toolchain without copying a
  # 200 MB node_modules tree into the project.
  BUILDER="../DADA (kopya)/node_modules/.bin/electron-builder"
else
  echo "electron-builder bulunamadi." >&2
  echo "Kurulum: npm install --save-dev electron electron-builder" >&2
  exit 1
fi

rm -rf dist/linux-unpacked
"$BUILDER" --linux AppImage --x64

ARTIFACT="dist/LIMBO-Sistem-Anomalisi-1.0.0.AppImage"
if [ -f "$ARTIFACT" ]; then
  chmod +x "$ARTIFACT"
  echo
  echo "HAZIR: $ARTIFACT"
  echo "Calistir: ./$ARTIFACT"
else
  echo "Beklenen cikti bulunamadi: $ARTIFACT" >&2
  exit 1
fi

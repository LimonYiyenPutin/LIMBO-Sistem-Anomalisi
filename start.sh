#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export LIMBO_LAUNCH_DIR="${LIMBO_LAUNCH_DIR:-$PWD}"

if [ -x .tools/electron/electron ]; then
  exec ./.tools/electron/electron . --no-sandbox "$@"
fi

exec electron . "$@"

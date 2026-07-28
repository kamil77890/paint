#!/usr/bin/env bash
# Always kill any previous Paint instance, then launch a fresh one.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_BIN="$ROOT/node_modules/.bin/electron"
PATTERN="$ROOT/node_modules/electron/dist/electron"

if [[ ! -x "$ELECTRON_BIN" && ! -f "$ELECTRON_BIN" ]]; then
  echo "Electron not found. Run: npm install" >&2
  exit 1
fi

# Kill only running Paint electron processes (not this shell).
while read -r pid; do
  [[ -z "$pid" ]] && continue
  [[ "$pid" == "$$" || "$pid" == "$PPID" ]] && continue
  kill "$pid" 2>/dev/null || true
done < <(pgrep -f "$PATTERN" || true)

sleep 0.35

cd "$ROOT"
exec "$ELECTRON_BIN" . --reset "$@"

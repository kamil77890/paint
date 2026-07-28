#!/usr/bin/env bash
# Region screenshot → unused Hyprland workspace → Paint with the capture loaded.
set -euo pipefail

DIR="${HOME}/Pictures/Screenshots"
mkdir -p "$DIR"
FILE="${DIR}/paint_$(date +'%Y-%m-%d_%H-%M-%S').png"
# Resolve symlinks (e.g. ~/.local/bin/paint-screenshot) so ROOT is drawing-app.
SCRIPT_PATH="$(readlink -f "$0")"
ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
START="$ROOT/scripts/start.sh"
if [[ ! -x "$START" ]]; then
  notify-send -a "Paint" "Screenshot" "Paint launcher missing: $START"
  exit 1
fi

# Area select; Esc cancels (same as ~/.local/bin/screenshot.sh)
GEO="$(slurp)" || exit 0
grim -g "$GEO" "$FILE"
wl-copy < "$FILE"

# First workspace 1–20 with zero windows (or not yet created).
WS="$(
  hyprctl workspaces -j | python3 -c '
import json, sys
ws = {w["id"]: w.get("windows", 0) for w in json.load(sys.stdin)}
for i in range(1, 21):
    if ws.get(i, 0) == 0:
        print(i)
        break
else:
    print((max(ws) + 1) if ws else 1)
'
)"

hyprctl dispatch workspace "$WS" >/dev/null
# Brief settle so the new Electron window lands on the active workspace.
sleep 0.08

notify-send -a "Paint" "Screenshot" "Workspace ${WS}: ${FILE}"
exec "$START" --open="$FILE"

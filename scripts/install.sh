#!/usr/bin/env bash
# Copy the plugin (and optionally the example theme) into a Hermes home.
#
#   scripts/install.sh            # plugin only
#   scripts/install.sh --theme    # plugin + themes/starter.yaml
#
# Honours HERMES_HOME (default ~/.hermes). PLUGIN_NAME must match
# "name" in plugin/dashboard/manifest.json (default: starter).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
PLUGIN_NAME="${PLUGIN_NAME:-starter}"
DEST="$HERMES_HOME/plugins/$PLUGIN_NAME"

mkdir -p "$DEST"
rm -rf "$DEST/dashboard"
cp -R "$ROOT/plugin/dashboard" "$DEST/dashboard"
find "$DEST" -name '__pycache__' -type d -prune -exec rm -rf {} +
echo "plugin  -> $DEST/dashboard"

if [[ "${1:-}" == "--theme" ]]; then
  mkdir -p "$HERMES_HOME/dashboard-themes"
  cp "$ROOT/themes/starter.yaml" "$HERMES_HOME/dashboard-themes/starter.yaml"
  echo "theme   -> $HERMES_HOME/dashboard-themes/starter.yaml"
fi

cat <<MSG

Next:
  1. Allow the plugin's Python backend:   hermes plugins enable $PLUGIN_NAME
  2. Restart the dashboard (backend routes mount at startup only).
  3. Open the "$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['label'])" "$ROOT/plugin/dashboard/manifest.json")" tab.
MSG

#!/usr/bin/env bash
# Patch GsmEvil2 for flask-socketio 5.x compatibility
# Called by gsmevil-patch.service (Type=oneshot, Before=gsmevil.service)
# Idempotent: checks if patch already applied before modifying files.
set -uo pipefail

LOG_TAG="gsmevil-patch"
log() { logger -t "$LOG_TAG" "$*"; echo "[$LOG_TAG] $*"; }

# Locate GsmEvil2 directory
GSMEVIL_DIR="${GSMEVIL_DIR:-$HOME/gsmevil2}"
if [[ ! -d "$GSMEVIL_DIR" ]]; then
  log "GsmEvil2 not found at $GSMEVIL_DIR — skipping patch"
  exit 0
fi

APP_FILE="$GSMEVIL_DIR/app.py"
if [[ ! -f "$APP_FILE" ]]; then
  log "app.py not found in $GSMEVIL_DIR — skipping patch"
  exit 0
fi

PATCH_MARKER="# ARGOS-PATCHED: flask-socketio 5.x"

# Check if already patched
if grep -q "$PATCH_MARKER" "$APP_FILE" 2>/dev/null; then
  log "Already patched — nothing to do"
  exit 0
fi

log "Patching $APP_FILE for flask-socketio 5.x compatibility..."

# Backup original
cp "$APP_FILE" "$APP_FILE.bak"

# Patch 1: Fix SocketIO initialization (add async_mode='threading' if missing)
if ! grep -q "async_mode" "$APP_FILE"; then
  sed -i 's/SocketIO(app)/SocketIO(app, async_mode="threading")/' "$APP_FILE"
  log "  Fixed: added async_mode='threading' to SocketIO init"
fi

# Patch 2: Fix emit calls that use deprecated string namespace format
# flask-socketio 5.x requires namespace parameter as keyword argument
sed -i "s/socketio\.emit(\([^,]*\), \([^,]*\), '\/')/socketio.emit(\1, \2, namespace='\/')/" "$APP_FILE" 2>/dev/null || true

# Add patch marker
echo "$PATCH_MARKER" >> "$APP_FILE"

# Verify
if grep -q "$PATCH_MARKER" "$APP_FILE"; then
  log "Patch applied successfully"
  exit 0
else
  log "ERROR: Patch verification failed"
  cp "$APP_FILE.bak" "$APP_FILE"
  exit 1
fi

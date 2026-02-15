#!/bin/sh
# =============================================================================
# dev-sync.sh — Container Dependency Synchronization
# =============================================================================
# Ensures the container's node_modules Docker volume matches the current
# package-lock.json. Prevents version skew between host and container when
# dependencies are updated on the host side.
#
# This script runs BEFORE the dev server starts. It compares an MD5 hash of
# package-lock.json against a stored hash in the node_modules volume. If they
# differ, it runs npm ci to synchronize, then regenerates .svelte-kit.
#
# Performance: ~100ms when dependencies are current (hash comparison only).
# Full sync: ~30-60s on NVMe SSD when package-lock.json has changed.
#
# Standards: CERT Secure Coding (input validation), NASA/JPL Rule 15 (assertions)
# =============================================================================
set -e

LOCK_FILE="/app/package-lock.json"
HASH_FILE="/app/node_modules/.lockfile-hash"
SYNC_LOG="/tmp/dev-sync.log"

log() {
    echo "[dev-sync] $1"
}

error() {
    echo "[dev-sync] ERROR: $1" >&2
}

# ---- Pre-condition: package-lock.json must exist ----
if [ ! -f "$LOCK_FILE" ]; then
    error "package-lock.json not found at $LOCK_FILE"
    error "Is the source bind-mounted at /app?"
    exit 1
fi

# ---- Pre-condition: node_modules directory must exist ----
if [ ! -d "/app/node_modules" ]; then
    error "node_modules directory not found. Running initial install..."
    cd /app
    npm ci --ignore-scripts 2>&1 | tee "$SYNC_LOG"
    npm rebuild better-sqlite3 node-pty 2>&1 | tee -a "$SYNC_LOG"
    npx svelte-kit sync 2>&1 | tee -a "$SYNC_LOG"
    md5sum "$LOCK_FILE" | cut -d' ' -f1 > "$HASH_FILE"
    log "Initial install complete."
    exit 0
fi

# ---- Compute current lockfile hash ----
CURRENT_HASH=$(md5sum "$LOCK_FILE" | cut -d' ' -f1)
STORED_HASH=""

if [ -f "$HASH_FILE" ]; then
    STORED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")
fi

# ---- Compare and sync if needed ----
if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
    log "Dependencies changed (${STORED_HASH:-initial} -> $CURRENT_HASH)"
    log "Synchronizing container node_modules..."
    cd /app

    # Use npm ci for deterministic installs. --ignore-scripts prevents
    # husky (prepare script) from failing in non-git container contexts.
    npm ci --ignore-scripts 2>&1 | tee "$SYNC_LOG"

    # Rebuild native modules for the container's Node.js ABI.
    # better-sqlite3: SQLite database driver with native bindings
    # node-pty: terminal emulator for dashboard terminal (host binary won't load in container)
    npm rebuild better-sqlite3 node-pty 2>&1 | tee -a "$SYNC_LOG"

    # Store the new hash AFTER successful install
    echo "$CURRENT_HASH" > "$HASH_FILE"

    # Regenerate .svelte-kit to match the new SvelteKit version
    log "Regenerating .svelte-kit..."
    npx svelte-kit sync 2>&1 | tee -a "$SYNC_LOG"

    log "Sync complete. Log: $SYNC_LOG"
else
    SHORT_HASH=$(echo "$CURRENT_HASH" | cut -c1-8)
    log "Dependencies up to date (hash: ${SHORT_HASH}...)"
fi

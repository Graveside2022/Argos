#!/bin/bash
# scripts/ops/keepalive-dev.sh
# Monitors and restarts critical dev services (Argos Vite + Socat Debugger)
#
# Lock file protocol: When npm run kill-dev is running, it creates a lock file
# so the keepalive won't race to restart Vite during a manual restart cycle.
#
# IMPORTANT: This script starts Vite DIRECTLY via the oom-protect wrapper,
# NOT via "npm run dev" (which destructively kill-devs first and causes
# a restart storm). Only the user should run "npm run dev" manually.

# Monitor ports every X seconds
CHECK_INTERVAL=10
RESTART_COOLDOWN=30  # seconds — skip checks after a restart to let Vite boot
LOG_DIR="logs"
LOCKFILE="/tmp/argos-dev-restart.lock"
LOCK_MAX_AGE=30  # seconds — stale lock protection
LAST_RESTART=0   # epoch timestamp of last restart attempt

# Circuit breaker: stop retrying after consecutive failures
MAX_CONSECUTIVE_FAILURES=10
CONSECUTIVE_FAILURES=0
CIRCUIT_OPEN=false
CIRCUIT_OPEN_SINCE=0
CIRCUIT_RESET_INTERVAL=300  # 5 minutes — try again after this long

# Ensure log directory exists
mkdir -p "$LOG_DIR"

log() {
    echo -e "\033[0;32m[$(date +'%T')] $1\033[0m"
}

warn() {
    echo -e "\033[1;33m[$(date +'%T')] [WARN] $1\033[0m"
}

is_locked() {
    if [ -f "$LOCKFILE" ]; then
        # Check for stale lock (older than LOCK_MAX_AGE seconds)
        local lock_age
        lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCKFILE" 2>/dev/null || echo 0) ))
        if [ "$lock_age" -gt "$LOCK_MAX_AGE" ]; then
            warn "Stale lock file detected (${lock_age}s old). Removing."
            rm -f "$LOCKFILE"
            return 1
        fi
        return 0
    fi
    return 1
}

in_cooldown() {
    local now
    now=$(date +%s)
    local elapsed=$(( now - LAST_RESTART ))
    if [ "$elapsed" -lt "$RESTART_COOLDOWN" ]; then
        return 0  # still in cooldown
    fi
    return 1
}

check_vite() {
    if lsof -ti:5173 > /dev/null; then
        # Vite is up — reset circuit breaker if it was tripped
        if [ "$CONSECUTIVE_FAILURES" -gt 0 ] || [ "$CIRCUIT_OPEN" = true ]; then
            log "Vite is back. Resetting circuit breaker (was ${CONSECUTIVE_FAILURES} failures)."
            CONSECUTIVE_FAILURES=0
            CIRCUIT_OPEN=false
        fi
        return
    fi

    # --- Vite is DOWN ---

    # Circuit breaker: stop hammering if we've failed too many times
    if [ "$CIRCUIT_OPEN" = true ]; then
        local now elapsed
        now=$(date +%s)
        elapsed=$(( now - CIRCUIT_OPEN_SINCE ))
        if [ "$elapsed" -lt "$CIRCUIT_RESET_INTERVAL" ]; then
            # Still in cooldown — stay quiet (log once per minute max)
            if [ $(( elapsed % 60 )) -lt "$CHECK_INTERVAL" ]; then
                log "Circuit breaker OPEN (${elapsed}s/${CIRCUIT_RESET_INTERVAL}s). Waiting before retry."
            fi
            return
        fi
        # Enough time passed — allow one probe attempt
        warn "Circuit breaker reset after ${CIRCUIT_RESET_INTERVAL}s. Probing..."
        CIRCUIT_OPEN=false
        CONSECUTIVE_FAILURES=0
    fi

    # Back off if a manual restart is in progress
    if is_locked; then
        log "Lock file present — manual restart in progress. Skipping."
        return
    fi

    # Back off if we recently restarted (Vite needs time to boot)
    if in_cooldown; then
        log "Cooldown active ($(( $(date +%s) - LAST_RESTART ))s/${RESTART_COOLDOWN}s). Skipping."
        return
    fi

    warn "Vite server (port 5173) is DOWN. Attempting restart (try $((CONSECUTIVE_FAILURES + 1))/${MAX_CONSECUTIVE_FAILURES})..."
    LAST_RESTART=$(date +%s)

    # Kill any stale tmux session (but NOT the Vite process — it's already dead)
    tmux kill-session -t argos-dev 2>/dev/null

    # Start Vite DIRECTLY via oom-protect wrapper in a detached tmux session.
    # Do NOT use "npm run dev" here — it runs kill-dev first which would
    # destroy any running Vite instance and cause a restart storm.
    tmux new-session -d -s argos-dev \
        "./scripts/dev/vite-oom-protect.sh 2>&1 | tee /tmp/argos-dev.log"

    sleep 8  # Vite takes 3-6s to bind port; wait longer to be sure
    if lsof -ti:5173 > /dev/null; then
        log "Vite server restarted successfully."
        CONSECUTIVE_FAILURES=0
        CIRCUIT_OPEN=false
    else
        CONSECUTIVE_FAILURES=$(( CONSECUTIVE_FAILURES + 1 ))
        warn "Failed to restart Vite (${CONSECUTIVE_FAILURES}/${MAX_CONSECUTIVE_FAILURES}). Check /tmp/argos-dev.log."

        if [ "$CONSECUTIVE_FAILURES" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
            warn "CIRCUIT BREAKER OPEN: ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Pausing Vite restarts for ${CIRCUIT_RESET_INTERVAL}s."
            warn "Run 'npm run dev' manually to restart, or wait for auto-retry."
            CIRCUIT_OPEN=true
            CIRCUIT_OPEN_SINCE=$(date +%s)
        fi
    fi
}

check_socat() {
    if ! lsof -ti:99 > /dev/null; then
        warn "Debug proxy (port 99) is DOWN. Attempting restart..."
        
        # Check if Chromium is actually running on 9222 first
        if lsof -ti:9222 > /dev/null; then
            # Start socat in background
            nohup socat TCP-LISTEN:99,fork TCP:127.0.0.1:9222 >> "$LOG_DIR/keepalive_socat.log" 2>&1 &
            sleep 1
            if lsof -ti:99 > /dev/null; then
                log "Debug proxy (socat) restarted successfully."
            else
                warn "Failed to start socat on port 99."
            fi
        else
            warn "Cannot start proxy: Chromium debugger (port 9222) is not running."
        fi
    fi
}

check_chromium() {
    if ! lsof -ti:9222 > /dev/null; then
        warn "Chromium debugger (port 9222) is DOWN. Checking Xvfb..."
        
        # Check Xvfb (Display :99)
        if ! pgrep -f "Xvfb.*:99" > /dev/null; then
            warn "Xvfb :99 is DOWN. Restarting..."
            Xvfb :99 -screen 0 1280x1024x24 >> "$LOG_DIR/xvfb.log" 2>&1 &
            sleep 2
        fi
        
        export DISPLAY=:99
        warn "Restarting Chromium in headless debug mode..."
        # Launch Chromium with remote debugging on 9222
        nohup chromium --no-sandbox --remote-debugging-port=9222 http://localhost:5173/dashboard >> "$LOG_DIR/chromium.log" 2>&1 &
        sleep 5
        
        if lsof -ti:9222 > /dev/null; then
            log "Chromium restarted successfully."
        else
            warn "Failed to restart Chromium."
        fi
    fi
}

log "Starting Argos Dev Keepalive Monitor..."
log "Monitoring Vite (5173), Chromium (9222), and Proxy (99)."

while true; do
    check_vite
    check_chromium
    check_socat
    sleep "$CHECK_INTERVAL"
done

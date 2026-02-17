#!/bin/bash
# scripts/ops/keepalive-dev.sh
# Monitors and restarts critical dev services (Argos Vite + Socat Debugger)
#
# Lock file protocol: When npm run kill-dev is running, it creates a lock file
# so the keepalive won't race to restart Vite during a manual restart cycle.

# Monitor ports every X seconds
CHECK_INTERVAL=10
LOG_DIR="logs"
LOCKFILE="/tmp/argos-dev-restart.lock"
LOCK_MAX_AGE=30  # seconds — stale lock protection

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

check_vite() {
    if ! lsof -ti:5173 > /dev/null; then
        # Back off if a manual restart is in progress
        if is_locked; then
            log "Lock file present — manual restart in progress. Skipping."
            return
        fi

        warn "Vite server (port 5173) is DOWN. Attempting restart..."
        # Kill any stale session first
        tmux kill-session -t argos-dev 2>/dev/null

        # Start Vite (detached tmux session)
        npm run dev >> "$LOG_DIR/keepalive_vite.log" 2>&1

        sleep 5
        if lsof -ti:5173 > /dev/null; then
            log "Vite server restarted successfully."
        else
            warn "Failed to restart Vite. Check /tmp/argos-dev.log for details."
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

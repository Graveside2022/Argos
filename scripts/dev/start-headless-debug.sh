#!/bin/bash
# scripts/dev/start-headless-debug.sh
# Automates setup of headless debugging proxy (socat) for Chromium

# Configuration
DEBUG_PORT=99
DEBUG_TARGET=9222
LOG_FILE="logs/socat.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

mkdir -p logs

log() { echo -e "${GREEN}[$(date +'%T')] $1${NC}"; }
err() { echo -e "${RED}[$(date +'%T')] $1${NC}"; }

check_chromium() {
    if ! lsof -ti:$DEBUG_TARGET > /dev/null; then
        err "Chromium debugger (port $DEBUG_TARGET) is NOT running."
        err "Ensure Chromium is launched with --remote-debugging-port=$DEBUG_TARGET"
        exit 1
    fi
}

start_proxy() {
    if lsof -ti:$DEBUG_PORT > /dev/null; then
        log "Debug proxy (port $DEBUG_PORT) is already running."
    else
        log "Starting debug proxy (port $DEBUG_PORT -> $DEBUG_TARGET)..."
        nohup socat TCP-LISTEN:$DEBUG_PORT,fork TCP:127.0.0.1:$DEBUG_TARGET > "$LOG_FILE" 2>&1 &
        sleep 1
        
        if lsof -ti:$DEBUG_PORT > /dev/null; then
            log "Success! Connect your debugger to port $DEBUG_PORT."
        else
            err "Failed to start socat. Check $LOG_FILE."
            exit 1
        fi
    fi
}

check_chromium
start_proxy

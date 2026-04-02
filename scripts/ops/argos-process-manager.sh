#!/usr/bin/env bash
# Argos Process Lifecycle Manager
# Monitors critical services, restarts on failure, cleans orphan processes.
# Usage: argos-process-manager.sh monitor
set -uo pipefail

LOG_TAG="argos-process-manager"

# Timing
POLL_INTERVAL=30
COOLDOWN_SECS=300
ORPHAN_INTERVAL=5  # Run orphan cleanup every Nth iteration
BOOT_DELAY=60
MEM_THRESHOLD=85

# State
declare -A LAST_RESTART_TIME
declare -A CONSECUTIVE_FAILURES
ITERATION=0

log()  { logger -t "$LOG_TAG" "$*"; echo "[$LOG_TAG] $*"; }
warn() { log "[WARN] $*"; }

mem_usage_pct() {
  awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d", (t-a)/t*100}' /proc/meminfo
}

check_service() {
  local svc="$1"
  systemctl is-active "$svc" >/dev/null 2>&1
}

restart_service() {
  local svc="$1"
  local now
  now=$(date +%s)
  local last=${LAST_RESTART_TIME[$svc]:-0}
  local failures=${CONSECUTIVE_FAILURES[$svc]:-0}

  # Circuit breaker: 10 consecutive failures → pause 10 min
  if (( failures >= 10 )); then
    if (( now - last < 600 )); then
      return
    fi
    log "Circuit breaker reset for $svc after 10min cooldown"
    CONSECUTIVE_FAILURES[$svc]=0
  fi

  # Cooldown per service
  if (( now - last < COOLDOWN_SECS )); then
    return
  fi

  # Memory pressure gate
  local mem_pct
  mem_pct=$(mem_usage_pct)
  if (( mem_pct >= MEM_THRESHOLD )); then
    warn "Skipping restart of $svc — RAM at ${mem_pct}%"
    return
  fi

  log "Restarting $svc (failure #$((failures + 1)))"
  if systemctl restart "$svc" 2>/dev/null; then
    log "$svc restarted successfully"
    CONSECUTIVE_FAILURES[$svc]=0
  else
    CONSECUTIVE_FAILURES[$svc]=$((failures + 1))
    warn "$svc restart failed (attempt #${CONSECUTIVE_FAILURES[$svc]})"
  fi
  LAST_RESTART_TIME[$svc]=$now
}

check_critical_services() {
  # earlyoom — protects the entire system
  if ! check_service "earlyoom"; then
    warn "earlyoom is down — OOM protection disabled"
    restart_service "earlyoom"
  fi

  # gpsd — needed for TAK SA broadcaster
  if ! check_service "gpsd"; then
    warn "gpsd is down"
    restart_service "gpsd"
  fi

  # Argos app — check if either production or dev is expected
  if systemctl is-enabled argos-final >/dev/null 2>&1; then
    if ! check_service "argos-final"; then
      warn "argos-final is down"
      restart_service "argos-final"
    fi
  fi
}

cleanup_orphans() {
  local killed=0

  # tshark/dumpcap older than 1 hour
  while IFS= read -r pid; do
    local age_secs
    age_secs=$(( $(date +%s) - $(stat -c %Y "/proc/$pid" 2>/dev/null || echo "$(date +%s)") ))
    if (( age_secs > 3600 )); then
      log "Killing orphan tshark/dumpcap (PID=$pid, age=${age_secs}s)"
      kill "$pid" 2>/dev/null || true
      ((killed++)) || true
    fi
  done < <(pgrep -f 'tshark|dumpcap' 2>/dev/null || true)

  # Puppeteer Chromium older than 2 hours
  while IFS= read -r pid; do
    local age_secs
    age_secs=$(( $(date +%s) - $(stat -c %Y "/proc/$pid" 2>/dev/null || echo "$(date +%s)") ))
    if (( age_secs > 7200 )); then
      log "Killing orphan Puppeteer Chromium (PID=$pid, age=${age_secs}s)"
      kill "$pid" 2>/dev/null || true
      ((killed++)) || true
    fi
  done < <(pgrep -f 'puppeteer_' 2>/dev/null || true)

  # Orphan bun worker-service.cjs daemons (PPID=1 or parent=systemd, age > 30s)
  while IFS= read -r pid; do
    local ppid
    ppid=$(awk '{print $4}' "/proc/$pid/stat" 2>/dev/null || echo "0")
    local parent_comm
    parent_comm=$(cat "/proc/$ppid/comm" 2>/dev/null || echo "unknown")
    if [[ "$ppid" == "1" || "$parent_comm" == "systemd" ]]; then
      local age_secs
      age_secs=$(( $(date +%s) - $(stat -c %Y "/proc/$pid" 2>/dev/null || echo "$(date +%s)") ))
      if (( age_secs > 30 )); then
        log "Killing orphan bun worker (PID=$pid, PPID=$ppid, age=${age_secs}s)"
        kill "$pid" 2>/dev/null || true
        ((killed++)) || true
      fi
    fi
  done < <(pgrep -f 'worker-service.cjs.*--daemon' 2>/dev/null || true)

  if (( killed > 0 )); then
    log "Cleaned $killed orphan processes"
  fi
}

monitor() {
  # Boot delay
  local uptime
  uptime=$(awk '{printf "%d", $1}' /proc/uptime)
  if (( uptime < BOOT_DELAY )); then
    local wait=$((BOOT_DELAY - uptime))
    log "Boot delay: waiting ${wait}s"
    sleep "$wait"
  fi

  log "Started — polling every ${POLL_INTERVAL}s, orphan cleanup every $((POLL_INTERVAL * ORPHAN_INTERVAL))s"

  while true; do
    check_critical_services

    ((ITERATION++)) || true
    if (( ITERATION % ORPHAN_INTERVAL == 0 )); then
      cleanup_orphans
    fi

    sleep "$POLL_INTERVAL"
  done
}

case "${1:-}" in
  monitor) monitor ;;
  *)
    echo "Usage: $0 monitor"
    exit 1
    ;;
esac

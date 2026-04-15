#!/bin/bash
#
# argos-keepalive.sh — Production process manager for Argos
# Monitors argos.service health, memory usage, and duplicate processes.
# Modes: single check (default), --daemon, --status, --stop
#

set -uo pipefail

# Configuration
ARGOS_SERVICE="argos.service"
MEMORY_THRESHOLD_MB=3500
CHECK_INTERVAL=${CHECK_INTERVAL:-60}
LOG_FILE="${LOG_FILE:-logs/argos-keepalive.log}"
PID_FILE="${PID_FILE:-/tmp/argos-keepalive.pid}"
MAX_FAILURES=10

# State
FAILURE_COUNT=0
RUNNING=true

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" >> "$LOG_FILE"
  [[ "${DEBUG:-0}" == "1" ]] && echo "$msg"
}

get_memory_used_mb() {
  awk '/MemAvailable/ {avail=$2} /MemTotal/ {total=$2} END {printf "%d", (total - avail) / 1024}' /proc/meminfo
}

prune_duplicate_vite_processes() {
  local pids
  pids=$(pgrep -f 'node.*vite' 2>/dev/null | sort -n)
  local count
  count=$(echo "$pids" | grep -c '[0-9]' 2>/dev/null || echo 0)

  if [[ "$count" -gt 1 ]]; then
    log "Found $count Vite processes — pruning duplicates"
    echo "$pids" | tail -n +2 | while read -r pid; do
      kill "$pid" 2>/dev/null && log "Killed duplicate Vite process $pid"
    done
  fi
}

check_service() {
  if ! systemctl is-active --quiet "$ARGOS_SERVICE" 2>/dev/null; then
    log "WARNING: $ARGOS_SERVICE is not active"
    ((FAILURE_COUNT++))

    if [[ $FAILURE_COUNT -ge $MAX_FAILURES ]]; then
      log "ERROR: Circuit breaker tripped after $MAX_FAILURES failures — pausing restarts"
      return 1
    fi

    local mem_used
    mem_used=$(get_memory_used_mb)
    if [[ $mem_used -gt $MEMORY_THRESHOLD_MB ]]; then
      log "WARNING: Memory at ${mem_used}MB (threshold ${MEMORY_THRESHOLD_MB}MB) — skipping restart"
      return 1
    fi

    log "Restarting $ARGOS_SERVICE (failure $FAILURE_COUNT/$MAX_FAILURES)..."
    sudo systemctl restart "$ARGOS_SERVICE" 2>/dev/null
    if systemctl is-active --quiet "$ARGOS_SERVICE" 2>/dev/null; then
      log "Service restarted successfully"
      FAILURE_COUNT=0
    else
      log "ERROR: Restart failed"
    fi
  else
    FAILURE_COUNT=0
  fi
}

check_memory() {
  local mem_used
  mem_used=$(get_memory_used_mb)
  if [[ $mem_used -gt $MEMORY_THRESHOLD_MB ]]; then
    log "WARNING: Memory usage ${mem_used}MB exceeds threshold ${MEMORY_THRESHOLD_MB}MB"
  fi
}

single_check() {
  log "running single check"
  check_service
  check_memory
  prune_duplicate_vite_processes
  log "Single check completed"
}

run_daemon() {
  if [[ -f "$PID_FILE" ]]; then
    local existing_pid
    existing_pid=$(cat "$PID_FILE")
    if kill -0 "$existing_pid" 2>/dev/null; then
      echo "already running (PID: $existing_pid)"
      exit 1
    fi
    rm -f "$PID_FILE"
  fi

  # Ensure log directory exists
  mkdir -p "$(dirname "$LOG_FILE")"

  echo $$ > "$PID_FILE"
  log "Daemon started (PID: $$, interval: ${CHECK_INTERVAL}s)"

  trap 'RUNNING=false; log "Daemon stopping (signal received)"; rm -f "$PID_FILE"; exit 0' SIGTERM SIGINT

  while $RUNNING; do
    single_check
    sleep "$CHECK_INTERVAL" &
    wait $! 2>/dev/null || true
  done
}

show_status() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "running (PID: $pid)"
      return 0
    fi
  fi
  echo "not running"
  return 1
}

stop_daemon() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      rm -f "$PID_FILE"
      echo "Stopped (PID: $pid)"
      return 0
    fi
    rm -f "$PID_FILE"
  fi
  echo "not running"
  return 1
}

show_help() {
  cat << 'HELP'
Usage: argos-keepalive.sh [OPTION]

Production process manager for Argos. Monitors service health,
memory usage, and duplicate processes.

Options:
  --daemon    Run continuously in background
  --status    Check if daemon is running
  --stop      Stop running daemon
  --help      Show this help

Environment:
  LOG_FILE    Log file path (default: logs/argos-keepalive.log)
  PID_FILE    PID file path (default: /tmp/argos-keepalive.pid)
  CHECK_INTERVAL  Seconds between checks in daemon mode (default: 60)
  DEBUG       Set to 1 for verbose output
HELP
}

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

case "${1:-}" in
  --help)   show_help ;;
  --daemon) run_daemon ;;
  --status) show_status ;;
  --stop)   stop_daemon ;;
  "")       single_check ;;
  *)        echo "Unknown option: $1"; show_help; exit 1 ;;
esac

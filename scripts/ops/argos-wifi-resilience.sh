#!/usr/bin/env bash
# Argos WiFi Resilience Monitor
# Monitors wlan0 connectivity and reconnects on failure.
# SAFETY: ONLY operates on wlan0. Never touches wlan1/wlan1mon (Kismet).
# Usage: argos-wifi-resilience.sh monitor
set -uo pipefail

LOG_TAG="argos-wifi-resilience"
MANAGED_IFACE="wlan0"

# Timing
BASE_INTERVAL=30
MAX_BACKOFF=300
BOOT_DELAY=60
MEM_THRESHOLD=90

# State
CONSECUTIVE_FAILURES=0
CURRENT_INTERVAL=$BASE_INTERVAL

log()  { logger -t "$LOG_TAG" "$*"; echo "[$LOG_TAG] $*"; }
warn() { log "[WARN] $*"; }

mem_usage_pct() {
  awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d", (t-a)/t*100}' /proc/meminfo
}

get_gateway() {
  ip route show dev "$MANAGED_IFACE" 2>/dev/null | awk '/default/{print $3; exit}'
}

check_connectivity() {
  # Check interface exists and is up
  if ! ip link show "$MANAGED_IFACE" >/dev/null 2>&1; then
    return 1
  fi

  # Check carrier
  local carrier
  carrier=$(cat "/sys/class/net/$MANAGED_IFACE/carrier" 2>/dev/null || echo "0")
  if [[ "$carrier" != "1" ]]; then
    return 1
  fi

  # Check IP assigned
  if ! ip addr show "$MANAGED_IFACE" | grep -q "inet "; then
    return 1
  fi

  # Ping gateway
  local gw
  gw=$(get_gateway)
  if [[ -n "$gw" ]]; then
    ping -c1 -W3 -I "$MANAGED_IFACE" "$gw" >/dev/null 2>&1 || return 1
  fi

  return 0
}

attempt_reconnect() {
  local level="$1"

  case "$level" in
    1)
      log "Level 1: nmcli reconnect $MANAGED_IFACE"
      nmcli device connect "$MANAGED_IFACE" 2>/dev/null
      ;;
    2)
      log "Level 2: link bounce + nmcli reconnect"
      sudo ip link set "$MANAGED_IFACE" down 2>/dev/null || true
      sleep 2
      sudo ip link set "$MANAGED_IFACE" up 2>/dev/null || true
      sleep 3
      nmcli device connect "$MANAGED_IFACE" 2>/dev/null
      ;;
    3)
      warn "Level 3: reapplying wlan0 connection (targeted, not full NM restart)"
      sudo nmcli device reapply "$MANAGED_IFACE" 2>/dev/null || true
      sleep 5
      # If reapply fails, try disconnect + reconnect (still wlan0-scoped)
      sudo nmcli device disconnect "$MANAGED_IFACE" 2>/dev/null || true
      sleep 2
      sudo nmcli device connect "$MANAGED_IFACE" 2>/dev/null || true
      ;;
  esac
}

reset_backoff() {
  CONSECUTIVE_FAILURES=0
  CURRENT_INTERVAL=$BASE_INTERVAL
}

increase_backoff() {
  ((CONSECUTIVE_FAILURES++)) || true
  CURRENT_INTERVAL=$((BASE_INTERVAL * (2 ** (CONSECUTIVE_FAILURES > 4 ? 4 : CONSECUTIVE_FAILURES))))
  if (( CURRENT_INTERVAL > MAX_BACKOFF )); then
    CURRENT_INTERVAL=$MAX_BACKOFF
  fi
}

monitor() {
  # Safety: refuse to operate on anything except wlan0
  if [[ "$MANAGED_IFACE" != "wlan0" ]]; then
    log "FATAL: MANAGED_IFACE is '$MANAGED_IFACE', not wlan0. Refusing to run."
    exit 1
  fi

  # Boot delay
  local uptime
  uptime=$(awk '{printf "%d", $1}' /proc/uptime)
  if (( uptime < BOOT_DELAY )); then
    local wait=$((BOOT_DELAY - uptime))
    log "Boot delay: waiting ${wait}s for NetworkManager to settle"
    sleep "$wait"
  fi

  log "Started — monitoring $MANAGED_IFACE every ${BASE_INTERVAL}s"

  while true; do
    if check_connectivity; then
      if (( CONSECUTIVE_FAILURES > 0 )); then
        log "Connectivity restored after $CONSECUTIVE_FAILURES failures"
        reset_backoff
      fi
    else
      # Memory pressure gate
      local mem_pct
      mem_pct=$(mem_usage_pct)
      if (( mem_pct >= MEM_THRESHOLD )); then
        warn "Skipping reconnect — RAM at ${mem_pct}%"
        sleep "$CURRENT_INTERVAL"
        continue
      fi

      increase_backoff

      # Escalation ladder
      local level=1
      if (( CONSECUTIVE_FAILURES >= 5 )); then
        level=3
      elif (( CONSECUTIVE_FAILURES >= 3 )); then
        level=2
      fi

      warn "$MANAGED_IFACE down (failure #$CONSECUTIVE_FAILURES, backoff ${CURRENT_INTERVAL}s)"
      attempt_reconnect "$level"
    fi

    sleep "$CURRENT_INTERVAL"
  done
}

case "${1:-}" in
  monitor) monitor ;;
  *)
    echo "Usage: $0 monitor"
    exit 1
    ;;
esac

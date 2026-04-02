#!/usr/bin/env bash
# Argos CPU Thermal Protector
# Monitors RPi 5 CPU temperature and throttle state.
# Stops non-essential services at critical temps, resumes on recovery.
# Usage: argos-cpu-protector.sh monitor
set -uo pipefail

LOG_TAG="argos-cpu-protector"
THERMAL_ZONE="/sys/class/thermal/thermal_zone0/temp"
VCGENCMD="/usr/local/bin/vcgencmd"

# Thresholds (Celsius)
WARN_TEMP=75
CRITICAL_TEMP=80
EMERGENCY_TEMP=85
RECOVERY_TEMP=70

# Timing
POLL_INTERVAL=15
COOLDOWN_SECS=300
BOOT_DELAY=45

# State
LAST_ACTION_TIME=0
SERVICES_STOPPED=false
STOPPED_SERVICES=()

log()  { logger -t "$LOG_TAG" "$*"; echo "[$LOG_TAG] $*"; }
warn() { log "[WARN] $*"; }

get_temp() {
  if [[ -r "$THERMAL_ZONE" ]]; then
    local millideg
    millideg=$(cat "$THERMAL_ZONE")
    # Validate numeric output — filesystem errors can produce garbage
    if [[ "$millideg" =~ ^[0-9]+$ ]]; then
      echo $((millideg / 1000))
    else
      echo "-1"
    fi
  else
    echo "-1"
  fi
}

get_throttle_state() {
  if [[ -x "$VCGENCMD" ]]; then
    "$VCGENCMD" get_throttled 2>/dev/null | cut -d= -f2 || echo "0x0"
  else
    echo "0x0"
  fi
}

stop_optional_services() {
  local level="$1"
  local now
  now=$(date +%s)

  # Cooldown check
  if (( now - LAST_ACTION_TIME < COOLDOWN_SECS )); then
    return
  fi

  STOPPED_SERVICES=()
  local services_to_stop=(argos-droneid argos-kismet)
  if [[ "$level" == "emergency" ]]; then
    services_to_stop+=(argos-headless)
  fi

  for svc in "${services_to_stop[@]}"; do
    if systemctl is-active "$svc" >/dev/null 2>&1; then
      log "Stopping $svc due to $level thermal state"
      sudo systemctl stop "$svc" 2>/dev/null || true
      STOPPED_SERVICES+=("$svc")
    fi
  done

  SERVICES_STOPPED=true
  LAST_ACTION_TIME=$now
}

resume_services() {
  if [[ "$SERVICES_STOPPED" != true ]]; then
    return
  fi
  for svc in "${STOPPED_SERVICES[@]}"; do
    log "Resuming $svc — temperature recovered"
    sudo systemctl start "$svc" 2>/dev/null || true
  done
  SERVICES_STOPPED=false
  STOPPED_SERVICES=()
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

  log "Started — polling every ${POLL_INTERVAL}s (warn=${WARN_TEMP}°C crit=${CRITICAL_TEMP}°C)"

  while true; do
    local temp
    temp=$(get_temp)

    if [[ "$temp" -eq -1 ]]; then
      warn "Cannot read thermal zone"
      sleep "$POLL_INTERVAL"
      continue
    fi

    local throttle
    throttle=$(get_throttle_state)

    # Check throttle bits (bit 3 = currently throttled, bit 1 = under-voltage)
    local throttle_val=$((throttle))
    if (( throttle_val & 0x8 )); then
      warn "CPU is being throttled (${temp}°C, throttle=$throttle)"
    fi
    if (( throttle_val & 0x2 )); then
      warn "Under-voltage detected — check power supply"
    fi

    if (( temp >= EMERGENCY_TEMP )); then
      log "[EMERGENCY] ${temp}°C — stopping all optional services"
      stop_optional_services "emergency"
    elif (( temp >= CRITICAL_TEMP )); then
      log "[CRITICAL] ${temp}°C — stopping non-essential services"
      stop_optional_services "critical"
    elif (( temp >= WARN_TEMP )); then
      warn "${temp}°C approaching thermal limit"
    elif (( temp <= RECOVERY_TEMP )) && [[ "$SERVICES_STOPPED" == true ]]; then
      log "[RECOVERY] ${temp}°C — resuming stopped services"
      resume_services
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

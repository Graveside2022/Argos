#!/bin/bash
# Argos Memory Monitor - Tracks system memory for OOM prevention on RPi 5 (8GB)
# Usage: ./check-memory-leaks.sh [--watch|--json|--alert-only|--help]
set -uo pipefail

WATCH_INTERVAL=30; LOG_FILE="/var/log/argos-memory-monitor.log"
WARN_AVAIL_MB=1500; CRIT_AVAIL_MB=800; WARN_CONTAINER_PCT=80; WARN_NODE_TOTAL_MB=3000

if [ -t 1 ] && [ "${MODE:-}" != "json" ]; then
    RED='\033[0;31m'; YLW='\033[0;33m'; GRN='\033[0;32m'; RST='\033[0m'; BLD='\033[1m'
else RED=''; YLW=''; GRN=''; RST=''; BLD=''; fi
ALERTS=()

usage() {
    cat <<'HELP'
Argos Memory Monitor - System memory tracker for OOM prevention

Usage:  check-memory-leaks.sh [OPTIONS]

Options:
  --watch       Continuous monitoring (30s interval), logs to /var/log/
  --json        Structured JSON output for programmatic consumption
  --alert-only  Only produce output when thresholds are exceeded
  --help        Show this help text

Alert Thresholds:
  [WARN] MemAvailable < 1500 MB    [CRIT] MemAvailable < 800 MB
  [WARN] Docker container > 80%    [WARN] Total Node.js RSS > 3000 MB
  [CRIT] earlyoom killed anything in the last hour
HELP
    exit 0
}

meminfo_mb() { awk -v key="$1" '$1==key":" {printf "%.0f",$2/1024}' /proc/meminfo; }
add_alert() { ALERTS+=("[$1] $2"); }
color_pct() {
    local p=$1
    if [ "$p" -gt 50 ]; then printf "${GRN}%3d%%${RST}" "$p"
    elif [ "$p" -gt 25 ]; then printf "${YLW}%3d%%${RST}" "$p"
    else printf "${RED}%3d%%${RST}" "$p"; fi
}
tag_ok_warn() {
    if [ "$1" -ge "${2:-80}" ]; then printf "${RED}[WARN]${RST}"; else printf "${GRN}[OK]${RST}"; fi
}
sum_rss_mb() {
    local t=0; for p in "$@"; do
        local r; r=$(awk '/^VmRSS:/{print $2}' /proc/"$p"/status 2>/dev/null || echo 0)
        t=$((t + r))
    done; echo $((t / 1024))
}

section_system_memory() {
    local tot=$(meminfo_mb MemTotal) avail=$(meminfo_mb MemAvailable)
    local swt=$(meminfo_mb SwapTotal) swf=$(meminfo_mb SwapFree)
    local swu=$((swt - swf)) used=$((tot - avail))
    local pu=$((used * 100 / tot)) pa=$((avail * 100 / tot))
    local stype="disk"; [ -e /sys/block/zram0 ] && stype="zram"
    if [ "$MODE" = "json" ]; then
        printf '"system_memory":{"total_mb":%d,"used_mb":%d,"available_mb":%d,"available_pct":%d,"swap_used_mb":%d,"swap_total_mb":%d,"swap_type":"%s"}' \
            "$tot" "$used" "$avail" "$pa" "$swu" "$swt" "$stype"
    else
        echo ""; echo -e "${BLD}[SYSTEM MEMORY]${RST}"
        printf "  Total:     %5d MB\n" "$tot"
        printf "  Used:      %5d MB (%d%%)\n" "$used" "$pu"
        printf "  Available: %5d MB (" "$avail"; color_pct "$pa"
        local tg=""
        if [ "$avail" -lt "$CRIT_AVAIL_MB" ]; then tg="${RED}[CRIT]${RST}"
        elif [ "$avail" -lt "$WARN_AVAIL_MB" ]; then tg="${YLW}[WARN]${RST}"; fi
        printf ")  %b\n" "$tg"
        printf "  Swap:      %5d MB / %d MB (%s)\n" "$swu" "$swt" "$stype"
    fi
    if [ "$avail" -lt "$CRIT_AVAIL_MB" ]; then
        add_alert "CRIT" "MemAvailable critically low (${avail}MB < ${CRIT_AVAIL_MB}MB)"
    elif [ "$avail" -lt "$WARN_AVAIL_MB" ]; then
        add_alert "WARN" "MemAvailable below threshold (${avail}MB < ${WARN_AVAIL_MB}MB)"
    fi
}

section_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        [ "$MODE" = "json" ] && printf '"docker_containers":[]' && return
        echo ""; echo -e "${BLD}[DOCKER CONTAINERS]${RST}"; echo "  docker not found -- skipping"; return
    fi
    local raw; raw=$(docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}|{{.MemPerc}}' 2>/dev/null) || true
    if [ -z "$raw" ]; then
        [ "$MODE" = "json" ] && printf '"docker_containers":[]' && return
        echo ""; echo -e "${BLD}[DOCKER CONTAINERS]${RST}"; echo "  No running containers"; return
    fi
    if [ "$MODE" = "json" ]; then printf '"docker_containers":['; else echo ""; echo -e "${BLD}[DOCKER CONTAINERS]${RST}"; fi
    local first=true
    while IFS='|' read -r name usage pct; do
        local us ls pn
        us=$(echo "$usage" | awk -F/ '{gsub(/^ +| +$/,"",$1);print $1}')
        ls=$(echo "$usage" | awk -F/ '{gsub(/^ +| +$/,"",$2);print $2}')
        pn=$(echo "$pct" | tr -d '% ')
        if [ "$MODE" = "json" ]; then
            [ "$first" = true ] && first=false || printf ','
            printf '{"name":"%s","used":"%s","limit":"%s","pct":"%s"}' "$name" "$us" "$ls" "$pn"
        else
            local pi=${pn%%.*}; local tg; tg=$(tag_ok_warn "${pi:-0}" "$WARN_CONTAINER_PCT")
            printf "  %-22s %10s / %10s  (%3s%%)  %b\n" "$name" "$us" "$ls" "${pi:-0}" "$tg"
            [ "${pi:-0}" -ge "$WARN_CONTAINER_PCT" ] && add_alert "WARN" "Container $name at ${pi}% memory limit"
        fi
    done <<< "$raw"
    [ "$MODE" = "json" ] && printf ']'
}

section_host_processes() {
    local cp vp mp np dp
    cp=$(pgrep -f "claude" 2>/dev/null | tr '\n' ' ') || true
    vp=$(pgrep -f "code-server|tsserver|eslintd" 2>/dev/null | tr '\n' ' ') || true
    mp=$(pgrep -f "mcp|dynamic-server" 2>/dev/null | tr '\n' ' ') || true
    np=$(pgrep -f "node|npm|npx|tsx" 2>/dev/null | tr '\n' ' ') || true
    dp=$(pgrep -f "dockerd|containerd" 2>/dev/null | tr '\n' ' ') || true
    # Dedup: remove PIDs claimed by earlier categories
    _dedup() {
        local cl="$1"; shift; local r=""
        for p in "$@"; do case " $cl " in *" $p "*) ;; *) r="$r $p" ;; esac; done
        echo "$r"
    }
    local claimed="$cp"
    # shellcheck disable=SC2086
    vp=$(_dedup "$claimed" $vp); claimed="$claimed $vp"
    # shellcheck disable=SC2086
    mp=$(_dedup "$claimed" $mp); claimed="$claimed $mp"
    # shellcheck disable=SC2086
    np=$(_dedup "$claimed" $np); claimed="$claimed $np"
    # shellcheck disable=SC2086
    dp=$(_dedup "$claimed" $dp)
    _cnt() { echo $# ; }
    # shellcheck disable=SC2086
    local cm=$(sum_rss_mb $cp) cc=$(_cnt $cp)
    # shellcheck disable=SC2086
    local vm=$(sum_rss_mb $vp) vc=$(_cnt $vp)
    # shellcheck disable=SC2086
    local mm=$(sum_rss_mb $mp) mc=$(_cnt $mp)
    # shellcheck disable=SC2086
    local nm=$(sum_rss_mb $np) nc=$(_cnt $np)
    # shellcheck disable=SC2086
    local dm=$(sum_rss_mb $dp) dc=$(_cnt $dp)
    local tnode=$((nm + mm))
    if [ "$MODE" = "json" ]; then
        printf '"host_processes":{"claude":{"rss_mb":%d,"count":%d},"vscode":{"rss_mb":%d,"count":%d},"mcp":{"rss_mb":%d,"count":%d},"node":{"rss_mb":%d,"count":%d},"docker":{"rss_mb":%d,"count":%d}}' \
            "$cm" "$cc" "$vm" "$vc" "$mm" "$mc" "$nm" "$nc" "$dm" "$dc"
    else
        echo ""; echo -e "${BLD}[HOST PROCESSES]${RST}"
        local f="  %-15s %5d MB  (%d procs)  %b\n"
        local ct=""; [ "$cm" -gt 2000 ] && ct="${YLW}[WARN]${RST}"
        local mt=""; [ "$mm" -gt 1000 ] && mt="${YLW}[WARN]${RST}"
        printf "$f" "Claude Code:" "$cm" "$cc" "$ct"
        printf "$f" "VSCode:" "$vm" "$vc" ""
        printf "$f" "MCP Servers:" "$mm" "$mc" "$mt"
        printf "$f" "Node.js/npm:" "$nm" "$nc" ""
        printf "$f" "Docker:" "$dm" "$dc" ""
    fi
    [ "$cm" -gt 2000 ] && add_alert "WARN" "Claude Code using ${cm}MB RSS"
    [ "$tnode" -gt "$WARN_NODE_TOTAL_MB" ] && add_alert "WARN" "Total Node.js RSS ${tnode}MB exceeds ${WARN_NODE_TOTAL_MB}MB"
    return 0
}

section_earlyoom() {
    local ep; ep=$(pgrep -x earlyoom 2>/dev/null | head -1) || true
    local kills="" kc=0
    if command -v journalctl >/dev/null 2>&1; then
        kills=$(journalctl -u earlyoom --since "1 hour ago" --no-pager -q 2>/dev/null | grep -i "sending" || true)
        [ -n "$kills" ] && kc=$(echo "$kills" | wc -l)
    fi
    if [ "$MODE" = "json" ]; then
        printf '"earlyoom":{"running":%s,"pid":"%s","kills_last_hour":%d}' \
            "$([ -n "$ep" ] && echo true || echo false)" "${ep:-}" "$kc"
    else
        echo ""; echo -e "${BLD}[EARLYOOM STATUS]${RST}"
        [ -n "$ep" ] && printf "  Running: YES (PID %s)\n" "$ep" || printf "  Running: NO\n"
        local tg; [ "$kc" -gt 0 ] && tg="${RED}[CRIT]${RST}" || tg="${GRN}[OK]${RST}"
        printf "  Kills in last hour: %d          %b\n" "$kc" "$tg"
        [ "$kc" -gt 0 ] && { echo "  Recent kills:"; echo "$kills" | tail -5 | while IFS= read -r l; do echo "    $l"; done; }
    fi
    [ "$kc" -gt 0 ] && add_alert "CRIT" "earlyoom killed $kc process(es) in the last hour"
    return 0
}

section_alerts() {
    if [ "$MODE" = "json" ]; then
        printf '"alerts":['
        local first=true
        for a in "${ALERTS[@]+"${ALERTS[@]}"}"; do
            [ "$first" = true ] && first=false || printf ','
            printf '"%s"' "$(echo "$a" | sed 's/"/\\"/g')"
        done
        printf ']'; return
    fi
    echo ""; echo -e "${BLD}[ALERTS]${RST}"
    if [ ${#ALERTS[@]} -eq 0 ]; then echo -e "  ${GRN}No alerts -- system healthy${RST}"; return; fi
    for a in "${ALERTS[@]}"; do
        [[ "$a" == *"[CRIT]"* ]] && echo -e "  ${RED}${a}${RST}" || echo -e "  ${YLW}${a}${RST}"
    done
}

generate_report() {
    ALERTS=(); local ts; ts=$(date '+%Y-%m-%d %H:%M:%S')
    if [ "$MODE" = "json" ]; then
        printf '{"timestamp":"%s",' "$ts"
        section_system_memory; printf ','; section_docker; printf ','
        section_host_processes; printf ','; section_earlyoom; printf ','
        section_alerts; printf '}\n'
    else
        echo "================================================================"
        echo "  ARGOS MEMORY MONITOR - $ts"
        echo "================================================================"
        section_system_memory; section_docker; section_host_processes
        section_earlyoom; section_alerts
        echo "================================================================"
    fi
}

# --- Entry point ---
MODE="report"
for arg in "$@"; do
    case "$arg" in
        --help|-h)    usage ;;
        --watch|-w)   MODE="watch" ;;
        --json|-j)    MODE="json"; RED=''; YLW=''; GRN=''; RST=''; BLD='' ;;
        --alert-only) MODE="alert" ;;
        *)            echo "Unknown option: $arg"; usage ;;
    esac
done
case "$MODE" in
    json) generate_report ;;
    alert)
        _tmpf=$(mktemp /tmp/argos-mem-XXXXXX)
        MODE=report generate_report > "$_tmpf" 2>&1
        [ ${#ALERTS[@]} -gt 0 ] && cat "$_tmpf"
        rm -f "$_tmpf" ;;
    watch)
        echo "Starting continuous monitoring (interval: ${WATCH_INTERVAL}s)"
        _tmpw=$(mktemp /tmp/argos-mem-watch-XXXXXX); trap 'rm -f "$_tmpw"' EXIT
        while true; do
            clear 2>/dev/null || true
            generate_report > "$_tmpw" 2>&1; cat "$_tmpw"
            touch "$LOG_FILE" 2>/dev/null && { sed 's/\x1b\[[0-9;]*m//g' "$_tmpw" >> "$LOG_FILE"; echo "" >> "$LOG_FILE"; }
            sleep "$WATCH_INTERVAL"
        done ;;
    *) generate_report ;;
esac

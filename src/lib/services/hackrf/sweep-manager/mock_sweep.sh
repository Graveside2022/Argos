#!/bin/bash
# Mock sweep tool for testing when no hardware is available
# Outputs data in hackrf_sweep format

# Send startup message to stderr like real hackrf_sweep
echo "Mock SDR mode - no hardware detected, generating simulated data" >&2
echo "hackrf_sweep version 0.0 mock" >&2
echo "Stop with Ctrl-C" >&2

# Parse arguments
FREQ_RANGE="2400:2500"
GAIN="20"
LNA="32"
BIN_WIDTH="20000"

while [[ $# -gt 0 ]]; do
    case $1 in
        -f) FREQ_RANGE="$2"; shift 2 ;;
        -g) GAIN="$2"; shift 2 ;;
        -l) LNA="$2"; shift 2 ;;
        -w) BIN_WIDTH="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# Extract start and stop frequencies
IFS=':' read -r START_FREQ STOP_FREQ <<< "$FREQ_RANGE"

# Force line buffering for stdout
exec 1> >(stdbuf -oL cat)

# Generate mock data
while true; do
    # Current time
    DATE=$(date -u +"%Y-%m-%d")
    TIME=$(date -u +"%H:%M:%S")
    
    # Generate mock power values (100 samples)
    POWER_VALUES=""
    for i in {1..100}; do
        # Generate random power between -90 and -30 dB
        POWER=$(echo "scale=2; -90 + $RANDOM * 60 / 32767" | bc)
        POWER_VALUES="${POWER_VALUES}, ${POWER}"
    done
    
    # Output in hackrf_sweep format
    HZ_LOW=$((START_FREQ * 1000000))
    HZ_HIGH=$((STOP_FREQ * 1000000))
    echo "${DATE}, ${TIME}, ${HZ_LOW}, ${HZ_HIGH}, ${BIN_WIDTH}, 100${POWER_VALUES}"
    
    # Force flush stdout
    # This ensures data is sent immediately rather than buffered
    # Small delay
    sleep 0.1
done
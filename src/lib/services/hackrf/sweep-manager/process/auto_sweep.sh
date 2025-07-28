#!/bin/bash
# Auto-detect and use either HackRF or USRP B205 Mini for sweeping
# This maintains compatibility with existing code that expects hackrf_sweep

# Set UHD images directory
export UHD_IMAGES_DIR=/usr/share/uhd/images

# Check if USRP B205 Mini is connected - only use if UHD can detect it
USRP_DETECTED=0
if [ "$FORCE_USRP" = "1" ]; then
    # Environment variable forces USRP mode (used when we know USRP should be available)
    USRP_DETECTED=1
    echo "USRP mode forced via environment variable" >&2
elif uhd_find_devices 2>/dev/null | grep -q "B205"; then
    # Only mark as detected if UHD can actually communicate with it
    USRP_DETECTED=1
    echo "USRP B205 Mini detected and accessible via UHD" >&2
fi

if [ $USRP_DETECTED -eq 1 ]; then
    echo "USRP B205 Mini detected, using USRP sweep tool" >&2
    # Use Python USRP sweep tool with converted arguments
    # Convert hackrf_sweep args to usrp_spectrum_scan.py args
    ARGS=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f)
                # Convert frequency range from min:max to --start-freq and --stop-freq
                # hackrf_sweep uses Hz, but USRP script expects Hz, so convert MHz to Hz
                IFS=':' read -r START STOP <<< "$2"
                START_HZ=$((START * 1000000))
                STOP_HZ=$((STOP * 1000000))
                ARGS="$ARGS --start-freq $START_HZ --stop-freq $STOP_HZ"
                shift 2
                ;;
            -g)
                # VGA gain becomes --gain
                ARGS="$ARGS --gain $2"
                shift 2
                ;;
            -l)
                # LNA gain - average with VGA gain for USRP
                shift 2
                ;;
            -w)
                # Bin width becomes --freq-step
                ARGS="$ARGS --freq-step $2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    # Use the USRP spectrum scanner from scripts directory
    # Force unbuffered output for real-time data streaming
    export PYTHONUNBUFFERED=1
    exec python3 -u ./scripts/usrp_spectrum_scan.py $ARGS
elif hackrf_info 2>/dev/null | grep -q "Serial number"; then
    echo "HackRF detected, using hackrf_sweep" >&2
    # Use original hackrf_sweep
    exec hackrf_sweep "$@"
else
    echo "Warning: No supported SDR device found (HackRF or USRP B205 Mini)" >&2
    echo "Running in mock mode for testing..." >&2
    # Use mock sweep script
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    exec "$SCRIPT_DIR/mock_sweep.sh" "$@"
fi
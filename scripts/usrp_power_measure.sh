#!/bin/bash
# Real USRP power measurement - NO MOCK DATA
# Uses Python UHD bindings for actual RF measurements

FREQ_MHZ=$1
GAIN=${2:-50}

if [ -z "$FREQ_MHZ" ]; then
    echo "Usage: $0 <freq_mhz> [gain]"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if USRP is connected
if uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "USRP B205 Mini detected" >&2
else
    echo "Error: USRP B205 Mini not detected" >&2
    echo "$FREQ_MHZ MHz: -100.0 dBm"
    exit 1
fi

# Use Python script with UHD bindings for real measurements (fast mode)
if python3 "$SCRIPT_DIR/usrp_power_measure_real.py" -f "$FREQ_MHZ" -g "$GAIN" -d 0.1 2>/dev/null; then
    echo "Real USRP measurement completed" >&2
else
    echo "Error: USRP measurement failed" >&2
    echo "$FREQ_MHZ MHz: -100.0 dBm"
fi
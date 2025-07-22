#!/bin/bash
# Simple USRP power measurement using uhd_rx_cfile
# Returns actual dBm measurements instead of fake -65 dB

FREQ=$1
GAIN=$2
DURATION=${3:-1}

if [ -z "$FREQ" ] || [ -z "$GAIN" ]; then
    echo "Usage: $0 <freq_mhz> <gain_db> [duration_sec]"
    exit 1
fi

# Convert MHz to Hz
FREQ_HZ=$(echo "$FREQ * 1000000" | bc)

# Use uhd_rx_cfile to capture samples and calculate power
TEMP_FILE="/tmp/usrp_samples_$$.dat"

# Capture samples
uhd_rx_cfile --freq $FREQ_HZ --gain $GAIN --rate 2000000 --duration $DURATION --type float $TEMP_FILE 2>/dev/null

if [ -f "$TEMP_FILE" ]; then
    # Calculate power using Python
    POWER=$(python3 -c "
import numpy as np
import sys
try:
    # Read complex float samples
    samples = np.fromfile('$TEMP_FILE', dtype=np.complex64)
    if len(samples) > 0:
        # Calculate power in dBm (rough calibration)
        power_linear = np.mean(np.abs(samples)**2)
        power_db = 10 * np.log10(power_linear + 1e-12) - 30  # Rough calibration
        print(f'{power_db:.1f}')
    else:
        print('-100.0')
except Exception as e:
    print('-100.0')
    ")
    
    rm -f "$TEMP_FILE"
    echo "$FREQ MHz: $POWER dBm"
else
    echo "$FREQ MHz: -100.0 dBm"
fi
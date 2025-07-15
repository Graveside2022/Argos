#!/bin/bash

# Automated GSM Frequency Scanner
# Scans all bands and returns the strongest frequency

set -e

echo "=== Automated GSM Frequency Scanner ==="
echo "Scanning for active GSM frequencies..."

# Check if kalibrate exists
if [ ! -f "/home/ubuntu/projects/Argos/tools/kalibrate-hackrf/src/kal" ]; then
    echo "Error: kalibrate-hackrf not found. Please install it first."
    exit 1
fi

# Kill any existing grgsm processes
pkill -f grgsm_livemon 2>/dev/null || true
pkill -f GsmEvil 2>/dev/null || true
sleep 2

# Function to scan a band and get power levels
scan_band() {
    local band=$1
    echo "Scanning $band..."
    /home/ubuntu/projects/Argos/tools/kalibrate-hackrf/src/kal -s $band -g 40 2>/dev/null | grep -E "chan:.*MHz.*power:" || true
}

# Scan all bands and collect results
echo "Scanning GSM900 (935-960 MHz)..."
GSM900_RESULTS=$(scan_band GSM900)

echo "Scanning DCS1800 (1805-1880 MHz)..."
DCS1800_RESULTS=$(scan_band DCS1800)

echo "Scanning GSM850 (869-894 MHz)..."
GSM850_RESULTS=$(scan_band GSM850)

echo "Scanning PCS1900 (1930-1990 MHz)..."
PCS1900_RESULTS=$(scan_band PCS1900)

# Combine all results and sort by power
ALL_RESULTS=$(echo -e "$GSM900_RESULTS\n$DCS1800_RESULTS\n$GSM850_RESULTS\n$PCS1900_RESULTS" | grep -E "chan:.*MHz.*power:" | sort -k5 -nr || true)

if [ -z "$ALL_RESULTS" ]; then
    echo "No GSM frequencies found!"
    # Default to common frequencies
    echo "Using default frequency: 943 MHz"
    echo "943" > /tmp/strongest_gsm_freq.txt
    exit 0
fi

# Get the strongest signal
STRONGEST=$(echo "$ALL_RESULTS" | head -1)
FREQ_MHZ=$(echo "$STRONGEST" | grep -oP '\d+\.\d+MHz' | sed 's/MHz//')
POWER=$(echo "$STRONGEST" | grep -oP 'power:\s*\K[\d.]+')

echo ""
echo "=== Scan Results ==="
echo "Strongest signal found:"
echo "Frequency: $FREQ_MHZ MHz"
echo "Power: $POWER"
echo ""
echo "Top 5 frequencies:"
echo "$ALL_RESULTS" | head -5

# Save the strongest frequency
echo "$FREQ_MHZ" > /tmp/strongest_gsm_freq.txt

echo ""
echo "Strongest frequency saved to: /tmp/strongest_gsm_freq.txt"
echo "Use this frequency: $FREQ_MHZ MHz"
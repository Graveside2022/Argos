#!/bin/bash
echo "Testing real USRP measurements..."
echo "This will take actual RF power readings from your B205 Mini"

# Test USRP detection
echo "1. Testing USRP detection:"
uhd_find_devices | grep -A5 -B5 "B205"

echo ""
echo "2. Testing basic USRP functionality:"
timeout 3 uhd_rx_cfile --freq 946e6 --gain 50 --rate 2e6 --duration 0.5 /tmp/test_samples.dat

if [ -f "/tmp/test_samples.dat" ]; then
    SIZE=$(stat -c%s "/tmp/test_samples.dat")
    echo "✓ Successfully captured $SIZE bytes of real RF data"
    rm -f /tmp/test_samples.dat
    echo "This is REAL data from your antenna - no simulation!"
else
    echo "✗ Failed to capture RF data"
fi

echo ""
echo "3. Testing Python UHD bindings:"
python3 -c "
import uhd
import numpy as np
print('Creating USRP object...')
usrp = uhd.usrp.MultiUSRP()
print('✓ USRP Python bindings working')
print('Device info:', usrp.get_pp_string())
"
#!/bin/bash
# Comprehensive USRP B205 Mini hardware diagnostic

echo "=== USRP B205 Mini Hardware Diagnostic ==="
echo

# 1. Basic hardware check
echo "1. Hardware detection:"
uhd_find_devices --args="type=b200" 2>&1 | grep -A10 "Device Address"

# 2. Firmware check
echo
echo "2. Firmware/FPGA version:"
uhd_usrp_probe --args="type=b200" 2>&1 | grep -E "Mboard|FPGA|FW Version|Clock|Daughterboard" | head -20

# 3. Test basic reception with UHD
echo
echo "3. Testing raw reception with UHD (no gr-gsm):"
echo "   Receiving at 947.2 MHz for 2 seconds..."
uhd_rx_cfile -f 947.2e6 -r 2e6 -g 50 -N 4000000 --args="type=b200" /tmp/usrp_test.dat 2>&1 | grep -v "Press Ctrl"

if [ -f /tmp/usrp_test.dat ]; then
    SIZE=$(stat -c%s /tmp/usrp_test.dat)
    echo "   ✓ Received $SIZE bytes"
    
    # Check if data contains actual signal (not just zeros)
    hexdump -n 1000 /tmp/usrp_test.dat | head -5
    rm /tmp/usrp_test.dat
else
    echo "   ✗ No data received - hardware issue!"
fi

# 4. Test with osmocom source (different driver path)
echo
echo "4. Testing with osmocom source:"
python3 -c "
try:
    from gnuradio import gr, blocks
    from gnuradio import uhd
    import time
    
    print('   Creating USRP source...')
    usrp = uhd.usrp_source(
        ','.join(('', '')),
        uhd.stream_args(
            cpu_format='fc32',
            channels=list(range(1)),
        ),
    )
    usrp.set_samp_rate(2e6)
    usrp.set_center_freq(947.2e6, 0)
    usrp.set_gain(50, 0)
    
    print('   USRP initialized successfully')
    print(f'   Actual sample rate: {usrp.get_samp_rate()}')
    print(f'   Actual frequency: {usrp.get_center_freq(0)/1e6} MHz')
    print(f'   Actual gain: {usrp.get_gain(0)} dB')
    
except Exception as e:
    print(f'   ✗ Error: {e}')
" 2>&1

# 5. Test different clock rates
echo
echo "5. Testing different master clock rates:"
for CLOCK in "16e6" "30.72e6" "61.44e6"; do
    echo -n "   Clock rate $CLOCK: "
    timeout 2 uhd_rx_cfile -f 947.2e6 -r 2e6 -g 50 -N 100000 \
        --args="type=b200,master_clock_rate=$CLOCK" /tmp/test.dat 2>&1 | \
        grep -q "Error" && echo "Failed" || echo "OK"
done

# 6. Check if gr-gsm was built with UHD support
echo
echo "6. Checking gr-gsm UHD support:"
ldd $(which grgsm_livemon_headless) 2>/dev/null | grep -i uhd || echo "   ✗ gr-gsm may not be linked with UHD!"

# 7. Test grgsm_scanner (different tool)
echo
echo "7. Testing with grgsm_scanner:"
if command -v grgsm_scanner &> /dev/null; then
    echo "   Scanning 947-948 MHz..."
    timeout 10 grgsm_scanner -s 2e6 -g 50 -b 947M -e 948M 2>&1 | head -20
else
    echo "   grgsm_scanner not found"
fi

# 8. Direct Python test with gr-gsm
echo
echo "8. Testing gr-gsm Python directly:"
python3 -c "
try:
    from grgsm import arfcn
    print('   gr-gsm Python module loaded')
    
    # Test ARFCN to frequency conversion
    freq = arfcn.arfcn2downlink(75)  # ARFCN 75 = 947.2 MHz
    print(f'   ARFCN 75 = {freq/1e6} MHz')
    
    # Try to import the source block
    try:
        from grgsm import gsm_input
        print('   ✓ gsm_input available')
    except:
        print('   ✗ gsm_input not available - may need rebuild')
        
except Exception as e:
    print(f'   ✗ Error: {e}')
" 2>&1

echo
echo "=== Diagnostic Summary ==="
echo
echo "If raw UHD reception works but gr-gsm doesn't, then:"
echo "1. gr-gsm may need to be rebuilt with UHD support"
echo "2. Try: sudo apt install gr-gsm"
echo "3. Or rebuild gr-gsm from source with UHD enabled"
echo
echo "If raw UHD reception also fails:"
echo "1. Check USB connection (USB 3.0 port required)"
echo "2. Update UHD: sudo uhd_images_downloader"
echo "3. Check dmesg for USB errors: dmesg | tail -20"
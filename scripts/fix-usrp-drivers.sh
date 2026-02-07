#!/bin/bash
# Fix USRP B205 Mini drivers and configuration

echo "=== Fixing USRP B205 Mini Drivers and Configuration ==="
echo

# 1. Update UHD to latest version
echo "1. Updating UHD drivers..."
sudo apt update
sudo apt install -y libuhd-dev uhd-host python3-uhd

# 2. Download latest FPGA images
echo
echo "2. Downloading latest FPGA images for B205 Mini..."
sudo uhd_images_downloader

# 3. Set up proper permissions
echo
echo "3. Setting up USB permissions..."
# Create udev rule for USRP
echo 'SUBSYSTEMS=="usb", ATTRS{idVendor}=="2500", ATTRS{idProduct}=="0022", MODE="0666", GROUP="usrp"' | sudo tee /etc/udev/rules.d/10-usrp.rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# 4. Add user to usrp group
sudo groupadd usrp 2>/dev/null || true
sudo usermod -a -G usrp $USER

# 5. Test basic USRP functionality
echo
echo "4. Testing USRP B205 Mini..."
uhd_find_devices

# 6. Configure USRP for optimal performance
echo
echo "5. Configuring USB buffers for better performance..."
# Increase USB buffer size
echo 1000 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb

# 7. Test with RX2 antenna explicitly
echo
echo "6. Testing reception on RX2 antenna port..."
timeout 3 uhd_rx_cfile -f 947.2e6 -r 2e6 -g 60 -N 2000000 --ant="RX2" /tmp/test_rx2.dat 2>&1 | grep -E "Setting|Actual|Error"

if [ -f /tmp/test_rx2.dat ]; then
    SIZE=$(ls -lh /tmp/test_rx2.dat | awk '{print $5}')
    echo "[PASS] Received $SIZE on RX2 antenna"
    rm /tmp/test_rx2.dat
fi

echo
echo "7. Rebuilding gr-gsm with proper UHD support..."
# Check if we need to rebuild gr-gsm
if ! ldd $(which grgsm_livemon_headless) 2>/dev/null | grep -q uhd; then
    echo "gr-gsm needs to be rebuilt with UHD support!"
    echo "Installing dependencies..."
    sudo apt install -y gnuradio-dev libgnuradio-osmosdr0.2.0 libosmocore-dev
fi

echo
echo "=== Driver update complete ==="
echo
echo "IMPORTANT: You may need to:"
echo "1. Logout and login again for group permissions"
echo "2. Disconnect and reconnect the USRP B205 Mini"
echo "3. Make sure it's connected to a USB 3.0 port (blue)"
echo
echo "Test with: uhd_usrp_probe"
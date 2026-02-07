#!/bin/bash
# Install USRP B205 Mini support for Argos

echo "Installing USRP B205 Mini support..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root for pip installations"
   exit 1
fi

# Install UHD if not already installed
if ! command -v uhd_find_devices &> /dev/null; then
    echo "Installing UHD..."
    sudo apt-get update
    sudo apt-get install -y uhd-host libuhd-dev python3-uhd
    sudo uhd_images_downloader
fi

# Install GNU Radio and dependencies
echo "Installing GNU Radio Python dependencies..."
pip3 install --user numpy
pip3 install --user gnuradio

# Test USRP detection
echo "Testing USRP detection..."
if uhd_find_devices 2>/dev/null | grep -q "B205"; then
    echo "[PASS] USRP B205 Mini detected!"
else
    echo "[INFO] No USRP B205 Mini detected (this is OK if using HackRF)"
fi

# Make sure gr-gsm supports USRP
echo "Checking gr-gsm USRP support..."
if grgsm_livemon_headless --help 2>&1 | grep -q "args"; then
    echo "[PASS] gr-gsm has USRP support"
else
    echo "[WARN] gr-gsm may need to be rebuilt with UHD support"
fi

echo "Installation complete!"
echo ""
echo "The system will now automatically detect and use USRP B205 Mini when available."
echo "Just click 'Start Scan' in the UI - no changes needed!"
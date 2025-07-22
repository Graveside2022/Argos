#!/bin/bash
set -e

echo "Installing UHD (USRP Hardware Driver) comprehensive package..."

# Add Ettus Research PPA for latest UHD
sudo apt-get update
sudo apt-get install -y software-properties-common
sudo add-apt-repository -y ppa:ettusresearch/uhd
sudo apt-get update

# Install core UHD packages
sudo apt-get install -y \
    uhd-host \
    libuhd-dev \
    python3-uhd \
    uhd-soapysdr \
    uhd-images-downloader

# Download UHD FPGA images
sudo /usr/lib/uhd/utils/uhd_images_downloader.py

# Verify installation
echo "Verifying UHD installation..."
which uhd_find_devices || echo "uhd_find_devices not found"
which uhd_rx_cfile || echo "uhd_rx_cfile not found" 
which uhd_usrp_probe || echo "uhd_usrp_probe not found"

# Test Python bindings
python3 -c "import uhd; print('UHD Python bindings: OK')" || echo "UHD Python bindings: FAILED"

echo "UHD installation complete!"
echo "Test with: uhd_find_devices"
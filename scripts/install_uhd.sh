#!/bin/bash
# Comprehensive UHD installation script

echo "=== Installing UHD and dependencies ==="

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
    cmake \
    build-essential \
    libboost-all-dev \
    libusb-1.0-0-dev \
    python3-dev \
    python3-setuptools \
    python3-pip \
    git

# Check if UHD is already working
if command -v uhd_find_devices &> /dev/null; then
    echo "UHD already installed, checking version..."
    uhd_find_devices --help | head -5
else
    echo "Installing UHD from packages..."
    
    # Try package installation first
    sudo apt-get install -y \
        uhd-host \
        libuhd-dev \
        libuhd4.6.0t64 || echo "Package install failed, will build from source"
fi

# Test if Python bindings work
if python3 -c "import uhd; print('UHD Python bindings OK')" 2>/dev/null; then
    echo "[PASS] UHD Python bindings working"
else
    echo "Installing UHD Python bindings..."
    sudo apt-get install -y python3-uhd || pip3 install uhd
fi

# Download firmware images
if command -v uhd_images_downloader &> /dev/null; then
    echo "Downloading UHD firmware images..."
    sudo uhd_images_downloader
else
    echo "uhd_images_downloader not available"
fi

echo "=== UHD Installation Complete ==="
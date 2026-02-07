#!/bin/bash

# Install DroneID as a systemd service

set -e

echo "Installing DroneID systemd service..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Copy service file
cp deployment/argos-droneid.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable argos-droneid.service

echo "[PASS] DroneID service installed"
echo ""
echo "Commands:"
echo "  Start:   sudo systemctl start argos-droneid"
echo "  Stop:    sudo systemctl stop argos-droneid"
echo "  Status:  sudo systemctl status argos-droneid"
echo "  Logs:    sudo journalctl -u argos-droneid -f"
echo "  Disable: sudo systemctl disable argos-droneid"
echo ""
echo "The service will start automatically on boot."
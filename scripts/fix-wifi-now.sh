#!/bin/bash
# Quick fix for WiFi issues - run this NOW to fix SSH disconnections

echo "=== Fixing WiFi Power Management and Connection Issues ==="

# 1. Disable power management immediately
echo "Disabling WiFi power management..."
sudo iw wlan0 set power_save off
sudo iwconfig wlan0 power off

# 2. Create NetworkManager config to make it permanent
echo "Creating permanent power save config..."
sudo tee /etc/NetworkManager/conf.d/wifi-powersave-off.conf > /dev/null << 'EOF'
[connection]
wifi.powersave = 2

[device]
wifi.scan-rand-mac-address=no
EOF

# 3. Stop the broken monitor script
echo "Stopping old monitor scripts..."
sudo pkill -f monitor-wlan0.sh

# 4. Remove old cron entries and add new one
echo "Updating cron jobs..."
sudo crontab -l | grep -v monitor-wlan0.sh | sudo crontab -

# 5. Install new keepalive service
echo "Installing new keepalive service..."
sudo cp /home/ubuntu/projects/Argos/scripts/wifi-keepalive.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wifi-keepalive.service
sudo systemctl start wifi-keepalive.service

# 6. Restart NetworkManager to apply changes
echo "Restarting NetworkManager..."
sudo systemctl restart NetworkManager

# 7. Wait for connection
sleep 5

# 8. Verify power management is off
echo ""
echo "Current WiFi Power Management Status:"
iwconfig wlan0 | grep "Power Management"

echo ""
echo "Service Status:"
sudo systemctl status wifi-keepalive.service --no-pager

echo ""
echo "=== WiFi keepalive fixed! ==="
echo "Your SSH connection should now be stable."
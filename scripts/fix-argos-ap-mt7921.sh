#!/bin/bash
# Complete fix for Argos AP with MT7921U adapter

echo "=== Fixing Argos AP with MT7921U Adapter ==="

# 1. Stop all services
echo "1. Stopping services..."
sudo systemctl stop hostapd
sudo systemctl stop dnsmasq
sudo killall hostapd 2>/dev/null
sleep 2

# 2. Remove old interface
echo "2. Removing old interface..."
sudo iw dev wlan_ap del 2>/dev/null
sleep 1

# 3. Reset USB device
echo "3. Resetting USB devices..."
for dev in /sys/bus/usb/devices/*; do 
    if [ -f "$dev/idVendor" ] && [ "$(cat $dev/idVendor)" = "0e8d" ] && [ "$(cat $dev/idProduct)" = "7961" ]; then 
        device=$(basename $dev)
        echo "   Resetting $device..."
        echo "$device" | sudo tee /sys/bus/usb/drivers/usb/unbind >/dev/null
        sleep 2
        echo "$device" | sudo tee /sys/bus/usb/drivers/usb/bind >/dev/null
    fi
done

# 4. Wait for interface to appear
echo "4. Waiting for interface..."
sleep 5

# 5. Find the phy with our MAC
echo "5. Finding correct phy device..."
PHY_NUM=""
for phy in /sys/class/ieee80211/phy*; do
    if [ -d "$phy" ]; then
        mac=$(cat $phy/macaddress 2>/dev/null)
        if [[ "$mac" == "00:c0:ca:b6:84:ad" ]]; then
            PHY_NUM=$(basename $phy)
            echo "   Found $PHY_NUM with MAC $mac"
            break
        fi
    fi
done

if [ -z "$PHY_NUM" ]; then
    echo "   Using first available MT7921U phy..."
    PHY_NUM=$(iw dev | grep -B5 "00:c0:ca:b6:84:ad" | grep "phy#" | cut -d'#' -f2 | head -1)
    PHY_NUM="phy$PHY_NUM"
fi

# 6. Create AP interface
echo "6. Creating AP interface on $PHY_NUM..."
sudo iw $PHY_NUM interface add wlan_ap type managed
sleep 1

# 7. Configure interface
echo "7. Configuring interface..."
sudo ip link set wlan_ap down
sudo iw dev wlan_ap set type __ap
sudo ip link set wlan_ap up
sudo ip addr flush dev wlan_ap
sudo ip addr add 192.168.50.1/24 dev wlan_ap

# 8. Ensure NAT is configured
echo "8. Configuring NAT..."
sudo iptables -t nat -C POSTROUTING -o eth0 -j MASQUERADE 2>/dev/null || \
    sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE

# 9. Start services
echo "9. Starting services..."
sudo systemctl start dnsmasq
sleep 2
sudo systemctl start hostapd

# 10. Verify
echo "10. Verifying..."
sleep 3

if systemctl is-active --quiet hostapd; then
    echo ""
    echo "✓ SUCCESS! Argos AP is running"
    echo "✓ SSID: Argos"
    echo "✓ Password: password"
    echo "✓ IP: 192.168.50.1"
    echo ""
    echo "Interface status:"
    iwconfig wlan_ap 2>/dev/null | head -3
else
    echo ""
    echo "✗ Failed to start AP. Check logs:"
    echo "  sudo journalctl -u hostapd -n 20"
fi
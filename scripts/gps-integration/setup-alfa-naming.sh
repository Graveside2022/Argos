#!/bin/bash

# Script to set up human-readable names for ALFA WiFi adapters
# Maps USB ports to consistent interface names

echo "=== ALFA Card Custom Naming Setup ==="
echo ""

# Show current ALFA adapters
echo "Current ALFA adapters detected:"
for interface in /sys/class/net/wlx*; do
    if [ -d "$interface" ]; then
        IFACE=$(basename $interface)
        MAC=$(cat $interface/address 2>/dev/null)
        DRIVER=$(readlink $interface/device/driver 2>/dev/null | xargs basename)
        USB_PATH=$(readlink $interface | grep -o 'usb[0-9]/[0-9]-[0-9].*/' | sed 's|/net/.*||')
        
        echo "  Interface: $IFACE"
        echo "  MAC: $MAC"
        echo "  Driver: $DRIVER"
        echo "  USB Path: $USB_PATH"
        echo ""
    fi
done

# Create UDEV rules for custom naming
echo "Creating UDEV rules for persistent naming..."

sudo tee /etc/udev/rules.d/70-alfa-wifi-naming.rules > /dev/null << 'EOF'
# Custom naming for ALFA WiFi adapters based on USB port
# This ensures consistent naming even with multiple identical adapters

# === NAMING BY USB PORT LOCATION ===
# Top-left USB port (bus 4, port 1)
ACTION=="add", SUBSYSTEM=="net", KERNELS=="4-1:1.0", NAME="alfa_monitor"

# Top-right USB port (bus 4, port 2)  
ACTION=="add", SUBSYSTEM=="net", KERNELS=="4-2:1.0", NAME="alfa_inject"

# Bottom-left USB port (bus 3, port 1)
ACTION=="add", SUBSYSTEM=="net", KERNELS=="3-1:1.0", NAME="alfa_backup"

# Bottom-right USB port (bus 3, port 2)
ACTION=="add", SUBSYSTEM=="net", KERNELS=="3-2:1.0", NAME="alfa_test"

# === ALTERNATIVE: NAMING BY MAC ADDRESS ===
# Uncomment and modify MAC addresses as needed
#ACTION=="add", SUBSYSTEM=="net", ATTR{address}=="be:e1:d6:9f:a8:11", NAME="alfa_primary"
#ACTION=="add", SUBSYSTEM=="net", ATTR{address}=="aa:bb:cc:dd:ee:ff", NAME="alfa_secondary"

# === ALTERNATIVE: NAMING BY SERIAL NUMBER ===
# For devices with unique serial numbers
#ACTION=="add", SUBSYSTEM=="net", ENV{ID_SERIAL_SHORT}=="12345678", NAME="alfa_unit1"
#ACTION=="add", SUBSYSTEM=="net", ENV{ID_SERIAL_SHORT}=="87654321", NAME="alfa_unit2"
EOF

echo "[PASS] UDEV rules created"
echo ""

# Create a label mapping file for reference
cat > /home/ubuntu/projects/alfa-labels.conf << 'EOF'
# ALFA Adapter Label Mapping
# Physical labels to attach to your adapters

ADAPTER 1 - "MONITOR":
  - Label Color: RED
  - USB Port: Top-left
  - Interface: alfa_monitor
  - Purpose: Primary Kismet monitoring
  
ADAPTER 2 - "INJECT":
  - Label Color: BLUE  
  - USB Port: Top-right
  - Interface: alfa_inject
  - Purpose: Packet injection/testing

ADAPTER 3 - "BACKUP":
  - Label Color: GREEN
  - USB Port: Bottom-left  
  - Interface: alfa_backup
  - Purpose: Backup monitoring

ADAPTER 4 - "TEST":
  - Label Color: YELLOW
  - USB Port: Bottom-right
  - Interface: alfa_test  
  - Purpose: Development/testing
EOF

echo "[PASS] Label mapping saved to alfa-labels.conf"
echo ""

# Create helper script to identify adapters
cat > /home/ubuntu/projects/identify-alfa.sh << 'SCRIPT'
#!/bin/bash
# Quick script to identify which ALFA is which

echo "=== ALFA Adapter Identification ==="
echo ""

# Blink LED on each adapter
for interface in /sys/class/net/alfa_* /sys/class/net/wlx*; do
    if [ -d "$interface" ]; then
        IFACE=$(basename $interface)
        echo "Interface: $IFACE"
        
        # Get physical info
        if [ -f "$interface/address" ]; then
            echo "  MAC: $(cat $interface/address)"
        fi
        
        # Try to blink LED (if supported)
        echo "  Blinking LED for 3 seconds..."
        sudo ethtool -p $IFACE 3 2>/dev/null || echo "  (LED control not supported)"
        echo ""
    fi
done
SCRIPT
chmod +x /home/ubuntu/projects/identify-alfa.sh

echo "[PASS] Helper script created"
echo ""

# Show how to apply changes
echo "=== TO APPLY THESE CHANGES ==="
echo ""
echo "1. Reload UDEV rules:"
echo "   sudo udevadm control --reload-rules"
echo ""
echo "2. Unplug and replug your ALFA adapters"
echo ""
echo "3. Check new names:"
echo "   ip link show | grep alfa"
echo ""
echo "=== PHYSICAL LABELING ==="
echo ""
echo "Put colored tape or labels on each ALFA adapter:"
echo "  • RED label = alfa_monitor (top-left USB)"
echo "  • BLUE label = alfa_inject (top-right USB)"
echo "  • GREEN label = alfa_backup (bottom-left USB)"
echo "  • YELLOW label = alfa_test (bottom-right USB)"
echo ""
echo "=== KISMET CONFIGURATION ==="
echo ""
echo "In /etc/kismet/kismet_site.conf, you can now use:"
echo "  source=alfa_monitor:type=linuxwifi"
echo "  source=alfa_inject:type=linuxwifi"
echo ""
echo "Instead of:"
echo "  source=wlxbee1d69fa811:type=linuxwifi"
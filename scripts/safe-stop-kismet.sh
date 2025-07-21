#!/bin/bash
# Safe Kismet stop script that prevents SSH drops

echo "[SAFE-STOP] Stopping Kismet gracefully..."

# First, stop any Kismet processes
sudo pkill -TERM kismet 2>/dev/null
sleep 2

# Force kill if still running
sudo pkill -KILL kismet 2>/dev/null

# Leave the USB wireless interface alone to prevent SSH drops
echo "[SAFE-STOP] Skipping interface reset for USB adapters to maintain network stability"

# Just remove any monitor interfaces that might have been created
for iface in wlx*mon kismon*; do
    if ip link show "$iface" >/dev/null 2>&1; then
        echo "[SAFE-STOP] Removing monitor interface: $iface"
        sudo ip link delete "$iface" 2>/dev/null || true
    fi
done

echo "[SAFE-STOP] Kismet stopped safely without disrupting SSH"
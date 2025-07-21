#!/bin/bash
# Graceful Kismet stop to prevent SSH disconnection

echo "[STOP] Gracefully stopping Kismet to prevent network disruption..."

# Send SIGTERM for graceful shutdown
pkill -TERM kismet 2>/dev/null

# Wait for process to exit cleanly
for i in {1..10}; do
    if ! pgrep kismet > /dev/null; then
        echo "[STOP] Kismet stopped cleanly"
        break
    fi
    echo "[STOP] Waiting for Kismet to stop... ($i/10)"
    sleep 1
done

# Force kill if still running
if pgrep kismet > /dev/null; then
    echo "[STOP] Force stopping Kismet"
    pkill -KILL kismet 2>/dev/null
fi

# DO NOT reset USB wireless interfaces to prevent SSH drops
echo "[STOP] Skipping USB interface reset to maintain network stability"

# Only clean up monitor interfaces
for iface in wlx*mon kismon* wlan1mon; do
    if ip link show "$iface" >/dev/null 2>&1; then
        echo "[STOP] Removing monitor interface: $iface"
        ip link delete "$iface" 2>/dev/null || true
    fi
done

echo "[STOP] Kismet stopped without disrupting SSH connection"
exit 0
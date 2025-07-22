#!/bin/bash
# Safe script to stop Kismet without affecting other processes

echo "Safely stopping Kismet..."

# Find the exact kismet process
KISMET_PID=$(pgrep -f "^/usr/bin/kismet" | head -1)

if [ -n "$KISMET_PID" ]; then
    echo "Found Kismet process: PID $KISMET_PID"
    # Verify it's actually kismet before killing
    PROCESS_NAME=$(ps -p "$KISMET_PID" -o comm= 2>/dev/null)
    if [ "$PROCESS_NAME" = "kismet" ]; then
        echo "Sending SIGTERM to Kismet (PID: $KISMET_PID)..."
        sudo kill -TERM "$KISMET_PID"
        
        # Wait for graceful shutdown
        for i in {1..10}; do
            if ! kill -0 "$KISMET_PID" 2>/dev/null; then
                echo "Kismet stopped gracefully"
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if kill -0 "$KISMET_PID" 2>/dev/null; then
            echo "Kismet didn't stop gracefully, forcing..."
            sudo kill -9 "$KISMET_PID"
        fi
    else
        echo "Warning: PID $KISMET_PID is not kismet process, skipping"
    fi
else
    echo "No Kismet process found"
fi

# Stop the systemd service
echo "Stopping systemd service..."
sudo systemctl stop kismet-auto-wlan1 2>/dev/null || true

# Clean up monitor interfaces
echo "Cleaning up monitor interfaces..."
for iface in wlx*mon kismon*; do
    if ip link show "$iface" >/dev/null 2>&1; then
        echo "Removing interface: $iface"
        sudo ip link delete "$iface" 2>/dev/null || true
    fi
done

echo "Kismet stopped safely"
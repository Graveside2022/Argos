#!/bin/bash
# Enhanced safe script to stop Kismet without affecting SSH or other critical processes

echo "Safely stopping Kismet with enhanced process safety..."

# Get current SSH/shell processes to avoid killing them
CURRENT_PID=$$
PARENT_PID=$(ps -o ppid= -p $CURRENT_PID 2>/dev/null | tr -d ' ')
SSH_PIDS=$(pgrep -f "sshd:" 2>/dev/null || true)

echo "Current script PID: $CURRENT_PID, Parent PID: $PARENT_PID"
echo "SSH processes to protect: $SSH_PIDS"

# Function to check if a PID is safe to kill
is_safe_to_kill() {
    local pid=$1
    
    # Never kill our own process or parent
    if [ "$pid" = "$CURRENT_PID" ] || [ "$pid" = "$PARENT_PID" ]; then
        return 1
    fi
    
    # Never kill SSH processes
    for ssh_pid in $SSH_PIDS; do
        if [ "$pid" = "$ssh_pid" ]; then
            return 1
        fi
    done
    
    # Check if it's a shell process connected to SSH
    PROCESS_INFO=$(ps -p "$pid" -o ppid=,comm= 2>/dev/null || echo "")
    if echo "$PROCESS_INFO" | grep -q "bash\|sh\|zsh"; then
        PARENT_COMM=$(ps -p "$(echo "$PROCESS_INFO" | awk '{print $1}')" -o comm= 2>/dev/null || echo "")
        if echo "$PARENT_COMM" | grep -q "sshd"; then
            return 1
        fi
    fi
    
    return 0
}

# Find all Kismet processes more carefully
echo "Searching for Kismet processes..."
KISMET_PIDS=$(pgrep -f "kismet" 2>/dev/null || true)

if [ -n "$KISMET_PIDS" ]; then
    for pid in $KISMET_PIDS; do
        # Get detailed process information (skip header line)
        PROCESS_LINE=$(ps -p "$pid" -o pid,ppid,comm,args --no-headers 2>/dev/null || continue)
        
        # Skip if line is empty
        if [ -z "$PROCESS_LINE" ]; then
            continue
        fi
        
        echo "Examining process: $PROCESS_LINE"
        
        # Extract command name and arguments (no header to worry about)
        COMM=$(echo "$PROCESS_LINE" | awk '{print $3}')
        ARGS=$(echo "$PROCESS_LINE" | awk '{for(i=4;i<=NF;i++) printf "%s ", $i}')
        
        # Check if this is actually a Kismet executable - enhanced patterns
        if [ "$COMM" = "kismet" ] || echo "$ARGS" | grep -q "/usr/bin/kismet" || echo "$ARGS" | grep -q "sudo kismet" || echo "$ARGS" | grep -q "kismet.*-t.*-c"; then
            if is_safe_to_kill "$pid"; then
                echo "Found legitimate Kismet process: PID $pid"
                echo "Command: $COMM, Args: $ARGS"
                
                # Attempt graceful shutdown first
                echo "Sending SIGTERM to Kismet (PID: $pid)..."
                if sudo kill -TERM "$pid" 2>/dev/null; then
                    # Wait for graceful shutdown
                    for i in {1..15}; do
                        if ! kill -0 "$pid" 2>/dev/null; then
                            echo "Kismet process $pid stopped gracefully"
                            break
                        fi
                        sleep 1
                    done
                    
                    # Force kill if still running
                    if kill -0 "$pid" 2>/dev/null; then
                        echo "Kismet process $pid didn't stop gracefully, using SIGKILL..."
                        sudo kill -KILL "$pid" 2>/dev/null || true
                        sleep 1
                        if kill -0 "$pid" 2>/dev/null; then
                            echo "Warning: Could not stop Kismet process $pid"
                        else
                            echo "Kismet process $pid force-stopped"
                        fi
                    fi
                else
                    echo "Failed to send SIGTERM to process $pid"
                fi
            else
                echo "Skipping PID $pid - not safe to kill (SSH/shell protection)"
            fi
        else
            echo "Skipping PID $pid - not a Kismet executable ($COMM)"
        fi
    done
else
    echo "No Kismet processes found by pgrep"
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
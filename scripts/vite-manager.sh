#!/bin/bash
# Vite instance manager - ensures only one vite dev server runs at a time

PORT=${VITE_PORT:-5173}
PROJECT_DIR="/home/pi/projects/Argos"

# Function to check if port is in use
check_port() {
    lsof -i :$PORT >/dev/null 2>&1
}

# Function to kill existing vite processes for this project
kill_existing_vite() {
    echo "[Vite Manager] Checking for existing vite processes..."
    
    # Find vite processes for Argos
    PIDS=$(ps aux | grep -E "vite.*Argos" | grep -v grep | grep -v "vite-manager" | awk '{print $2}')
    
    if [ ! -z "$PIDS" ]; then
        echo "[Vite Manager] Found existing vite processes: $PIDS"
        echo "[Vite Manager] Killing existing processes..."
        echo $PIDS | xargs -r kill -9 2>/dev/null
        sleep 2
    fi
    
    # Also check for processes on the port
    if check_port; then
        echo "[Vite Manager] Port $PORT is still in use, killing process..."
        lsof -ti :$PORT | xargs -r kill -9 2>/dev/null
        sleep 2
    fi
}

# Function to start vite
start_vite() {
    echo "[Vite Manager] Starting vite dev server on port $PORT..."
    
    # Export environment to prevent multiple instances
    export VITE_SINGLE_INSTANCE=true
    export VITE_PORT=$PORT
    
    # Start vite with the existing memory settings
    cd "$PROJECT_DIR"
    # Increased memory limit to 2048MB to handle larger builds and prevent out-of-memory errors
    NODE_OPTIONS='--max-old-space-size=2048' npx vite dev --port $PORT --host
}

# Main execution
main() {
    echo "=== Vite Development Server Manager ==="
    echo "Project: Argos"
    echo "Port: $PORT"
    echo ""
    
    # Kill any existing instances
    kill_existing_vite
    
    # Verify port is free
    if check_port; then
        echo "[Vite Manager] ERROR: Port $PORT is still in use after cleanup"
        echo "[Vite Manager] Please manually check: lsof -i :$PORT"
        exit 1
    fi
    
    echo "[Vite Manager] Port $PORT is free"
    
    # Start vite
    start_vite
}

# Handle cleanup on exit
trap "echo '[Vite Manager] Shutting down...'; exit 0" INT TERM

# Run main
main "$@"
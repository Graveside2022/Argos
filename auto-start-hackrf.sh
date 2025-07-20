#!/bin/bash

# Auto-start HackRF Emitter services (lightweight version)
# This script runs in the background and automatically starts HackRF services

HACKRF_BACKEND_DIR="/workspace/hackrf_emitter/backend"
HACKRF_FRONTEND_DIR="/workspace/hackrf_emitter/frontend"

# Check if services are already running
check_and_start_backend() {
    if ! pgrep -f "python.*app.py" > /dev/null; then
        echo "Starting HackRF Backend..."
        cd "$HACKRF_BACKEND_DIR"
        source venv/bin/activate
        nohup python app.py > /dev/null 2>&1 &
        sleep 3
        echo "HackRF Backend started on port 5000"
    fi
}

check_and_start_frontend() {
    if ! pgrep -f "npm.*start.*3000" > /dev/null; then
        echo "Starting HackRF Frontend..."
        cd "$HACKRF_FRONTEND_DIR"
        export BROWSER=none
        nohup npm start > /dev/null 2>&1 &
        sleep 10
        echo "HackRF Frontend started on port 3000"
    fi
}

# Main function
main() {
    echo "Auto-starting HackRF Emitter services..."
    check_and_start_backend
    check_and_start_frontend
    echo "✅ HackRF services are running"
    echo "Frontend: http://100.79.154.94:3000"
    echo "Backend:  http://100.79.154.94:5000"
}

# Run main function
main
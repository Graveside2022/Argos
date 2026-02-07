#!/bin/bash

# Argos + HackRF Emitter Complete Startup Script
# This script starts both the main Argos app (port 5173) and HackRF Emitter (ports 3000/5000)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Project directories
ARGOS_DIR="/home/ubuntu/projects/Argos"
HACKRF_BACKEND_DIR="$ARGOS_DIR/hackrf_emitter/backend"
HACKRF_FRONTEND_DIR="$ARGOS_DIR/hackrf_emitter/frontend"

# Process tracking
ARGOS_PID=""
HACKRF_BACKEND_PID=""
HACKRF_FRONTEND_PID=""

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] [OK] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] [WARN]  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $1${NC}"
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}[STOP] Shutting down all services...${NC}"
    
    if [ ! -z "$ARGOS_PID" ]; then
        kill $ARGOS_PID 2>/dev/null && success "Argos main app stopped"
    fi
    
    if [ ! -z "$HACKRF_BACKEND_PID" ]; then
        kill $HACKRF_BACKEND_PID 2>/dev/null && success "HackRF backend stopped"
    fi
    
    if [ ! -z "$HACKRF_FRONTEND_PID" ]; then
        kill $HACKRF_FRONTEND_PID 2>/dev/null && success "HackRF frontend stopped"
    fi
    
    # Kill any remaining processes
    pkill -f "npm.*run.*dev" 2>/dev/null || true
    pkill -f "python.*app.py" 2>/dev/null || true
    pkill -f "npm.*start.*3000" 2>/dev/null || true
    
    echo -e "${PURPLE}Thanks for using Argos + HackRF Emitter! [START]${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Stop any existing services
stop_existing_services() {
    log "Stopping any existing services..."
    
    # Kill existing processes
    pkill -f "npm.*run.*dev" 2>/dev/null && success "Stopped existing Argos app" || true
    pkill -f "python.*app.py" 2>/dev/null && success "Stopped existing HackRF backend" || true
    pkill -f "npm.*start.*3000" 2>/dev/null && success "Stopped existing HackRF frontend" || true
    
    # Wait for processes to terminate
    sleep 2
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check main Argos directory
    if [ ! -d "$ARGOS_DIR" ]; then
        error "Argos directory not found: $ARGOS_DIR"
        exit 1
    fi
    
    # Check HackRF backend
    if [ ! -f "$HACKRF_BACKEND_DIR/app.py" ]; then
        error "HackRF backend not found: $HACKRF_BACKEND_DIR/app.py"
        exit 1
    fi
    
    if [ ! -d "$HACKRF_BACKEND_DIR/venv" ]; then
        error "HackRF backend virtual environment not found: $HACKRF_BACKEND_DIR/venv"
        exit 1
    fi
    
    # Check HackRF frontend
    if [ ! -f "$HACKRF_FRONTEND_DIR/package.json" ]; then
        error "HackRF frontend not found: $HACKRF_FRONTEND_DIR/package.json"
        exit 1
    fi
    
    if [ ! -d "$HACKRF_FRONTEND_DIR/node_modules" ]; then
        error "HackRF frontend dependencies not found. Run: cd $HACKRF_FRONTEND_DIR && npm install"
        exit 1
    fi
    
    success "All prerequisites met"
}

# Start HackRF Backend
start_hackrf_backend() {
    log "Starting HackRF Backend on port 5000..."
    
    cd "$HACKRF_BACKEND_DIR"
    source venv/bin/activate
    
    # Start backend in background
    nohup python app.py > backend_startup.log 2>&1 &
    HACKRF_BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 3
    
    if kill -0 $HACKRF_BACKEND_PID 2>/dev/null; then
        # Test if backend is responding
        if curl -s --connect-timeout 5 http://localhost:5000/api/status >/dev/null 2>&1; then
            success "HackRF Backend started successfully (PID: $HACKRF_BACKEND_PID)"
        else
            warning "HackRF Backend started but not yet responding"
        fi
    else
        error "HackRF Backend failed to start"
        exit 1
    fi
}

# Start HackRF Frontend
start_hackrf_frontend() {
    log "Starting HackRF Frontend on port 3000..."
    
    cd "$HACKRF_FRONTEND_DIR"
    export BROWSER=none  # Prevent auto-opening browser
    
    # Start frontend in background
    nohup npm start > frontend_startup.log 2>&1 &
    HACKRF_FRONTEND_PID=$!
    
    # Wait for frontend to compile (React takes longer)
    log "Waiting for React to compile..."
    sleep 15
    
    if kill -0 $HACKRF_FRONTEND_PID 2>/dev/null; then
        # Test if frontend is responding
        if curl -s --connect-timeout 10 http://localhost:3000 >/dev/null 2>&1; then
            success "HackRF Frontend started successfully (PID: $HACKRF_FRONTEND_PID)"
        else
            warning "HackRF Frontend started but not yet responding"
        fi
    else
        error "HackRF Frontend failed to start"
        exit 1
    fi
}

# Start Main Argos App
start_argos_app() {
    log "Starting Main Argos App on port 5173..."
    
    cd "$ARGOS_DIR"
    
    # Start Argos in background
    nohup npm run dev > argos_startup.log 2>&1 &
    ARGOS_PID=$!
    
    # Wait for Argos to start
    sleep 5
    
    if kill -0 $ARGOS_PID 2>/dev/null; then
        # Test if Argos is responding
        if curl -s --connect-timeout 10 http://localhost:5173 >/dev/null 2>&1; then
            success "Main Argos App started successfully (PID: $ARGOS_PID)"
        else
            warning "Main Argos App started but not yet responding"
        fi
    else
        error "Main Argos App failed to start"
        exit 1
    fi
}

# Display status
show_status() {
    echo ""
    echo "==========================================="
    echo "  [START] Argos + HackRF Emitter System Status"
    echo "==========================================="
    echo ""
    echo "[OK] Main Argos App:     http://100.79.154.94:5173"
    echo "[OK] HackRF Frontend:    http://100.79.154.94:3000"
    echo "[OK] HackRF Backend:     http://100.79.154.94:5000"
    echo ""
    echo "Process IDs:"
    echo "  Argos:            $ARGOS_PID"
    echo "  HackRF Backend:   $HACKRF_BACKEND_PID"
    echo "  HackRF Frontend:  $HACKRF_FRONTEND_PID"
    echo ""
    echo "Logs:"
    echo "  Argos:            $ARGOS_DIR/argos_startup.log"
    echo "  HackRF Backend:   $HACKRF_BACKEND_DIR/backend_startup.log"
    echo "  HackRF Frontend:  $HACKRF_FRONTEND_DIR/frontend_startup.log"
    echo ""
    echo "[TARGET] Quick Access:"
    echo "  - Navigate to http://100.79.154.94:5173 for main dashboard"
    echo "  - Click 'RF Emitter' to open HackRF interface"
    echo "  - All services will stay running until you press Ctrl+C"
    echo ""
}

# Main execution
main() {
    echo -e "${PURPLE}[START] Starting Argos + HackRF Emitter System${NC}"
    echo -e "${BLUE}Complete RF Analysis and Signal Generation Platform${NC}"
    echo ""
    
    stop_existing_services
    check_prerequisites
    
    # Start services in order
    start_hackrf_backend
    start_hackrf_frontend
    start_argos_app
    
    show_status
    
    success "[DONE] All services started successfully!"
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Monitor all processes
    while true; do
        if ! kill -0 $ARGOS_PID 2>/dev/null; then
            error "Argos app stopped unexpectedly"
            cleanup
            exit 1
        fi
        
        if ! kill -0 $HACKRF_BACKEND_PID 2>/dev/null; then
            error "HackRF Backend stopped unexpectedly"
            cleanup
            exit 1
        fi
        
        if ! kill -0 $HACKRF_FRONTEND_PID 2>/dev/null; then
            error "HackRF Frontend stopped unexpectedly"
            cleanup
            exit 1
        fi
        
        sleep 5
    done
}

# Execute main function
main
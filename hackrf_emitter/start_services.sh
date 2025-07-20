#!/bin/bash

# HackRF Emitter Services Startup Script
# Production-grade service management

set -e

PROJECT_ROOT="/home/ubuntu/projects/Argos/hackrf_emitter"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Stop existing services
stop_services() {
    log "Stopping existing HackRF Emitter services..."
    
    # Stop backend
    pkill -f "python.*app\.py" 2>/dev/null && success "Backend stopped" || warning "No backend to stop"
    
    # Stop frontend  
    pkill -f "npm.*start.*3000" 2>/dev/null && success "Frontend stopped" || warning "No frontend to stop"
    
    # Wait for processes to fully terminate
    sleep 2
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check HackRF device
    if hackrf_info >/dev/null 2>&1; then
        success "HackRF device detected"
    else
        warning "HackRF device not detected - services will run in simulation mode"
    fi
    
    # Check backend dependencies
    if [ -f "$BACKEND_DIR/venv/bin/activate" ]; then
        success "Backend virtual environment found"
    else
        error "Backend virtual environment not found at $BACKEND_DIR/venv"
        exit 1
    fi
    
    # Check frontend dependencies
    if [ -d "$FRONTEND_DIR/node_modules" ]; then
        success "Frontend dependencies found"
    else
        error "Frontend dependencies not found. Run: cd $FRONTEND_DIR && npm install"
        exit 1
    fi
}

# Start backend service
start_backend() {
    log "Starting HackRF Emitter Backend..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Start backend in background with logging
    nohup python app.py > backend_production.log 2>&1 &
    BACKEND_PID=$!
    
    # Wait for backend to start
    sleep 3
    
    # Check if backend is running
    if kill -0 $BACKEND_PID 2>/dev/null; then
        success "Backend started (PID: $BACKEND_PID)"
        
        # Test API endpoint
        if curl -s --connect-timeout 5 http://localhost:5000/api/status >/dev/null; then
            success "Backend API responding on port 5000"
        else
            warning "Backend API not yet responding - may still be initializing"
        fi
    else
        error "Backend failed to start"
        tail -10 backend_production.log
        exit 1
    fi
}

# Start frontend service
start_frontend() {
    log "Starting HackRF Emitter Frontend..."
    
    cd "$FRONTEND_DIR"
    
    # Start frontend in background with logging
    nohup npm start > frontend_production.log 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to start (React can take longer)
    log "Waiting for React application to compile..."
    sleep 15
    
    # Check if frontend is running
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        success "Frontend started (PID: $FRONTEND_PID)"
        
        # Test frontend endpoint
        if curl -s --connect-timeout 10 http://100.79.154.94:3000 >/dev/null; then
            success "Frontend responding on http://100.79.154.94:3000"
        else
            warning "Frontend not yet responding - may still be compiling"
        fi
    else
        error "Frontend failed to start"
        tail -10 frontend_production.log
        exit 1
    fi
}

# Health check
health_check() {
    log "Performing health checks..."
    
    # Backend health
    if curl -s http://localhost:5000/api/health | grep -q "healthy"; then
        success "Backend health check passed"
    else
        warning "Backend health check failed"
    fi
    
    # Frontend accessibility
    if curl -s http://100.79.154.94:3000 | grep -q "<!DOCTYPE html>"; then
        success "Frontend accessibility check passed"
    else
        warning "Frontend accessibility check failed"
    fi
}

# Display service status
show_status() {
    echo ""
    echo "=================================="
    echo "  HackRF Emitter Service Status"
    echo "=================================="
    echo ""
    echo "Backend API:     http://100.79.154.94:5000"
    echo "Frontend App:    http://100.79.154.94:3000"
    echo "Argos Integration: Ready"
    echo ""
    echo "Logs:"
    echo "  Backend:  $BACKEND_DIR/backend_production.log"
    echo "  Frontend: $FRONTEND_DIR/frontend_production.log"
    echo ""
    echo "Commands:"
    echo "  Stop services: pkill -f 'python.*app.py'; pkill -f 'npm.*start'"
    echo "  View logs:     tail -f $BACKEND_DIR/backend_production.log"
    echo ""
}

# Main execution
main() {
    log "Starting HackRF Emitter Services (Production Mode)"
    
    stop_services
    check_prerequisites
    start_backend
    start_frontend
    health_check
    show_status
    
    success "All services started successfully!"
}

# Execute main function
main
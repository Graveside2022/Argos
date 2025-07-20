#!/bin/bash

# HackRF Emitter Comprehensive Quick Start Script
# Automatically sets up and runs the complete HackRF Emitter system

set -e  # Exit on any error

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Emojis for better UX
CHECK="✅"
CROSS="❌"
WARNING="⚠️"
ROCKET="🚀"
GEAR="⚙️"
GLOBE="🌐"

echo -e "${PURPLE}${ROCKET} HackRF Emitter Quick Start Script${NC}"
echo -e "${CYAN}Setting up your complete RF signal generation platform...${NC}"
echo

# Store the original directory
ORIGINAL_DIR=$(pwd)

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}${GEAR} $1${NC}"
    echo "----------------------------------------"
}

# Function to print success
print_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}${CROSS} $1${NC}"
}

# Function to check command existence
check_command() {
    if command -v "$1" &> /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to check version
check_version() {
    local cmd="$1"
    local min_version="$2"
    local version_cmd="$3"
    
    if check_command "$cmd"; then
        local current_version=$($version_cmd 2>/dev/null | head -n1)
        print_success "$cmd found: $current_version"
        return 0
    else
        return 1
    fi
}

# Function to check HTTP endpoint
check_http_endpoint() {
    local url="$1"
    
    # Try curl first (most common)
    if command -v curl &> /dev/null; then
        curl -s "$url" >/dev/null 2>&1
        return $?
    fi
    
    # Try wget as fallback
    if command -v wget &> /dev/null; then
        wget -q --spider "$url" >/dev/null 2>&1
        return $?
    fi
    
    # Try nc (netcat) as last resort
    if command -v nc &> /dev/null; then
        local host=$(echo "$url" | sed 's|http://||' | cut -d: -f1)
        local port=$(echo "$url" | sed 's|http://||' | cut -d: -f2 | cut -d/ -f1)
        echo "" | nc -w1 "$host" "$port" >/dev/null 2>&1
        return $?
    fi
    
    # If none available, assume success after a delay
    sleep 1
    return 0
}

# Function to open browser
open_browser() {
    local url="$1"
    echo -e "\n${GLOBE} Opening web browser..."
    
    # Detect OS and open browser accordingly
    if command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$url" &>/dev/null &
    elif command -v open &> /dev/null; then
        # macOS
        open "$url" &>/dev/null &
    elif command -v start &> /dev/null; then
        # Windows (Git Bash, WSL)
        start "$url" &>/dev/null &
    else
        print_warning "Could not automatically open browser. Please navigate to: $url"
        return 1
    fi
    print_success "Browser opened to $url"
}

# Function to cleanup background processes
cleanup() {
    echo -e "\n\n${YELLOW}Shutting down services...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null && print_success "Backend stopped"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null && print_success "Frontend stopped"
    fi
    cd "$ORIGINAL_DIR"
    echo -e "\n${CYAN}Thanks for using HackRF Emitter! ${ROCKET}${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check system dependencies
print_section "Checking System Dependencies"

# Function to compare versions
version_compare() {
    local version1="$1"
    local version2="$2"
    
    # Split versions into arrays
    IFS='.' read -ra V1 <<< "$version1"
    IFS='.' read -ra V2 <<< "$version2"
    
    # Compare major version
    if [ "${V1[0]}" -gt "${V2[0]}" ]; then
        return 0  # version1 > version2
    elif [ "${V1[0]}" -lt "${V2[0]}" ]; then
        return 1  # version1 < version2
    fi
    
    # Major versions are equal, compare minor version
    local minor1="${V1[1]:-0}"
    local minor2="${V2[1]:-0}"
    
    if [ "$minor1" -ge "$minor2" ]; then
        return 0  # version1 >= version2
    else
        return 1  # version1 < version2
    fi
}

# Check Python 3.8+
if check_version "python3" "3.8" "python3 --version"; then
    PYTHON_VERSION=$(python3 -c "import sys; print('.'.join(map(str, sys.version_info[:2])))")
    if version_compare "$PYTHON_VERSION" "3.8"; then
        print_success "Python $PYTHON_VERSION meets requirements (≥3.8)"
    else
        print_error "Python $PYTHON_VERSION is too old. Please install Python 3.8 or higher."
        exit 1
    fi
else
    print_error "Python 3 is required but not installed."
    echo "Please install Python 3.8+ from: https://www.python.org/downloads/"
    exit 1
fi

# Check Node.js 16+
if check_version "node" "16" "node --version"; then
    NODE_VERSION=$(node --version | sed 's/v//')
    if version_compare "$NODE_VERSION" "16.0"; then
        print_success "Node.js $NODE_VERSION meets requirements (≥16.0)"
    else
        print_error "Node.js $NODE_VERSION is too old. Please install Node.js 16+ from: https://nodejs.org/"
        exit 1
    fi
else
    print_error "Node.js is required but not installed."
    echo "Please install Node.js 16+ from: https://nodejs.org/"
    exit 1
fi

# Check npm
if check_version "npm" "" "npm --version"; then
    :
else
    print_error "npm is required but not installed (usually comes with Node.js)."
    exit 1
fi

# Check pip
if check_command "pip3" || check_command "pip"; then
    print_success "pip found"
else
    print_error "pip is required but not installed."
    echo "Please install pip: python3 -m ensurepip --upgrade"
    exit 1
fi

# Check HackRF tools (optional)
if check_command "hackrf_info"; then
    print_success "HackRF tools found - hardware support enabled"
    
    # Test HackRF connection
    if hackrf_info &>/dev/null; then
        print_success "HackRF device detected and ready"
    else
        print_warning "HackRF tools found but no device detected"
        echo "  ${CYAN}Connect your HackRF device or run in simulation mode${NC}"
    fi
else
    print_warning "HackRF tools not found - running in simulation mode"
    echo "  ${CYAN}Install with: sudo apt-get install hackrf (Linux) or brew install hackrf (macOS)${NC}"
fi

# Check Git (optional but recommended)
if check_command "git"; then
    print_success "Git found - ready for development"
else
    print_warning "Git not found - recommended for version control"
fi

print_success "All required dependencies satisfied!"

# Backend Setup
print_section "Setting Up Backend Environment"

cd "$ORIGINAL_DIR/backend" || {
    print_error "Could not find backend directory"
    exit 1
}

# Verify backend files
if [ ! -f "app.py" ]; then
    print_error "app.py not found in backend directory"
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    print_error "requirements.txt not found in backend directory"
    exit 1
fi

print_success "Backend files verified"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo -e "${CYAN}Creating Python virtual environment...${NC}"
    python3 -m venv venv || {
        print_error "Failed to create virtual environment"
        exit 1
    }
    print_success "Virtual environment created"
else
    print_success "Virtual environment already exists"
fi

# Activate virtual environment
echo -e "${CYAN}Activating virtual environment...${NC}"
source venv/bin/activate || {
    print_error "Failed to activate virtual environment"
    exit 1
}
print_success "Virtual environment activated"

# Check if dependencies need installation
NEED_INSTALL=false
if [ ! -f "venv/.deps_installed" ]; then
    NEED_INSTALL=true
else
    # Check if requirements.txt is newer than marker file
    if [ "requirements.txt" -nt "venv/.deps_installed" ]; then
        NEED_INSTALL=true
    fi
fi

if $NEED_INSTALL; then
    echo -e "${CYAN}Installing backend dependencies...${NC}"
    echo "This may take a few minutes on first run..."
    
    # Upgrade pip first
    echo -e "${CYAN}Upgrading pip...${NC}"
    pip install --upgrade pip || {
        print_error "Failed to upgrade pip"
        exit 1
    }
    
    # Install dependencies with progress
    echo -e "${CYAN}Installing packages from requirements.txt...${NC}"
    pip install -r requirements.txt || {
        print_error "Failed to install backend dependencies"
        echo "Error details shown above. Common fixes:"
        echo "  1. Check your internet connection"
        echo "  2. Try: pip install --upgrade pip setuptools wheel"
        echo "  3. CRC16 now uses pure Python implementation (no external dependencies)"
        echo "  4. Run manually: pip install -r requirements.txt"
        exit 1
    }
    
    # Create marker file
    touch venv/.deps_installed
    print_success "Backend dependencies installed successfully"
else
    print_success "Backend dependencies already up to date"
    
    # CRC16 now uses pure Python implementation - no external dependencies needed
print_success "CRC16 using pure Python implementation"
fi

# Frontend Setup
print_section "Setting Up Frontend Environment"

cd "$ORIGINAL_DIR/frontend" || {
    print_error "Could not find frontend directory"
    cleanup
    exit 1
}

# Verify frontend files
if [ ! -f "package.json" ]; then
    print_error "package.json not found in frontend directory"
    cleanup
    exit 1
fi

print_success "Frontend files verified"

# Check if dependencies need installation
FRONTEND_NEED_INSTALL=false
if [ ! -d "node_modules" ]; then
    FRONTEND_NEED_INSTALL=true
else
    # Check if package.json is newer than node_modules
    if [ "package.json" -nt "node_modules" ]; then
        FRONTEND_NEED_INSTALL=true
    fi
fi

if $FRONTEND_NEED_INSTALL; then
    echo -e "${CYAN}Installing frontend dependencies...${NC}"
    echo "This may take a few minutes on first run..."
    
    npm install > /dev/null 2>&1 || {
        print_error "Failed to install frontend dependencies"
        echo "Try running: npm install"
        cleanup
        exit 1
    }
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies already up to date"
fi

# Start Services
print_section "Starting Services"

# Start backend
echo -e "${CYAN}Starting backend server...${NC}"
cd "$ORIGINAL_DIR/backend"
source venv/bin/activate

# Start backend with logs visible
echo -e "${YELLOW}Backend logs will appear below:${NC}"
echo "----------------------------------------"
python app.py &
BACKEND_PID=$!

# Wait for backend to start and check if it's running
echo -e "\n${CYAN}Waiting for backend to initialize...${NC}"
for i in {1..10}; do
    if kill -0 $BACKEND_PID 2>/dev/null; then
        if check_http_endpoint "http://localhost:5000/api/status"; then
            print_success "Backend server running on http://localhost:5000"
            break
        fi
    else
        print_error "Backend failed to start - check logs above"
        exit 1
    fi
    
    if [ $i -eq 10 ]; then
        print_error "Backend startup timeout"
        cleanup
        exit 1
    fi
    
    sleep 1
    echo -n "."
done

# Start frontend
echo -e "\n${CYAN}Starting frontend server...${NC}"
cd "$ORIGINAL_DIR/frontend"

# Set environment to suppress browser auto-open (we'll do it manually)
export BROWSER=none

echo -e "${YELLOW}Frontend logs will appear below:${NC}"
echo "----------------------------------------"
PORT=3000 npm start &
FRONTEND_PID=$!

# Wait for frontend to start
echo -e "\n${CYAN}Waiting for frontend to initialize...${NC}"
for i in {1..15}; do
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        if check_http_endpoint "http://localhost:3000"; then
            print_success "Frontend server running on http://localhost:3000"
            break
        fi
    else
        print_error "Frontend failed to start - check logs above"
        cleanup
        exit 1
    fi
    
    if [ $i -eq 15 ]; then
        print_error "Frontend startup timeout"
        cleanup
        exit 1
    fi
    
    sleep 1
    echo -n "."
done

# Success message and browser opening
print_section "🎉 Setup Complete!"

echo -e "${GREEN}${ROCKET} HackRF Emitter is now running successfully!${NC}\n"

echo -e "${CYAN}Services:${NC}"
echo -e "  ${CHECK} Backend API: http://localhost:5000"
echo -e "  ${CHECK} Frontend UI: http://localhost:3000"
echo -e "  ${CHECK} WebSocket: ws://localhost:5000"

echo -e "\n${CYAN}Live Logs:${NC}"
echo -e "  📄 Backend and Frontend logs are displayed in real-time above"
echo -e "  📊 Any errors or status messages will appear immediately"

echo -e "\n${CYAN}Quick Start Guide:${NC}"
echo -e "  1. 🌐 Open http://localhost:3000 in your browser"
echo -e "  2. 📡 Connect your HackRF device (or use simulation mode)"
echo -e "  3. 🔧 Select a workflow from the library"
echo -e "  4. ⚙️  Configure parameters as needed"
echo -e "  5. 🚀 Click 'Configure & Launch' to start transmission"

echo -e "\n${YELLOW}${WARNING} Safety Reminder:${NC}"
echo -e "  Ensure compliance with local RF regulations"
echo -e "  System restrictions have been disabled for advanced users"

# Attempt to open browser after a short delay
sleep 2
open_browser "http://localhost:3000"

echo -e "\n${PURPLE}Press Ctrl+C to stop all services${NC}"
echo -e "${CYAN}Monitoring services... ${ROCKET}${NC}\n"

# Monitor both processes
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend process stopped unexpectedly"
        cleanup
        exit 1
    fi
    
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend process stopped unexpectedly"
        cleanup
        exit 1
    fi
    
    sleep 5
done 
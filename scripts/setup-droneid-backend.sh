#!/bin/bash

# Setup script for RemoteIDReceiver backend integration with Argos

set -e

echo "=== DroneID Backend Setup Script ==="
echo

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the Argos project root
if [ ! -f "package.json" ] || [ ! -d "RemoteIDReceiver" ]; then
    echo -e "${RED}Error: This script must be run from the Argos project root directory${NC}"
    echo "Please cd to your Argos directory and run again"
    exit 1
fi

echo -e "${YELLOW}Step 1: Installing Python dependencies${NC}"
cd RemoteIDReceiver/Receiver

# Check if Python 3.8+ is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python 3 is not installed${NC}"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.8"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Error: Python $PYTHON_VERSION is installed, but version $REQUIRED_VERSION or higher is required${NC}"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Installing Python requirements..."
pip install -r requirements.txt

echo -e "${GREEN}✓ Python dependencies installed${NC}"
echo

echo -e "${YELLOW}Step 2: Setting up configuration${NC}"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "Created .env file from .env.example"
    else
        # Create a basic .env file
        cat > .env << EOF
# RemoteIDReceiver Configuration
FRONTEND_MAP_STYLE=default
# Uncomment to use Google Maps:
# FRONTEND_MAP_STYLE=google
# GOOGLE_MAPS_API_KEY=your-api-key-here
EOF
        echo "Created basic .env file"
    fi
fi

echo -e "${GREEN}✓ Configuration file ready${NC}"
echo

echo -e "${YELLOW}Step 3: Building frontend${NC}"
# Check if Docker is installed
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "Building frontend with Docker..."
    docker-compose up build-frontend
    echo -e "${GREEN}✓ Frontend built${NC}"
else
    echo -e "${YELLOW}Warning: Docker not found, skipping frontend build${NC}"
    echo "Install Docker to build the RemoteIDReceiver frontend"
fi
echo

echo -e "${YELLOW}Step 4: Checking WiFi adapter${NC}"
# Check for WiFi adapters
if command -v iwconfig &> /dev/null; then
    echo "Available network interfaces:"
    iwconfig 2>/dev/null | grep -E "^[a-zA-Z]" | cut -d' ' -f1
    echo
    echo -e "${YELLOW}Note: You'll need a WiFi adapter that supports monitor mode${NC}"
    echo "Recommended adapters: Archer T2U Plus, EDIMAX EW-7811Un"
else
    echo -e "${YELLOW}Warning: iwconfig not found, can't check WiFi adapters${NC}"
fi
echo

echo -e "${GREEN}=== Setup Complete ===${NC}"
echo
echo "To start the RemoteIDReceiver backend:"
echo -e "${GREEN}cd RemoteIDReceiver/Receiver${NC}"
echo -e "${GREEN}source venv/bin/activate${NC}"
echo -e "${GREEN}sudo python3 ./backend/dronesniffer/main.py -p 80${NC}"
echo
echo "Note: Use -p 8080 if you want to run on a different port"
echo "      Update the WebSocket URL in /src/routes/droneid/+page.svelte accordingly"
echo
echo "The DroneID page in Argos will automatically connect to the backend at ws://localhost:80/ws"
echo

# Deactivate virtual environment
deactivate

cd ../..
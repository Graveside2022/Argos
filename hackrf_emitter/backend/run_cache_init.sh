#!/bin/bash

# Script to run cache initialization with proper virtual environment activation

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Activating virtual environment and running cache initialization...${NC}"

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the backend directory
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run the main start script first:"
    echo "   cd .. && ./start.sh"
    exit 1
fi

# Activate virtual environment
echo -e "${GREEN}✅ Activating virtual environment...${NC}"
source venv/bin/activate

# Run the cache initialization script
echo -e "${GREEN}✅ Running cache initialization...${NC}"
python3 initialize_cache.py "$@"

echo -e "${GREEN}✅ Cache initialization complete!${NC}" 
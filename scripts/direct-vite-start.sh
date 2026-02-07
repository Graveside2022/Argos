#!/bin/bash

# Direct Vite Startup Script for Argos Project
# Bypasses npm run dev complexity

set -euo pipefail

PROJECT_DIR="/home/pi/projects/Argos"
PORT=5173

cd "$PROJECT_DIR"

# Kill any existing processes on port 5173
echo "Cleaning up port $PORT..."
lsof -ti :$PORT | xargs -r kill -9 2>/dev/null || true
pkill -9 -f "vite.*dev" || true
pkill -9 -f "npm.*dev" || true
sleep 2

# Validate environment first
echo "Validating environment..."
node src/lib/server/validate-env.js

# Start Vite directly
echo "Starting Vite on port $PORT..."
NODE_OPTIONS='--max-old-space-size=1024' npx vite dev --port $PORT --host
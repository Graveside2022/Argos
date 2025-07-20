#!/bin/bash

# Kill any existing processes
echo "Stopping any existing services..."
pkill -f "npm.*dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start the development server with increased memory and error handling
echo "Starting Fusion development server..."
export NODE_OPTIONS="--max-old-space-size=3072"

# Start in background with proper error handling
npm run dev > fusion-dev.log 2>&1 &
DEV_PID=$!

echo "Development server starting with PID: $DEV_PID"
echo "Logs are being written to fusion-dev.log"
echo ""
echo "Waiting for server to be ready..."
sleep 5

# Check if server is running
if ps -p $DEV_PID > /dev/null; then
    echo "✅ Server is running at http://100.79.154.94:5173"
    echo ""
    echo "To view logs: tail -f fusion-dev.log"
    echo "To stop: kill $DEV_PID"
else
    echo "❌ Server failed to start. Check fusion-dev.log for errors"
    tail -20 fusion-dev.log
fi
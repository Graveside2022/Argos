#!/usr/bin/env bash
# debug-headless.sh
# Launches a headless Chromium instance inside Xvfb for remote debugging.
# Usage: ./scripts/dev/debug-headless.sh [URL]

URL="${1:-http://localhost:5173}"
DISPLAY_NUM=":99"
DEBUG_PORT="9222"

# Check dependencies
if ! command -v Xvfb &>/dev/null; then
    echo "Error: Xvfb is not installed. Run 'sudo apt install xvfb'."
    exit 1
fi

if ! command -v chromium &>/dev/null; then
    echo "Error: chromium is not installed. Run 'sudo apt install chromium'."
    exit 1
fi

# Cleanup previous session
pkill -f "Xvfb $DISPLAY_NUM" 2>/dev/null
pkill -f "chromium.*remote-debugging-port=$DEBUG_PORT" 2>/dev/null

echo "Starting Xvfb on $DISPLAY_NUM..."
Xvfb $DISPLAY_NUM -screen 0 1280x1024x24 &
XVFB_PID=$!
sleep 2

echo "Starting Chromium headless debug on port $DEBUG_PORT..."
DISPLAY=$DISPLAY_NUM chromium \
    --remote-debugging-port=$DEBUG_PORT \
    --no-sandbox \
    --disable-gpu \
    --user-data-dir=/tmp/chrome-debug-profile \
    "$URL" &
CHROME_PID=$!

echo ""
echo "=== Headless Debug Session Active ==="
echo "Target URL: $URL"
echo "Debug Port: $DEBUG_PORT"
echo ""
echo "To debug from your laptop, run this SSH tunnel command locally:"
echo "  ssh -L $DEBUG_PORT:localhost:$DEBUG_PORT user@$(hostname -I | awk '{print $1}')"
echo ""
echo "Then open Chrome on your laptop and go to: chrome://inspect"
echo ""
echo "Press Ctrl+C to stop the debug session."

# Wait for user interrupt
trap "kill $XVFB_PID $CHROME_PID; exit" SIGINT SIGTERM
wait $CHROME_PID

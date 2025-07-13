#!/bin/bash
# Development environment setup - prevents multiple instances and memory issues

echo "=== Argos Development Setup ==="
echo ""

# 1. Check for multiple vite instances
VITE_COUNT=$(ps aux | grep -E "vite.*Argos" | grep -v grep | wc -l)
if [ $VITE_COUNT -gt 0 ]; then
    echo "⚠️  Found $VITE_COUNT vite instance(s) running"
    read -p "Kill all existing vite processes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ps aux | grep -E "vite.*Argos" | grep -v grep | awk '{print $2}' | xargs -r kill -9
        echo "✓ Killed existing vite processes"
    fi
fi

# 2. Check log file sizes
echo ""
echo "Checking log files..."
for logfile in /tmp/hackrf-sweeper.log /tmp/hackrf-*.log; do
    if [ -f "$logfile" ]; then
        SIZE=$(du -h "$logfile" 2>/dev/null | cut -f1)
        echo "  $logfile: $SIZE"
        if [ $(stat -c%s "$logfile" 2>/dev/null || echo "0") -gt 10485760 ]; then
            echo "  ⚠️  Large log file detected, rotating..."
            ./scripts/log-rotation.sh >/dev/null 2>&1
        fi
    fi
done

# 3. Check memory usage
echo ""
echo "Memory status:"
free -h | grep -E "^(Mem|Swap):"

# 4. Set development environment
echo ""
echo "Setting development environment..."
export NODE_ENV=development
export LOG_LEVEL=warn
export VITE_LOG_LEVEL=warn
echo "✓ Environment configured for development"

# 5. Recommendations
echo ""
echo "=== Recommendations ==="
echo "• Use 'npm run dev' to start vite (auto-manages instances)"
echo "• Monitor logs with: tail -f /tmp/hackrf-sweeper.log"
echo "• If memory issues occur, run: ./scripts/claude-cleanup.sh"
echo "• For production mode: cp .env.production .env"
echo ""

# 6. Optional: Start dev server
read -p "Start development server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run dev
fi
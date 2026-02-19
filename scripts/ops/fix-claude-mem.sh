#!/bin/bash
# scripts/ops/fix-claude-mem.sh
# Applies fixes for claude-mem process explosion and orphaned process issues.
# Safe to run multiple times.

set -e

# Path to claude-mem plugins
PLUGIN_DIR="$HOME/.claude/plugins/cache/thedotmack/claude-mem"

if [ ! -d "$PLUGIN_DIR" ]; then
    echo "Error: claude-mem plugin directory not found at $PLUGIN_DIR"
    exit 1
fi

PATCH_APPLIED=false

echo "Found claude-mem plugin directory."

# Find all version directories
VERSIONS=$(ls -d "$PLUGIN_DIR"/*/)

for VERSION_DIR in $VERSIONS; do
    echo "Processing version: $(basename "$VERSION_DIR")"
    
    # 1. Fix Orphaned Processes (bun-runner.js)
    BUN_RUNNER="$VERSION_DIR/scripts/bun-runner.js"
    if [ -f "$BUN_RUNNER" ]; then
        if grep -q "const signals = \['SIGINT', 'SIGTERM'\];" "$BUN_RUNNER"; then
            echo "  - bun-runner.js already patched."
        else
            echo "  - Patching bun-runner.js..."
            # Insert the signal handling code before child.on('error')
            sed -i "/child.on('error', (err) => {/i \\
// Forward signals to child\\
const signals = ['SIGINT', 'SIGTERM'];\\
signals.forEach((signal) => {\\
  process.on(signal, () => {\\
    if (child.exitCode === null) {\\
      child.kill(signal);\\
    }\\
  });\\
});" "$BUN_RUNNER"
            echo "  - bun-runner.js patched."
            PATCH_APPLIED=true
        fi
    else
        echo "  - Warning: bun-runner.js not found in $(basename "$VERSION_DIR")"
    fi

    # 2. Fix Concurrency Race Condition (worker-service.cjs)
    WORKER_SERVICE="$VERSION_DIR/scripts/worker-service.cjs"
    if [ -f "$WORKER_SERVICE" ]; then
        if grep -q "pendingSpawns=0" "$WORKER_SERVICE"; then
             echo "  - worker-service.cjs already patched."
        else
             echo "  - Patching worker-service.cjs..."
             
             # 2a. Initialize counter
             sed -i 's/var OJ=(0,$J.promisify)(Tg.exec),Iu=new Map;/var OJ=(0,$J.promisify)(Tg.exec),Iu=new Map,pendingSpawns=0;/g' "$WORKER_SERVICE"
             
             # 2b. Decrement in B6e
             sed -i 's/function B6e(t,e,r){Iu.set(t,{pid:t,sessionDbId:e,spawnedAt:Date.now(),process:r}),C.info("PROCESS"/function B6e(t,e,r){pendingSpawns>0\&\&pendingSpawns--,Iu.set(t,{pid:t,sessionDbId:e,spawnedAt:Date.now(),process:r}),C.info("PROCESS"/g' "$WORKER_SERVICE"
             
             # 2c. Increment check in AJ initialization
             sed -i 's/async function AJ(t,e=6e4){if(!(Iu.size<t))/async function AJ(t,e=6e4){if(!((Iu.size+pendingSpawns)<t))/g' "$WORKER_SERVICE"
             
             # 2d. Increment in AJ waiter
             sed -i 's/a=()=>{clearTimeout(s),Iu.size<t?r():Sg.push(a)};Sg.push(a)/a=()=>{clearTimeout(s),(Iu.size+pendingSpawns)<t?(pendingSpawns++,r()):Sg.push(a)};Sg.push(a)});pendingSpawns++/g' "$WORKER_SERVICE"

             echo "  - worker-service.cjs patched."
             PATCH_APPLIED=true
        fi
    else
        echo "  - Warning: worker-service.cjs not found in $(basename "$VERSION_DIR")"
    fi

done

if [ "$PATCH_APPLIED" = true ]; then
    echo "Patches were applied. Restarting claude-mem processes..."
    if pgrep -f claude-mem > /dev/null; then
        pkill -f claude-mem
        echo "Killed existing processes. They should restart automatically by Claude Desktop/MCP."
    else
        echo "No running claude-mem processes found to restart."
    fi
else
    echo "All versions already patched. No restart needed."
fi

echo "Done. Patches applied."

#!/usr/bin/env bash
# build-apm-runner.sh — Build the APM CLI executable + memory pool library
#
# Checks dependencies, compiles apm-runner + libapmsafe.so, and verifies
# both version retrieval and propagation computation work correctly.
#
# Usage: ./scripts/ops/build-apm-runner.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APM_DIR="$PROJECT_ROOT/native/apm-runner"

echo "=== Building APM Runner ==="
echo "Directory: $APM_DIR"

# Check dependencies
echo ""
echo "Checking dependencies..."

if ! command -v gcc &>/dev/null; then
    echo "ERROR: gcc not found. Install with: sudo apt install gcc"
    exit 1
fi
echo "  gcc: $(gcc --version | head -1)"

if [ ! -f /usr/lib/aarch64-linux-gnu/libgfortran.so.5 ] && ! ldconfig -p 2>/dev/null | grep -q libgfortran.so.5; then
    echo "ERROR: libgfortran5 not found. Install with: sudo apt install libgfortran5"
    exit 1
fi
echo "  libgfortran5: found"

if [ ! -f "$APM_DIR/lib/libapm_linux.so" ]; then
    echo "ERROR: libapm_linux.so not found at $APM_DIR/lib/"
    if [ -f "/tmp/libapm_linux_fixed.so" ]; then
        echo "  Copying from /tmp/libapm_linux_fixed.so..."
        cp /tmp/libapm_linux_fixed.so "$APM_DIR/lib/libapm_linux.so"
    elif [ -f "/tmp/apm-relink/libapm_linux.so" ]; then
        echo "  Copying from /tmp/apm-relink/..."
        cp /tmp/apm-relink/libapm_linux.so "$APM_DIR/lib/"
    else
        echo "  Please place libapm_linux.so in $APM_DIR/lib/"
        exit 1
    fi
fi
echo "  libapm_linux.so: found ($(stat -c%s "$APM_DIR/lib/libapm_linux.so") bytes)"

# Build
echo ""
echo "Compiling..."
cd "$APM_DIR"
make clean 2>/dev/null || true
make

echo ""
echo "Binary: $APM_DIR/apm-runner ($(stat -c%s "$APM_DIR/apm-runner") bytes)"
echo "Pool:   $APM_DIR/lib/libapmsafe.so ($(stat -c%s "$APM_DIR/lib/libapmsafe.so") bytes)"

# Verify version
echo ""
echo "Verifying..."
RESULT=$(echo '{"mode":"version"}' | LD_PRELOAD=./lib/libapmsafe.so ./apm-runner 2>/dev/null || true)
echo "  Version: $RESULT"

if ! echo "$RESULT" | grep -q '"error":0'; then
    echo "WARNING: Version check failed."
    exit 1
fi

# Verify propagation
echo -n "  Propagation: "
PROP_RESULT=$(python3 -c '
import json
steps=50; maxr=10000.0; ss=maxr/steps
d=[i*ss for i in range(steps)]; e=[0.0]*steps
j={"mode":"single","frequency":500,"polarization":1,"txHeight":5,"rxHeight":2,
   "maxRange":maxr,"numSteps":steps,"distances":d,"elevation":e,
   "refractHeights":[0.0],"refractM":[0.0,4000.0],"atmosN":[339.0,811.0]}
print(json.dumps(j))
' | LD_PRELOAD=./lib/libapmsafe.so ./apm-runner 2>/dev/null)

python3 -c "
import json, sys
r = json.loads('$PROP_RESULT'.split(chr(10))[0])
loss = r['loss']
nz = [v for v in loss if v != 0]
if r['error'] == 0 and len(nz) == 50:
    print('PASS (err=0, 50/50 values, %.1f-%.1f dB)' % (min(nz), max(nz)))
else:
    print('FAIL (err=%d, %d/%d non-zero)' % (r['error'], len(nz), len(loss)))
    sys.exit(1)
"

echo ""
echo "=== BUILD SUCCESS ==="
echo ""
echo "Usage from Node.js:"
echo "  const { execFileAsync } = require('./src/lib/server/exec');"
echo "  await execFileAsync('./native/apm-runner/apm-runner', [], {"
echo "    env: { ...process.env, LD_PRELOAD: './native/apm-runner/lib/libapmsafe.so' }"
echo "  });"

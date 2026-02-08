# Phase 7.1: Pre-Migration Discovery, Baseline Capture, and Golden File Generation

**Risk Level**: LOW -- Read-only analysis and test vector generation. No production code modified.
**Prerequisites**: None (this phase is the entry point for all Phase 7 work)
**Estimated Duration**: One focused session
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

This phase captures the complete ground truth of the Python backend before any migration begins.
Every numerical claim, every file path, every function signature, and every binary output must be
recorded here so that the TypeScript replacement can be verified against an immutable baseline.

Without this phase, there is no objective way to verify the migration succeeded.

---

## Task 7.1.0: Build Health Prerequisite Gate

Before any Phase 7 work begins, the following prerequisites MUST be verified:

1. `npm run build` must succeed (currently FAILS due to MCP SDK import error in src/routes/api/agent/stream/+server.ts)
2. `npm run typecheck` must report 0 errors (currently 111 errors in 74 files)
3. Existing test suite must pass (`npm run test:unit` -- currently 44 failures)

If any prerequisite fails, resolve it before proceeding with Phase 7.1.

These are hard blockers. Phase 7 verification gates (Phase 7.6) require build, typecheck, and test passes. Starting Phase 7 on a broken foundation makes gate checks meaningless.

---

## Task 7.1.1: Complete Source Inventory Verification

### Subtask 7.1.1.1: Python Backend File Inventory

Record the exact state of every file in `hackrf_emitter/backend/` (excluding `.venv/` and `__pycache__/`).

**Verified inventory (27 project files):**

| #   | File (relative to hackrf_emitter/backend/)     | Lines | Type                                 |
| --- | ---------------------------------------------- | ----- | ------------------------------------ |
| 1   | `rf_workflows/enhanced_workflows.py`           | 1,385 | Protocol orchestration               |
| 2   | `rf_workflows/hackrf_controller.py`            | 795   | Hardware control                     |
| 3   | `rf_workflows/modulation_workflows.py`         | 672   | Signal modulation                    |
| 4   | `rf_workflows/universal_signal_cache.py`       | 625   | Signal cache (primary)               |
| 5   | `rf_workflows/adsb_protocol.py`                | 580   | ADS-B protocol encoder               |
| 6   | `rf_workflows/drone_video_jamming_protocol.py` | 579   | Drone video jamming                  |
| 7   | `rf_workflows/elrs_jamming_protocol.py`        | 559   | ELRS jamming                         |
| 8   | `rf_workflows/gps_protocol.py`                 | 460   | GPS L1 C/A encoder                   |
| 9   | `rf_workflows/wideband_signal_cache.py`        | 371   | Signal cache (wideband)              |
| 10  | `rf_workflows/raw_energy_protocol.py`          | 340   | Broadband energy emission            |
| 11  | `rf_workflows/elrs_protocol.py`                | 330   | ExpressLRS protocol                  |
| 12  | `app.py`                                       | 406   | Flask application + routes           |
| 13  | `utils/config_manager.py`                      | 254   | Configuration management             |
| 14  | `sweep_bridge.py`                              | 172   | hackrf_sweep to python-hackrf bridge |
| 15  | `initialize_cache.py`                          | 119   | Cache initialization                 |
| 16  | `simple_test.py`                               | 101   | Test utilities                       |
| 17  | `utils/safety_manager.py`                      | 95    | Safety limits (all-permissive)       |
| 18  | `rf_workflows/crc16_python.py`                 | 70    | CRC-16 implementations               |
| 19  | `rf_workflows/__init__.py`                     | 0     | Package marker                       |
| 20  | `utils/__init__.py`                            | 0     | Package marker                       |
| 21  | `__init__.py`                                  | 0     | Package marker                       |
| 22  | `Dockerfile`                                   | 52    | Python container build               |
| 23  | `requirements.txt`                             | 11    | Python dependencies                  |
| 24  | `README.md`                                    | 88    | Documentation                        |
| 25  | `.dockerignore`                                | 58    | Docker ignore rules                  |
| 26  | `run_cache_init.sh`                            | 34    | Cache init script                    |
| 27  | `package-lock.json`                            | 6     | Artifact                             |

**Total Python source lines**: 7,913 (across 18 non-empty .py files)
**Total backend project files**: 27

### Subtask 7.1.1.2: React Frontend File Inventory

Record the exact state of every source file in `hackrf_emitter/frontend/src/`.

| #   | File (relative to hackrf_emitter/frontend/src/) | Lines | Purpose                                    |
| --- | ----------------------------------------------- | ----- | ------------------------------------------ |
| 1   | `pages/Workflows.tsx`                           | 466   | RF workflow browser and launcher           |
| 2   | `pages/Dashboard.tsx`                           | 442   | System status, quick-start, emergency stop |
| 3   | `components/WorkflowForm.tsx`                   | 250   | Parameter configuration modal              |
| 4   | `pages/DeviceInfo.tsx`                          | 237   | HackRF device status display               |
| 5   | `pages/Settings.tsx`                            | 213   | Safety limits and guidelines               |
| 6   | `services/api.ts`                               | 197   | REST client to Flask backend               |
| 7   | `contexts/SocketContext.tsx`                    | 137   | Flask-SocketIO WebSocket context           |
| 8   | `components/Layout.tsx`                         | 128   | App layout with navigation                 |
| 9   | `pages/Library.tsx`                             | 113   | Cached signal browser                      |
| 10  | `components/ErrorBoundary.tsx`                  | 74    | React error boundary                       |
| 11  | `App.tsx`                                       | 26    | App root with routing                      |
| 12  | `index.tsx`                                     | 21    | React entry point                          |

**Total frontend source lines**: 2,304 (12 source files, excluding config)
**Total frontend source lines including config**: 2,362 (with postcss.config.js, tailwind.config.js, tsconfig.json, package.json)

### Subtask 7.1.1.3: Root-Level File Inventory

| #   | File (relative to hackrf_emitter/) | Lines | Purpose                      |
| --- | ---------------------------------- | ----- | ---------------------------- |
| 1   | `start.sh`                         | 495   | Service orchestration script |
| 2   | `start_services.sh`                | 194   | Multi-service launcher       |
| 3   | `.gitignore`                       | 250   | Git ignore rules             |
| 4   | `README.md`                        | 573   | Project documentation        |
| 5   | `pyproject.toml`                   | 44    | Python project config        |
| 6   | `pyrightconfig.json`               | 13    | Pyright type checker config  |

**Total root-level lines**: 1,569 (true root-level files)

Plus `.vscode/css_custom_data.json` (64 lines) in subdirectory.

### Subtask 7.1.1.4: Correct False Claims from Original Plan

The original Phase 7 plan contained the following data integrity failures that MUST be corrected:

| #   | Original Claim                                   | Actual Value                                                                                                                    | Error Factor                        | Impact                                    |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- |
| 1   | "Startup scripts: ~19,000 lines (combined)"      | 689 lines (start.sh=495, start_services.sh=194)                                                                                 | **27.6x overstated**                | Cascades to total deletion count          |
| 2   | "Total lines removed: ~30,000+"                  | ~12,412 hand-written lines (all non-vendored files)                                                                             | **2.4x overstated**                 | Misrepresents migration scope             |
| 3   | "Estimated Files Deleted: ~25"                   | 45 project files (27 backend + 12 frontend source + 6 root)                                                                     | **1.8x understated**                | Underestimates deletion work              |
| 4   | React frontend "2,388 lines"                     | 2,304 source / 2,362 including config                                                                                           | Minor -- depends on counting method |
| 5   | "Remove Python from docker/Dockerfile ~10 lines" | Python in main Dockerfile is BUILD-ONLY (node-gyp). Actual Python Dockerfile is at hackrf_emitter/backend/Dockerfile (52 lines) | **Wrong file referenced**           | Would leave the real Dockerfile undeleted |

**Verification command:**

```bash
# Verify startup script line counts
wc -l hackrf_emitter/start.sh hackrf_emitter/start_services.sh

# Verify total non-vendored lines
find hackrf_emitter/ -type f \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/node_modules/*' \
  -not -name 'package-lock.json' \
  | xargs wc -l | tail -1

# Verify file count
find hackrf_emitter/ -type f \
  -not -path '*/.venv/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/node_modules/*' \
  -not -name 'package-lock.json' \
  | wc -l
```

---

## Task 7.1.2: Port Architecture Discovery

### Subtask 7.1.2.1: Identify All HackRF-Related Network Services

The original plan conflates two distinct services on different ports:

| Port | Service                                         | Protocol             | Source                    |
| ---- | ----------------------------------------------- | -------------------- | ------------------------- |
| 8092 | Flask backend (`hackrf_emitter/backend/app.py`) | HTTP REST + SocketIO | Docker compose, env vars  |
| 3002 | HackRF control API (UNDOCUMENTED in plan)       | HTTP REST            | SvelteKit proxy catch-all |

**CRITICAL FINDING**: The proxy at `src/routes/api/hackrf/[...path]/+server.ts` (line 4) targets `http://localhost:3002`, NOT `http://localhost:8092`. The plan incorrectly states this proxy forwards to the Flask backend.

**Required investigation**: Determine what runs on port 3002. Possible explanations:

1. The Flask backend is configured to run on 3002 in development (start.sh may override the Docker port)
2. There is a separate Node.js HackRF control service
3. Port 3002 is a stale reference from a previous architecture

**Verification command:**

```bash
# Check what start.sh configures
grep -n "3002\|PORT" hackrf_emitter/start.sh

# Check if any process currently listens on 3002
ss -tlnp | grep 3002

# Check Docker compose for port 3002
grep -n "3002" docker/docker-compose*.yml
```

### Subtask 7.1.2.2: Document All SvelteKit References to Python Backend

**Verified references (5 files, 7 total references):**

| File                                                          | Line    | Reference                                 | Type                     |
| ------------------------------------------------------------- | ------- | ----------------------------------------- | ------------------------ |
| `src/routes/api/hackrf/[...path]/+server.ts`                  | 4       | `http://localhost:3002`                   | Proxy target             |
| `src/lib/components/hackrf/AnalysisTools.svelte`              | 14      | `http://localhost:8092`                   | Client-side window.open  |
| `src/lib/server/hardware/detection/network-detector.ts`       | 125     | `http://localhost:8092`                   | Health check             |
| `src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh` | 63-64   | `hackrf_emitter/backend/sweep_bridge.py`  | Fallback script path     |
| `src/lib/server/hackrf/sweepManager.ts`                       | 949-951 | `pkill -9 -f sweep_bridge.py`             | Process kill command     |
| `static/script.js`                                            | 7       | `http://${window.location.hostname}:3002` | Client-side API base URL |
| `static/api-config.js`                                        | 2       | `http://100.68.185.86:3002`               | Hardcoded API base URL   |

**No references to port 5000 exist** in the SvelteKit source (the original plan mentioned port 5000 incorrectly).

### Subtask 7.1.2.3: Document Docker Environment Variables

The following environment variables in `docker/docker-compose.portainer-dev.yml` reference the Python backend:

```
PUBLIC_HACKRF_API_URL=http://localhost:8092
PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092
PUBLIC_HACKRF_WS_URL=ws://localhost:8092
```

These must be removed or redirected after migration.

---

## Task 7.1.3: Python-in-SvelteKit Dependencies

### Subtask 7.1.3.1: usrp_sweep.py Inside SvelteKit Source Tree

**CRITICAL FINDING NOT IN ORIGINAL PLAN**: A 146-line Python file exists inside the SvelteKit source:

**File**: `src/lib/services/hackrf/sweep-manager/process/usrp_sweep.py`
**Purpose**: USRP B205 Mini sweep tool that mimics hackrf_sweep output format
**Dependencies**: `numpy`, `gnuradio` (gr, uhd, fft, blocks)
**Lines**: 146

This file is NOT part of `hackrf_emitter/` but depends on Python + numpy + gnuradio. It is invoked by
`auto_sweep.sh` as a fallback when the native `hackrf_sweep` binary is unavailable.

**Decision required**: This file is OUTSIDE the scope of hackrf_emitter deletion but will lose its
Python runtime if Python is removed from the system. Options:

1. Keep as-is (requires Python + gnuradio to remain installed for USRP support)
2. Migrate to TypeScript (requires Node.js bindings for UHD -- none exist)
3. Migrate to compiled language (C++ with UHD library -- native approach)
4. Accept USRP sweep degradation (remove Python fallback, USRP sweep requires gnuradio installed separately)

**Recommendation**: Option 4. The USRP sweep is a secondary hardware path. Document that USRP sweep
requires Python + gnuradio installed separately. Do NOT delete usrp_sweep.py as part of Phase 7.

### Subtask 7.1.3.2: auto_sweep.sh Dependency on sweep_bridge.py

**File**: `src/lib/services/hackrf/sweep-manager/process/auto_sweep.sh` (77 lines)
**Line 63-64**: References `hackrf_emitter/backend/sweep_bridge.py` via relative path traversal

```bash
SWEEP_BRIDGE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../../../../../hackrf_emitter/backend/sweep_bridge.py"
if [ -f "$SWEEP_BRIDGE" ] && python3 -c "from python_hackrf import pyhackrf_sweep" 2>/dev/null; then
```

After Phase 7.7 deletes `hackrf_emitter/backend/`, this path will resolve to a nonexistent file.
The `[ -f "$SWEEP_BRIDGE" ]` check will fail gracefully, so the sweep will fall through to the
`hackrf_sweep` binary path. No functional breakage, but the dead reference must be cleaned up.

**Action**: In Phase 7.7 (Deletion), update `auto_sweep.sh` to remove the sweep_bridge.py fallback block.

---

## Task 7.1.4: Generate Golden Reference Files from Python

This task MUST execute while the Python backend and its dependencies (numpy, scipy) are available.
Once Python code is deleted, these reference files become the sole source of truth for verification.

### Subtask 7.1.4.1: Create Golden File Directory Structure

```bash
mkdir -p tests/golden-files/hackrf/protocols/
mkdir -p tests/golden-files/hackrf/filters/
mkdir -p tests/golden-files/hackrf/crc/
mkdir -p tests/golden-files/hackrf/modulation/
```

### Subtask 7.1.4.2: Generate Protocol Reference Files

For each protocol encoder, generate a reference `.bin` (binary I/Q samples) and `.json` (input parameters + metadata) file pair.

| Protocol      | Reference .bin                         | Reference .json                         | Input Parameters                                                                                |
| ------------- | -------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ADS-B         | `protocols/adsb-reference.bin`         | `protocols/adsb-reference.json`         | ICAO=ABCDEF, callsign=TEST1234, lat=34.05, lon=-118.25, alt=35000, freq=1090e6, sample_rate=2e6 |
| GPS           | `protocols/gps-reference.bin`          | `protocols/gps-reference.json`          | lat=34.05, lon=-118.25, alt=100, freq=1575.42e6, sample_rate=2e6                                |
| ELRS          | `protocols/elrs-reference.bin`         | `protocols/elrs-reference.json`         | channel=0, binding_phrase="TEST", freq=915e6, sample_rate=2e6                                   |
| ELRS Jamming  | `protocols/elrs-jamming-reference.bin` | `protocols/elrs-jamming-reference.json` | center_freq=915e6, bandwidth=1e6, sample_rate=2e6                                               |
| Drone Video   | `protocols/drone-video-reference.bin`  | `protocols/drone-video-reference.json`  | freq=5.8e9, bandwidth=20e6, sample_rate=20e6                                                    |
| Raw Energy    | `protocols/raw-energy-reference.bin`   | `protocols/raw-energy-reference.json`   | freq=915e6, bandwidth=1e6, sample_rate=2e6, duration=0.01                                       |
| Modulation AM | `modulation/am-reference.bin`          | `modulation/am-reference.json`          | carrier=1e6, mod_freq=1e3, mod_index=0.5, sample_rate=2e6                                       |
| Modulation FM | `modulation/fm-reference.bin`          | `modulation/fm-reference.json`          | carrier=1e6, mod_freq=1e3, deviation=75e3, sample_rate=2e6                                      |

**Generation script**: `tests/golden-files/generate-references.py`

This script must:

1. Import each protocol class from `hackrf_emitter/backend/rf_workflows/`
2. Call `generate_signal()` or equivalent with the exact parameters listed above
3. Write raw samples to `.bin` (numpy `.tofile()` format, float64)
4. Write metadata to `.json` including: input params, output length, dtype, numpy version, scipy version, Python version, generation timestamp
5. Compute and store SHA-256 hash of each `.bin` file in the `.json` metadata

**Verification:**

```bash
# All golden files exist
ls -la tests/golden-files/hackrf/protocols/*.bin tests/golden-files/hackrf/protocols/*.json
ls -la tests/golden-files/hackrf/modulation/*.bin tests/golden-files/hackrf/modulation/*.json

# All .json files have required fields
for f in tests/golden-files/hackrf/**/*.json; do
  python3 -c "import json; d=json.load(open('$f')); assert 'output_length' in d and 'dtype' in d and 'sha256' in d, f'$f missing fields'"
done
echo "All golden files validated"
```

**Subtask 7.1.4.3: REMOVED** -- scipy.signal.butter is not used anywhere in the Python codebase. No Butterworth reference coefficients are needed.

### Subtask 7.1.4.4: Generate CRC Reference Vectors

```bash
python3 -c "
import sys, json
sys.path.insert(0, 'hackrf_emitter/backend/rf_workflows')
from crc16_python import crc16xmodem, crc16ccitt, crc16modbus

test_inputs = [
    b'',
    b'\x00',
    b'\xff',
    b'ABCDEF',
    b'\x8d\x4c\xa2\x51\x0b\x85\x79',  # Sample ADS-B bytes
    bytes(range(256)),
    b'hello world',
]

results = []
for data in test_inputs:
    results.append({
        'input_hex': data.hex(),
        'input_length': len(data),
        'crc16_xmodem': crc16xmodem(data),
        'crc16_ccitt': crc16ccitt(data),
        'crc16_modbus': crc16modbus(data),
    })

json.dump(results, open('tests/golden-files/hackrf/crc/crc16-reference.json','w'), indent=2)
print(f'Generated {len(results)} CRC test vectors')
"
```

**NOTE**: CRC-24 (used by ADS-B) is implemented INSIDE `adsb_protocol.py` as `_calculate_crc()`, NOT in `crc16_python.py`. Generate separate CRC-24 reference vectors:

```bash
python3 -c "
import sys, json
sys.path.insert(0, 'hackrf_emitter/backend/rf_workflows')
from adsb_protocol import ADSBProtocol

proto = ADSBProtocol()
# CRC-24 test vectors (11-byte Mode S messages, last 3 bytes are CRC)
test_messages = [
    bytes([0x8D, 0x4C, 0xA2, 0x51, 0x0B, 0x85, 0x79, 0x00, 0x00, 0x00, 0x00]),
    bytes([0x8D, 0xAB, 0xCD, 0xEF, 0x58, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00]),
]
results = []
for msg in test_messages:
    crc = proto._calculate_crc(msg[:11])
    results.append({'input_hex': msg.hex(), 'crc24': crc})

json.dump(results, open('tests/golden-files/hackrf/crc/crc24-reference.json','w'), indent=2)
print(f'Generated {len(results)} CRC-24 test vectors')
"
```

---

## Task 7.1.5: Capture Python Performance Baseline

### Subtask 7.1.5.1: Protocol Generation Benchmarks

```bash
cd hackrf_emitter/backend
python3 -c "
import time, json, sys
sys.path.insert(0, '.')
from rf_workflows.adsb_protocol import ADSBProtocol
from rf_workflows.gps_protocol import GPSProtocol
from rf_workflows.raw_energy_protocol import RawEnergyProtocol
from rf_workflows.elrs_protocol import ELRSProtocol
from rf_workflows.modulation_workflows import ModulationWorkflows

benchmarks = [
    ('adsb', ADSBProtocol, 'generate_adsb_transmission', {
        'icao_address': 'ABCDEF', 'callsign': 'TEST1234',
        'latitude': 34.05, 'longitude': -118.25, 'altitude': 35000,
        'frequency': 1090e6, 'sample_rate': 2e6, 'duration': 1.0
    }),
    ('gps', GPSProtocol, 'generate_gps_signal', {
        'latitude': 34.05, 'longitude': -118.25, 'altitude': 100,
        'frequency': 1575.42e6, 'sample_rate': 2e6, 'duration': 1.0
    }),
    ('raw_energy', RawEnergyProtocol, 'generate_raw_energy_signal', {
        'frequency': 915e6, 'bandwidth': 1e6, 'sample_rate': 2e6, 'duration': 1.0
    }),
]

results = {}
for name, cls, method_name, kwargs in benchmarks:
    proto = cls()
    method = getattr(proto, method_name)
    times = []
    sample_count = 0
    for i in range(5):
        t0 = time.perf_counter()
        try:
            samples = method(**kwargs)
            sample_count = len(samples) if hasattr(samples, '__len__') else 0
        except Exception as e:
            print(f'{name}: ERROR - {e}')
            break
        t1 = time.perf_counter()
        times.append((t1-t0)*1000)
    if times:
        results[name] = {
            'mean_ms': sum(times)/len(times),
            'min_ms': min(times),
            'max_ms': max(times),
            'samples': sample_count,
            'iterations': len(times)
        }

import platform, numpy, scipy
results['_metadata'] = {
    'python_version': platform.python_version(),
    'numpy_version': numpy.__version__,
    'scipy_version': scipy.__version__,
    'platform': platform.machine(),
    'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
}
json.dump(results, open('../../tests/performance/baseline-python.json','w'), indent=2)
print(json.dumps(results, indent=2))
"
```

### Subtask 7.1.5.2: Memory Baseline

```bash
python3 -c "
import os, json, resource
import psutil
proc = psutil.Process(os.getpid())

# Idle memory
idle_rss = proc.memory_info().rss / (1024*1024)

# Import all modules
import sys
sys.path.insert(0, 'hackrf_emitter/backend')
from rf_workflows.adsb_protocol import ADSBProtocol
from rf_workflows.gps_protocol import GPSProtocol
from rf_workflows.raw_energy_protocol import RawEnergyProtocol

loaded_rss = proc.memory_info().rss / (1024*1024)

# Generate one signal
proto = ADSBProtocol()
samples = proto.generate_adsb_transmission(
    icao_address='ABCDEF', callsign='TEST', latitude=34.05,
    longitude=-118.25, altitude=35000, frequency=1090e6,
    sample_rate=2e6, duration=1.0
)
peak_rss = proc.memory_info().rss / (1024*1024)

print(json.dumps({
    'idle_rss_mb': round(idle_rss, 1),
    'loaded_rss_mb': round(loaded_rss, 1),
    'peak_rss_mb': round(peak_rss, 1),
    'sample_count': len(samples) if hasattr(samples, '__len__') else 0,
}, indent=2))
"
```

---

## Task 7.1.6: Document Function Signatures for Migration

### Subtask 7.1.6.1: Extract All Public Method Signatures

For each protocol file, record every public method with its full signature (parameters, types, return type).
This serves as the API contract that the TypeScript implementation must honor.

**Deliverable**: `tests/golden-files/hackrf/api-signatures.json`

```bash
python3 -c "
import sys, json, inspect
sys.path.insert(0, 'hackrf_emitter/backend')

modules = {
    'adsb_protocol': 'rf_workflows.adsb_protocol',
    'gps_protocol': 'rf_workflows.gps_protocol',
    'elrs_protocol': 'rf_workflows.elrs_protocol',
    'elrs_jamming_protocol': 'rf_workflows.elrs_jamming_protocol',
    'drone_video_jamming_protocol': 'rf_workflows.drone_video_jamming_protocol',
    'raw_energy_protocol': 'rf_workflows.raw_energy_protocol',
    'modulation_workflows': 'rf_workflows.modulation_workflows',
    'enhanced_workflows': 'rf_workflows.enhanced_workflows',
    'hackrf_controller': 'rf_workflows.hackrf_controller',
    'universal_signal_cache': 'rf_workflows.universal_signal_cache',
    'config_manager': 'utils.config_manager',
    'safety_manager': 'utils.safety_manager',
    'crc16_python': 'rf_workflows.crc16_python',
}

signatures = {}
for name, module_path in modules.items():
    try:
        mod = __import__(module_path, fromlist=[''])
        sigs = {}
        for cls_name, cls in inspect.getmembers(mod, inspect.isclass):
            methods = {}
            for method_name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
                if not method_name.startswith('_'):
                    sig = str(inspect.signature(method))
                    methods[method_name] = sig
            if methods:
                sigs[cls_name] = methods
        for func_name, func in inspect.getmembers(mod, inspect.isfunction):
            if not func_name.startswith('_'):
                sigs[func_name] = str(inspect.signature(func))
        signatures[name] = sigs
    except Exception as e:
        signatures[name] = {'error': str(e)}

json.dump(signatures, open('tests/golden-files/hackrf/api-signatures.json','w'), indent=2)
print(f'Extracted signatures from {len(signatures)} modules')
"
```

---

## Verification Checklist

- [ ] All 27 backend project files inventoried with exact line counts
- [ ] All 12 frontend source files inventoried with exact line counts
- [ ] All 6 root-level files inventoried with exact line counts
- [ ] Port 3002 service identified and documented
- [ ] Port 8092 Flask backend confirmed in Docker compose
- [ ] usrp_sweep.py (146 lines) documented as out-of-scope Python dependency
- [ ] auto_sweep.sh sweep_bridge.py reference documented for cleanup
- [ ] Golden reference .bin files generated for all 8 protocol/modulation test vectors
- [ ] Golden reference .json metadata files generated with SHA-256 hashes
- [ ] CRC-16 reference vectors generated (7 test inputs, 3 CRC variants each)
- [ ] CRC-24 reference vectors generated (at least 2 Mode S message test vectors)
- [ ] Python performance baseline recorded to tests/performance/baseline-python.json
- [ ] Python memory baseline recorded
- [ ] API signatures extracted from all 13 Python modules
- [ ] All false claims from original plan documented with corrections

---

## Definition of Done

This phase is complete when:

1. Every file in `tests/golden-files/hackrf/` can be loaded and verified by a script
2. `tests/performance/baseline-python.json` exists with timing data for at least 3 protocols
3. The port 3002 mystery is resolved with evidence
4. All data integrity errors from the original plan are documented in this file
5. No Python code has been modified or deleted

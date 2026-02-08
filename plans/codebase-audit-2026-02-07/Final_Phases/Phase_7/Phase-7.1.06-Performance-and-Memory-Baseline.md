# Phase 7.1.06: Performance and Memory Baseline

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Subtasks 7.1.5.1 and 7.1.5.2)
**Risk Level**: LOW -- Read-only benchmarking. No production code modified.
**Prerequisites**: Phase-7.1.01-Build-Health-Prerequisite-Gate.md, Phase-7.1.02-Source-Inventory-Verification.md (protocol files must be inventoried)
**Estimated Duration**: 15-30 minutes (benchmark execution on RPi 5 Cortex-A76)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

The TypeScript reimplementation must not be significantly slower than the Python original for protocol generation. Without a performance baseline captured BEFORE the Python code is deleted, there is no way to measure whether the TypeScript version meets acceptable performance thresholds.

This sub-task captures:

1. **Execution time** for 3 protocol generators (ADS-B, GPS, Raw Energy) -- 5 iterations each, with mean/min/max.
2. **Memory consumption** at 3 stages: idle Python, after importing all modules, and after generating one signal.

These baselines are written to `tests/performance/baseline-python.json` for comparison by Phase 7.6 (Verification Suite).

---

## Subtask 7.1.5.1: Protocol Generation Benchmarks

Run 5 iterations of each protocol generator and record timing statistics. This script must execute from the `hackrf_emitter/backend` directory where the Python modules are importable.

**Benchmark script** (copy-paste and execute verbatim):

```bash
cd /home/kali/Documents/Argos/Argos/hackrf_emitter/backend && python3 -c "
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

**Pre-requisite**: The output directory must exist:

```bash
mkdir -p /home/kali/Documents/Argos/Argos/tests/performance/
```

**Expected output structure** (timing values will vary):

```json
{
  "adsb": {
    "mean_ms": <number>,
    "min_ms": <number>,
    "max_ms": <number>,
    "samples": <number>,
    "iterations": 5
  },
  "gps": { ... },
  "raw_energy": { ... },
  "_metadata": {
    "python_version": "3.x.x",
    "numpy_version": "x.x.x",
    "scipy_version": "x.x.x",
    "platform": "aarch64",
    "timestamp": "2026-02-08T..."
  }
}
```

**Deliverable**: `/home/kali/Documents/Argos/Argos/tests/performance/baseline-python.json`

---

## Subtask 7.1.5.2: Memory Baseline

Capture Python process memory at three stages: idle, after module imports, and after signal generation.

**Memory baseline script** (copy-paste and execute verbatim):

```bash
cd /home/kali/Documents/Argos/Argos && python3 -c "
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

**NOTE**: This script requires `psutil` to be installed (`pip install psutil`). If psutil is not available in the Python environment, install it first:

```bash
pip install psutil
```

**Expected output structure** (values will vary):

```json
{
  "idle_rss_mb": <number>,
  "loaded_rss_mb": <number>,
  "peak_rss_mb": <number>,
  "sample_count": <number>
}
```

---

## Verification Commands

```bash
# Verify baseline file exists and has correct structure
python3 -c "
import json
data = json.load(open('/home/kali/Documents/Argos/Argos/tests/performance/baseline-python.json'))
assert 'adsb' in data, 'Missing adsb benchmark'
assert 'gps' in data, 'Missing gps benchmark'
assert 'raw_energy' in data, 'Missing raw_energy benchmark'
assert '_metadata' in data, 'Missing metadata'
for proto in ['adsb', 'gps', 'raw_energy']:
    assert data[proto]['iterations'] == 5, f'{proto} did not complete 5 iterations'
    assert data[proto]['mean_ms'] > 0, f'{proto} has zero timing'
print('Performance baseline validated')
print(f'  ADS-B:      {data[\"adsb\"][\"mean_ms\"]:.1f}ms mean, {data[\"adsb\"][\"samples\"]} samples')
print(f'  GPS:        {data[\"gps\"][\"mean_ms\"]:.1f}ms mean, {data[\"gps\"][\"samples\"]} samples')
print(f'  Raw Energy: {data[\"raw_energy\"][\"mean_ms\"]:.1f}ms mean, {data[\"raw_energy\"][\"samples\"]} samples')
print(f'  Platform:   {data[\"_metadata\"][\"platform\"]}')
print(f'  Python:     {data[\"_metadata\"][\"python_version\"]}')
print(f'  NumPy:      {data[\"_metadata\"][\"numpy_version\"]}')
"
```

---

## Verification Checklist

- [ ] `tests/performance/` directory created
- [ ] Protocol generation benchmarks completed for ADS-B, GPS, Raw Energy (5 iterations each)
- [ ] `tests/performance/baseline-python.json` exists with timing data for all 3 protocols
- [ ] All 3 benchmarks completed 5 iterations (no ERROR results)
- [ ] `_metadata` section records Python version, numpy version, scipy version, platform (aarch64), timestamp
- [ ] Memory baseline captured: idle_rss_mb, loaded_rss_mb, peak_rss_mb values recorded
- [ ] No Python code was modified during benchmarking

---

## Definition of Done

This sub-task is complete when:

1. `tests/performance/baseline-python.json` exists with valid timing data for at least 3 protocols.
2. Each protocol benchmark completed 5 iterations with non-zero timing values.
3. Metadata records the exact Python, numpy, and scipy versions used.
4. Memory baseline values have been captured and recorded.

---

## Cross-References

- **Required by**: Phase-7.6-VERIFICATION-SUITE.md (TypeScript performance will be compared against this baseline)
- **Informed by**: Phase-7.1.02-Source-Inventory-Verification.md (protocol files identified)
- **Related to**: Phase-7.1.05-Golden-Reference-File-Generation.md (same protocol classes used for both golden files and benchmarks)

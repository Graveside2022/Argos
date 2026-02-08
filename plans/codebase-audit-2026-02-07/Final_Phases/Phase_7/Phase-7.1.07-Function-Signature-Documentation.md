# Phase 7.1.07: Function Signature Documentation

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Subtask 7.1.6.1)
**Risk Level**: LOW -- Read-only introspection. No production code modified.
**Prerequisites**: Phase-7.1.01-Build-Health-Prerequisite-Gate.md, Phase-7.1.02-Source-Inventory-Verification.md (module list must be verified)
**Estimated Duration**: 10-20 minutes
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

The TypeScript reimplementation must honor the exact same API contracts as the Python original. This means every public method must have the same name, the same parameters (in order), and compatible return types. Without an explicit record of these signatures, the migration engineer must reverse-engineer them from Python source code -- error-prone and slow.

This sub-task uses Python's `inspect` module to extract every public method signature from all 13 Python modules and writes them to a machine-readable JSON file. This file serves as the API contract specification for Phase 7.3 (Protocol Encoders) and Phase 7.4 (Service Layer).

---

## Subtask 7.1.6.1: Extract All Public Method Signatures

For each protocol file, record every public method with its full signature (parameters, types, return type). This serves as the API contract that the TypeScript implementation must honor.

### Target Modules (13 total)

| #   | Module Key                     | Import Path                                 | Source File                                                |
| --- | ------------------------------ | ------------------------------------------- | ---------------------------------------------------------- |
| 1   | `adsb_protocol`                | `rf_workflows.adsb_protocol`                | `rf_workflows/adsb_protocol.py` (580 lines)                |
| 2   | `gps_protocol`                 | `rf_workflows.gps_protocol`                 | `rf_workflows/gps_protocol.py` (460 lines)                 |
| 3   | `elrs_protocol`                | `rf_workflows.elrs_protocol`                | `rf_workflows/elrs_protocol.py` (330 lines)                |
| 4   | `elrs_jamming_protocol`        | `rf_workflows.elrs_jamming_protocol`        | `rf_workflows/elrs_jamming_protocol.py` (559 lines)        |
| 5   | `drone_video_jamming_protocol` | `rf_workflows.drone_video_jamming_protocol` | `rf_workflows/drone_video_jamming_protocol.py` (579 lines) |
| 6   | `raw_energy_protocol`          | `rf_workflows.raw_energy_protocol`          | `rf_workflows/raw_energy_protocol.py` (340 lines)          |
| 7   | `modulation_workflows`         | `rf_workflows.modulation_workflows`         | `rf_workflows/modulation_workflows.py` (672 lines)         |
| 8   | `enhanced_workflows`           | `rf_workflows.enhanced_workflows`           | `rf_workflows/enhanced_workflows.py` (1,385 lines)         |
| 9   | `hackrf_controller`            | `rf_workflows.hackrf_controller`            | `rf_workflows/hackrf_controller.py` (795 lines)            |
| 10  | `universal_signal_cache`       | `rf_workflows.universal_signal_cache`       | `rf_workflows/universal_signal_cache.py` (625 lines)       |
| 11  | `config_manager`               | `utils.config_manager`                      | `utils/config_manager.py` (254 lines)                      |
| 12  | `safety_manager`               | `utils.safety_manager`                      | `utils/safety_manager.py` (95 lines)                       |
| 13  | `crc16_python`                 | `rf_workflows.crc16_python`                 | `rf_workflows/crc16_python.py` (70 lines)                  |

### Generation Script

**Deliverable path**: `tests/golden-files/hackrf/api-signatures.json`

```bash
cd /home/kali/Documents/Argos/Argos && python3 -c "
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

**Expected output**: `Extracted signatures from 13 modules`

### Output Format

The generated JSON follows this structure:

```json
{
	"adsb_protocol": {
		"ADSBProtocol": {
			"generate_adsb_transmission": "(self, icao_address, callsign, latitude, longitude, altitude, frequency, sample_rate, duration=1.0)",
			"encode_adsb_message": "(self, ...)"
		}
	},
	"crc16_python": {
		"crc16xmodem": "(data)",
		"crc16ccitt": "(data)",
		"crc16modbus": "(data)"
	}
}
```

Classes are nested objects with method names as keys. Module-level functions appear directly under the module key. Both map to their string signature.

If a module fails to import (e.g., missing gnuradio dependency), the entry will contain `{"error": "<message>"}` instead. This is expected for modules that depend on hardware-specific libraries.

---

## Verification Commands

```bash
# Verify the output file exists
ls -la /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/api-signatures.json

# Verify it contains all 13 modules
python3 -c "
import json
data = json.load(open('/home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/api-signatures.json'))
expected_modules = [
    'adsb_protocol', 'gps_protocol', 'elrs_protocol',
    'elrs_jamming_protocol', 'drone_video_jamming_protocol',
    'raw_energy_protocol', 'modulation_workflows', 'enhanced_workflows',
    'hackrf_controller', 'universal_signal_cache',
    'config_manager', 'safety_manager', 'crc16_python'
]
for mod in expected_modules:
    assert mod in data, f'Missing module: {mod}'
    if 'error' in data[mod]:
        print(f'  WARNING: {mod} had import error: {data[mod][\"error\"]}')
    else:
        count = sum(
            len(v) if isinstance(v, dict) else 1
            for v in data[mod].values()
        )
        print(f'  {mod}: {count} signatures')
print(f'All {len(expected_modules)} modules present')
"

# Verify specific critical signatures exist
python3 -c "
import json
data = json.load(open('/home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/api-signatures.json'))

# CRC functions must be top-level (not class methods)
assert 'crc16xmodem' in data.get('crc16_python', {}), 'Missing crc16xmodem'
assert 'crc16ccitt' in data.get('crc16_python', {}), 'Missing crc16ccitt'
assert 'crc16modbus' in data.get('crc16_python', {}), 'Missing crc16modbus'
print('CRC-16 signatures: OK')

# ADS-B must have class with generate method
adsb = data.get('adsb_protocol', {})
for cls_name, methods in adsb.items():
    if isinstance(methods, dict) and 'generate_adsb_transmission' in methods:
        print(f'ADS-B generate method: OK (in {cls_name})')
        break
else:
    print('WARNING: ADS-B generate_adsb_transmission not found')
"
```

---

## Verification Checklist

- [ ] `tests/golden-files/hackrf/api-signatures.json` exists
- [ ] File contains entries for all 13 modules
- [ ] No modules report import errors (or errors are documented as expected, e.g., hardware dependencies)
- [ ] CRC-16 module contains 3 function signatures: crc16xmodem, crc16ccitt, crc16modbus
- [ ] ADS-B module contains class with generate_adsb_transmission method
- [ ] GPS module contains class with generate_gps_signal method
- [ ] JSON file is valid and parseable
- [ ] No Python source code was modified

---

## Definition of Done

This sub-task is complete when:

1. `tests/golden-files/hackrf/api-signatures.json` exists with signatures from all 13 modules.
2. The verification script confirms all modules are present and critical signatures exist.
3. Any import errors are documented with explanations (e.g., missing gnuradio is expected if USRP hardware is not present).
4. The file is committed to the repository.

---

## Cross-References

- **Required by**: Phase-7.3-PROTOCOL-ENCODERS.md (TypeScript protocol classes must implement these exact method signatures)
- **Required by**: Phase-7.4-SERVICE-LAYER.md (service layer must expose these method signatures)
- **Required by**: Phase-7.1.05-Golden-Reference-File-Generation.md (generation script needs correct method names from these signatures)
- **Informed by**: Phase-7.1.02-Source-Inventory-Verification.md (module list and line counts)

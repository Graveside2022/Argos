# Phase 7.1.05: Golden Reference File Generation

**Decomposed from**: Phase-7.1-PRE-MIGRATION-BASELINE.md (Subtasks 7.1.4.1 through 7.1.4.4)
**Risk Level**: LOW -- Generates test artifacts only. No production code modified.
**Prerequisites**: Phase-7.1.01-Build-Health-Prerequisite-Gate.md, Phase-7.1.02-Source-Inventory-Verification.md (must know which protocol files exist)
**Estimated Duration**: 45-90 minutes (depends on protocol generation time on RPi 5)
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

This sub-task generates the immutable ground truth files that Phase 7.6 (Verification Suite) will compare against. Once the Python backend is deleted in Phase 7.7, there is no way to regenerate these files. They are the SOLE source of truth for verifying that the TypeScript reimplementation produces identical output.

This task MUST execute while the Python backend and its dependencies (numpy, scipy) are available. The generation script runs actual Python protocol encoders, captures their binary output, and records SHA-256 hashes.

---

## Subtask 7.1.4.1: Create Golden File Directory Structure

```bash
mkdir -p /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/protocols/
mkdir -p /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/filters/
mkdir -p /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/crc/
mkdir -p /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/modulation/
```

**Verification:**

```bash
ls -d /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/protocols/ \
      /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/filters/ \
      /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/crc/ \
      /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/modulation/
# Expected: all 4 directories listed without error
```

---

## Subtask 7.1.4.2: Generate Protocol Reference Files

For each protocol encoder, generate a reference `.bin` (binary I/Q samples) and `.json` (input parameters + metadata) file pair.

### Reference File Specification

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

### Generation Script

**Deliverable path**: `tests/golden-files/generate-references.py`

This script must:

1. Import each protocol class from `hackrf_emitter/backend/rf_workflows/`
2. Call `generate_signal()` or equivalent with the exact parameters listed above
3. Write raw samples to `.bin` (numpy `.tofile()` format, float64)
4. Write metadata to `.json` including: input params, output length, dtype, numpy version, scipy version, Python version, generation timestamp
5. Compute and store SHA-256 hash of each `.bin` file in the `.json` metadata

**NOTE**: The generation script must be written and committed as part of this sub-task. The exact script content depends on the actual method signatures discovered in Phase-7.1.07 (Function Signature Documentation). If method signatures are not yet available, use the parameter names from the table above and adjust after Phase-7.1.07 completes.

**NOTE**: Subtask 7.1.4.3 (Butterworth filter coefficients) was REMOVED from the original plan because `scipy.signal.butter` is not used anywhere in the Python codebase. No Butterworth reference coefficients are needed.

### Verification

```bash
# All golden protocol files exist
ls -la /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/protocols/*.bin \
       /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/protocols/*.json

# All golden modulation files exist
ls -la /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/modulation/*.bin \
       /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/modulation/*.json

# Verify file count: 6 protocol pairs + 2 modulation pairs = 16 files total
find /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/protocols/ \
     /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/modulation/ \
     -type f | wc -l
# Expected: 16

# All .json files have required fields
for f in $(find /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/ -name "*.json" -path "*/protocols/*" -o -name "*.json" -path "*/modulation/*"); do
  python3 -c "import json; d=json.load(open('$f')); assert 'output_length' in d and 'dtype' in d and 'sha256' in d, f'$f missing fields'"
done
echo "All golden files validated"

# Verify SHA-256 hashes match
for f in $(find /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/ -name "*.json" -path "*/protocols/*" -o -name "*.json" -path "*/modulation/*"); do
  bin_file="${f%.json}.bin"
  expected_hash=$(python3 -c "import json; print(json.load(open('$f'))['sha256'])")
  actual_hash=$(sha256sum "$bin_file" | cut -d' ' -f1)
  if [ "$expected_hash" = "$actual_hash" ]; then
    echo "PASS: $(basename $bin_file)"
  else
    echo "FAIL: $(basename $bin_file) expected=$expected_hash actual=$actual_hash"
  fi
done
```

---

## Subtask 7.1.4.4: Generate CRC Reference Vectors

### CRC-16 Reference Vectors

The `crc16_python.py` module exports three CRC-16 variants: `crc16xmodem`, `crc16ccitt`, `crc16modbus`. Generate reference vectors for 7 test inputs across all 3 variants (21 total values).

**Generation script:**

```bash
cd /home/kali/Documents/Argos/Argos && python3 -c "
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

**Expected output**: `Generated 7 CRC test vectors`

### CRC-24 Reference Vectors

CRC-24 (used by ADS-B) is implemented INSIDE `adsb_protocol.py` as `_calculate_crc()`, NOT in `crc16_python.py`. Generate separate CRC-24 reference vectors:

```bash
cd /home/kali/Documents/Argos/Argos && python3 -c "
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

**Expected output**: `Generated 2 CRC-24 test vectors`

### CRC Verification

```bash
# Verify CRC reference files exist
ls -la /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/crc/crc16-reference.json
ls -la /home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/crc/crc24-reference.json

# Verify CRC-16 file contains 7 test vectors
python3 -c "
import json
data = json.load(open('/home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/crc/crc16-reference.json'))
assert len(data) == 7, f'Expected 7 vectors, got {len(data)}'
for entry in data:
    assert 'crc16_xmodem' in entry, 'Missing crc16_xmodem'
    assert 'crc16_ccitt' in entry, 'Missing crc16_ccitt'
    assert 'crc16_modbus' in entry, 'Missing crc16_modbus'
print('CRC-16 reference: 7 vectors, all 3 variants present')
"

# Verify CRC-24 file contains at least 2 test vectors
python3 -c "
import json
data = json.load(open('/home/kali/Documents/Argos/Argos/tests/golden-files/hackrf/crc/crc24-reference.json'))
assert len(data) >= 2, f'Expected >=2 vectors, got {len(data)}'
for entry in data:
    assert 'crc24' in entry, 'Missing crc24'
print(f'CRC-24 reference: {len(data)} vectors')
"
```

---

## Verification Checklist

- [ ] Directory structure created: protocols/, filters/, crc/, modulation/
- [ ] Golden reference .bin files generated for all 6 protocol test vectors
- [ ] Golden reference .bin files generated for all 2 modulation test vectors
- [ ] Golden reference .json metadata files generated with SHA-256 hashes for all 8 pairs
- [ ] All .json files contain required fields: output_length, dtype, sha256
- [ ] SHA-256 hashes verified: hash of .bin matches sha256 field in .json
- [ ] CRC-16 reference vectors generated: 7 test inputs, 3 CRC variants each (21 values)
- [ ] CRC-24 reference vectors generated: at least 2 Mode S message test vectors
- [ ] Subtask 7.1.4.3 (Butterworth) confirmed removed: scipy.signal.butter not used in codebase
- [ ] Generation script committed at `tests/golden-files/generate-references.py`

---

## Definition of Done

This sub-task is complete when:

1. All 16 golden reference files (8 .bin + 8 .json) exist in the correct directories.
2. Every .json metadata file contains: input parameters, output_length, dtype, numpy version, scipy version, Python version, generation timestamp, and SHA-256 hash.
3. SHA-256 hash verification passes for all 8 .bin files.
4. CRC-16 reference contains exactly 7 test vectors with 3 variants each.
5. CRC-24 reference contains at least 2 test vectors.
6. The generation script is committed to the repository.

---

## Cross-References

- **Required by**: Phase-7.6-VERIFICATION-SUITE.md (golden files are the comparison baseline for all protocol tests)
- **Required by**: Phase-7.3-PROTOCOL-ENCODERS.md (TypeScript protocol encoders must produce output matching these golden files)
- **Informed by**: Phase-7.1.02-Source-Inventory-Verification.md (protocol file list)
- **Informed by**: Phase-7.1.07-Function-Signature-Documentation.md (method signatures determine generation script parameters)

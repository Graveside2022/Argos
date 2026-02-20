# SigMF (Signal Metadata Format)

> **RISK CLASSIFICATION**: LOW RISK
> IQ signal recording metadata standard and Python library. No RF capability — purely a data format specification and tooling library. No hardware interaction.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python; `pip install sigmf`; platform-independent; zero hardware requirements

| Method               | Supported | Notes                                                                        |
| -------------------- | --------- | ---------------------------------------------------------------------------- |
| **Docker Container** | N/A       | Not a service — Python library installed via pip; no containerization needed |
| **Native Install**   | YES       | `pip install sigmf` — pure Python, no compilation, no native dependencies    |

---

## Tool Description

SigMF (Signal Metadata Format) is an open standard for describing collections of recorded digital signal samples with rich metadata. It provides a JSON sidecar format (`.sigmf-meta`) that accompanies IQ recording data files (`.sigmf-data`), documenting the capture parameters, hardware used, signal annotations, and temporal context. The `sigmf-python` library provides Python tools for creating, reading, validating, and manipulating SigMF recordings.

Think of it as "EXIF metadata for RF recordings" — it ensures that IQ captures are self-describing and interoperable between tools.

Key capabilities:

- **SigMF Specification**: JSON schema defining metadata fields for IQ recordings
    - Global metadata: sample rate, data format, center frequency, hardware description, author, description
    - Capture segments: frequency changes, gain adjustments during recording
    - Annotations: signal of interest labels, start/stop sample indices, frequency ranges, comments
- **sigmf-python library**: Python API for SigMF files
    - Create `.sigmf-meta` sidecar files for existing IQ recordings
    - Read and validate SigMF recordings
    - Archive SigMF recordings to `.sigmf` tar files (data + metadata bundled)
    - NumPy integration for reading sample data directly
    - Collection support for multi-file recordings
- **Interoperability**: SigMF is supported by FISSURE, IQEngine, GNU Radio, Inspectrum, and many other SDR tools
- **Data format support**: complex float32, complex int16, complex int8, real formats

## Category

SDR Metadata Standard / IQ Recording Management / Signal Archive Format

## Repository

- **GitHub (spec)**: https://github.com/sigmf/SigMF
- **GitHub (python)**: https://github.com/sigmf/sigmf-python
- **Language**: Specification (JSON Schema) + Python library
- **License**: Open source
- **Stars**: ~431 (spec) + ~60 (python)

---

## Docker Compatibility

### Can it run in Docker?

**N/A** — SigMF is a Python library, not a service or daemon. It is installed via `pip install sigmf` and used as an import in Python scripts. No containerization is needed or beneficial. If needed in a Docker container for another tool, add `RUN pip install sigmf` to that tool's Dockerfile.

### Integration with Docker-based tools

```dockerfile
# Add SigMF to any Python-based Docker image
RUN pip install --no-cache-dir sigmf

# Or in a dedicated Python container for IQ processing
FROM python:3.11-slim
RUN pip install --no-cache-dir sigmf numpy
```

---

## Install Instructions (Native)

```bash
# ============================================
# SigMF Native Install on Kali Linux RPi5
# ============================================

# Install via pip (recommended)
pip3 install --break-system-packages sigmf

# Verify installation
python3 -c "import sigmf; print(f'SigMF version: {sigmf.__version__}')"

# ============================================
# Usage Examples
# ============================================

# Create a SigMF metadata file for an existing IQ recording
python3 << 'PYEOF'
import sigmf
from sigmf import SigMFFile
import numpy as np
import datetime

# Create metadata for a HackRF IQ capture
meta = SigMFFile(
    data_file="capture_851MHz.raw",
    global_info={
        SigMFFile.DATATYPE_KEY: "cf32_le",           # complex float32 little-endian
        SigMFFile.SAMPLE_RATE_KEY: 8000000,            # 8 MSPS
        SigMFFile.DESCRIPTION_KEY: "P25 control channel capture",
        SigMFFile.AUTHOR_KEY: "Argos",
        SigMFFile.HW_KEY: "HackRF One",
    }
)

# Add capture segment
meta.add_capture(0, metadata={
    SigMFFile.FREQUENCY_KEY: 851000000,              # 851 MHz center frequency
    SigMFFile.DATETIME_KEY: datetime.datetime.utcnow().isoformat() + "Z",
})

# Add signal annotation
meta.add_annotation(0, 8000000, metadata={
    SigMFFile.FLO_KEY: 851000000 - 4000000,
    SigMFFile.FHI_KEY: 851000000 + 4000000,
    SigMFFile.LABEL_KEY: "P25 trunked radio system",
    SigMFFile.COMMENT_KEY: "Training site P25 capture for trunk-recorder analysis",
})

# Write metadata to .sigmf-meta file
meta.tofile("capture_851MHz.sigmf-meta")
print("SigMF metadata written")
PYEOF

# Read and validate a SigMF recording
python3 << 'PYEOF'
from sigmf import SigMFFile

# Load SigMF recording
signal = SigMFFile("capture_851MHz.sigmf-meta")

# Access metadata
print(f"Sample rate: {signal.get_global_field(SigMFFile.SAMPLE_RATE_KEY)} SPS")
print(f"Data type: {signal.get_global_field(SigMFFile.DATATYPE_KEY)}")
print(f"Hardware: {signal.get_global_field(SigMFFile.HW_KEY)}")

# Read sample data as numpy array
samples = signal.read_samples()
print(f"Loaded {len(samples)} samples")
PYEOF

# Archive a SigMF recording (bundle data + metadata)
python3 << 'PYEOF'
from sigmf.archive import SigMFArchive

# Create .sigmf archive (tar file with data + meta)
archive = SigMFArchive("capture_851MHz.sigmf-meta")
print(f"Archive created: {archive.path}")
PYEOF

# Validate a SigMF file
python3 -c "
from sigmf import SigMFFile
s = SigMFFile('capture_851MHz.sigmf-meta')
s.validate()
print('SigMF file is valid')
"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — pure Python, completely platform-independent                       |
| Kali Repo Available   | :white_check_mark: Available via pip — `pip3 install sigmf`                                  |
| Hardware Requirements | None — metadata library only, no SDR hardware interaction                                    |
| Performance on RPi5   | :white_check_mark: Excellent — negligible resource usage; only active during file operations |

### RPi5-Specific Notes

- `pip install sigmf` — one command, no compilation, no native dependencies
- Pure Python with numpy/jsonschema as only dependencies
- No runtime resource usage — it's a library called on demand, not a daemon
- Works with any IQ recording from any SDR tool in the Argos suite
- NumPy integration means efficient handling of large IQ files on RPi 5's 8 GB RAM

### Argos Integration Notes

- Adopt as the standard metadata format for all Argos IQ recordings
- When HackRF captures IQ data, automatically generate SigMF metadata sidecars
- Makes recordings self-describing: any team member can understand a capture without external context
- Interoperable with FISSURE (already in folder 08), Inspectrum (folder 08), and IQEngine
- SigMF archives (`.sigmf` tar files) bundle data + metadata for easy sharing/archiving
- Can be integrated into Argos Python backend as an import — minimal code to add SigMF tagging to existing capture workflows
- Annotations field enables marking signals of interest within recordings for review

### Verdict

**COMPATIBLE** — SigMF is pure Python with zero hardware requirements and zero runtime overhead. `pip install sigmf` is the simplest possible deployment. Adopting SigMF as the standard IQ metadata format makes all Argos recordings self-describing and interoperable with the broader SDR tool ecosystem. Zero-effort, high-value infrastructure addition.

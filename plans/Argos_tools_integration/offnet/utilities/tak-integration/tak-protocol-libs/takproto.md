# takproto

> **RISK CLASSIFICATION**: MODERATE RISK
> This tool is part of a controlled military/defense training toolkit. TAK Protocol encoding/decoding enables Cursor-on-Target message crafting, which could be used for CoT spoofing or injecting fabricated situational awareness data into TAK networks. Use only in authorized training, research, and red-team environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python protobuf library, no architecture-specific dependencies

| Method               | Supported | Notes                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no special access needed        |
| **Native Install**   | YES       | `pip install takproto` on ARM64; pure Python with protobuf dependency |

---

## Tool Description

takproto is a pure Python library for encoding and decoding TAK Protocol Protobuf data. It parses and generates Cursor-on-Target (CoT) XML messages and supports TAK Protocol Version 1 (protobuf-wrapped CoT). This is the foundational library that enables any Python application to speak the TAK/CoT protocol natively. It handles the low-level serialization and deserialization of CoT events, including position location information (PLI), alerts, sensor data, and mission packages. This is the #4 priority tool for Argos integration -- it enables Argos to encode and decode CoT messages natively, bridging Argos RF/network intelligence into TAK ecosystem workflows.

## Category

TAK Protocol / Cursor-on-Target / Situational Awareness Integration

## Repository

- **Source**: https://pypi.org/project/takproto / https://github.com/snstac/takproto
- **Language**: Python
- **License**: MIT

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Base Python 3.9+ image (ARM64-compatible)
- No native compiled dependencies -- pure Python with protobuf
- Minimal image footprint (~150MB with dependencies)
- No special hardware or device access required

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

LABEL maintainer="Argos Project"
LABEL description="takproto - TAK Protocol Protobuf encoder/decoder"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir takproto

WORKDIR /app

# Example: encode/decode CoT messages
COPY . /app/

CMD ["python", "-c", "import takproto; print(f'takproto {takproto.__version__} loaded successfully')"]
```

### Docker Run Command

```bash
# Run interactive Python shell with takproto available
docker run -it --rm \
    --name argos-takproto \
    argos-takproto \
    python

# Run a custom script that uses takproto
docker run -it --rm \
    --name argos-takproto \
    -v $(pwd)/scripts:/app/scripts:ro \
    argos-takproto \
    python /app/scripts/my_cot_script.py
```

---

## Install Instructions (Native)

```bash
# Install via pip (recommended)
pip install takproto

# Or install from source
git clone https://github.com/snstac/takproto.git
cd takproto
pip install .

# Verify installation
python -c "import takproto; print('takproto loaded')"

# Install with development dependencies
pip install takproto[dev]
```

### Basic Usage Example

```python
import takproto
import xml.etree.ElementTree as ET

# Example: Parse a CoT XML event into protobuf
cot_xml = """<?xml version='1.0' encoding='UTF-8'?>
<event version="2.0" uid="ARGOS-RF-001" type="a-f-G-U-C"
       time="2025-01-01T00:00:00Z" start="2025-01-01T00:00:00Z"
       stale="2025-01-01T00:05:00Z" how="m-g">
  <point lat="38.8977" lon="-77.0365" hae="10.0" ce="5.0" le="5.0"/>
  <detail>
    <contact callsign="ARGOS-SENSOR"/>
  </detail>
</event>"""

# Encode CoT XML to TAK Protocol v1 protobuf
tak_proto_bytes = takproto.xml2proto(cot_xml)

# Decode TAK Protocol protobuf back to CoT XML
decoded_xml = takproto.proto2xml(tak_proto_bytes)
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                    |
| --------------------- | ------------------------------------------------------------------------- |
| ARM64 Support         | ✅ Pure Python, architecture-independent                                  |
| Kali Repo Available   | ❌ Not in Kali repos, install via pip                                     |
| Hardware Requirements | Minimal -- no special hardware needed                                     |
| Performance on RPi5   | Excellent -- lightweight protobuf serialization, negligible CPU/RAM usage |

### Platform Details

- **Tested Architecture**: aarch64 (ARM64)
- **Python Requirement**: Python 3.9+
- **Key Dependencies**: protobuf (Google Protocol Buffers for Python)
- **Memory Footprint**: ~20MB RAM when loaded
- **CPU Impact**: Negligible for message encoding/decoding operations

### Verdict

**COMPATIBLE** -- Pure Python library with no native dependencies or architecture constraints. Runs identically on Raspberry Pi 5 ARM64 as on x86_64. Protobuf serialization is lightweight and well within RPi5 Cortex-A76 capabilities. Ideal for embedding CoT protocol support directly into Argos on the Pi 5 platform.

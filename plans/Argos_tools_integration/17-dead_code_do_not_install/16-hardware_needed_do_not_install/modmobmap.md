# Modmobmap

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: MODERATE RISK
> Cellular network mapping and tower enumeration. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                      |
| -------------------- | --------- | ------------------------------------------ |
| **Docker Container** | YES       | Pure Python, USB modem passthrough         |
| **Native Install**   | YES       | `pip install` — lightweight, no SDR needed |

---

## Tool Description

Mobile network mapping tool developed by Synacktiv. Uses a USB cellular modem or phone with AT command support to scan and map all cell towers in range. Reports tower frequencies, operators (MCC/MNC), signal strengths, cell IDs, and location area codes. Creates a comprehensive map of the cellular infrastructure in the operational area. Supports automated scanning across multiple bands and operators.

## Category

Cellular Reconnaissance / Network Mapping

## Repository

https://github.com/Synacktiv-contrib/Modmobmap

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application with minimal dependencies. Requires USB passthrough for the cellular modem.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or appropriate modem device) - USB modem passthrough
- No `--privileged` needed if specific device is passed
- No kernel modules needed (standard USB serial drivers)
- No `--net=host` required

### Docker-to-Host Communication

- CLI output (stdout) and JSON output files
- No network services
- Volume mount for output: `-v /host/output:/output`

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended)

```bash
sudo apt install -y python3-pip python3-serial
git clone https://github.com/Synacktiv-contrib/Modmobmap.git /opt/modmobmap
cd /opt/modmobmap
pip3 install pyserial  # requirements.txt lists 'serial' which is the wrong package
```

### Option B: Docker

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    git \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pyserial

RUN git clone https://github.com/Synacktiv-contrib/Modmobmap.git /opt/modmobmap

WORKDIR /opt/modmobmap
ENTRYPOINT ["python3", "modmobmap.py"]
```

```bash
# Build
docker build -t argos/modmobmap .

# Run - scan all bands with USB modem
docker run --rm \
  --device=/dev/ttyUSB0 \
  -v $(pwd)/output:/opt/modmobmap/output \
  argos/modmobmap -m /dev/ttyUSB0 -a

# Run - scan specific operator
docker run --rm \
  --device=/dev/ttyUSB0 \
  -v $(pwd)/output:/opt/modmobmap/output \
  argos/modmobmap -m /dev/ttyUSB0 -o 310260
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Pure Python. No compiled extensions. Runs on any platform with Python 3.

### Hardware Constraints

- **CPU**: Negligible — sends AT commands and parses text responses.
- **RAM**: < 50MB.
- **Hardware**: Requires a USB cellular modem (e.g., Huawei E3372, ZTE MF823) or phone with AT command support. Not included in current Argos hardware — must be procured separately.

### Verdict

**COMPATIBLE** - Runs perfectly on RPi 5. The only barrier is hardware: a USB cellular modem (~$30-50) is needed. Native install preferred. Excellent first-step reconnaissance tool for mapping cell towers at NTC before deploying any other cellular tool.

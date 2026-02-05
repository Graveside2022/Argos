# QCSuper

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Passive cellular air traffic capture using consumer phones. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                                         |
| -------------------- | --------- | ------------------------------------------------------------- |
| **Docker Container** | YES       | Pure Python, Qualcomm phone USB passthrough                   |
| **Native Install**   | YES       | `pip install .` from cloned repo — lightweight, no SDR needed |

---

## Tool Description

QCSuper captures 2G/3G/4G air traffic using Qualcomm-based Android phones. Exploits Qualcomm's diagnostic interface (Diag/QXDM) to turn any phone with a Qualcomm chipset into a passive cellular protocol analyzer. Captures raw baseband frames from the air interface and outputs standard PCAP files compatible with Wireshark. Supports capture from:

- USB-connected Qualcomm phones (via ADB or serial)
- Qualcomm-based USB modems
- Existing PCAP/DLF log files (offline analysis)

Developed by P1 Security, a French cellular security research firm.

## Category

Cellular Passive Sniffer / Protocol Analyzer

## Repository

https://github.com/P1sec/QCSuper

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application with minimal dependencies. USB device passthrough for connected phone/modem. Lightweight and well-suited for containerization.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for Qualcomm phone or modem
- ADB must be available (can be installed in container)
- No kernel modules required beyond standard USB
- No `--net=host` needed
- No `--privileged` strictly required if specific USB device is passed through

### Docker-to-Host Communication

- PCAP file output via volume mount
- No network services
- USB device communication only

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended)

```bash
sudo apt install -y python3-pip adb
git clone https://github.com/P1sec/QCSuper.git /opt/qcsuper
cd /opt/qcsuper
pip3 install crcmod pycrate pyserial pyusb
pip3 install .
```

### Option B: Docker

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    adb \
    git \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/P1sec/QCSuper.git /opt/qcsuper
WORKDIR /opt/qcsuper
RUN pip install --no-cache-dir .

WORKDIR /output
ENTRYPOINT ["python3", "/opt/qcsuper/qcsuper.py"]
```

```bash
# Build
docker build -t argos/qcsuper .

# Run - capture from USB-connected Qualcomm phone
docker run --rm \
  --device=/dev/bus/usb \
  -v $(pwd)/pcaps:/output \
  argos/qcsuper --usb-modem /dev/ttyUSB0 --pcap-dump /output/capture.pcap

# Run - capture via ADB
docker run --rm \
  --device=/dev/bus/usb \
  -v $(pwd)/pcaps:/output \
  argos/qcsuper --adb --pcap-dump /output/capture.pcap
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Pure Python application. No compiled C extensions or architecture-specific code. Python 3 and ADB are available in Kali ARM64 repos.

### Hardware Constraints

- **CPU**: Minimal - Python script processing serial data. Well within RPi 5 capabilities.
- **RAM**: < 100MB. No concern.
- **Hardware**: Requires a Qualcomm-based Android phone (e.g., Samsung Galaxy, OnePlus, Pixel) connected via USB with USB debugging enabled. No SDR hardware needed.

### Verdict

**COMPATIBLE** - Excellent fit for RPi 5. Zero SDR hardware required — just a spare Android phone with a Qualcomm chipset. Native install recommended over Docker for simplicity. This is the lowest-barrier cellular capture tool in the inventory.

# RFCrack

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Sub-GHz attack tool for replay, brute force, and jamming of garage doors, car key fobs, and IoT devices operating in the 300-928 MHz range. Enables unauthorized access to physical security systems. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python; no architecture-specific dependencies

| Method               | Supported | Notes                                                                              |
| -------------------- | --------- | ---------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `python:3.11-slim-bookworm` base; USB passthrough for HackRF One or Yard Stick One |
| **Native Install**   | YES       | Pure Python with pip-installable dependencies; runs natively on ARM64              |

---

## Tool Description

RFCrack is a Python-based sub-GHz RF attack framework that uses HackRF One or Yard Stick One to perform replay attacks, rolling code brute force, and targeted jamming against devices operating in the sub-GHz ISM bands (315 MHz, 433 MHz, 868 MHz, 915 MHz). It targets garage door openers, car key fobs, wireless doorbells, alarm systems, and IoT sensors that use simple OOK/ASK modulation with fixed or weakly-implemented rolling codes.

## Category

Sub-GHz RF Attacks / Replay / Brute Force / Physical Security

## Repository

https://github.com/cclabsInc/RFCrack

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - RFCrack is a Python application that communicates with SDR hardware via USB. It runs cleanly in Docker with USB passthrough for the HackRF One or Yard Stick One.

### Host OS-Level Requirements

- `--privileged` - Required for raw USB device access to HackRF One or Yard Stick One
- `--device=/dev/bus/usb:/dev/bus/usb` - USB passthrough for SDR hardware
- No `--net=host` required (operates via USB, not network)
- Host kernel modules: HackRF or Yard Stick One udev rules on host
- For Yard Stick One: host needs `cdc_acm` kernel module (standard on Kali)

### Docker-to-Host Communication

- SDR hardware (HackRF One or Yard Stick One) must be connected to host USB
- Host requires appropriate udev rules for the SDR device
- Captured signal files can be persisted via volume mount: `-v /host/captures:/captures`
- No network communication required; all RF operations are via USB

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Install udev rules for HackRF on host
sudo apt-get update && sudo apt-get install -y hackrf
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    git \
    hackrf \
    libhackrf-dev \
    libusb-1.0-0-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/cclabsInc/RFCrack.git /opt/rfcrack

WORKDIR /opt/rfcrack

RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --no-cache-dir rfcat matplotlib bitstring pyusb numpy

RUN mkdir -p /captures

ENTRYPOINT ["python3", "RFCrack.py"]
CMD ["--help"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/rfcrack .

# Run - record a sub-GHz signal (433 MHz garage door)
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/rfcrack -r -F 433920000

# Run - replay a captured signal
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/rfcrack -p -F 433920000 -f /captures/signal.raw

# Run - brute force rolling codes
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/rfcrack -b -F 433920000

# Run - jam + record simultaneously (RollJam attack)
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/rfcrack -j -F 433920000
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - RFCrack is a pure Python application with no architecture-specific compiled extensions. All dependencies (rfcat, matplotlib, bitstring, pyusb, numpy) are available for ARM64 on Kali Linux.

### Hardware Constraints

- CPU: Lightweight Python application; minimal CPU usage on Cortex-A76. Signal processing for OOK/ASK demodulation is not computationally intensive
- RAM: ~100-200MB during operation; negligible on 8GB system
- Hardware: Requires HackRF One (installed) or Yard Stick One. HackRF provides wider frequency range but Yard Stick One has better sub-GHz sensitivity for this specific use case
- Storage: Minimal (<200MB including Python dependencies). Captured signal files are small (raw IQ samples at low sample rates for sub-GHz)

### Verdict

**COMPATIBLE** - RFCrack runs natively on Kali RPi 5 ARM64. Python-based with no platform constraints. The tool is lightweight and well-suited to the RPi 5 hardware profile. HackRF One (installed) provides full sub-GHz coverage for all supported attack modes.

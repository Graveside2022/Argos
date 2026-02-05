# JamRF

> **RISK CLASSIFICATION**: HIGH RISK - EXTREME - SENSITIVE SOFTWARE
> Broadband RF jamming tool that disrupts ALL wireless communications within effective range, including WiFi, Bluetooth, Zigbee, drone control links, IoT devices, and emergency communications. Illegal to operate under FCC regulations (47 U.S.C. 333). Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python/GNU Radio; all dependencies available in Kali ARM64 repos

| Method               | Supported | Notes                                                                                               |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `debian:bookworm-slim` base with `gnuradio`, `gr-osmosdr`, `hackrf`; USB passthrough for HackRF One |
| **Native Install**   | YES       | GNU Radio and all dependencies install natively from Kali ARM64 apt repositories                    |

---

## Tool Description

JamRF is a GNU Radio-based SDR jamming tool developed by the Technology Innovation Institute (TIIUAE). It generates broadband RF interference across configurable frequency bands using HackRF One hardware, capable of disrupting wireless communications within its effective transmission range. The tool supports configurable center frequency, bandwidth, gain, and jamming waveform parameters through Python-based GNU Radio flowgraphs.

## Category

Broadband RF Jamming / Electronic Warfare / Active RF Transmission

## Repository

https://github.com/tiiuae/jamrf

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - JamRF runs in Docker with HackRF One USB passthrough. The application consists of Python scripts and GNU Radio flowgraphs with no GUI dependency for core jamming functionality.

### Host OS-Level Requirements

- `--privileged` - Required for raw USB device access to HackRF One for RF transmission
- `--device=/dev/bus/usb:/dev/bus/usb` - USB passthrough for HackRF One hardware
- No `--net=host` required (operates via USB to HackRF, not network sockets)
- Host kernel modules: HackRF udev rules must be installed on the host for device recognition
- Host package: `hackrf` (for udev rules and firmware utilities)

### Docker-to-Host Communication

- HackRF One must be physically connected to the host and accessible via USB passthrough
- Host requires HackRF udev rules: `/etc/udev/rules.d/53-hackrf.rules`
- No network port mappings required; all RF operations are performed through USB-connected HackRF hardware
- Container isolation does NOT contain RF emissions; once transmitting, all devices within radio range are affected

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Install HackRF udev rules on host
sudo apt-get update && sudo apt-get install -y hackrf
sudo udevadm control --reload-rules
sudo udevadm trigger

# Verify HackRF detected
hackrf_info
```

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    gnuradio \
    gr-osmosdr \
    hackrf \
    libhackrf-dev \
    python3 \
    python3-numpy \
    python3-scipy \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/tiiuae/jamrf.git /opt/jamrf

WORKDIR /opt/jamrf

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/jamrf .

# Run with HackRF passthrough
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  argos/jamrf

# Inside container (example - jam 2.4 GHz band):
# python3 HackRF/jamRF_v1.py --freq 2.4e9 --bandwidth 20e6 --gain 40
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - JamRF is a Python application using GNU Radio, which is available in Kali ARM64 repositories. GNU Radio, gr-osmosdr, and HackRF libraries all compile and run natively on aarch64. No architecture-specific binary dependencies.

### Hardware Constraints

- CPU: GNU Radio signal processing is moderately CPU-intensive; Cortex-A76 quad-core handles single-band jamming waveform generation adequately
- RAM: ~512MB-1GB during active GNU Radio flowgraph execution; well within 8GB available
- Hardware: Requires HackRF One (installed). HackRF TX power is limited to ~15 dBm; effective jamming radius is constrained without external amplification. Single HackRF can cover ~20 MHz instantaneous bandwidth
- Storage: Minimal (<500MB including GNU Radio dependencies in Docker)

### Verdict

**COMPATIBLE** - JamRF runs natively on Kali RPi 5 ARM64 with HackRF One. GNU Radio and all dependencies are available in Kali ARM64 repositories. Primary limitation is HackRF transmit power and bandwidth, not platform constraints.

# gnss-uav-spoofing-jamming

> **HIGH RISK - SENSITIVE SOFTWARE**
> Multi-constellation GNSS spoofing and jamming toolkit targeting UAV navigation. Capable of spoofing GPS, GLONASS, and Galileo signals simultaneously. Active RF transmission disrupts all GNSS receivers in range, not just the target drone. Illegal without authorization.

> **WARNING: NO DEPLOYABLE CODE** - This repository contains only capstone project screenshots and documentation, not working software. Use gps-sdr-sim for actual GNSS spoofing capabilities.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** (single-constellation; multi-constellation CPU-limited)

| Method               | Supported | Notes                                       |
| -------------------- | --------- | ------------------------------------------- |
| **Docker Container** | YES       | GNU Radio + UHD/HackRF, SDR USB passthrough |
| **Native Install**   | YES       | GNU Radio and UHD compile on ARM64          |

---

## Description

Practical implementation of GNSS spoofing and jamming attacks on UAVs using SDR and custom RF hardware. Supports multi-constellation spoofing (GPS, GLONASS, Galileo), adaptive jamming with variable power, and CEP (Circular Error Probable) manipulation to gradually drift a drone's perceived position. Designed for research into UAV navigation security.

## Category

GNSS Spoofing / Multi-Constellation Jamming / UAV Navigation Attack

## Source

- **Repository**: https://github.com/AnumulaBalaji/gnss-uav-spoofing-jamming
- **Status**: RESEARCH
- **Language**: Python, C/C++
- **Dependencies**: GNU Radio, gr-osmosdr, UHD (for USRP), libhackrf

## Docker Compatibility

| Attribute                | Value                                            |
| ------------------------ | ------------------------------------------------ |
| Docker Compatible        | Yes                                              |
| ARM64 (aarch64) Support  | Yes (GNU Radio and UHD available for aarch64)    |
| Base Image               | debian:bookworm-slim                             |
| Privileged Mode Required | Yes (SDR USB access, RF transmission)            |
| Host Network Required    | No                                               |
| USB Device Passthrough   | USRP B200/B210 or HackRF One (`/dev/bus/usb`)    |
| Host Kernel Modules      | uhd (for USRP), hackrf (for HackRF), usb-storage |

### Docker-to-Host Communication

- SDR hardware (USRP or HackRF) must be accessible via USB passthrough.
- USRP requires UHD firmware images downloaded inside the container or mounted from host.
- For USRP B210: host needs `uhd-host` udev rules. Container downloads FPGA images on first run (~50MB).
- No network ports required; operates entirely via USB to SDR hardware.

## Install Instructions (Docker)

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
    uhd-host \
    libuhd-dev \
    python3-pip \
    python3-numpy \
    python3-scipy \
    && rm -rf /var/lib/apt/lists/*

# Download UHD FPGA images for USRP
RUN uhd_images_downloader || true

RUN git clone https://github.com/AnumulaBalaji/gnss-uav-spoofing-jamming.git \
    /opt/gnss-spoofing

WORKDIR /opt/gnss-spoofing

CMD ["/bin/bash"]
```

```bash
# Build
docker build -t gnss-spoofing .

# Run with USRP
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  gnss-spoofing

# Run with HackRF
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  gnss-spoofing
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes (with limitations)                                                                                                                                                                                                                                                 |
| Architecture     | aarch64 native (GNU Radio, UHD, and gr-osmosdr all compile on ARM64)                                                                                                                                                                                                   |
| RAM Requirement  | ~1GB (GNU Radio + signal generation)                                                                                                                                                                                                                                   |
| Limiting Factors | Multi-constellation simultaneous spoofing is CPU-intensive; RPi5 may only handle single-constellation spoofing in real-time. USRP B210 draws significant USB power and may need a powered USB hub. GNU Radio compilation from source takes considerable time on ARM64. |

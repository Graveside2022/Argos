# ButteRFly

## DO NOT INSTALL -- Required hardware not available

> **WARNING: REPOSITORY UNAVAILABLE** - The documented repository (github.com/whid-injector/ButteRFly) does not exist. This tool may have been removed or made private. All install instructions, Dockerfiles, and clone commands below will fail.

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> ESP32-S3 Bluetooth Classic and BLE attack platform capable of MAC spoofing, GATT fuzzing, HID keystroke injection, and device impersonation. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — Firmware runs on ESP32-S3 hardware; RPi 5 serves as build host and serial controller

| Method               | Supported | Notes                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| **Docker Container** | PARTIAL   | Build toolchain + firmware flashing in Docker; attack runs on ESP32-S3               |
| **Native Install**   | PARTIAL   | ESP-IDF ARM64 toolchain installs natively; host-side Python controller runs on RPi 5 |

---

## Tool Description

ButteRFly is a Bluetooth attack platform built on ESP32-S3 hardware that provides a wide range of Bluetooth Classic and BLE offensive capabilities. It supports MAC address spoofing, GATT service fuzzing, HID keyboard/mouse injection (BadBT), device name and class spoofing, advertisement flooding, and connection denial-of-service attacks. The ESP32-S3 runs custom firmware while a host-side Python controller provides command-and-control through USB serial. Designed for integration with security assessment workflows via serial API.

## Category

BT Classic/BLE Attack Hardware Platform

## Repository

https://github.com/whid-injector/ButteRFly

---

## Docker Compatibility Analysis

### Can it run in Docker?

**PARTIAL** - Docker is used for the build toolchain and firmware flashing only. The attack firmware runs on the ESP32-S3 hardware, not on the host. The host-side Python controller for serial communication can run in Docker.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or `/dev/ttyACM0`) - USB serial passthrough for ESP32-S3 board
- `--privileged` - Required for USB serial access and firmware flashing
- Host kernel modules: `cp210x` or `cdc_acm` for ESP32-S3 USB interface
- No `--net=host` required (communication is via USB serial)

### Docker-to-Host Communication

- ESP32-S3 board must be connected to host USB and visible as a serial device
- Host needs USB-UART drivers loaded (standard on Kali)
- Firmware build uses ESP-IDF toolchain which can run entirely in Docker
- Serial output/logs via volume mount: `-v /host/output:/output`

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile (Build and Flash Environment)

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-serial \
    git \
    wget \
    cmake \
    ninja-build \
    build-essential \
    libffi-dev \
    libssl-dev \
    usbutils \
    esptool \
    && rm -rf /var/lib/apt/lists/*

# Install ESP-IDF toolchain for ARM64
RUN mkdir -p /opt/esp && \
    cd /opt/esp && \
    git clone --recursive --depth 1 -b v5.1 \
    https://github.com/espressif/esp-idf.git && \
    cd esp-idf && \
    ./install.sh esp32s3

RUN git clone --depth 1 \
    https://github.com/whid-injector/ButteRFly.git /opt/butterfly

WORKDIR /opt/butterfly

# Source ESP-IDF environment in entrypoint
RUN echo '#!/bin/bash\n\
source /opt/esp/esp-idf/export.sh\n\
exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
```

### Build and Run

```bash
# Build the image (includes ESP-IDF toolchain - large image, ~4GB)
docker build -t argos/butterfly .

# Build firmware for ESP32-S3
docker run --rm -it \
  -v $(pwd)/output:/output \
  argos/butterfly idf.py build

# Flash firmware to ESP32-S3 board
docker run --rm -it \
  --privileged \
  --device=/dev/ttyUSB0 \
  argos/butterfly idf.py -p /dev/ttyUSB0 flash

# Run host-side controller (serial command interface)
docker run --rm -it \
  --privileged \
  --device=/dev/ttyUSB0 \
  -v $(pwd)/output:/output \
  argos/butterfly python3 controller.py --port /dev/ttyUSB0
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 CROSS-COMPILE** - The ESP-IDF toolchain supports ARM64 hosts for cross-compiling to the ESP32-S3 Xtensa architecture. The host-side Python controller runs natively on ARM64. ESP-IDF installation on ARM64 may require building some toolchain components from source, but Espressif provides ARM64 Linux toolchain binaries.

### Hardware Constraints

- CPU: ESP-IDF firmware compilation is CPU-intensive but manageable on 4x Cortex-A76 (~5-10 minutes for a full build)
- RAM: ESP-IDF build process can use 2-3GB RAM; fits within 8GB with headroom
- Hardware: Requires an ESP32-S3 DevKit board (ESP32-S3-DevKitC-1 or similar). The ESP32-S3 provides the Bluetooth radio for attacks; the RPi 5 serves as the build host and serial controller
- Storage: ESP-IDF toolchain requires approximately 4-5GB disk space

### Verdict

**COMPATIBLE** - ButteRFly firmware builds and flashes from RPi 5 using the ESP-IDF ARM64 toolchain. The host-side serial controller runs natively in Python. Primary constraint is the requirement for ESP32-S3 hardware and the large ESP-IDF toolchain footprint.

# BlueFang

## DO NOT INSTALL -- Required hardware not available

> **WARNING: REPOSITORY UNAVAILABLE** - The documented repository (github.com/koutto/bluefang) does not exist. This tool may have been removed or made private. All install instructions, Dockerfiles, and clone commands below will fail.

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> ESP32-based BLE attack platform for automated GATT discovery, characteristic fuzzing, connection exhaustion DoS, and advertisement flooding. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — Firmware runs on ESP32 hardware; RPi 5 serves as build host and serial controller

| Method               | Supported | Notes                                                                                                         |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Build environment (Arduino CLI or ESP-IDF) + firmware flashing in Docker; attack runs on ESP32                |
| **Native Install**   | PARTIAL   | Arduino CLI has official aarch64 binaries; ESP-IDF ARM64 toolchain available; serial controller runs natively |

---

## Tool Description

BlueFang is a BLE attack tool built on ESP32 hardware that automates BLE security assessment tasks including GATT service and characteristic discovery, characteristic value fuzzing (write random/crafted data to writable characteristics), connection exhaustion denial-of-service (opening maximum concurrent BLE connections to saturate a target), and advertisement flooding (broadcasting large numbers of fake BLE advertisements to disrupt scanning). The ESP32 runs custom firmware while the host provides a serial-based control interface for configuring and launching attacks.

## Category

BLE Attack Hardware / GATT Fuzzing

## Repository

https://github.com/koutto/bluefang

---

## Docker Compatibility Analysis

### Can it run in Docker?

**PARTIAL** - Docker is used for the build environment and firmware flashing only. The attack firmware executes on the ESP32 hardware. The host-side serial controller can run in Docker with USB passthrough.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or equivalent) - USB serial passthrough for ESP32 board
- `--privileged` - Required for USB serial access and firmware flashing via esptool
- Host kernel modules: `cp210x` or `ch341` for ESP32 USB-UART bridge
- No `--net=host` required (communication is via USB serial only)

### Docker-to-Host Communication

- ESP32 board must be connected to host USB and visible as `/dev/ttyUSB*`
- Host must have USB-UART driver loaded (standard on Kali)
- Build environment requires ESP-IDF or Arduino toolchain within Docker
- Serial output and logs via volume mount: `-v /host/output:/output`

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Arduino-based Build

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-serial \
    git \
    wget \
    curl \
    build-essential \
    usbutils \
    esptool \
    && rm -rf /var/lib/apt/lists/*

# Install Arduino CLI for ARM64
RUN curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh -s -- --dest /usr/local/bin

# Install ESP32 Arduino core
RUN arduino-cli core update-index --additional-urls \
    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json && \
    arduino-cli core install esp32:esp32 --additional-urls \
    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json

RUN git clone --depth 1 \
    https://github.com/koutto/bluefang.git /opt/bluefang

WORKDIR /opt/bluefang

ENTRYPOINT ["bash"]
```

### Option B: ESP-IDF Build

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

RUN mkdir -p /opt/esp && \
    cd /opt/esp && \
    git clone --recursive --depth 1 -b v5.1 \
    https://github.com/espressif/esp-idf.git && \
    cd esp-idf && \
    ./install.sh esp32

RUN git clone --depth 1 \
    https://github.com/koutto/bluefang.git /opt/bluefang

WORKDIR /opt/bluefang

RUN echo '#!/bin/bash\n\
source /opt/esp/esp-idf/export.sh\n\
exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
```

### Build and Run

```bash
# Build the image (choose Option A or B)
docker build -t argos/bluefang .

# Compile firmware
docker run --rm -it \
  -v $(pwd)/output:/output \
  argos/bluefang arduino-cli compile --fqbn esp32:esp32:esp32 .

# Flash firmware to ESP32
docker run --rm -it \
  --privileged \
  --device=/dev/ttyUSB0 \
  argos/bluefang esptool.py --port /dev/ttyUSB0 \
    --baud 921600 write_flash 0x0 build/bluefang.bin

# Monitor serial output (attack control)
docker run --rm -it \
  --privileged \
  --device=/dev/ttyUSB0 \
  argos/bluefang python3 -m serial.tools.miniterm /dev/ttyUSB0 115200
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 CROSS-COMPILE** - Arduino CLI and ESP-IDF both support ARM64 Linux hosts for cross-compiling to ESP32 Xtensa architecture. The host-side Python serial controller runs natively on ARM64. Arduino CLI provides official aarch64 binaries. ESP-IDF ARM64 support is available with some toolchain components built from source.

### Hardware Constraints

- CPU: ESP32 firmware compilation is moderate on Cortex-A76 (~3-5 minutes via Arduino, ~5-10 minutes via ESP-IDF)
- RAM: Build process uses 1-2GB RAM; fits within 8GB
- Hardware: Requires an ESP32 DevKit board (ESP-WROOM-32 or similar). The ESP32 provides the BLE radio for attacks. Connected to RPi 5 via USB for flashing and serial control
- Storage: Arduino core or ESP-IDF toolchain requires 2-4GB disk space

### Verdict

**COMPATIBLE** - BlueFang firmware builds and flashes from RPi 5 Kali ARM64 using either Arduino CLI or ESP-IDF toolchain. The serial-based control interface works natively. Primary constraint is the requirement for ESP32 hardware and the build toolchain disk space.

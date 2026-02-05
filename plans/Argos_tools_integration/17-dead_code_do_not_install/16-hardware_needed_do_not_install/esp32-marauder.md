# ESP32 Marauder

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Multi-vector WiFi/BT attack suite capable of deauthentication, beacon spam, EAPOL/PMKID capture, Evil Portal, and BLE exploitation on portable ESP32 hardware. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — firmware executes on ESP32 hardware, RPi 5 is the build and serial-control host

| Method               | Supported | Notes                                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| **Docker Container** | YES       | Arduino CLI cross-compilation and esptool flashing via USB serial passthrough |
| **Native Install**   | YES       | Arduino CLI ARM64 binaries available; lightweight build                       |

---

## Tool Description

ESP32 Marauder is a comprehensive WiFi and Bluetooth offensive security firmware for the ESP32 platform. It provides deauthentication attacks, beacon spam, probe request sniffing, EAPOL/PMKID handshake scanning, Evil Portal credential harvesting, packet monitoring, Bluetooth Low Energy scanning and attacks, and Flipper Zero integration. The firmware runs entirely on the ESP32 microcontroller with an optional TFT display for standalone field operation, while also supporting serial command-line control from a host computer for integration into larger toolchains.

## Category

WiFi/Bluetooth Attack Hardware Firmware

## Repository

https://github.com/justcallmekoko/ESP32Marauder

---

## Docker Compatibility Analysis

### Can it run in Docker?

**BUILD/FLASH ONLY** - ESP32 Marauder firmware executes on the ESP32 microcontroller, not on the host system. Docker on the RPi5 serves exclusively as a cross-compilation and flashing environment. The Arduino CLI toolchain runs inside the container to compile the firmware, which is then flashed to the ESP32 over USB serial. Runtime operation is entirely on the ESP32 hardware.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or `/dev/ttyACM0`) - USB serial passthrough for flashing and serial control of the ESP32
- No `--privileged` required for serial-only access (use `--device` for targeted passthrough)
- No `--net=host` required (no network-level interaction with host)
- Host kernel modules: `cp210x`, `ch341`, or `ftdi_sio` (USB-to-serial drivers, loaded by default on Kali)
- `udev` rules for non-root serial access: add user to `dialout` group

### Docker-to-Host Communication

- USB serial device must be passed through to the container for firmware flashing (`esptool.py`)
- After flashing, serial control of the running Marauder firmware uses the same USB serial device
- Volume mount for firmware build output: `-v /host/builds:/builds`
- No persistent daemon or network service required on the host

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ARG ARDUINO_CLI_VERSION=0.35.3
ARG MARAUDER_VERSION=master

# Install system dependencies for Arduino CLI and serial communication
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    screen \
    minicom \
    libusb-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Arduino CLI (ARM64)
RUN wget -qO- https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz \
    | tar xz -C /usr/local/bin/

# Configure Arduino CLI with ESP32 board support
RUN arduino-cli config init && \
    arduino-cli config add board_manager.additional_urls \
    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json && \
    arduino-cli core update-index && \
    arduino-cli core install esp32:esp32

# Install required Arduino libraries
RUN arduino-cli lib install \
    "TFT_eSPI" \
    "JPEGDecoder" \
    "LinkedList" \
    "lv_arduino" \
    "Adafruit NeoPixel" \
    "ArduinoJson" \
    "NimBLE-Arduino"

# Install esptool for direct flashing
RUN pip install --no-cache-dir esptool pyserial

# Clone ESP32 Marauder source
RUN cd /opt && \
    git clone --recursive --branch ${MARAUDER_VERSION} \
    https://github.com/justcallmekoko/ESP32Marauder.git

# Copy User_Setup.h for TFT_eSPI library configuration
RUN cp /opt/ESP32Marauder/User_Setup.h \
    /root/Arduino/libraries/TFT_eSPI/User_Setup.h 2>/dev/null || true

WORKDIR /opt/ESP32Marauder

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/esp32-marauder .

# Identify the ESP32 serial device on the host
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Enter the build environment (interactive)
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  -v $(pwd)/marauder-builds:/builds \
  argos/esp32-marauder

# Inside the container: compile with Arduino CLI
# arduino-cli compile --fqbn esp32:esp32:d32_pro:FlashFreq=80,UploadSpeed=921600,PartitionScheme=min_spiffs \
#   esp32_marauder/esp32_marauder.ino

# Upload to ESP32
# arduino-cli upload --fqbn esp32:esp32:d32_pro \
#   --port /dev/ttyUSB0 \
#   esp32_marauder/esp32_marauder.ino

# Copy build output
# cp esp32_marauder/build/*/esp32_marauder.ino.bin /builds/
```

### Serial Control After Flashing

```bash
# Connect to running Marauder firmware for serial command control
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  argos/esp32-marauder \
  screen /dev/ttyUSB0 115200

# Alternative: direct host-side serial control (no Docker needed)
screen /dev/ttyUSB0 115200
```

### Argos Integration (Serial API)

```bash
# Marauder serial commands can be sent programmatically from Argos
# via Node.js serialport library. Key commands:
#   scanap           - Scan for WiFi access points
#   scansta          - Scan for WiFi stations (clients)
#   sniffpmkid       - Capture PMKID hashes
#   sniffesp         - Sniff EAPOL handshakes
#   attack -t deauth - Launch deauthentication attack
#   stopscan         - Stop current operation
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Arduino CLI provides official ARM64 binaries. The ESP32 cross-compilation toolchain (xtensa-esp32-elf-gcc) is available for ARM64 hosts via the Arduino board manager. The RPi5 acts as a build host and serial controller, not as the execution platform.

### Hardware Constraints

- **CPU**: Cross-compilation is moderately CPU-intensive but well within the 4x Cortex-A76 capability. Clean builds take approximately 5-10 minutes on RPi5.
- **RAM**: Arduino CLI builds consume approximately 1-2GB RAM during compilation. Well within the 8GB available.
- **Storage**: Arduino CLI with ESP32 core plus Marauder source requires approximately 3-4GB of disk space.
- **Hardware**: Requires an ESP32 development board (ESP32-WROOM, ESP32-S2, or ESP32-S3 depending on Marauder variant) connected via USB. Optionally an ILI9341 TFT display for standalone operation.
- **USB**: USB-to-serial converter (typically CP2102 or CH340) on the ESP32 dev board. Drivers included in Kali kernel.

### Verdict

**COMPATIBLE** - The RPi5 is fully capable of serving as the build, flash, and serial control host for ESP32 Marauder. Docker provides a clean, reproducible Arduino CLI build environment without polluting the host system. After flashing, the ESP32 operates independently or under serial command from Argos. This is a top-10 priority integration target for Argos due to its multi-attack capability, compact form factor, and serial controllability.

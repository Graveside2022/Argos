# M5Stack WiFi Toolkit

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> ESP32-based modular attack platform enabling WiFi deauthentication, captive portal attacks, packet monitoring, and credential harvesting in a battery-powered handheld form factor. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — firmware executes on M5Stack ESP32 hardware, RPi 5 is the build and flash host

| Method               | Supported | Notes                                                                      |
| -------------------- | --------- | -------------------------------------------------------------------------- |
| **Docker Container** | YES       | Arduino CLI (Nemo) and PlatformIO (Bruce) cross-compilation via USB serial |
| **Native Install**   | YES       | Arduino CLI ARM64 binaries + PlatformIO via Python; esptool is pure Python |

---

## Tool Description

M5Stack WiFi Toolkit encompasses a collection of offensive security firmware projects designed for M5Stack hardware (M5StickC, M5StickC Plus, M5Stack Core, ATOM Matrix, Cardputer). Built on the ESP32 platform, these tools provide WiFi deauthentication attacks, rogue access point creation, captive portal credential harvesting, packet monitoring and sniffing, Bluetooth scanning, and network reconnaissance. The M5Stack platform's integrated LCD display, battery, buttons, and modular expansion system (HAT/GROVE) make it a self-contained portable attack device with a more polished hardware experience than raw ESP32 dev boards.

## Category

WiFi/Bluetooth Attack Hardware Platform (ESP32-based)

## Repository

https://github.com/M5Stack (various community projects):

- https://github.com/7h30th3r0n3/Evil-M5Core2 (Evil Portal / Captive Portal)
- https://github.com/marivaaldo/evil-portal-m5stack (Portal attacks)
- https://github.com/n0xa/m5stick-nemo (WiFi/BLE multi-tool)
- https://github.com/pr3y/Bruce (Multi-protocol attack firmware)

---

## Docker Compatibility Analysis

### Can it run in Docker?

**BUILD/FLASH ONLY** - The firmware executes on the M5Stack's ESP32 microcontroller, not on the host. Docker on the RPi5 provides the build toolchains: Arduino CLI (for m5stick-nemo) and PlatformIO (for Bruce). Compiled firmware is flashed to the M5Stack device over USB serial. Runtime operation is entirely on the M5Stack hardware.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or `/dev/ttyACM0`) - USB serial passthrough for flashing and serial communication
- No `--privileged` required for serial-only operations
- No `--net=host` required
- Host kernel modules: `cp210x` or `ch341` (USB-to-serial drivers for M5Stack FTDI/CH9102 chips, loaded by default on Kali)
- `udev` rules for non-root serial access: add user to `dialout` group

### Docker-to-Host Communication

- USB serial device passthrough for firmware flashing and post-flash serial monitoring
- Volume mount for build artifacts: `-v /host/builds:/builds`
- Some M5Stack firmware variants expose a WiFi configuration portal; these run on the M5Stack's own WiFi radio, not the host
- No persistent host-side services required

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile (Arduino CLI + PlatformIO Build Environment)

```dockerfile
FROM python:3.11-slim-bookworm

ARG ARDUINO_CLI_VERSION=0.35.3

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    screen \
    minicom \
    && rm -rf /var/lib/apt/lists/*

# Install Arduino CLI (ARM64) — needed for m5stick-nemo
RUN wget -qO- https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz \
    | tar xz -C /usr/local/bin/

# Configure Arduino CLI with M5Stack board support (for Nemo)
RUN arduino-cli config init && \
    arduino-cli core update-index && \
    arduino-cli core install m5stack:esp32 \
    --additional-urls "https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/arduino/package_m5stack_index.json"

# Install PlatformIO (for Bruce) and esptool
RUN pip install --no-cache-dir platformio esptool pyserial

# Clone key M5Stack attack firmware repositories
RUN mkdir -p /opt/m5stack && \
    cd /opt/m5stack && \
    git clone https://github.com/n0xa/m5stick-nemo.git && \
    git clone https://github.com/7h30th3r0n3/Evil-M5Core2.git && \
    git clone https://github.com/pr3y/Bruce.git

WORKDIR /opt/m5stack

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/m5stack-toolkit .

# Identify M5Stack serial device
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Enter the build environment
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  -v $(pwd)/m5stack-builds:/builds \
  argos/m5stack-toolkit

# Inside the container: compile M5Stick-Nemo (Arduino CLI)
# cd /opt/m5stack/m5stick-nemo
# arduino-cli compile --fqbn m5stack:esp32:m5stick-c-plus m5stick-nemo.ino
# arduino-cli upload --fqbn m5stack:esp32:m5stick-c-plus \
#   --port /dev/ttyUSB0 m5stick-nemo.ino

# Inside the container: compile Bruce (PlatformIO)
# cd /opt/m5stack/Bruce
# pio run -e m5stack-cardputer
# pio run -e m5stack-cardputer -t upload --upload-port /dev/ttyUSB0
```

### Alternative: Direct esptool Flashing

```bash
# For pre-compiled firmware binaries, flash directly with esptool
# esptool.py --chip esp32 --port /dev/ttyUSB0 \
#   --baud 921600 write_flash -z 0x10000 firmware.bin
```

### Serial Monitoring

```bash
# Monitor serial output from M5Stack device
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  argos/m5stack-toolkit \
  screen /dev/ttyUSB0 115200

# Host-side alternative
screen /dev/ttyUSB0 115200
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Arduino CLI provides official ARM64 binaries (for Nemo). PlatformIO runs on ARM64 via Python (for Bruce). The ESP32 cross-compilation toolchain (xtensa-esp32-elf-gcc) is downloaded automatically by both tools for ARM64 hosts.

### Hardware Constraints

- **CPU**: Compilation is moderately CPU-intensive. Build times of 3-8 minutes per firmware are typical on the RPi5's 4x Cortex-A76 cores.
- **RAM**: Build process uses approximately 1-2GB RAM. Well within the 8GB available.
- **Storage**: Arduino CLI + PlatformIO with ESP32 platforms plus firmware sources requires approximately 4-5GB of disk space.
- **Hardware**: Requires one or more M5Stack devices connected via USB:
    - M5StickC / M5StickC Plus (~$20-25) - compact attack platform
    - M5Stack Core / Core2 (~$40-50) - larger display, more GPIO
    - M5Cardputer (~$30) - keyboard-equipped variant
    - ATOM Matrix/Lite (~$10-15) - minimal form factor
- **USB**: USB-to-serial chips vary by M5Stack model (FTDI, CH9102, CP2104). All drivers included in Kali kernel.

### Verdict

**COMPATIBLE** - The RPi5 is fully capable of compiling and flashing M5Stack attack firmware. Docker provides a clean build environment with both Arduino CLI (for Nemo) and PlatformIO (for Bruce). The M5Stack platform offers similar capabilities to ESP32 Marauder with the advantage of integrated displays, batteries, and input buttons for standalone field operation. Integration with Argos follows the same serial-control pattern as ESP32 Marauder. Multiple firmware variants (Nemo, Bruce, Evil-M5Core2) provide different attack profiles for different M5Stack hardware models.

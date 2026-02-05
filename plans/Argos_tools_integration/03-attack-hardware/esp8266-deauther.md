# ESP8266 Deauther

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Dedicated WiFi deauthentication attack device capable of disconnecting any client from any WiFi network within range, plus beacon flood and probe request spam attacks. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — firmware executes on ESP8266 hardware, RPi 5 is the build and flash host

| Method               | Supported | Notes                                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| **Docker Container** | YES       | Arduino CLI cross-compilation and esptool flashing via USB serial passthrough |
| **Native Install**   | YES       | Arduino CLI ARM64 binaries available; very lightweight build                  |

---

## Tool Description

ESP8266 Deauther is a firmware for the ESP8266 microcontroller that exploits the IEEE 802.11 management frame vulnerability to perform WiFi deauthentication attacks, beacon flooding, and probe request spamming. The deauth attack sends forged disassociation/deauthentication frames to disconnect targeted clients from their access points. Beacon flood creates hundreds of fake WiFi networks visible to nearby devices. Probe spam sends fake probe responses to confuse client device WiFi scanning. The firmware includes a built-in web interface accessible over the ESP8266's own WiFi AP for configuration and attack control, and also supports serial CLI and an optional OLED display. At approximately $3 per unit for a bare ESP8266 board, it is one of the cheapest WiFi attack tools available.

## Category

WiFi Deauthentication / Beacon Flood / Denial of Service

## Repository

https://github.com/SpacehuhnTech/esp8266_deauther

---

## Docker Compatibility Analysis

### Can it run in Docker?

**BUILD/FLASH ONLY** - The Deauther firmware runs on the ESP8266 microcontroller, not on the host system. Docker on the RPi5 provides the Arduino build environment for compiling the firmware, which is then flashed to the ESP8266 over USB serial. All WiFi attacks execute on the ESP8266's Espressif WiFi radio using raw 802.11 frame injection capabilities built into the ESP8266 SDK. The host system cannot replicate this functionality because standard WiFi adapters do not permit the same level of raw frame injection that the ESP8266 SDK provides.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or `/dev/ttyACM0`) - USB serial passthrough for flashing and serial CLI control
- No `--privileged` required for serial-only access
- No `--net=host` required
- Host kernel modules: `ch341` or `cp210x` (USB-to-serial drivers, loaded by default on Kali)
- `udev` rules for non-root serial access: add user to `dialout` group

### Docker-to-Host Communication

- USB serial device passthrough for firmware flashing and optional serial CLI control
- Volume mount for build output: `-v /host/builds:/builds`
- After flashing, the ESP8266 Deauther creates its own WiFi AP (default SSID: `pwned`, password: `deauther`) for web interface access. This AP is broadcast from the ESP8266's radio, not the host
- No persistent host-side services required

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ARG ARDUINO_CLI_VERSION=0.35.3
ARG DEAUTHER_VERSION=v3

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    screen \
    minicom \
    && rm -rf /var/lib/apt/lists/*

# Install Arduino CLI (ARM64)
RUN wget -qO- https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz \
    | tar xz -C /usr/local/bin/

# Configure Arduino CLI with ESP8266 board support
RUN arduino-cli config init && \
    arduino-cli config add board_manager.additional_urls \
    https://arduino.esp8266.com/stable/package_esp8266com_index.json && \
    arduino-cli core update-index && \
    arduino-cli core install esp8266:esp8266

# Install esptool for direct flashing
RUN pip install --no-cache-dir esptool pyserial

# Clone ESP8266 Deauther source
RUN cd /opt && \
    git clone --branch ${DEAUTHER_VERSION} \
    https://github.com/SpacehuhnTech/esp8266_deauther.git

WORKDIR /opt/esp8266_deauther

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/esp8266-deauther .

# Identify ESP8266 serial device
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Enter the build environment
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  -v $(pwd)/deauther-builds:/builds \
  argos/esp8266-deauther

# Inside the container: compile for NodeMCU (most common ESP8266 board)
# arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 \
#   esp8266_deauther.ino

# Upload to ESP8266
# arduino-cli upload --fqbn esp8266:esp8266:nodemcuv2 \
#   --port /dev/ttyUSB0 \
#   esp8266_deauther.ino

# For other ESP8266 boards, use appropriate FQBN:
#   esp8266:esp8266:d1_mini       - Wemos D1 Mini
#   esp8266:esp8266:d1_mini_pro   - Wemos D1 Mini Pro
#   esp8266:esp8266:generic       - Generic ESP8266
```

### Alternative: Flash Pre-built Binary

```bash
# Download pre-compiled binary from GitHub releases
# and flash directly with esptool (faster than compiling)
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  -v $(pwd)/deauther-builds:/builds \
  argos/esp8266-deauther \
  bash -c "
    wget -O /builds/deauther.bin \
      https://github.com/SpacehuhnTech/esp8266_deauther/releases/latest/download/esp8266_deauther_nodemcu.bin && \
    esptool.py --chip esp8266 --port /dev/ttyUSB0 \
      --baud 921600 write_flash -fm dio 0x00000 /builds/deauther.bin
  "
```

### Serial CLI Control

```bash
# Connect to Deauther serial CLI
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  argos/esp8266-deauther \
  screen /dev/ttyUSB0 115200

# Host-side alternative
screen /dev/ttyUSB0 115200

# Deauther serial CLI commands:
#   scan -m ap         - Scan for access points
#   scan -m st         - Scan for stations (clients)
#   select -a <id>     - Select target AP
#   select -s <id>     - Select target station
#   attack -m deauth   - Start deauthentication attack
#   attack -m beacon   - Start beacon flood
#   attack -m probe    - Start probe spam
#   stop               - Stop all attacks
#   show selected      - Show currently selected targets
```

### Web Interface Access (After Flashing)

```bash
# After flashing, the ESP8266 creates its own WiFi AP:
#   SSID: "pwned" (default, configurable)
#   Password: "deauther" (default, configurable)
#
# Connect to the AP from any device and navigate to:
#   http://192.168.4.1
#
# The web interface provides:
#   - Network scanner (APs and clients)
#   - Target selection
#   - Attack controls (deauth, beacon, probe)
#   - Settings configuration
#   - Packet monitoring
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Arduino CLI provides official ARM64 binaries. The ESP8266 cross-compilation toolchain (xtensa-lx106-elf-gcc) is available for ARM64 hosts via the Arduino board manager. The Deauther project compiles without architecture-specific modifications on ARM64.

### Hardware Constraints

- **CPU**: ESP8266 firmware compilation is very lightweight. Build completes in under 1 minute on the RPi5's 4x Cortex-A76 cores.
- **RAM**: Build process uses under 500MB RAM. Well within the 8GB available.
- **Storage**: Arduino CLI with ESP8266 core requires approximately 1-1.5GB of disk space.
- **Hardware**: Requires an ESP8266 development board. Supported and tested boards include:
    - NodeMCU v2/v3 (~$3) - most common, built-in USB
    - Wemos D1 Mini (~$3) - compact form factor
    - Generic ESP-12F module (~$2) - requires external USB-serial adapter
    - Optional: SSD1306 OLED display (~$3) for standalone status display
- **USB**: CH340 or CP2102 USB-to-serial, drivers included in Kali kernel.
- **Total cost**: $3-6 per complete deauther unit.

### Verdict

**COMPATIBLE** - The RPi5 handles ESP8266 Deauther compilation and flashing with trivial resource usage. Docker provides a clean Arduino build environment. After flashing, the ESP8266 operates independently with its own web interface and WiFi AP, or can be controlled via serial CLI from the RPi5. Integration with Argos is HIGH: the serial CLI can be automated from Argos via Node.js serialport to trigger targeted deauthentication attacks against networks identified through Argos reconnaissance. The extremely low per-unit cost ($3) makes it practical to deploy multiple deauther devices for coordinated multi-channel attacks.

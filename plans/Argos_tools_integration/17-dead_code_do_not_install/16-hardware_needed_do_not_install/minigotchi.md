# Minigotchi

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: MODERATE RISK
> Pwnagotchi companion device on ESP8266/ESP32 that performs WiFi deauthentication attacks to assist Pwnagotchi handshake capture. Smaller scope than full attack suites. Military education/training toolkit - Not for public release.

> **NOTE: ESP8266 ONLY** - This project targets ESP8266 hardware only. The ESP32 version is in a separate repository (minigotchi-ESP32).

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — firmware executes on ESP8266/ESP32 hardware, RPi 5 is the build and flash host

| Method               | Supported | Notes                                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------------- |
| **Docker Container** | YES       | Arduino CLI cross-compilation and esptool flashing via USB serial passthrough |
| **Native Install**   | YES       | Arduino CLI ARM64 binaries available; lightweight build                       |

---

## Tool Description

Minigotchi is a lightweight companion device for Pwnagotchi, running on ESP8266 or ESP32 microcontrollers. Its primary function is to perform targeted WiFi deauthentication attacks against clients on nearby networks, forcing them to disconnect and re-authenticate, which in turn helps a co-located Pwnagotchi capture the resulting WPA/WPA2 handshakes. Minigotchi also implements the Pwnagotchi mesh protocol (pwngrid), allowing it to appear as a peer on the Pwnagotchi network and coordinate with nearby Pwnagotchi devices. It features a small OLED or TFT display for status and a simple mood system inspired by Pwnagotchi's Tamagotchi-style interface.

## Category

WiFi Deauthentication / Pwnagotchi Companion Device

## Repository

https://github.com/dj1ch/minigotchi

---

## Docker Compatibility Analysis

### Can it run in Docker?

**BUILD/FLASH ONLY** - Minigotchi firmware runs on ESP8266 or ESP32 hardware, not on the host system. Docker on the RPi5 provides the Arduino IDE or PlatformIO build environment for compiling the firmware, which is then flashed to the target microcontroller over USB serial. All runtime WiFi operations (deauthentication, channel hopping, mesh networking) execute on the ESP hardware's WiFi radio.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or `/dev/ttyACM0`) - USB serial passthrough for flashing and serial monitoring
- No `--privileged` required for serial-only access
- No `--net=host` required
- Host kernel modules: `cp210x`, `ch341`, or `ftdi_sio` (USB-to-serial drivers, loaded by default on Kali)

### Docker-to-Host Communication

- USB serial device passthrough for firmware flashing via esptool or Arduino CLI
- Volume mount for configuration files and build output: `-v /host/builds:/builds`
- After flashing, the device operates autonomously; serial connection is optional for monitoring
- No host-side daemon or network service required

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

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

# Install Arduino CLI (ARM64)
RUN wget -qO- https://downloads.arduino.cc/arduino-cli/arduino-cli_${ARDUINO_CLI_VERSION}_Linux_ARM64.tar.gz \
    | tar xz -C /usr/local/bin/

# Configure Arduino CLI with ESP8266 and ESP32 board support
RUN arduino-cli config init && \
    arduino-cli config add board_manager.additional_urls \
    https://arduino.esp8266.com/stable/package_esp8266com_index.json \
    https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json && \
    arduino-cli core update-index && \
    arduino-cli core install esp8266:esp8266 && \
    arduino-cli core install esp32:esp32

# Install required Arduino libraries
RUN arduino-cli lib install \
    "Adafruit SSD1306" \
    "Adafruit GFX Library" \
    "ArduinoJson"

# Install esptool for direct flashing
RUN pip install --no-cache-dir esptool pyserial

# Clone Minigotchi source
RUN cd /opt && \
    git clone --recursive https://github.com/dj1ch/minigotchi.git

WORKDIR /opt/minigotchi

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/minigotchi .

# Identify the ESP device serial port
ls -la /dev/ttyUSB* /dev/ttyACM* 2>/dev/null

# Enter the build environment
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  -v $(pwd)/minigotchi-builds:/builds \
  argos/minigotchi

# Inside the container: configure before building
# Edit minigotchi/config.h to set:
#   - WiFi whitelist (networks to skip)
#   - Display type (SSD1306 OLED, ST7789 TFT, or none)
#   - Channel hopping parameters
#   - Pwnagotchi mesh (pwngrid) settings

# Compile for ESP8266 (e.g., NodeMCU / Wemos D1 Mini)
# arduino-cli compile --fqbn esp8266:esp8266:nodemcuv2 \
#   minigotchi/minigotchi.ino

# Upload to ESP8266
# arduino-cli upload --fqbn esp8266:esp8266:nodemcuv2 \
#   --port /dev/ttyUSB0 \
#   minigotchi/minigotchi.ino

# Compile for ESP32 (alternative target)
# arduino-cli compile --fqbn esp32:esp32:esp32 \
#   minigotchi/minigotchi.ino

# Upload to ESP32
# arduino-cli upload --fqbn esp32:esp32:esp32 \
#   --port /dev/ttyUSB0 \
#   minigotchi/minigotchi.ino
```

### Serial Monitoring

```bash
# Monitor Minigotchi serial output (debug and status messages)
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  argos/minigotchi \
  screen /dev/ttyUSB0 115200

# Host-side alternative
screen /dev/ttyUSB0 115200
```

### Configuration Customization

```bash
# Key configuration parameters in minigotchi/config.h:
#
# WHITELIST: SSIDs to never attack
# DEAUTH_FRAMES: Number of deauth frames per burst (default: 15)
# CHANNEL_DELAY: Dwell time per channel in ms (default: 1000)
# DISPLAY_TYPE: 0=none, 1=SSD1306, 2=ST7789
# PWNGRID_ENABLED: Enable Pwnagotchi mesh discovery
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Arduino CLI provides official ARM64 binaries. The ESP8266 and ESP32 cross-compilation toolchains (xtensa-lx106-elf-gcc and xtensa-esp32-elf-gcc respectively) are available for ARM64 hosts via the Arduino board manager. The Minigotchi project is standard Arduino C++ and compiles without architecture-specific modifications.

### Hardware Constraints

- **CPU**: Compilation is lightweight. ESP8266 firmware builds complete in under 2 minutes on the RPi5. ESP32 builds take slightly longer (2-4 minutes).
- **RAM**: Build process uses under 1GB RAM. Well within the 8GB available.
- **Storage**: Arduino CLI with both ESP8266 and ESP32 cores requires approximately 2-3GB of disk space.
- **Hardware**: Requires an ESP8266 (~$3-5 for a Wemos D1 Mini or NodeMCU) or ESP32 (~$5-10 for a basic dev board). Optional: SSD1306 OLED display (~$3) for status display. Total hardware cost under $10 for the most basic configuration.
- **USB**: Standard USB-to-serial (CH340/CP2102), drivers included in Kali kernel.

### Verdict

**COMPATIBLE** - The RPi5 is well-suited as a build and flash host for Minigotchi. The project is lightweight and compiles quickly even on ARM64. Docker provides a clean Arduino build environment. After flashing, the Minigotchi operates autonomously alongside a Pwnagotchi to enhance handshake capture rates. Integration with Argos is MEDIUM priority: the device could be coordinated with Argos for targeted deauthentication of specific networks identified by Argos reconnaissance, and serial output could be parsed for status monitoring. The extremely low hardware cost ($3-10) makes it practical to deploy multiple Minigotchi devices in a mesh.

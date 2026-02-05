# ESP32 WiFi Drone Disabler

> **HIGH RISK - SENSITIVE SOFTWARE**
> Sends targeted WiFi deauthentication frames to disconnect drones from their controllers. Disrupts drone control links causing loss of control or forced RTH (Return to Home). Affects all WiFi devices in target channel range. Illegal under CFAA and FCC regulations without authorization.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — Attack runs on standalone ESP32 hardware

| Method               | Supported | Notes                                                    |
| -------------------- | --------- | -------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Build toolchain + flash via USB serial only              |
| **Native Install**   | PARTIAL   | Same — RPi 5 compiles and flashes; ESP32 runs the attack |

---

## Description

ESP32-based firmware that performs targeted WiFi deauthentication attacks against DJI Mini/Mavic Air and other WiFi-controlled drones. Automatically identifies drone BSSIDs by MAC prefix, tracks them across channels, and sends continuous deauth frames to sever the controller-to-drone WiFi link. Battery-powered and portable. The RPi/Docker role is limited to compiling and flashing the ESP32 firmware and optionally controlling the device via serial API.

## Category

WiFi Deauthentication / Drone Disruption / ESP32 Firmware

## Source

- **Repository**: Various ESP32 deauth projects (e.g., https://github.com/tesa-klebeband/ESP32-Deauther, https://github.com/PicoShot/ESP32-Deauther)
- **Status**: WORKING / EXPERIMENTAL
- **Language**: C/C++ (Arduino framework)
- **Dependencies**: PlatformIO (Arduino framework), esptool.py (for flashing)

## Docker Compatibility

| Attribute                | Value                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| Docker Compatible        | Partial (build/flash environment only)                            |
| ARM64 (aarch64) Support  | Yes (PlatformIO runs on ARM64)                                    |
| Base Image               | python:3.11-slim-bookworm                                         |
| Privileged Mode Required | Yes (USB serial access for flashing)                              |
| Host Network Required    | No                                                                |
| USB Device Passthrough   | ESP32 dev board via USB serial (`/dev/ttyUSB0` or `/dev/ttyACM0`) |
| Host Kernel Modules      | cp210x or ch341 (USB-to-serial drivers for ESP32 boards)          |

### Docker-to-Host Communication

- **Build phase**: No host communication needed. Docker compiles the firmware.
- **Flash phase**: ESP32 connected via USB serial must be passed through to container. Host needs USB serial drivers loaded (`cp210x`, `ch341`).
- **Runtime**: The ESP32 runs independently once flashed. Docker is not involved in runtime operation. Optionally, a serial monitor from Docker can send commands to ESP32 via `/dev/ttyUSB0`.

**Important**: The ESP32 is a standalone device. Docker only provides the build toolchain and flashing capability. The actual deauth attack runs on the ESP32 hardware, not inside Docker.

## Install Instructions (Docker)

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PlatformIO (Arduino framework)
RUN pip install --no-cache-dir platformio esptool pyserial

# Clone ESP32 deauther project
RUN git clone https://github.com/tesa-klebeband/ESP32-Deauther.git /opt/esp32-deauther

WORKDIR /opt/esp32-deauther

# Build is done via PlatformIO
CMD ["/bin/bash", "-c", "pio run && echo 'Build complete. Flash with: pio run -t upload'"]
```

```bash
# Build
docker build -t esp32-deauther-build .

# Compile firmware
docker run -it --rm esp32-deauther-build

# Flash to ESP32 (connect ESP32 via USB first)
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  esp32-deauther-build \
  pio run -t upload --upload-port /dev/ttyUSB0

# Serial monitor (optional, for control commands)
docker run -it --rm \
  --device=/dev/ttyUSB0:/dev/ttyUSB0 \
  esp32-deauther-build \
  pio device monitor --port /dev/ttyUSB0
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Partial (build + flash only; attack runs on ESP32 hardware)                                                                                                         |
| Architecture     | aarch64 for build toolchain; ESP32 is Xtensa/RISC-V (cross-compiled)                                                                                                |
| RAM Requirement  | ~512MB (PlatformIO compilation)                                                                                                                                     |
| Limiting Factors | Requires separate ESP32 hardware (~$5-10). RPi5 is only the build/flash host. PlatformIO supports ARM64. Compile times are longer on ARM64 than x86 but functional. |

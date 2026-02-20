# BLE CTF Framework

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: LOW RISK
> BLE security training platform providing intentionally vulnerable GATT services for hands-on practice; educational tool with no offensive capability against production devices. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — ESP-IDF firmware for ESP32; RPi 5 is the build host; CTF runs on ESP32 hardware

| Method               | Supported | Notes                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| **Docker Container** | YES       | ESP-IDF build environment + esptool flashing via USB serial passthrough |
| **Native Install**   | YES       | ESP-IDF toolchain on Kali ARM64; firmware builds and flashes to ESP32   |

---

## Tool Description

BLE CTF Infinity is a Bluetooth Low Energy capture-the-flag training framework that deploys intentionally vulnerable GATT services on ESP32 hardware for hands-on BLE security practice. It provides a series of progressive challenges covering BLE fundamentals including device discovery, GATT enumeration, characteristic read/write operations, authentication bypass, notification handling, and protocol-level attacks. The firmware is built with ESP-IDF (v3.3.1) and flashed to an ESP32 DevKit board, which then runs the vulnerable GATT server autonomously. Trainees use separate BLE tools (gatttool, bluetoothctl, or custom scripts) to interact with and exploit the CTF challenges.

## Category

BLE Security Training / CTF Platform

## Repository

https://github.com/hackgnar/ble_ctf_infinity

---

## Docker Compatibility Analysis

### Can it run in Docker?

**BUILD/FLASH ONLY** - Docker provides the ESP-IDF build environment for compiling and flashing the CTF firmware to ESP32 hardware. After flashing, the ESP32 runs the vulnerable GATT server autonomously. There is no host-side software component — the CTF is entirely firmware-based.

### Host OS-Level Requirements

- `--device=/dev/ttyUSB0` (or `/dev/ttyACM0`) - USB serial passthrough for ESP32 board
- `--privileged` - Required for USB serial access during firmware flashing
- Host kernel modules: `cp210x` or `ch341` for ESP32 USB-UART bridge
- No `--net=host` required (communication is via USB serial for flashing only)

### Docker-to-Host Communication

- ESP32 board must be connected to host USB for firmware flashing
- After flashing, the ESP32 operates autonomously as a BLE GATT server
- No persistent host-side services required
- Trainees interact with the CTF using BLE tools on the RPi 5 (gatttool, bluetoothctl, etc.)

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile (ESP-IDF build environment)

> **NOTE**: The official Dockerfile uses `espressif/idf:v3.3.1`. This project uses the older make-based ESP-IDF build system, not the newer `idf.py` CMake build.

```dockerfile
FROM espressif/idf:v3.3.1

RUN apt-get update && apt-get install -y \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 \
    https://github.com/hackgnar/ble_ctf_infinity.git /opt/ble_ctf

WORKDIR /opt/ble_ctf

ENTRYPOINT ["bash"]
```

> **WARNING**: The `espressif/idf:v3.3.1` image may not have ARM64 support. On RPi 5, you may need to use a newer ESP-IDF version and adapt the build, or use QEMU emulation for the x86_64 IDF image.

### Build and Flash

```bash
# Build the Docker image
docker build -t argos/ble-ctf .

# Build the CTF firmware (old-style make build)
docker run --rm -it \
  -v $(pwd)/ble-ctf-build:/opt/ble_ctf/build \
  argos/ble-ctf -c "make -j$(nproc)"

# Flash firmware to ESP32
docker run --rm -it \
  --privileged \
  --device=/dev/ttyUSB0 \
  argos/ble-ctf -c "make flash ESPPORT=/dev/ttyUSB0"

# Monitor serial output (optional, for debugging)
docker run --rm -it \
  --privileged \
  --device=/dev/ttyUSB0 \
  argos/ble-ctf -c "make monitor ESPPORT=/dev/ttyUSB0"
```

### Interacting with CTF Challenges (from RPi 5)

```bash
# After flashing, the ESP32 advertises as a BLE GATT server
# Use standard BLE tools on the RPi 5 to solve challenges:

# Scan for the CTF device
sudo hcitool lescan

# Connect with gatttool
gatttool -b <CTF_DEVICE_ADDR> -I
# > connect
# > primary
# > char-read-hnd 0x002a

# Or use bluetoothctl
bluetoothctl
# > scan on
# > connect <CTF_DEVICE_ADDR>
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 WITH CAVEATS** - BLE CTF Infinity uses ESP-IDF v3.3.1 (2019-era), which predates official ARM64 Docker image support from Espressif. A newer ESP-IDF version may be needed for ARM64 builds, or QEMU user-mode emulation can run the x86_64 IDF container. The ESP32 firmware itself is architecture-independent (runs on ESP32 Xtensa core). BLE interaction tools (gatttool, bluetoothctl) run natively on ARM64.

### Hardware Constraints

- CPU: Minimal CPU requirements for running GATT services or challenge validation; Cortex-A76 is vastly overpowered
- RAM: Lightweight (~50-100MB for CTF server); well within 8GB
- Hardware: Requires an ESP32 DevKit board (ESP-WROOM-32 or similar) — the CTF firmware runs entirely on the ESP32
- The RPi 5 serves dual roles: build/flash host for the CTF firmware, and attacker platform using the onboard Bluetooth adapter or an external USB adapter to solve challenges

### Verdict

**COMPATIBLE (ESP32 REQUIRED)** - BLE CTF Infinity requires an ESP32 DevKit board for the vulnerable GATT server. The RPi 5 builds/flashes the firmware and serves as the attacker platform. ESP-IDF v3.3.1 ARM64 compatibility is uncertain; a newer IDF version or QEMU emulation may be needed for the build step. Excellent training tool for BLE security fundamentals.

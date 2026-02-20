# Flipper Zero Unleashed Firmware

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Extended Flipper Zero firmware with unlocked Sub-GHz TX frequencies, enabling transmission on restricted bands (315/433/868/915 MHz) for replay attacks, brute-forcing, and signal jamming. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: BUILD/FLASH ONLY** — firmware executes on Flipper Zero STM32WB55, RPi 5 is the build and flash host

| Method               | Supported | Notes                                                          |
| -------------------- | --------- | -------------------------------------------------------------- |
| **Docker Container** | YES       | ARM GCC cross-compilation and DFU flashing via USB passthrough |
| **Native Install**   | YES       | gcc-arm-none-eabi available in Kali ARM64 repos                |

---

## Tool Description

Flipper Zero Unleashed is a community-developed custom firmware for the Flipper Zero multi-tool that removes Sub-GHz transmission frequency restrictions, enabling operation on bands blocked in the stock firmware. It provides full Sub-GHz replay and brute-force attacks, NFC/RFID emulation and cloning, infrared learning and transmission, BadUSB HID attacks, iButton emulation, and GPIO-based hardware interfacing. The firmware extends the stock capabilities with additional protocols, custom applications, and unrestricted frequency access while maintaining the same hardware platform.

## Category

Multi-Protocol Radio Attack Hardware Firmware (Sub-GHz / NFC / RFID / IR / BadUSB)

## Repository

https://github.com/DarkFlippers/unleashed-firmware

---

## Docker Compatibility Analysis

### Can it run in Docker?

**BUILD ONLY** - The Unleashed firmware executes on the Flipper Zero hardware (STM32WB55 microcontroller), not on the host system. Docker on the RPi5 provides a clean cross-compilation environment using the ARM GCC toolchain. The compiled firmware (.dfu file) is then flashed to the Flipper Zero over USB. Post-flash interaction occurs via USB serial CLI or the Flipper Zero's own interface.

### Host OS-Level Requirements

- `--device=/dev/ttyACM0` - USB serial passthrough for flashing and CLI control of Flipper Zero
- No `--privileged` required for serial-only access (targeted `--device` passthrough is sufficient)
- No `--net=host` required
- Host kernel modules: `cdc_acm` (USB CDC serial driver, loaded by default on Kali)
- DFU flashing alternative: `--device=/dev/bus/usb` for USB DFU mode access (may require `--privileged`)

### Docker-to-Host Communication

- USB device passthrough for firmware flashing via DFU or serial
- Volume mount for build artifacts: `-v /host/builds:/builds`
- After flashing, Flipper Zero CLI is accessible over serial (`/dev/ttyACM0`) at 230400 baud
- No persistent host-side daemon required

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

ARG UNLEASHED_VERSION=latest

# Install build dependencies and ARM GCC cross-compiler
RUN apt-get update && apt-get install -y \
    git \
    make \
    cmake \
    python3 \
    python3-pip \
    python3-venv \
    gcc-arm-none-eabi \
    libnewlib-arm-none-eabi \
    libstdc++-arm-none-eabi-newlib \
    binutils-arm-none-eabi \
    dfu-util \
    openocd \
    wget \
    unzip \
    screen \
    minicom \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for Flipper build system
RUN pip3 install --no-cache-dir --break-system-packages \
    heatshrink2 \
    pillow \
    protobuf \
    grpcio-tools \
    flipper-zero-protobuf

# Clone Unleashed firmware source
RUN cd /opt && \
    git clone --recursive https://github.com/DarkFlippers/unleashed-firmware.git

WORKDIR /opt/unleashed-firmware

ENTRYPOINT ["/bin/bash"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/flipper-unleashed .

# Enter the build environment (interactive)
docker run -it --rm \
  --device=/dev/ttyACM0:/dev/ttyACM0 \
  -v $(pwd)/flipper-builds:/builds \
  argos/flipper-unleashed

# Inside the container: compile firmware
# cd /opt/unleashed-firmware
# ./fbt updater_package
# cp dist/f7-U/flipper-z-f7-update-*.tgz /builds/

# Flash via USB DFU (Flipper must be in DFU mode: hold BACK + LEFT on boot)
# ./fbt flash_usb
```

### Alternative: Pre-built Firmware Flashing

```bash
# Download pre-built release and flash via qFlipper CLI or DFU
docker run -it --rm \
  --device=/dev/bus/usb:/dev/bus/usb \
  --privileged \
  argos/flipper-unleashed \
  bash -c "dfu-util -a 0 -D /builds/flipper-z-f7-full-*.dfu"
```

### Serial CLI Control After Flashing

```bash
# Connect to Flipper Zero CLI over USB serial
docker run -it --rm \
  --device=/dev/ttyACM0:/dev/ttyACM0 \
  argos/flipper-unleashed \
  screen /dev/ttyACM0 230400

# Alternative: direct host-side CLI (no Docker needed)
screen /dev/ttyACM0 230400

# Flipper CLI commands for Argos integration:
#   subghz tx <frequency> <modulation>  - Transmit Sub-GHz signal
#   subghz rx <frequency>               - Receive Sub-GHz signal
#   nfc detect                          - Detect NFC tags
#   rfid read                           - Read RFID tags
#   ir tx <signal>                      - Transmit infrared
#   gpio set <pin> <value>              - Control GPIO pins
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - The `gcc-arm-none-eabi` cross-compiler is available as a pre-built ARM64 package in Debian/Kali repositories. The Flipper build system (`fbt` - Flipper Build Tool) is Python-based and architecture-independent. Cross-compilation targets the STM32WB55 (ARM Cortex-M4), which is independent of the host architecture.

### Hardware Constraints

- **CPU**: Firmware compilation is moderately demanding. A full build takes approximately 10-15 minutes on the RPi5's 4x Cortex-A76 cores. Incremental builds are significantly faster.
- **RAM**: Build process peaks at approximately 1-1.5GB RAM. Well within the 8GB available.
- **Storage**: Full source tree with submodules requires approximately 2-3GB of disk space.
- **Hardware**: Requires a Flipper Zero device (~$170) connected via USB-C. The device appears as `/dev/ttyACM0` for CLI access or enters DFU mode for firmware flashing.
- **USB**: Standard USB CDC ACM driver, included in Kali kernel by default.

### Verdict

**COMPATIBLE** - The RPi5 is a capable build and control host for Flipper Zero Unleashed firmware. Docker provides an isolated build environment with the ARM GCC toolchain without installing cross-compilation dependencies on the host. After flashing, the Flipper Zero operates standalone or can be controlled programmatically over USB serial from Argos. Integration value is MEDIUM due to the Flipper's own user interface reducing the need for external control, but Sub-GHz TX capabilities and CLI access make it a useful complement to the Argos toolkit.

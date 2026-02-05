# Proxmark3

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> RFID/NFC cloning, sniffing, emulation, and brute force tool for access cards, hotel keys, transit cards, and secure credential systems. Enables unauthorized duplication of physical access control credentials. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Upstream project explicitly supports Raspberry Pi ARM64 builds

| Method               | Supported | Notes                                                                                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `debian:bookworm-slim` base; compiles client from source (~10-15 min on RPi 5); USB serial passthrough for Proxmark3 hardware |
| **Native Install**   | YES       | Compiles natively on ARM64 with standard toolchain; Kali repos include pre-built `proxmark3` package                          |

---

## Tool Description

Proxmark3 is the industry-standard RFID/NFC research platform supporting both 125 kHz (LF) and 13.56 MHz (HF) frequencies. Maintained by the RfidResearchGroup (Iceman fork), it provides comprehensive capabilities for cloning, sniffing, emulating, and brute-forcing RFID/NFC tags and cards including MIFARE Classic, MIFARE DESFire, HID iCLASS, EM4100, T5577, and many others. The tool interfaces via USB to the Proxmark3 hardware, which contains its own FPGA and ARM processor for real-time RF signal processing.

## Category

RFID/NFC Security Research / Card Cloning / Credential Attacks

## Repository

https://github.com/RfidResearchGroup/proxmark3

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - The Proxmark3 client application runs in Docker with USB passthrough to the Proxmark3 hardware. The client is a C application compiled from source, communicating with the Proxmark3 device over USB serial.

### Host OS-Level Requirements

- `--privileged` - Required for raw USB device access to Proxmark3 hardware
- `--device=/dev/ttyACM0` - USB serial passthrough for Proxmark3 device (or `--device=/dev/bus/usb:/dev/bus/usb` for broad USB access)
- No `--net=host` required (communicates via USB serial, not network)
- Host kernel modules: `cdc_acm` for USB serial communication (standard on Kali)
- Host udev rules recommended for non-root Proxmark3 access

### Docker-to-Host Communication

- Proxmark3 hardware must be connected to host USB and visible as `/dev/ttyACM0` (or similar)
- Host needs udev rules for Proxmark3: the repository includes `driver/77-pm3.rules`
- Captured card data and dump files via volume mount: `-v /host/pm3:/data`
- Lua scripting extensions via volume mount for custom attack scripts

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Install Proxmark3 udev rules on host
sudo bash -c 'cat > /etc/udev/rules.d/77-pm3.rules << EOF
# Proxmark3
SUBSYSTEM=="usb", ATTRS{idVendor}=="9ac4", ATTRS{idProduct}=="4b8f", MODE="0666"
SUBSYSTEM=="tty", ATTRS{idVendor}=="9ac4", ATTRS{idProduct}=="4b8f", MODE="0666"
# Proxmark3 bootloader
SUBSYSTEM=="usb", ATTRS{idVendor}=="9ac4", ATTRS{idProduct}=="4b8f", ENV{ID_MM_DEVICE_IGNORE}="1"
EOF'
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Dockerfile

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    gcc-arm-none-eabi \
    libnewlib-dev \
    libreadline-dev \
    libbz2-dev \
    libssl-dev \
    libpython3-dev \
    pkg-config \
    libjansson-dev \
    liblua5.2-dev \
    liblz4-dev \
    libusb-1.0-0-dev \
    qtbase5-dev \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/RfidResearchGroup/proxmark3.git /opt/proxmark3

WORKDIR /opt/proxmark3

# Build for generic Proxmark3 (change to PLATFORM=PM3RDPV4 for RDV4)
RUN make clean && make -j$(nproc) PLATFORM=PM3GENERIC client

RUN mkdir -p /data

ENV PATH="/opt/proxmark3/client:$PATH"

ENTRYPOINT ["proxmark3"]
CMD ["/dev/ttyACM0"]
```

### Build and Run

```bash
# Build the image (takes ~10-15 minutes on RPi 5)
docker build -t argos/proxmark3 .

# Run - connect to Proxmark3 hardware
docker run --rm -it \
  --privileged \
  --device=/dev/ttyACM0 \
  -v $(pwd)/pm3-data:/data \
  argos/proxmark3 /dev/ttyACM0

# Inside Proxmark3 client - example operations:
#
# Auto-detect card type:
# [pm3] --> auto
#
# Read HF (13.56 MHz) card UID:
# [pm3] --> hf search
#
# Read LF (125 kHz) card:
# [pm3] --> lf search
#
# Clone MIFARE Classic 1K:
# [pm3] --> hf mf autopwn
#
# Dump card to file:
# [pm3] --> hf mf dump --1k -f /data/card_dump

# Flash firmware to Proxmark3 (if needed, run on host):
# cd /opt/proxmark3
# make PLATFORM=PM3GENERIC flash-all
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE (confirmed RPi builds)** - The Proxmark3 Iceman fork explicitly supports Raspberry Pi builds and includes ARM64 compilation instructions. The client application compiles natively on aarch64 with the standard ARM toolchain. The Proxmark3 firmware itself runs on the device's own ARM processor and FPGA, independent of host architecture.

### Hardware Constraints

- CPU: Client application is lightweight; the computationally intensive RF processing runs on the Proxmark3's onboard ARM7TDMI processor and FPGA. Cortex-A76 is more than sufficient for the client interface and key cracking operations
- RAM: Client uses ~100-300MB during card attacks (MIFARE key cracking can use more during dictionary attacks); well within 8GB
- Hardware: **Requires Proxmark3 hardware** - Proxmark3 Easy (~$50), Proxmark3 RDV4 (~$300), or Proxmark3 RDV4.01. The RDV4 includes onboard battery, Bluetooth, and improved antenna. Hardware must be acquired separately
- Storage: ~500MB for compiled client and Docker image. Card dumps are small (4KB-64KB per card)

### Verdict

**COMPATIBLE** - Proxmark3 client compiles and runs natively on Kali RPi 5 ARM64, with confirmed Raspberry Pi build support from the upstream project. The Docker image provides clean isolation and reproducible builds. The only constraint is the requirement for Proxmark3 hardware ($50-$300 depending on model).

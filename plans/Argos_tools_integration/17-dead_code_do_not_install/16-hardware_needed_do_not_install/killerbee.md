# KillerBee

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Full 802.15.4/ZigBee exploitation framework capable of packet injection, key cracking, network disruption, and device impersonation. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — pure Python framework; all dependencies have ARM64 wheels or compile on aarch64

| Method               | Supported | Notes                                                              |
| -------------------- | --------- | ------------------------------------------------------------------ |
| **Docker Container** | YES       | USB passthrough for 802.15.4 radio hardware; --privileged required |
| **Native Install**   | YES       | pip install; libusb available in Kali ARM64 repos                  |

---

## Tool Description

KillerBee is the foundational 802.15.4 and ZigBee security assessment framework developed by River Loop Security (formerly by Joshua Wright). It provides a comprehensive Python library and CLI tools for capturing, injecting, replaying, and analyzing IEEE 802.15.4 and ZigBee packets. Key capabilities include network discovery (zbstumbler), packet sniffing (zbdump), key sniffing and cracking (zbgoodfind), packet injection (zbinjection), denial-of-service (zbjammer), and firmware flashing for supported hardware. It is the dependency foundation for most other ZigBee attack tools including ZigDiggity.

## Category

802.15.4/ZigBee Protocol Exploitation Framework

## Repository

https://github.com/riverloopsec/killerbee

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - KillerBee runs in Docker with USB passthrough for compatible radio hardware. All tools are Python CLI-based. No GUI or special display requirements.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for 802.15.4 radio hardware
- `--privileged` - Required for raw USB device access and radio communication
- Supported hardware must be connected before container start:
    - Atmel RZUSBstick (AT86RF230) - requires KillerBee firmware flash
    - TI CC2531 USB dongle - requires sniffer firmware
    - Sewio Open Sniffer
    - ApiMote (Apimote v4b)
- No special kernel modules; standard USB drivers handle all supported hardware

### Docker-to-Host Communication

- No network port mappings required (802.15.4 radio communication via USB hardware)
- Volume mount for packet captures: `-v /host/captures:/captures`
- PCAP files created by `zbdump` are compatible with Wireshark on the host
- Optional: Pipe live packet data to Wireshark via named pipe on shared volume

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    libusb-1.0-0-dev \
    libusb-dev \
    python3-dev \
    usbutils \
    pkg-config \
    libgcrypt20-dev \
    wireshark-common \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/riverloopsec/killerbee.git /opt/killerbee

WORKDIR /opt/killerbee
RUN pip install --no-cache-dir pyusb pyserial cryptography && \
    pip install --no-cache-dir .

VOLUME ["/captures"]
WORKDIR /captures

ENTRYPOINT ["/bin/bash"]
```

```bash
# Build
docker build -t argos/killerbee .

# Run - interactive shell with all KillerBee tools available
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/killerbee

# Run - scan for ZigBee networks (zbstumbler)
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  argos/killerbee -c "zbstumbler"

# Run - sniff ZigBee packets on channel 15 and save to PCAP
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/captures:/captures \
  argos/killerbee -c "zbdump -c 15 -w /captures/zigbee_ch15.pcap"

# Run - identify connected KillerBee-compatible hardware
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/killerbee -c "zbid"

# Run - search for ZigBee encryption keys in firmware dumps
docker run --rm --privileged \
  -v $(pwd)/captures:/captures \
  argos/killerbee -c "zbgoodfind /captures/firmware.bin"

# Run - flash RZUSBstick with KillerBee firmware
docker run --rm -it --privileged \
  --device=/dev/bus/usb \
  argos/killerbee -c "kb_flash_rzusbstick"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - KillerBee is pure Python with native ARM64 support. All Python dependencies (pyusb, pyserial, cryptography) provide ARM64 wheels or compile from source on aarch64. The `libusb` C library used for USB communication is fully supported on ARM64. No platform-specific patches needed.

### Hardware Constraints

- CPU: Lightweight - 802.15.4 operates at 250 kbps maximum data rate. Packet capture and analysis are trivial workloads for the Cortex-A76 cores
- RAM: Minimal usage (~50-100MB). Extended packet captures stored in PCAP files on disk
- **Hardware Requirement (Critical)**: At least one of the following:
    - **Atmel RZUSBstick** (ATAVRRZUSBSTICK) - Discontinued, available secondhand. Must be flashed with KillerBee firmware using `kb_flash_rzusbstick`
    - **TI CC2531** USB dongle - More readily available. Requires flashing with sniffer firmware via CC Debugger
    - **ApiMote v4b** - Purpose-built for KillerBee. Best option if available
    - **Sewio Open Sniffer** - Network-attached 802.15.4 sniffer
- Without compatible hardware, KillerBee can only perform offline analysis of previously captured PCAP files

### Verdict

**COMPATIBLE** - KillerBee is fully functional on Raspberry Pi 5. As the foundational ZigBee security framework, it should be installed before other ZigBee tools (ZigDiggity, Z3sec, Attify). The TI CC2531 dongle is the most practical hardware choice due to availability and cost. Docker deployment is clean and straightforward. The framework is actively maintained and well-documented.

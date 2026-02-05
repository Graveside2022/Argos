# RFcat / Yard Stick One

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Sub-GHz (300-928 MHz) transceiver framework enabling active RF transmission, packet sniffing, replay attacks, and protocol analysis on ISM bands used by garage doors, car fobs, alarms, and IoT devices. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python; requires Yard Stick One USB dongle (not included)

| Method               | Supported | Notes                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| **Docker Container** | YES       | `python:3.11-slim-bookworm` base; USB passthrough for Yard Stick One  |
| **Native Install**   | YES       | Pure Python with pip-installable dependencies; runs natively on ARM64 |

---

## Tool Description

RFcat is a Python-based framework for interfacing with the Yard Stick One USB transceiver (TI CC1111 chipset). It provides an interactive Python shell and scripting API for sub-GHz RF operations across 300-928 MHz, supporting packet sniffing, transmission, replay, jamming, and custom protocol analysis. RFcat enables raw access to the CC1111 radio with configurable modulation (OOK, ASK, FSK, GFSK, MSK), data rate, channel bandwidth, and power output, making it a versatile sub-GHz RF research tool.

## Category

Sub-GHz RF Transceiver / Packet Sniffing / Replay / Protocol Analysis

## Repository

https://github.com/atlas0fd00m/rfcat

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - RFcat is a Python application communicating with the Yard Stick One over USB serial. It runs cleanly in Docker with USB passthrough and requires no network access or GUI.

### Host OS-Level Requirements

- `--privileged` - Required for raw USB access to Yard Stick One
- `--device=/dev/bus/usb:/dev/bus/usb` - USB passthrough for Yard Stick One dongle
- No `--net=host` required (communicates via USB serial, not network)
- Host kernel modules: `cdc_acm` for USB serial communication with Yard Stick One (standard on Kali)
- Host package: Install udev rules for Yard Stick One device recognition

### Docker-to-Host Communication

- Yard Stick One must be connected to host USB and visible as a USB serial device
- Host needs Yard Stick One udev rules for non-root device access
- Captured data and scripts can be persisted via volume mount: `-v /host/rfcat:/data`
- No network communication required; all operations are via USB to Yard Stick One radio

---

## Install Instructions (Docker on Kali RPi 5)

### Host Preparation

```bash
# Install udev rules for Yard Stick One
sudo bash -c 'cat > /etc/udev/rules.d/20-rfcat.rules << EOF
SUBSYSTEM=="usb", ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="6048", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="6049", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="1d50", ATTRS{idProduct}=="604a", MODE="0666"
EOF'
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    git \
    libusb-1.0-0-dev \
    usbutils \
    python3-usb \
    python3-serial \
    python3-future \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/atlas0fd00m/rfcat.git /opt/rfcat

WORKDIR /opt/rfcat

RUN pip install --no-cache-dir -e . 2>/dev/null || \
    pip install --no-cache-dir pyusb pyserial future ipython numpy

RUN mkdir -p /data

ENTRYPOINT ["rfcat"]
CMD ["-r"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/rfcat .

# Run - interactive RFcat Python shell
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/rfcat-data:/data \
  argos/rfcat -r

# Run - execute an RFcat script
docker run --rm -it \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  -v $(pwd)/rfcat-data:/data \
  --entrypoint python3 \
  argos/rfcat /data/my_script.py

# Inside RFcat shell - example sniffing 433 MHz OOK:
# >>> d = RfCat()
# >>> d.setFreq(433920000)
# >>> d.setMdmModulation(MOD_ASK_OOK)
# >>> d.setMdmDRate(4800)
# >>> d.RFlisten()
#
# Example transmitting a captured packet:
# >>> d.RFxmit(b'\xaa\xbb\xcc\xdd')
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - RFcat is a pure Python package with no compiled architecture-specific components. All dependencies (pyusb, pyserial, IPython) are available for ARM64. The Yard Stick One firmware is architecture-independent (runs on the TI CC1111 microcontroller).

### Hardware Constraints

- CPU: Minimal CPU requirements; Python serial communication and packet processing are lightweight. Cortex-A76 is far more than sufficient
- RAM: Very low memory usage (~50-100MB); negligible on 8GB system
- Hardware: **Requires Yard Stick One dongle (~$100)** - not included in current Argos hardware. The Yard Stick One uses a TI CC1111 SoC providing 300-928 MHz coverage with configurable modulation. It cannot be substituted with HackRF for RFcat operations (different protocol/firmware)
- Storage: Minimal (<100MB for Python package and dependencies)

### Verdict

**COMPATIBLE** - RFcat runs natively on Kali RPi 5 ARM64 with no platform constraints. The only requirement is the Yard Stick One USB dongle hardware, which must be acquired separately (~$100). Once hardware is available, installation and operation on ARM64 is straightforward via pip or Docker.

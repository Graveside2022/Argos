# nRF Sniffer

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: LOW RISK
> Passive BLE packet capture tool for Wireshark integration using nRF52840 dongle; receive-only capability with no transmission or exploitation functions. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python extcap plugin + Wireshark/tshark; dongle firmware is architecture-independent

| Method               | Supported | Notes                                                                    |
| -------------------- | --------- | ------------------------------------------------------------------------ |
| **Docker Container** | YES       | USB passthrough for nRF52840 dongle; tshark capture to shared volume     |
| **Native Install**   | YES       | Wireshark + pyserial from Kali ARM64 repos; recommended for GUI analysis |

---

## Tool Description

nRF Sniffer for Bluetooth LE is Nordic Semiconductor's official BLE packet capture tool designed for use with the nRF52840 USB Dongle (PCA10059) or nRF52840 DK (PCA10056). It captures raw BLE link layer packets on all 40 BLE channels and feeds them directly into Wireshark via an extcap plugin, enabling real-time BLE protocol analysis with full Wireshark dissection. The sniffer supports BLE 4.x and 5.x advertisements, connection following, data channel capture, and PCAP export. It operates as a passive receiver with no transmission capability.

## Category

BLE Passive Packet Capture / Protocol Analysis

## Repository

https://www.nordicsemi.com/Products/Development-tools/nRF-Sniffer-for-Bluetooth-LE (official download)

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - The nRF Sniffer Python backend and firmware run with USB passthrough for the nRF52840 dongle. Wireshark can run on the host with the extcap plugin while the sniffer backend runs in Docker, or the entire stack can run in the container with X11 forwarding.

### Host OS-Level Requirements

- `--device=/dev/ttyACM0` (or equivalent) - USB serial passthrough for nRF52840 dongle
- `--device=/dev/bus/usb` - Alternative broad USB passthrough
- `--privileged` - Required for USB device access
- Host kernel modules: `cdc_acm` for nRF52840 USB serial interface
- No `--net=host` required for headless capture; required if serving PCAP over network

### Docker-to-Host Communication

- nRF52840 dongle must be connected to host USB and visible as `/dev/ttyACM*`
- For Wireshark integration on host: sniffer backend pipes data to Wireshark extcap interface
- Recommended approach: Run sniffer in Docker, output PCAP to shared volume, analyze with host Wireshark
- PCAP output via volume mount: `-v /host/captures:/captures`

---

## Install Instructions (Docker on Kali RPi 5)

### Firmware Flashing (run on host first)

```bash
# Flash nRF Sniffer firmware to nRF52840 dongle
# Download firmware from Nordic Semiconductor website
# Use nRF Connect for Desktop or nrfutil to flash

pip3 install nrfutil
nrfutil dfu usb-serial -pkg nrf_sniffer_for_bluetooth_le_4.1.1.zip -p /dev/ttyACM0
```

### Dockerfile

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-serial \
    wireshark-common \
    tshark \
    usbutils \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download and install nRF Sniffer extcap plugin
RUN mkdir -p /opt/nrf_sniffer

# Note: Download the sniffer package from Nordic's website
# and place it in the build context as nrf_sniffer.zip
COPY nrf_sniffer.zip /tmp/
RUN unzip /tmp/nrf_sniffer.zip -d /opt/nrf_sniffer && \
    rm /tmp/nrf_sniffer.zip

RUN python3 -m venv /opt/nrf_sniffer/venv && \
    /opt/nrf_sniffer/venv/bin/pip install --upgrade pip && \
    /opt/nrf_sniffer/venv/bin/pip install pyserial

# Install extcap plugin for tshark/Wireshark
RUN mkdir -p /root/.config/wireshark/extcap && \
    cp /opt/nrf_sniffer/extcap/* /root/.config/wireshark/extcap/ && \
    chmod +x /root/.config/wireshark/extcap/nrf_sniffer_ble.py

ENV PATH="/opt/nrf_sniffer/venv/bin:$PATH"

WORKDIR /captures

ENTRYPOINT ["bash"]
```

### Build and Run

```bash
# Download nRF Sniffer package from Nordic and place in build context
# Build the image
docker build -t argos/nrf-sniffer .

# Run - capture BLE packets to PCAP via tshark
docker run --rm -it \
  --privileged \
  --device=/dev/ttyACM0 \
  -v $(pwd)/captures:/captures \
  argos/nrf-sniffer tshark -i nrf_sniffer_ble \
    -w /captures/ble_capture.pcap

# Run - capture with display filter for specific device
docker run --rm -it \
  --privileged \
  --device=/dev/ttyACM0 \
  -v $(pwd)/captures:/captures \
  argos/nrf-sniffer tshark -i nrf_sniffer_ble \
    -f "btle.advertising_address == aa:bb:cc:dd:ee:ff" \
    -w /captures/filtered.pcap

# Run - headless capture with Python backend directly
docker run --rm -it \
  --privileged \
  --device=/dev/ttyACM0 \
  -v $(pwd)/captures:/captures \
  argos/nrf-sniffer python3 /opt/nrf_sniffer/extcap/nrf_sniffer_ble.py \
    --capture --fifo /captures/live.pcap \
    --extcap-interface /dev/ttyACM0
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - The nRF Sniffer extcap plugin is a Python script with pyserial dependency, fully compatible with ARM64. Wireshark and tshark are available in Kali ARM64 repositories. The nRF52840 dongle firmware is architecture-independent (runs on the nRF52840 Cortex-M4F, not the host).

### Hardware Constraints

- CPU: Minimal CPU requirements for serial data reception and PCAP writing; Cortex-A76 is more than sufficient
- RAM: Very lightweight (~50-100MB for tshark capture); Wireshark GUI uses ~200-400MB if running graphically
- Hardware: Requires one of:
    - nRF52840 USB Dongle (PCA10059) - recommended, compact form factor, ~$10 USD
    - nRF52840 DK (PCA10056) - development kit with onboard debugger
- Storage: Capture files can grow large depending on traffic volume; allocate accordingly

### Verdict

**COMPATIBLE** - nRF Sniffer runs on RPi 5 Kali ARM64 with the nRF52840 dongle. The Python extcap plugin and Wireshark/tshark work natively on ARM64. Ideal for passive BLE traffic analysis and protocol debugging. Low cost of entry with the nRF52840 dongle.

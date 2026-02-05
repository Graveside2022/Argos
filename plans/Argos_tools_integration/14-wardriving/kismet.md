# Kismet

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. Kismet is a passive wireless network detector and sniffer. It operates in monitor mode and does not transmit or interact with target networks. Passive monitoring may still be subject to local regulations regarding wireless interception. Use in accordance with applicable laws and authorized training environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Already deployed and operational as the primary WiFi/BT scanning engine

| Method               | Supported | Notes                                                                    |
| -------------------- | --------- | ------------------------------------------------------------------------ |
| **Docker Container** | YES       | Requires `--privileged`, `--net=host`, USB passthrough for WiFi adapters |
| **Native Install**   | YES       | Native ARM64 package in Kali repos; already running on Argos RPi 5       |

---

## Tool Description

Kismet is a wireless network and device detector, sniffer, wardriving tool, and wireless intrusion detection system (WIDS). It operates entirely passively by placing wireless adapters into monitor mode and capturing raw 802.11 frames without associating with or transmitting to any network. Kismet supports WiFi (802.11a/b/g/n/ac/ax), Bluetooth (classic and BLE), Zigbee, Z-Wave, ADSB, and other wireless protocols through a modular datasource architecture. It provides real-time device detection, signal strength tracking, GPS coordinate logging, manufacturer identification (OUI lookup), SSID probing detection, client-AP relationship mapping, and comprehensive logging in multiple formats (kismetdb SQLite, pcapng, JSON). Kismet features a modern web-based UI, REST API for automation, and supports remote capture sensors for distributed monitoring. It is the primary WiFi and Bluetooth scanning engine integrated into the Argos system.

## Category

Wardriving / Wireless Network Detection / Wireless IDS / Passive Reconnaissance

## Repository

- **GitHub**: https://github.com/kismetwireless/kismet
- **Language**: C++, Python, JavaScript (Web UI)
- **License**: GPL-2.0

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- `--net=host` for network interface access
- `--privileged` for WiFi adapter monitor mode control
- USB passthrough for external WiFi adapters
- Volume mount for persistent kismetdb log storage
- Port 2501 exposed for web UI and REST API
- GPS device passthrough (if using USB GPS)

### Dockerfile

```dockerfile
FROM kalilinux/kali-rolling:latest

ENV DEBIAN_FRONTEND=noninteractive

# Install Kismet and dependencies
RUN apt-get update && apt-get install -y \
    kismet \
    kismet-plugins \
    gpsd \
    gpsd-clients \
    wireless-tools \
    iw \
    aircrack-ng \
    usbutils \
    && rm -rf /var/lib/apt/lists/*

# Create kismet user and directories
RUN useradd -m kismet && \
    usermod -aG kismet kismet && \
    mkdir -p /var/log/kismet && \
    chown kismet:kismet /var/log/kismet

# Default configuration
COPY kismet_site.conf /etc/kismet/kismet_site.conf 2>/dev/null || true

EXPOSE 2501

VOLUME ["/var/log/kismet"]

CMD ["kismet", "--no-ncurses", "-c", "wlan1"]
```

### Docker Run Command

```bash
# Run Kismet with full network and USB access
docker run -d --rm \
    --net=host \
    --privileged \
    -v /dev/bus/usb:/dev/bus/usb \
    -v kismet-logs:/var/log/kismet \
    --name kismet \
    kismet:latest

# Run with specific WiFi adapter and GPS
docker run -d --rm \
    --net=host \
    --privileged \
    -v /dev/bus/usb:/dev/bus/usb \
    -v kismet-logs:/var/log/kismet \
    --device /dev/ttyACM0 \
    --name kismet \
    kismet:latest kismet --no-ncurses -c wlan1 --gps=serial:device=/dev/ttyACM0,name=GPS

# Run with remote capture source
docker run -d --rm \
    --net=host \
    --privileged \
    -v kismet-logs:/var/log/kismet \
    --name kismet \
    kismet:latest kismet --no-ncurses -c wlan1 -c hci0:type=linuxbluetooth
```

---

## Install Instructions (Native)

```bash
# Install from Kali repositories (recommended)
sudo apt-get update
sudo apt-get install -y kismet kismet-plugins

# Add user to kismet group for non-root capture
sudo usermod -aG kismet $USER

# Configure WiFi adapter for monitor mode
sudo airmon-ng check kill
sudo airmon-ng start wlan1

# Start Kismet with WiFi and Bluetooth sources
kismet -c wlan1mon -c hci0:type=linuxbluetooth

# Access web UI at http://localhost:2501

# --- OR build from source for latest features ---

# Install build dependencies
sudo apt-get install -y \
    build-essential \
    git \
    libmicrohttpd-dev \
    pkg-config \
    zlib1g-dev \
    libnl-3-dev \
    libnl-genl-3-dev \
    libcap-dev \
    libpcap-dev \
    libnm-dev \
    libdw-dev \
    libsqlite3-dev \
    libprotobuf-dev \
    libprotobuf-c-dev \
    protobuf-compiler \
    protobuf-c-compiler \
    libsensors-dev \
    libusb-1.0-0-dev \
    python3 \
    python3-setuptools \
    python3-protobuf \
    python3-requests \
    python3-numpy \
    python3-serial \
    python3-usb \
    python3-dev \
    librtlsdr0 \
    libubertooth-dev \
    libbtbb-dev

# Clone and build
git clone https://github.com/kismetwireless/kismet.git
cd kismet
./configure
make -j$(nproc)
sudo make suidinstall
sudo usermod -aG kismet $USER
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Native ARM64 packages in Kali repos                                                   |
| Kali Repo Available   | :white_check_mark: `apt install kismet` works out of the box                                             |
| Hardware Requirements | WiFi adapter supporting monitor mode (external USB recommended), optional: Bluetooth adapter, GPS module |
| Performance on RPi5   | :white_check_mark: Excellent -- runs smoothly with multiple datasources on Cortex-A76                    |

### Additional Notes

- **Argos Integration**: Kismet is already integrated as the primary WiFi/Bluetooth scanning engine in the Argos system, communicating via its REST API on port 2501
- **Monitor Mode Adapters**: The onboard RPi5 WiFi (brcmfmac) does not support monitor mode; use an external USB adapter (Alfa AWUS036ACH, Alfa AWUS036ACHM, or Panda PAU09 recommended)
- **Bluetooth**: The onboard RPi5 Bluetooth adapter works with Kismet's linuxbluetooth datasource for BLE scanning
- **GPS Integration**: Kismet supports gpsd for GPS coordinate logging; works with USB GPS modules (u-blox recommended) connected to the RPi5
- **Multiple Datasources**: RPi5's USB 3.0 ports support multiple simultaneous capture adapters (WiFi + BT + GPS)
- **Kismetdb**: SQLite-based log format enables post-capture analysis, integration with Wigle, and data export
- **REST API**: Full REST API on port 2501 allows programmatic access to all device data, alerts, and configuration -- this is how Argos communicates with Kismet
- **Remote Capture**: Kismet supports remote capture sensors, allowing distributed monitoring from multiple RPi5 nodes
- **Web UI**: Modern responsive web interface accessible from any browser, optimized for both desktop and mobile

### Verdict

**COMPATIBLE** -- Kismet is fully compatible with RPi5 running Kali Linux. It is available as a native ARM64 package in the Kali repositories and is already deployed and operational on the Argos system. The RPi5's quad-core Cortex-A76 handles multiple simultaneous datasources (WiFi, Bluetooth, GPS) with excellent performance. Kismet is the cornerstone of Argos's wireless intelligence capabilities.

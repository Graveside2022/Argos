# Sparrow-WiFi

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. Sparrow-WiFi is a passive wireless spectrum analyzer that operates in monitor mode for WiFi scanning and passive Bluetooth detection. It does not transmit signals or interact with target networks. Passive monitoring may still be subject to local regulations. Use in accordance with applicable laws and authorized training environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python/Qt5 app; GUI requires display or VNC, headless agent mode available

| Method               | Supported | Notes                                                                             |
| -------------------- | --------- | --------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | Requires X11 forwarding or VNC for GUI; headless agent mode works fully in Docker |
| **Native Install**   | YES       | Python + Qt5 dependencies available on ARM64 Kali; recommended for GUI use        |

---

## Tool Description

Sparrow-WiFi is a next-generation GUI-based WiFi and Bluetooth spectrum awareness tool designed for field operations. It provides real-time 2.4 GHz and 5 GHz WiFi scanning, Bluetooth (classic and BLE) device detection, GPS coordinate logging, and signal strength tracking with a hunt mode for physically locating specific access points or devices. The Qt5-based graphical interface displays real-time signal strength graphs, network tables, channel utilization charts, and GPS-tagged network maps. Key features include simultaneous multi-band scanning, signal strength history graphing, AP client association tracking, hidden SSID detection, Bluetooth proximity detection, GPS-correlated signal logging for wardriving, hunt mode with audible alerts for signal tracking, remote agent support for distributed scanning, and export to CSV/JSON/KML formats. Sparrow-WiFi is particularly well-suited for field WiFi surveys, rogue AP detection, wireless penetration testing reconnaissance, and Bluetooth device hunting.

## Category

Wardriving / WiFi Spectrum Analysis / Bluetooth Detection / Signal Hunting / Field Reconnaissance

## Repository

- **GitHub**: https://github.com/ghostop14/sparrow-wifi
- **Language**: Python 3, Qt5 (PyQt5)
- **License**: GPL-3.0

---

## Docker Compatibility

### Can it run in Docker?

PARTIAL

### Docker Requirements

- X11 forwarding or VNC for Qt5 GUI display
- `--net=host` and `--privileged` for WiFi adapter monitor mode access
- USB passthrough for external WiFi and Bluetooth adapters
- GPS device passthrough (USB GPS module)
- Volume mount for scan logs and KML exports
- PyQt5 and Qt5 libraries in container

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV QT_X11_NO_MITSHM=1

# Install system dependencies including Qt5
RUN apt-get update && apt-get install -y \
    git \
    wireless-tools \
    iw \
    aircrack-ng \
    gpsd \
    gpsd-clients \
    python3-pyqt5 \
    python3-pyqt5.qtchart \
    libqt5charts5-dev \
    bluez \
    bluetooth \
    usbutils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    python3-tk \
    && rm -rf /var/lib/apt/lists/*

# Clone Sparrow-WiFi
RUN git clone https://github.com/ghostop14/sparrow-wifi.git /opt/sparrow-wifi

WORKDIR /opt/sparrow-wifi

# Install Python dependencies
RUN pip install --no-cache-dir \
    gps3 \
    dronekit \
    manuf \
    python-dateutil \
    requests \
    QScintilla \
    numpy \
    matplotlib \
    pyqtchart 2>/dev/null || true

ENTRYPOINT ["python3", "sparrow-wifi.py"]
```

### Docker Run Command

```bash
# Run with X11 forwarding, WiFi adapter, and GPS
docker run -it --rm \
    --net=host \
    --privileged \
    -e DISPLAY=$DISPLAY \
    -e QT_X11_NO_MITSHM=1 \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -v /dev/bus/usb:/dev/bus/usb \
    -v sparrow-logs:/opt/sparrow-wifi/logs \
    --name sparrow-wifi \
    sparrow-wifi:latest

# Run with specific adapters and GPS device
docker run -it --rm \
    --net=host \
    --privileged \
    -e DISPLAY=$DISPLAY \
    -e QT_X11_NO_MITSHM=1 \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    --device /dev/ttyACM0 \
    -v sparrow-logs:/opt/sparrow-wifi/logs \
    --name sparrow-wifi \
    sparrow-wifi:latest

# Run headless agent for remote scanning
docker run -d --rm \
    --net=host \
    --privileged \
    --name sparrow-agent \
    sparrow-wifi:latest python3 sparrowwifiagent.py --port 8020
```

---

## Install Instructions (Native)

```bash
# Install dependencies on Kali Linux
sudo apt-get update
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-pyqt5 \
    python3-pyqt5.qtchart \
    git \
    wireless-tools \
    iw \
    aircrack-ng \
    gpsd \
    gpsd-clients \
    bluez \
    bluetooth \
    python3-tk

# Clone Sparrow-WiFi
git clone https://github.com/ghostop14/sparrow-wifi.git
cd sparrow-wifi

# Install Python dependencies
pip3 install gps3 dronekit manuf python-dateutil requests QScintilla numpy matplotlib python3-tk

# Run Sparrow-WiFi (requires root for WiFi scanning)
sudo python3 sparrow-wifi.py

# --- Alternative: Run headless remote agent ---
# On the RPi5 field unit:
sudo python3 sparrowwifiagent.py --port 8020

# On the remote client, connect to agent:
python3 sparrow-wifi.py --remote <rpi5-ip>:8020

# --- Hunt mode for signal tracking ---
# Start in hunt mode for a specific BSSID
sudo python3 sparrow-wifi.py --hunt --bssid AA:BB:CC:DD:EE:FF
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Pure Python with Qt5, fully supported on ARM64                             |
| Kali Repo Available   | :x: Not in Kali repos, install from GitHub (dependencies are in repos)                        |
| Hardware Requirements | WiFi adapter supporting monitor mode (external USB), optional: Bluetooth adapter, GPS module  |
| Performance on RPi5   | :white_check_mark: Good -- Qt5 GUI runs smoothly, real-time scanning works well on Cortex-A76 |

### Additional Notes

- **Argos Integration Priority**: Sparrow-WiFi is a very high priority for Argos integration due to its comprehensive field scanning capabilities, GPS integration, and hunt mode functionality
- **Hunt Mode**: Unique feature for physically tracking down a specific AP or BT device using real-time signal strength feedback with audible alerts -- invaluable for field operations
- **Remote Agent**: The sparrow-agent mode allows the RPi5 to act as a headless scanning sensor, with the GUI running on a remote machine -- ideal for distributed deployments
- **GPS Integration**: Native GPS support via gpsd for wardriving with coordinate-tagged network observations
- **Bluetooth**: Built-in Bluetooth (classic and BLE) scanning for device detection and proximity monitoring
- **Multi-Band**: Simultaneous 2.4 GHz and 5 GHz scanning when adapter supports it
- **Export Formats**: CSV, JSON, and KML export for integration with Google Earth, TAK systems, and other analysis tools
- **Qt5 Display**: On headless RPi5, use VNC or the remote agent mode; for direct display, connect HDMI or use X11 forwarding
- **WiFi Adapters**: Recommended adapters for RPi5: Alfa AWUS036ACH (dual-band), Alfa AWUS036ACHM (dual-band, newer), Panda PAU09 (dual-band budget option)
- **Drone Integration**: Optional dronekit support for aerial WiFi surveys (drone-mounted scanning)

### Verdict

**COMPATIBLE** -- Sparrow-WiFi runs well on RPi5 with Kali Linux. As a Python/Qt5 application, it has no architecture-specific compilation requirements. The RPi5's Cortex-A76 cores handle the real-time scanning, signal processing, and Qt5 rendering without issues. The remote agent mode is particularly well-suited for RPi5 deployment, allowing the Pi to serve as a field scanning sensor while the full GUI runs on a more capable display system. This tool is a high-priority integration target for Argos due to its complementary capabilities alongside Kismet.

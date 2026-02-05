# WigleToTAK

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. WigleToTAK is a data bridging utility that converts wardriving data into tactical awareness formats. It does not perform any active scanning or network interaction. Use in accordance with applicable data handling policies and authorized training environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python, no architecture-specific dependencies

| Method               | Supported | Notes                                                            |
| -------------------- | --------- | ---------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight Python container; needs network access to TAK server |
| **Native Install**   | YES       | Pure Python with pip dependencies; runs natively on ARM64        |

---

## Tool Description

WigleToTAK is a Flask-based web application that bridges WiGLE wardriving data to Team Awareness Kit (TAK) systems by converting WiFi and Bluetooth network observation data into Cursor-on-Target (CoT) messages. It reads `.wiglecsv` files from local directories, parses network observations (MAC, SSID, channel, RSSI, GPS coordinates, auth mode), and broadcasts CoT XML events via UDP multicast (default 239.2.3.1:6969) and/or unicast to a configured TAK server. The web UI (served on port 8000) provides controls for TAK server configuration, file selection, real-time vs post-collection analysis modes, and SSID/MAC whitelist and blacklist management with custom ARGB color coding for blacklisted entries. This enables wardriving data to be visualized on TAK tactical maps alongside other data layers for wireless network situational awareness.

## Category

Wardriving / Tactical Data Integration / CoT Bridge / Situational Awareness

## Repository

- **GitHub**: https://github.com/canaryradio/WigleToTAK (community tool)
- **Language**: Python (Flask web application)
- **License**: MIT

---

> **NOTE**: WigleToTAK is a **Flask web application** (not a CLI tool). The entry point is `WigletoTAK.py` (note capitalization), which starts a web server on port 8000. Configuration (TAK server IP/port, file selection, whitelist/blacklist) is done through the web UI. CoT messages are delivered via UDP multicast (239.2.3.1:6969) and/or unicast to a configured TAK server. The only Python dependency is `Flask==3.0.2`. The tool reads `.wiglecsv` files from local directories — it does not query the WiGLE REST API.

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Network access to TAK server (UDP for CoT multicast/unicast)
- Volume mount for `.wiglecsv` data files
- Port 8000 exposed for Flask web UI
- Minimal resource requirements (lightweight Flask application)

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Clone WigleToTAK
RUN git clone https://github.com/canaryradio/WigleToTAK.git /opt/wigletotak

WORKDIR /opt/wigletotak

# Install Python dependencies (requirements.txt contains Flask==3.0.2)
RUN pip install --no-cache-dir -r requirements.txt

# Create data directory for .wiglecsv files
RUN mkdir -p /data

VOLUME ["/data"]

EXPOSE 8000

CMD ["python3", "WigletoTAK.py"]
```

### Docker Run Command

```bash
# Run WigleToTAK web app with host networking (for UDP multicast to TAK)
# Web UI accessible at http://localhost:8000
# Place .wiglecsv files in the mounted /data directory
docker run -d --rm \
    --network host \
    -v /path/to/wigle-data:/data \
    --name wigletotak \
    wigletotak:latest

# Run with port mapping instead of host networking
docker run -d --rm \
    -p 8000:8000 \
    -v /path/to/wigle-data:/data \
    --name wigletotak \
    wigletotak:latest
# NOTE: UDP multicast CoT delivery requires --network host; port mapping
# only exposes the web UI. Configure TAK server IP/port via the web interface.
```

---

## Install Instructions (Native)

```bash
# Install dependencies on Kali Linux
sudo apt-get update
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git

# Clone WigleToTAK
git clone https://github.com/canaryradio/WigleToTAK.git
cd WigleToTAK

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies (Flask==3.0.2)
pip install -r requirements.txt

# Run WigleToTAK Flask web app (starts on port 8000)
python3 WigletoTAK.py

# Access web UI at http://localhost:8000
# From the web UI:
#   1. Configure TAK server IP and port
#   2. Set directory containing .wiglecsv files
#   3. Select a file and start broadcast
#   4. Configure whitelist/blacklist as needed
#   5. Choose real-time or post-collection analysis mode
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Pure Python, fully architecture-independent                         |
| Kali Repo Available   | :x: Not in Kali repos, install from GitHub                                             |
| Hardware Requirements | Network connectivity to TAK server, no special hardware needed                         |
| Performance on RPi5   | :white_check_mark: Excellent -- minimal CPU/RAM usage, lightweight data transformation |

### Additional Notes

- **Web Application**: WigleToTAK is a Flask web app (port 8000), not a CLI tool. All configuration is done through the browser-based UI
- **Data Sources**: Reads `.wiglecsv` files from local directories selected via the web UI
- **CoT Protocol**: Generates standard Cursor-on-Target XML messages compatible with all TAK products (ATAK, WinTAK, iTAK, TAK Server)
- **CoT Delivery**: UDP multicast (default 239.2.3.1:6969) and/or unicast to a configured TAK server IP:port; no TCP/TLS support
- **Network Metadata**: CoT messages include SSID, MAC, channel, RSSI, GPS coordinates, altitude, accuracy, auth mode, and device type
- **Filtering**: SSID and MAC whitelist (exclude from broadcast) and blacklist (mark with custom ARGB color) via web UI
- **Analysis Modes**: Real-time mode (watches file for new entries) and post-collection mode (batch processes entire file in chunks)

### Verdict

**COMPATIBLE** -- WigleToTAK runs without any issues on RPi5 running Kali Linux. As a pure Python data transformation tool with no hardware dependencies or architecture-specific requirements, it works identically on ARM64 as on any other platform. The tool's minimal resource footprint makes it well-suited for running alongside other Argos services on the RPi5.

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

WigleToTAK bridges WiGLE wardriving data to Team Awareness Kit (TAK) systems by converting WiFi and Bluetooth network observation data into Cursor-on-Target (CoT) messages. It takes network data collected by wardriving tools (WiGLE-formatted CSV exports, Kismet logs, or direct WiGLE API queries) and transforms each network observation into a CoT event with proper geolocation, network metadata, and tactical symbology. These CoT messages are then pushed to a TAK server (ATAK, WinTAK, iTAK) for real-time display on the tactical map. This enables wardriving data to be visualized alongside other tactical data layers, providing wireless network situational awareness in a unified operational picture. Networks can be categorized, filtered by signal strength, age, or encryption type, and displayed with appropriate tactical markers.

## Category

Wardriving / Tactical Data Integration / CoT Bridge / Situational Awareness

## Repository

- **GitHub**: https://github.com/canaryradio/WigleToTAK (community tool)
- **Language**: Python
- **License**: MIT

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Network access to TAK server (TCP/UDP for CoT messaging)
- Volume mount for WiGLE data files (CSV imports)
- Environment variables for TAK server connection and WiGLE API credentials
- Minimal resource requirements (lightweight Python application)

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

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --no-cache-dir requests pytak lxml

# Create data directory
RUN mkdir -p /data

VOLUME ["/data"]

ENTRYPOINT ["python3", "wigletotak.py"]
```

### Docker Run Command

```bash
# Run with TAK server connection and WiGLE data file
docker run -it --rm \
    --network host \
    -v /path/to/wigle-data:/data \
    -e TAK_SERVER=tak-server.local:8087 \
    -e WIGLE_API_NAME=your_api_name \
    -e WIGLE_API_TOKEN=your_api_token \
    --name wigletotak \
    wigletotak:latest --input /data/wigle-export.csv

# Run with TAK server TLS connection
docker run -it --rm \
    --network host \
    -v /path/to/wigle-data:/data \
    -v /path/to/tak-certs:/certs \
    -e TAK_SERVER=tak-server.local:8089 \
    -e TAK_CERT=/certs/client.p12 \
    --name wigletotak \
    wigletotak:latest

# Run in continuous mode pulling from WiGLE API
docker run -d --rm \
    --network host \
    -e TAK_SERVER=tak-server.local:8087 \
    -e WIGLE_API_NAME=your_api_name \
    -e WIGLE_API_TOKEN=your_api_token \
    -e LAT=38.8977 \
    -e LON=-77.0365 \
    -e RADIUS=0.01 \
    --name wigletotak \
    wigletotak:latest --mode api --continuous
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

# Install Python dependencies
pip install -r requirements.txt 2>/dev/null || \
    pip install requests pytak lxml

# Configure TAK server connection
# Edit configuration file or set environment variables:
export TAK_SERVER="tak-server.local:8087"
export WIGLE_API_NAME="your_api_name"
export WIGLE_API_TOKEN="your_api_token"

# Run WigleToTAK with a WiGLE CSV export
python3 wigletotak.py --input /path/to/wigle-export.csv

# Run with WiGLE API queries for a specific area
python3 wigletotak.py --mode api --lat 38.8977 --lon -77.0365 --radius 0.01
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

- **Argos Integration**: WigleToTAK is already installed on the Argos system and can bridge wardriving data collected by Kismet to TAK for unified tactical display
- **Data Sources**: Accepts WiGLE CSV exports, Kismetdb conversions, and direct WiGLE REST API queries
- **CoT Protocol**: Generates standard Cursor-on-Target XML messages compatible with all TAK products (ATAK, WinTAK, iTAK, TAK Server)
- **TAK Connectivity**: Supports both TCP (plaintext) and TLS (certificate-based) connections to TAK servers
- **WiGLE API**: Optional integration with WiGLE REST API for querying historical network data by location; requires free WiGLE account for API access
- **Network Metadata**: CoT messages include SSID, BSSID, encryption type, signal strength, first/last seen timestamps, and GPS coordinates
- **Filtering**: Supports filtering by encryption type, signal strength, network age, and geographic bounds before sending to TAK
- **Batch and Continuous**: Can process data in batch mode (single file) or continuous mode (polling API or watching directory)

### Verdict

**COMPATIBLE** -- WigleToTAK runs without any issues on RPi5 running Kali Linux. As a pure Python data transformation tool with no hardware dependencies or architecture-specific requirements, it works identically on ARM64 as on any other platform. The tool's minimal resource footprint makes it well-suited for running alongside other Argos services on the RPi5.

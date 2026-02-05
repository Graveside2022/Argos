# AIS-catcher

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. AIS-catcher is a passive maritime vessel tracking receiver that decodes AIS (Automatic Identification System) signals broadcast by ships on VHF frequencies 161.975 MHz and 162.025 MHz. Reception of AIS signals is legal worldwide. No transmit capability exists. This tool performs receive-only operations using an RTL-SDR dongle.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Official multi-arch Docker images include linux/arm64; compiles natively with cmake on aarch64; ~3-5% CPU, <40MB RAM

| Method               | Supported | Notes                                                                                                                       |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Official `ghcr.io/jvde-github/ais-catcher` image supports arm64 natively; RTL-SDR USB passthrough (`--device=/dev/bus/usb`) |
| **Native Install**   | YES       | Builds from source with cmake on aarch64; all deps (`librtlsdr-dev`, `libcurl4-openssl-dev`) in Kali 2025.4 repos           |

---

## Tool Description

AIS-catcher is a high-performance AIS (Automatic Identification System) receiver and decoder for RTL-SDR dongles and other SDR hardware. It receives VHF radio transmissions from ships on the international AIS frequencies (161.975 MHz Channel 87B and 162.025 MHz Channel 88B) and decodes them to extract vessel identification, position, course, speed, destination, cargo type, and other navigational data. Ships over 300 gross tons and all passenger vessels are required by international maritime law (IMO SOLAS) to transmit AIS, making this a rich data source for maritime situational awareness.

AIS-catcher is written in modern C++ with a focus on decoding performance and supports simultaneous dual-channel reception, meaning it can monitor both AIS channels with a single RTL-SDR dongle. It has official Docker support and provides both a built-in web interface and JSON output for integration into external platforms like Argos.

Key capabilities:

- Decodes AIS messages (Types 1-27) from maritime vessels
- Simultaneous dual-channel reception (161.975 MHz + 162.025 MHz) with single RTL-SDR
- Real-time vessel tracking with MMSI, vessel name, callsign, IMO number
- Position reporting with latitude, longitude, course over ground, speed over ground
- Ship type classification, destination, ETA, draught, cargo information
- Built-in web interface with vessel map display on port 8100
- JSON API output for programmatic integration
- NMEA sentence output (standard marine data format)
- Feed data to community aggregation services (MarineTraffic, VesselFinder, AISHub)
- Support for multiple SDR hardware: RTL-SDR, Airspy, Airspy HF+, HackRF, SDRplay
- UDP/TCP network output for feeding data to other applications
- PostgreSQL and SQLite database storage options
- Built-in signal statistics and performance metrics
- Official Docker images provided by the developer

## Category

Maritime Vessel Tracking / AIS Reception / Passive RF Intelligence

## Repository

- **GitHub**: https://github.com/jvde-github/AIS-catcher
- **Language**: C++
- **License**: GPL-3.0

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- RTL-SDR USB dongle passed through to the container via `--device` flag
- `librtlsdr` and `libusb` libraries inside the container
- Host must have `rtl-sdr` udev rules configured for USB device access
- Blacklist `dvb_usb_rtl28xxu` kernel module on the host
- Port mapping for web interface (default 8100) and optional data feed ports
- Official Docker images available at `ghcr.io/jvde-github/ais-catcher`
- Multi-architecture images support linux/amd64 and linux/arm64 natively

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    librtlsdr-dev \
    libusb-1.0-0-dev \
    libcurl4-openssl-dev \
    zlib1g-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/jvde-github/AIS-catcher.git /build/AIS-catcher

WORKDIR /build/AIS-catcher
RUN mkdir build && cd build && \
    cmake .. -DRTLSDR=ON -DHACKRF=OFF -DAIRSPY=OFF -DSDRPLAY=OFF -DAIRSPYHF=OFF && \
    make -j$(nproc)

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    librtlsdr0 \
    libusb-1.0-0 \
    libcurl4 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/AIS-catcher/build/AIS-catcher /usr/local/bin/AIS-catcher

EXPOSE 8100

ENTRYPOINT ["AIS-catcher"]
CMD ["-d", "00000000", "-N", "8100", "PLUGIN_DIR", "/usr/share/aiscatcher/plugins", "-o", "4"]
```

### Docker Run Command

```bash
# Basic run with RTL-SDR USB passthrough and web interface
docker run -d \
  --name ais-catcher \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 8100:8100 \
  ghcr.io/jvde-github/ais-catcher:latest \
  -d 00000000 \
  -N 8100 \
  -o 4

# With specific RTL-SDR serial and verbose output
docker run -d \
  --name ais-catcher \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 8100:8100 \
  ghcr.io/jvde-github/ais-catcher:latest \
  -d 00000000 \
  -gr RTLSDR TUNER auto RTLAGC on \
  -N 8100 \
  -o 4 \
  -M DT

# With JSON output via UDP for Argos integration
docker run -d \
  --name ais-catcher \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 8100:8100 \
  -p 10110:10110/udp \
  ghcr.io/jvde-github/ais-catcher:latest \
  -d 00000000 \
  -gr RTLSDR TUNER auto RTLAGC on \
  -N 8100 \
  -u 127.0.0.1 10110 \
  -o 4

# With feeding to community services
docker run -d \
  --name ais-catcher \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 8100:8100 \
  ghcr.io/jvde-github/ais-catcher:latest \
  -d 00000000 \
  -N 8100 \
  -o 4 \
  -N STATION_NAME "Argos-AIS" LAT 0.0 LON 0.0 SHARE_LOC on

# Docker Compose example (AIS-catcher standalone)
# Save as docker-compose.yml and run: docker compose up -d
# ---
# version: '3.8'
# services:
#   ais-catcher:
#     image: ghcr.io/jvde-github/ais-catcher:latest
#     container_name: ais-catcher
#     restart: unless-stopped
#     devices:
#       - /dev/bus/usb:/dev/bus/usb
#     ports:
#       - "8100:8100"
#     command: >
#       -d 00000000
#       -gr RTLSDR TUNER auto RTLAGC on
#       -N 8100
#       -N STATION_NAME "Argos-AIS" LAT 0.0 LON 0.0
#       -o 4
```

---

## Install Instructions (Native)

```bash
# ============================================
# AIS-catcher Native Install on Kali Linux RPi5
# ============================================

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  librtlsdr-dev \
  libusb-1.0-0-dev \
  libcurl4-openssl-dev \
  zlib1g-dev \
  libssl-dev

# Blacklist the kernel DVB driver so RTL-SDR is available
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtlsdr.conf
sudo modprobe -r dvb_usb_rtl28xxu 2>/dev/null || true

# Clone AIS-catcher
cd /opt
sudo git clone https://github.com/jvde-github/AIS-catcher.git
cd AIS-catcher

# Build with CMake (RTL-SDR support only for minimal build)
sudo mkdir build && cd build
sudo cmake .. \
  -DRTLSDR=ON \
  -DHACKRF=OFF \
  -DAIRSPY=OFF \
  -DSDRPLAY=OFF \
  -DAIRSPYHF=OFF
sudo make -j4

# Install binary
sudo cp AIS-catcher /usr/local/bin/

# Test the installation
AIS-catcher -h

# Verify RTL-SDR is detected
rtl_test -t

# Run AIS-catcher with web interface
AIS-catcher -d 00000000 -N 8100 -o 4

# Run with auto gain and verbose decoding
AIS-catcher -d 00000000 \
  -gr RTLSDR TUNER auto RTLAGC on \
  -N 8100 \
  -o 4 \
  -M DT

# Run with JSON output via UDP (for Argos integration)
AIS-catcher -d 00000000 \
  -gr RTLSDR TUNER auto RTLAGC on \
  -N 8100 \
  -u 127.0.0.1 10110 \
  -o 4

# Create systemd service for automatic startup
sudo tee /etc/systemd/system/ais-catcher.service << 'SERVICEEOF'
[Unit]
Description=AIS-catcher Maritime Vessel Receiver
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/AIS-catcher \
  -d 00000000 \
  -gr RTLSDR TUNER auto RTLAGC on \
  -N 8100 \
  -o 4
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable ais-catcher
sudo systemctl start ais-catcher

# Verify operation
sudo systemctl status ais-catcher

# Access web interface at http://<pi-ip>:8100
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ARM64 Support         | :white_check_mark: Full native ARM64/aarch64 support, official multi-arch Docker images include linux/arm64                                |
| Kali Repo Available   | :x: Not in Kali repos, builds from source cleanly or use official Docker image                                                             |
| Hardware Requirements | RTL-SDR USB dongle (R820T/R820T2 tuner), VHF antenna tuned for 162 MHz (marine band), location near waterway or coastline for best results |
| Performance on RPi5   | :white_check_mark: Excellent -- ~3-5% CPU on a single Cortex-A76 core, <40MB RAM, dual-channel decoding runs smoothly                      |

### RPi5-Specific Notes

- AIS-catcher provides official ARM64 Docker images, making deployment on RPi5 trivial
- The CMake build system correctly detects ARM64 and applies appropriate optimizations
- Dual-channel simultaneous decoding (both AIS frequencies at once) runs efficiently on the Cortex-A76 cores
- Can share an RTL-SDR dongle only if the other application is not using it; for simultaneous ADS-B and AIS, two separate RTL-SDR dongles are needed (one tuned to 1090 MHz, one to 162 MHz)
- The RPi5 USB 3.0 ports provide adequate bandwidth for RTL-SDR sample rates
- Built-in web interface is lightweight and works well when served from the Pi
- If running alongside readsb/dump1090 for aircraft tracking, assign each RTL-SDR a unique serial number using `rtl_eeprom -s AISDONGLE` and `rtl_eeprom -s ADSBDONGLE`

### Argos Integration Notes

- Built-in web interface on port 8100 can be embedded in Argos dashboard
- JSON data available via the web interface API endpoints
- UDP output (`-u host port`) sends decoded AIS messages in JSON format for real-time consumption
- NMEA sentence output can be parsed by standard marine data processing libraries
- AIS message types relevant to Argos:
    - Type 1-3: Position reports (Class A vessels) -- lat, lon, SOG, COG, heading, ROT, nav status
    - Type 5: Static and voyage data -- vessel name, IMO, callsign, ship type, destination, ETA, dimensions
    - Type 18-19: Position reports (Class B vessels) -- smaller vessels, leisure craft
    - Type 21: Aid to navigation reports -- buoys, lighthouses
    - Type 24: Class B static data -- vessel name and type for smaller craft
- Can output data in GeoJSON format for direct map overlay integration
- Community feed integration (MarineTraffic, VesselFinder) can provide bidirectional data enrichment
- The `-N 8100` web server provides a REST-like JSON API at `/api/vessels` for vessel list data

### Verdict

**COMPATIBLE** -- AIS-catcher is fully compatible with the Raspberry Pi 5 running Kali Linux. It compiles natively on ARM64, has official multi-architecture Docker images, and uses minimal system resources. The dual-channel simultaneous decoding capability means a single RTL-SDR dongle can monitor both AIS frequencies, providing comprehensive maritime vessel tracking. The JSON API and UDP output provide clean integration paths into Argos. When combined with ADS-B tools (readsb + tar1090), the RPi5 becomes a combined air and maritime traffic monitoring station using two RTL-SDR dongles.

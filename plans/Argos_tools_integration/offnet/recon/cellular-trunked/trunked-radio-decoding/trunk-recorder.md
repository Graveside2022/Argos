# trunk-recorder

> **RISK CLASSIFICATION**: MEDIUM RISK - SENSITIVE SOFTWARE
> Passive P25 and SmartNet trunked radio monitoring and recording. Captures law enforcement, emergency services, and military trunked radio communications. Receive-only — no transmit capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Official multi-arch Docker image (`robotastic/trunk-recorder:latest`) includes linux/arm64; RPi explicitly documented

| Method               | Supported | Notes                                                                                              |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Official `robotastic/trunk-recorder:latest` arm64 image; 180K+ pulls; SDR USB passthrough required |
| **Native Install**   | YES       | Builds from source with CMake; requires GNU Radio 3.10, gr-osmosdr, Boost, ffmpeg                  |

---

## Tool Description

trunk-recorder is an open-source tool for recording calls from P25 and SmartNet trunked radio systems. It monitors one or more trunked radio control channels using SDR hardware, automatically follows conversations as they hop across frequencies, and records each talkgroup conversation as a separate audio file (WAV or M4A). The system supports simultaneous monitoring of multiple radio systems using multiple SDR sources and provides a plugin architecture for real-time streaming, uploading to services like OpenMHz and Broadcastify, MQTT notifications, and custom scripting.

Key capabilities:

- Monitors P25 Phase I, P25 Phase II (TDMA), and SmartNet/SmartZone trunked systems
- Automatically follows trunking control channels and records individual talkgroup calls
- Multi-source SDR support — use multiple SDRs to monitor different systems simultaneously
- Plugin architecture: `openmhz_uploader`, `broadcastify_uploader`, `rdioscanner_uploader`, `simplestream`, `stat_socket`, `unit_script`
- JSON configuration for systems, talkgroups, and sources
- Outputs WAV/M4A audio files tagged with talkgroup, timestamp, frequency, and unit IDs
- Web-based call player via companion projects (trunk-player, rdio-scanner)
- REST API status endpoint for monitoring

## Category

P25 Trunked Radio Recording / SIGINT / Public Safety Radio Monitoring

## Repository

- **GitHub**: https://github.com/TrunkRecorder/trunk-recorder
- **Language**: C++ (GNU Radio based)
- **License**: GPL-3.0
- **Stars**: ~1,050

---

## Docker Compatibility

### Can it run in Docker?

**YES** — Official multi-architecture Docker image provided by the developer. The `robotastic/trunk-recorder:latest` image includes linux/amd64 and linux/arm64 builds with 180,000+ pulls on Docker Hub.

### Docker Requirements

- `--privileged` — Required for raw USB access to SDR hardware
- `--device=/dev/bus/usb` — USB passthrough for HackRF, RTL-SDR, USRP, Airspy
- Host `udev` rules for SDR device permissions
- Volume mount for configuration: `-v /path/to/config.json:/app/config.json`
- Volume mount for recorded audio: `-v /path/to/recordings:/app/recordings`
- No network ports required for core operation; optional ports for status API and streaming plugins

### Dockerfile

```dockerfile
# Official image is recommended — custom build only if needed
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    gnuradio-dev \
    gr-osmosdr \
    libhackrf-dev \
    librtlsdr-dev \
    libuhd-dev \
    libboost-all-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libsndfile1-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/TrunkRecorder/trunk-recorder.git /build/trunk-recorder

WORKDIR /build/trunk-recorder
RUN mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc)

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gnuradio \
    gr-osmosdr \
    libhackrf0 \
    librtlsdr0 \
    libboost-all-dev \
    libcurl4 \
    libssl3 \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/trunk-recorder/build/trunk-recorder /usr/local/bin/trunk-recorder

WORKDIR /app
ENTRYPOINT ["trunk-recorder"]
CMD ["--config=/app/config.json"]
```

### Docker Run Command

```bash
# Use the official multi-arch image (recommended)
docker run -d \
  --name trunk-recorder \
  --restart unless-stopped \
  --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/recordings:/app/recordings \
  robotastic/trunk-recorder:latest \
  --config=/app/config.json

# Example config.json for P25 system with HackRF:
# {
#   "ver": 2,
#   "sources": [{
#     "center": 851000000,
#     "rate": 8000000,
#     "driver": "osmosdr",
#     "device": "hackrf=0",
#     "gain": 40,
#     "ifGain": 32,
#     "bbGain": 16
#   }],
#   "systems": [{
#     "type": "p25",
#     "control_channels": [851012500],
#     "talkgroupsFile": "talkgroups.csv"
#   }]
# }

# With status API enabled
docker run -d \
  --name trunk-recorder \
  --restart unless-stopped \
  --privileged \
  --device=/dev/bus/usb \
  -p 3005:3005 \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/recordings:/app/recordings \
  robotastic/trunk-recorder:latest
```

---

## Install Instructions (Native)

```bash
# ============================================
# trunk-recorder Native Install on Kali Linux RPi5
# ============================================

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  gnuradio-dev \
  gr-osmosdr \
  libhackrf-dev \
  librtlsdr-dev \
  libuhd-dev \
  libboost-all-dev \
  libcurl4-openssl-dev \
  libssl-dev \
  libsndfile1-dev \
  ffmpeg

# Clone trunk-recorder
cd /opt
sudo git clone https://github.com/TrunkRecorder/trunk-recorder.git
cd trunk-recorder

# Build with CMake
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4

# Install binary
sudo cp trunk-recorder /usr/local/bin/

# Test installation
trunk-recorder --help

# Create configuration directory
sudo mkdir -p /etc/trunk-recorder
sudo mkdir -p /var/lib/trunk-recorder/recordings

# Create a basic config.json (edit for your local P25 system)
sudo tee /etc/trunk-recorder/config.json << 'CONFIGEOF'
{
  "ver": 2,
  "captureDir": "/var/lib/trunk-recorder/recordings",
  "sources": [{
    "center": 851000000,
    "rate": 8000000,
    "driver": "osmosdr",
    "device": "hackrf=0",
    "gain": 40,
    "ifGain": 32,
    "bbGain": 16
  }],
  "systems": [{
    "type": "p25",
    "control_channels": [851012500],
    "talkgroupsFile": "/etc/trunk-recorder/talkgroups.csv"
  }]
}
CONFIGEOF

# Run trunk-recorder
trunk-recorder --config=/etc/trunk-recorder/config.json

# Create systemd service for automatic startup
sudo tee /etc/systemd/system/trunk-recorder.service << 'SERVICEEOF'
[Unit]
Description=trunk-recorder P25 Trunked Radio Recorder
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/trunk-recorder --config=/etc/trunk-recorder/config.json
WorkingDirectory=/var/lib/trunk-recorder
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable trunk-recorder
sudo systemctl start trunk-recorder
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — official arm64 Docker image; builds from source on aarch64                                   |
| Kali Repo Available   | :x: Not in Kali repos — use official Docker image or build from source                                                 |
| Hardware Requirements | HackRF One, RTL-SDR, or USRP via USB; antenna tuned for local P25 frequencies (typically 700-900 MHz UHF)              |
| Performance on RPi5   | :white_check_mark: Good — C++ with GNU Radio; single P25 system monitoring uses ~15-25% CPU; multiple systems scale up |

### RPi5-Specific Notes

- Official arm64 Docker image is the easiest deployment path on RPi 5
- HackRF One can monitor ~8 MHz bandwidth simultaneously, covering most P25 system frequency ranges
- RTL-SDR provides ~2.4 MHz bandwidth — sufficient for smaller P25 systems
- Multiple SDR sources can be configured for monitoring multiple systems or wider coverage
- Recorded audio files should be stored on external storage if monitoring continuously (audio accumulates quickly)
- Memory usage: ~200-500 MB depending on number of active talkgroups and recording sessions

### Argos Integration Notes

- Recorded audio files (WAV/M4A) tagged with metadata (talkgroup, frequency, timestamp) for indexing
- Status API provides JSON data on active calls, frequencies, and talkgroups
- Plugin architecture enables MQTT and WebSocket streaming for real-time Argos dashboard updates
- `simplestream` plugin can stream decoded audio to a web player
- Talkgroup CSV files map numeric IDs to unit/agency names for display

### Verdict

**COMPATIBLE** — trunk-recorder is fully compatible with RPi 5. The official arm64 Docker image makes deployment trivial. P25 trunked radio monitoring is a high-value capability that fills a major gap in the existing Argos toolset — no current tool in folders 01-15 handles trunked radio systems. This is the highest-priority tool in the new additions.

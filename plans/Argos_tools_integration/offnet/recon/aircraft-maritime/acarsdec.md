# acarsdec

> **RISK CLASSIFICATION**: LOW RISK
> Passive ACARS (Aircraft Communications Addressing and Reporting System) receiver and decoder. Decodes VHF text messages between aircraft and ground stations on ~131 MHz. Reception of ACARS is legal worldwide. Receive-only — no transmit capability.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure C; community arm64 Docker image available (`sdr-enthusiasts/docker-acarshub`); compiles natively on ARM64

| Method               | Supported | Notes                                                                                                            |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `sdr-enthusiasts/docker-acarshub` — community arm64 image with web UI and acarsdec bundled; 98 stars, maintained |
| **Native Install**   | YES       | Pure C with CMake; compiles on aarch64; deps: librtlsdr or SoapySDR                                              |

---

## Tool Description

acarsdec is an ACARS (Aircraft Communications Addressing and Reporting System) multi-channel decoder. ACARS is a VHF datalink system (~131 MHz) that carries text messages between aircraft and ground stations. Messages include position reports, weather requests, departure/arrival clearances, maintenance alerts, gate assignments, OOOI (Out/Off/On/In) events, and free-text pilot-ground communications. acarsdec can monitor multiple ACARS channels simultaneously from a single SDR and outputs decoded messages in JSON format.

**IMPORTANT**: The original `TLeconte/acarsdec` repository is **ARCHIVED** and no longer maintained. This documentation references the active continuation fork at `f00b4r0/acarsdec`.

Key capabilities:

- Decodes ACARS messages on VHF frequencies (primary: 131.550, 131.525, 131.725 MHz)
- Simultaneous multi-channel monitoring (up to 8 channels from single SDR)
- RTL-SDR direct support
- Airspy direct support
- SoapySDR support (HackRF via SoapyHackRF bridge)
- JSON output format for programmatic consumption
- Network output (UDP/TCP) for feeding to aggregation services
- Per-message details: flight number, aircraft registration, message type, content
- Automatic message labeling by type (position, weather, free-text, etc.)

## Category

Aviation Communications Intelligence / ACARS Decoding / Passive RF Intelligence

## Repository

- **GitHub**: https://github.com/f00b4r0/acarsdec (active fork)
- **Original**: https://github.com/TLeconte/acarsdec (ARCHIVED — do not use)
- **Language**: C
- **License**: GPL-2.0
- **Stars**: ~48 (fork)

---

## Docker Compatibility

### Can it run in Docker?

**YES** — The `sdr-enthusiasts/docker-acarshub` community image bundles acarsdec with a web UI dashboard, database storage, and network feed capabilities. Multi-architecture support includes linux/arm64. This is the recommended Docker deployment path.

### Docker Requirements

- `--device=/dev/bus/usb` — USB passthrough for RTL-SDR
- Host `udev` rules for RTL-SDR device permissions
- Blacklist `dvb_usb_rtl28xxu` kernel module on host
- Port mapping for web interface (default 8888 for acarshub)
- Volume mount for persistent database and configuration
- For HackRF: requires SoapyHackRF bridge installed in container

### Dockerfile

```dockerfile
# Standalone acarsdec (without acarshub web UI)
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    librtlsdr-dev \
    libusb-1.0-0-dev \
    libsoapysdr-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/f00b4r0/acarsdec.git /build/acarsdec

WORKDIR /build/acarsdec
RUN mkdir build && cd build && \
    cmake .. -Drtl=ON -Dsoapy=ON && \
    make -j$(nproc)

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    librtlsdr0 \
    libusb-1.0-0 \
    libsoapysdr0.8 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/acarsdec/build/acarsdec /usr/local/bin/acarsdec

ENTRYPOINT ["acarsdec"]
CMD ["-r", "0", "131.550", "131.525", "131.725"]
```

### Docker Run Command

```bash
# Option A: Use sdr-enthusiasts/docker-acarshub (recommended — includes web UI)
docker run -d \
  --name acarshub \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 8888:80 \
  -e TZ=UTC \
  -e STATION_ID_ACARS="Argos-ACARS" \
  -e FREQUENCIES_ACARS="131.550;131.525;131.725" \
  -v $(pwd)/acarshub-data:/run/acars \
  ghcr.io/sdr-enthusiasts/docker-acarshub:latest

# Option B: Standalone acarsdec with JSON output
docker build -t argos/acarsdec .

docker run -d \
  --name acarsdec \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  argos/acarsdec \
  -r 0 131.550 131.525 131.725 -j 127.0.0.1:5555

# With JSON UDP output to Argos
docker run -d \
  --name acarsdec \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  --net=host \
  argos/acarsdec \
  -r 0 131.550 131.525 131.725 -j 127.0.0.1:5555 -v
```

---

## Install Instructions (Native)

```bash
# ============================================
# acarsdec Native Install on Kali Linux RPi5
# ============================================

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  librtlsdr-dev \
  libusb-1.0-0-dev

# Optional: SoapySDR support (for HackRF via SoapyHackRF)
sudo apt-get install -y \
  libsoapysdr-dev \
  soapysdr-module-hackrf

# Clone the ACTIVE fork (NOT TLeconte/acarsdec which is archived)
cd /opt
sudo git clone https://github.com/f00b4r0/acarsdec.git
cd acarsdec

# Build with CMake
sudo mkdir build && cd build
sudo cmake .. -Drtl=ON -Dsoapy=ON
sudo make -j4

# Install binary
sudo cp acarsdec /usr/local/bin/

# Test installation
acarsdec -h

# Blacklist DVB kernel module for RTL-SDR
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtlsdr.conf
sudo modprobe -r dvb_usb_rtl28xxu 2>/dev/null || true

# Run acarsdec with RTL-SDR monitoring 3 ACARS channels
acarsdec -r 0 131.550 131.525 131.725 -v

# Run with JSON UDP output for Argos integration
acarsdec -r 0 131.550 131.525 131.725 -j 127.0.0.1:5555 -v

# Run with SoapySDR (HackRF via SoapyHackRF bridge)
acarsdec -s 131.550 131.525 131.725 -v

# Create systemd service
sudo tee /etc/systemd/system/acarsdec.service << 'SERVICEEOF'
[Unit]
Description=acarsdec ACARS Decoder
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/acarsdec -r 0 131.550 131.525 131.725 -j 127.0.0.1:5555 -v
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable acarsdec
sudo systemctl start acarsdec
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| ARM64 Support         | :white_check_mark: Full — pure C, compiles natively on aarch64; community arm64 Docker image available |
| Kali Repo Available   | :x: Not in Kali repos — build from source or use Docker image                                          |
| Hardware Requirements | RTL-SDR (direct support, ideal for 131 MHz VHF); HackRF via SoapyHackRF bridge; VHF antenna            |
| Performance on RPi5   | :white_check_mark: Excellent — pure C, multi-channel decode uses ~3-5% CPU; <30 MB RAM                 |

### RPi5-Specific Notes

- Pure C codebase with no framework dependencies — extremely lightweight
- RTL-SDR is ideal for ACARS at 131 MHz — within its tuning range and VHF works well
- HackRF works via SoapyHackRF bridge but RTL-SDR is simpler and cheaper for this application
- Can monitor up to 8 ACARS channels simultaneously from a single SDR
- Shares RTL-SDR bandwidth with no contention — all ACARS channels fit within ~1 MHz
- If running alongside ADS-B (dump1090/readsb), need a separate RTL-SDR dongle (ACARS is 131 MHz, ADS-B is 1090 MHz)

### Argos Integration Notes

- JSON output via UDP (`-j host:port`) feeds directly to Argos backend for real-time display
- Messages include: flight number, aircraft registration, message type, timestamp, signal level, content
- Complements existing ADS-B tracking (dump1090/readsb/tar1090) — ADS-B gives position, ACARS gives communications content
- docker-acarshub option provides a standalone web UI on port 8888 that can be linked from Argos
- Message types valuable for intelligence: position reports, free-text crew messages, weather data, dispatch instructions

### Verdict

**COMPATIBLE** — acarsdec is fully compatible with RPi 5. Pure C, minimal dependencies, excellent performance. The docker-acarshub community image provides a complete solution with web UI. Adds aircraft communications intelligence to complement existing ADS-B position tracking — different and complementary intelligence from the same aircraft.

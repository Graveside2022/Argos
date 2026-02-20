# dumpvdl2

> **RISK CLASSIFICATION**: LOW RISK
> Passive VDL Mode 2 (VHF Data Link) message decoder and protocol analyzer. Decodes digital aviation datalink messages including CPDLC (controller-pilot communications) and ADS-C. Reception is legal worldwide. Receive-only — no transmit capability.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure C with CMake; community multi-arch Docker image (`fredclausen/dumpvdl2:latest`) includes arm64; RPi documented in README

| Method               | Supported | Notes                                                                                                       |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `fredclausen/dumpvdl2:latest` — community multi-arch (amd64, arm64, armv7, armv6, 386); actively maintained |
| **Native Install**   | YES       | Pure C with CMake; RPi build instructions in README; deps: glib-2.0, libacars >= 2.1.0                      |

---

## Tool Description

dumpvdl2 is a VDL Mode 2 (VHF Data Link Mode 2) message decoder and protocol analyzer. VDL2 is the digital successor to ACARS, carrying higher-value aviation data including ACARS messages, CPDLC (Controller-Pilot Data Link Communications), ADS-C (Automatic Dependent Surveillance - Contract), and ATN (Aeronautical Telecommunication Network) messages. VDL2 operates on VHF frequencies around 136.650-136.975 MHz.

Key capabilities:

- Decodes VDL Mode 2 protocol on VHF frequencies (primary: 136.650, 136.800, 136.975 MHz)
- Full ACARS message decoding within VDL2 frames
- CPDLC message decoding — controller-pilot clearances, requests, instructions
- ADS-C contract decoding — automatic position reports requested by ATC
- ATN/FANS protocol support
- Multi-channel simultaneous monitoring
- JSON output format for programmatic consumption
- StatsD metrics output for monitoring
- Optional SQLite aircraft database for enrichment (registration, type, operator)
- libacars library for comprehensive ACARS/FANS message parsing
- RTL-SDR direct support; SoapySDR for HackRF; SDRPlay support
- Network output (UDP/TCP) for feeding to aggregation platforms

## Category

Aviation Digital Datalink / VDL2 Decoding / CPDLC Intelligence / Passive RF Intelligence

## Repository

- **GitHub**: https://github.com/szpajder/dumpvdl2
- **Language**: C
- **License**: GPL-3.0
- **Stars**: ~236

---

## Docker Compatibility

### Can it run in Docker?

**YES** — The `fredclausen/dumpvdl2:latest` community image provides multi-architecture builds including linux/arm64. This is the recommended deployment path for Docker.

### Docker Requirements

- `--device=/dev/bus/usb` — USB passthrough for RTL-SDR
- Host `udev` rules for RTL-SDR device permissions
- Blacklist `dvb_usb_rtl28xxu` kernel module on host
- Environment variables for frequency configuration
- Volume mount for SQLite aircraft database (optional)
- No web UI — output to JSON via network or stdout

### Dockerfile

```dockerfile
# Custom build (if community image unavailable)
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    libglib2.0-dev \
    librtlsdr-dev \
    libusb-1.0-0-dev \
    libsoapysdr-dev \
    libsqlite3-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Build libacars first (required dependency)
RUN git clone https://github.com/szpajder/libacars.git /build/libacars && \
    cd /build/libacars && mkdir build && cd build && \
    cmake .. && make -j$(nproc) && make install

# Build dumpvdl2
RUN git clone https://github.com/szpajder/dumpvdl2.git /build/dumpvdl2

WORKDIR /build/dumpvdl2
RUN mkdir build && cd build && \
    cmake .. -DRTLSDR=ON -DSOAPYSDR=ON -DSQLITE=ON && \
    make -j$(nproc)

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    librtlsdr0 \
    libusb-1.0-0 \
    libsqlite3-0 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/dumpvdl2/build/dumpvdl2 /usr/local/bin/dumpvdl2
COPY --from=builder /usr/local/lib/libacars* /usr/local/lib/
RUN ldconfig

ENTRYPOINT ["dumpvdl2"]
CMD ["--rtlsdr", "0", "136650000", "136800000", "136975000"]
```

### Docker Run Command

```bash
# Use community multi-arch image (recommended)
docker run -d \
  --name dumpvdl2 \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -e FREQUENCIES_VDL2="136.650;136.800;136.975" \
  fredclausen/dumpvdl2:latest

# With JSON UDP output for Argos
docker run -d \
  --name dumpvdl2 \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  --net=host \
  fredclausen/dumpvdl2:latest \
  --rtlsdr 0 136650000 136800000 136975000 \
  --output decoded:json:udp:address=127.0.0.1,port=5556

# Custom build
docker build -t argos/dumpvdl2 .

docker run -d \
  --name dumpvdl2 \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  --net=host \
  argos/dumpvdl2 \
  --rtlsdr 0 136650000 136800000 136975000 \
  --output decoded:json:udp:address=127.0.0.1,port=5556
```

---

## Install Instructions (Native)

```bash
# ============================================
# dumpvdl2 Native Install on Kali Linux RPi5
# ============================================

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  libglib2.0-dev \
  librtlsdr-dev \
  libusb-1.0-0-dev \
  libsqlite3-dev \
  zlib1g-dev

# Optional: SoapySDR support (for HackRF via SoapyHackRF)
sudo apt-get install -y \
  libsoapysdr-dev \
  soapysdr-module-hackrf

# Build libacars (required dependency)
cd /opt
sudo git clone https://github.com/szpajder/libacars.git
cd libacars
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo make install
sudo ldconfig

# Build dumpvdl2
cd /opt
sudo git clone https://github.com/szpajder/dumpvdl2.git
cd dumpvdl2
sudo mkdir build && cd build
sudo cmake .. -DRTLSDR=ON -DSOAPYSDR=ON -DSQLITE=ON
sudo make -j4

# Install binary
sudo cp dumpvdl2 /usr/local/bin/

# Test installation
dumpvdl2 --help

# Blacklist DVB kernel module for RTL-SDR
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtlsdr.conf
sudo modprobe -r dvb_usb_rtl28xxu 2>/dev/null || true

# Run dumpvdl2 with RTL-SDR monitoring 3 VDL2 channels
dumpvdl2 --rtlsdr 0 136650000 136800000 136975000

# Run with JSON output for Argos integration
dumpvdl2 --rtlsdr 0 136650000 136800000 136975000 \
  --output decoded:json:udp:address=127.0.0.1,port=5556

# Run with SoapySDR (HackRF via SoapyHackRF bridge)
dumpvdl2 --soapysdr driver=hackrf 136650000 136800000 136975000 \
  --output decoded:json:udp:address=127.0.0.1,port=5556

# Create systemd service
sudo tee /etc/systemd/system/dumpvdl2.service << 'SERVICEEOF'
[Unit]
Description=dumpvdl2 VDL Mode 2 Decoder
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/dumpvdl2 --rtlsdr 0 136650000 136800000 136975000 \
  --output decoded:json:udp:address=127.0.0.1,port=5556
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable dumpvdl2
sudo systemctl start dumpvdl2
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — pure C, RPi documented in README; community arm64 Docker image available |
| Kali Repo Available   | :x: Not in Kali repos — build from source (with libacars) or use community Docker image            |
| Hardware Requirements | RTL-SDR (direct support, ideal for 136 MHz VHF); HackRF via SoapyHackRF bridge; VHF antenna        |
| Performance on RPi5   | :white_check_mark: Excellent — pure C, multi-channel decode uses ~3-5% CPU; <30 MB RAM             |

### RPi5-Specific Notes

- Pure C codebase — extremely lightweight, nearly identical resource profile to acarsdec
- README specifically documents Raspberry Pi as a supported platform
- RTL-SDR is ideal for VDL2 at 136 MHz — same frequency range as ACARS
- If running alongside acarsdec, both can share one RTL-SDR if frequencies are close enough; otherwise use a second dongle
- libacars dependency must be built first (not in Debian repos) — straightforward CMake build
- SQLite aircraft database enriches messages with registration, aircraft type, and operator data

### Argos Integration Notes

- JSON output via UDP feeds directly to Argos backend
- Decoded messages include: ACARS content, CPDLC clearances, ADS-C position reports
- CPDLC messages are particularly high-value — they contain ATC controller instructions (altitude, heading, speed clearances)
- ADS-C provides contracted automatic position reports — more detailed than ADS-B
- Natural pairing with acarsdec: ACARS gives VHF analog messages, dumpvdl2 gives VHF digital messages
- Combined with ADS-B (dump1090/readsb), provides comprehensive aviation intelligence: position + analog comms + digital comms

### Verdict

**COMPATIBLE** — dumpvdl2 is fully compatible with RPi 5. Pure C, minimal resources, excellent Docker support. Carries higher-value aviation intelligence than ACARS (includes CPDLC and ADS-C). Pairs naturally with acarsdec and existing ADS-B tools to provide comprehensive aviation SIGINT.

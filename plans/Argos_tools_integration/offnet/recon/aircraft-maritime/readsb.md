# readsb

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. readsb is a passive ADS-B Mode S decoder that only receives and decodes aircraft transponder broadcasts on 1090 MHz. No transmit capability. Reception of ADS-B signals is legal in most jurisdictions. This is a receive-only tool with no active scanning or transmission functions.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Optimized for ARM; 30-50% less CPU than dump1090-fa on RPi; ~1-3% CPU, <25MB RAM

| Method               | Supported | Notes                                                                                                                      |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | RTL-SDR USB passthrough (`--device=/dev/bus/usb`); community `sdr-enthusiasts/docker-readsb-protobuf` image supports arm64 |
| **Native Install**   | YES       | Builds from source on aarch64 with `make`; all deps (`librtlsdr-dev`, `libzstd-dev`) in Kali 2025.4 repos                  |

---

## Tool Description

readsb is a high-performance ADS-B Mode S decoder that serves as a modern, drop-in replacement for dump1090-fa. Originally forked from dump1090-fa (which itself was forked from the original dump1090 by antirez), readsb has been significantly refactored and optimized with a focus on improved decoding accuracy, reduced CPU usage, better memory efficiency, and enhanced network performance. It is the recommended decoder for production ADS-B receiver deployments and is the preferred backend for tar1090.

readsb uses zstandard (zstd) compression and optimized internal data handling, resulting in more efficient data processing and reduced CPU overhead compared to dump1090's original format. It maintains full API compatibility with dump1090-fa, meaning all tools and services that consume dump1090 data work seamlessly with readsb.

Key capabilities:

- Drop-in replacement for dump1090-fa with identical network protocols and API endpoints
- Improved Mode S/ADS-B decoding algorithms with better position accuracy
- Reduced CPU usage through optimized internal data representation with zstd compression
- Better memory efficiency and garbage collection
- Enhanced multi-receiver merging (MLAT-compatible output)
- Aircraft database integration for type and registration lookup
- JSON API output fully compatible with dump1090-fa format (`aircraft.json`)
- Beast, raw, SBS/BaseStation network output protocols
- Automatic gain optimization
- Built-in statistics and performance monitoring
- Better handling of CPR (Compact Position Reporting) decoding edge cases
- Optimized for ARM processors (Raspberry Pi)

## Category

Aircraft Tracking / ADS-B Reception / Passive RF Intelligence

## Repository

- **GitHub**: https://github.com/wiedehopf/readsb
- **Language**: C
- **License**: GPL-3.0

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- RTL-SDR USB dongle passed through to the container via `--device` flag
- `librtlsdr` and `libusb` libraries inside the container
- `libzstd` library for zstandard compression
- Host must have `rtl-sdr` udev rules configured for USB device access
- Blacklist `dvb_usb_rtl28xxu` kernel module on the host
- Port mappings for Beast output (30005), raw output (30002), SBS output (30003)
- Shared volume for `/run/readsb/` so tar1090 and other consumers can access aircraft data
- The community `ghcr.io/sdr-enthusiasts/docker-readsb-protobuf` image is the standard Docker deployment

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    ca-certificates \
    librtlsdr-dev \
    libusb-1.0-0-dev \
    libncurses5-dev \
    libzstd-dev \
    pkg-config \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/wiedehopf/readsb.git /build/readsb

WORKDIR /build/readsb
RUN make OPTIMIZE="-O3" RTLSDR=yes BLADERF=no PLUTOSDR=no

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    librtlsdr0 \
    libusb-1.0-0 \
    libncurses6 \
    libzstd1 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/readsb/readsb /usr/bin/readsb
COPY --from=builder /build/readsb/viewadsb /usr/bin/viewadsb

RUN mkdir -p /run/readsb

EXPOSE 30001 30002 30003 30004 30005

VOLUME ["/run/readsb"]

ENTRYPOINT ["readsb"]
CMD ["--net", "--device-type", "rtlsdr", "--device-index", "0", "--fix", \
     "--net-ri-port", "30001", "--net-ro-port", "30002", \
     "--net-sbs-port", "30003", "--net-bi-port", "30004,30104", \
     "--net-bo-port", "30005", "--gain", "autogain", \
     "--max-range", "360", "--write-json", "/run/readsb", \
     "--write-json-every", "1"]
```

### Docker Run Command

```bash
# Basic run with RTL-SDR USB passthrough
docker run -d \
  --name readsb \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 30002:30002 \
  -p 30003:30003 \
  -p 30005:30005 \
  -v readsb-data:/run/readsb \
  readsb \
  --net \
  --device-type rtlsdr \
  --device-index 0 \
  --fix \
  --gain autogain \
  --max-range 360 \
  --write-json /run/readsb \
  --write-json-every 1 \
  --net-ro-port 30002 \
  --net-sbs-port 30003 \
  --net-bo-port 30005 \
  --lat 0.0 \
  --lon 0.0

# Using the community SDR-Enthusiasts image (recommended)
docker run -d \
  --name readsb \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 30002:30002 \
  -p 30003:30003 \
  -p 30005:30005 \
  -v readsb-data:/run/readsb \
  -e TZ=UTC \
  -e READSB_DEVICE_TYPE=rtlsdr \
  -e READSB_FIX=true \
  -e READSB_GAIN=autogain \
  -e READSB_MAX_RANGE=360 \
  -e READSB_NET_ENABLE=true \
  -e READSB_STATS_EVERY=60 \
  -e READSB_STATS_RANGE=true \
  -e READSB_LAT=0.0 \
  -e READSB_LON=0.0 \
  ghcr.io/sdr-enthusiasts/docker-readsb-protobuf:latest

# With specific RTL-SDR serial number
docker run -d \
  --name readsb \
  --restart unless-stopped \
  --device /dev/bus/usb:/dev/bus/usb \
  -p 30005:30005 \
  -v readsb-data:/run/readsb \
  readsb \
  --net \
  --device-type rtlsdr \
  --device serial ADSB1090 \
  --fix \
  --gain autogain \
  --write-json /run/readsb \
  --write-json-every 1
```

---

## Install Instructions (Native)

```bash
# ============================================
# readsb Native Install on Kali Linux RPi5
# ============================================

# Install build dependencies
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  git \
  librtlsdr-dev \
  libusb-1.0-0-dev \
  libncurses5-dev \
  libzstd-dev \
  pkg-config \
  zlib1g-dev

# Blacklist the kernel DVB driver so RTL-SDR is available
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtlsdr.conf
sudo modprobe -r dvb_usb_rtl28xxu 2>/dev/null || true

# Clone readsb
cd /opt
sudo git clone https://github.com/wiedehopf/readsb.git
cd readsb

# Build with ARM64 optimizations
sudo make OPTIMIZE="-O3" RTLSDR=yes BLADERF=no PLUTOSDR=no

# Install binaries
sudo cp readsb /usr/local/bin/
sudo cp viewadsb /usr/local/bin/

# Create data directory
sudo mkdir -p /run/readsb
sudo chown nobody:nogroup /run/readsb

# Create systemd service for automatic startup
sudo tee /etc/systemd/system/readsb.service << 'SERVICEEOF'
[Unit]
Description=readsb ADS-B receiver
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/readsb \
  --net \
  --device-type rtlsdr \
  --device-index 0 \
  --fix \
  --gain autogain \
  --max-range 360 \
  --write-json /run/readsb \
  --write-json-every 1 \
  --net-ro-port 30002 \
  --net-sbs-port 30003 \
  --net-bo-port 30005 \
  --net-ri-port 30001 \
  --net-bi-port 30004,30104 \
  --lat 0.0 \
  --lon 0.0
RuntimeDirectory=readsb
RuntimeDirectoryMode=0755
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable readsb
sudo systemctl start readsb

# Verify operation
sudo systemctl status readsb
viewadsb  # Interactive terminal viewer

# Verify JSON output
ls -la /run/readsb/
cat /run/readsb/aircraft.json | python3 -m json.tool | head -50

# Verify RTL-SDR is detected
rtl_test -t
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full native ARM64/aarch64 support, optimized for ARM platforms                                                                   |
| Kali Repo Available   | :x: Not in Kali repos, builds from source cleanly on Kali                                                                                           |
| Hardware Requirements | RTL-SDR USB dongle (R820T/R820T2 tuner), optional 1090 MHz bandpass filter and dedicated ADS-B antenna                                              |
| Performance on RPi5   | :white_check_mark: Excellent -- lower CPU usage than dump1090-fa due to zstd compression and code optimizations, ~1-3% CPU on Cortex-A76, <25MB RAM |

### RPi5-Specific Notes

- readsb is specifically optimized for ARM processors and performs better than dump1090-fa on Raspberry Pi hardware
- The optimized internal data format with zstd compression reduces memory allocations and CPU cycles
- On the RPi5 Cortex-A76 cores, readsb typically uses 30-50% less CPU than dump1090-fa for the same workload
- JSON output files written to `/run/readsb/` are on tmpfs (RAM disk), avoiding SD card writes
- Autogain feature intelligently adjusts RTL-SDR gain for optimal reception without user intervention
- viewadsb terminal utility works well for headless debugging over SSH
- All build dependencies (`libzstd-dev`, `librtlsdr-dev`) are available in Kali ARM64 repositories

### Argos Integration Notes

- JSON API output at `/run/readsb/aircraft.json` is fully compatible with dump1090-fa format
- Protobuf-based data can also be consumed directly for higher-performance integration
- The `aircraft.json` file is updated every 1 second (configurable via `--write-json-every`)
- Aircraft data includes: hex, flight, alt_baro, alt_geom, gs, track, lat, lon, vert_rate, squawk, category, messages, seen, rssi
- Additional files: `stats.json` (receiver statistics), `receiver.json` (receiver metadata)
- SBS output on port 30003 provides real-time CSV-formatted position reports that can be parsed directly
- Beast binary output on port 30005 is the standard feed format for ADS-B aggregation
- Network raw output supports custom parsing for specialized Argos processing pipelines
- readsb is the recommended backend over dump1090-fa for Argos due to its superior performance characteristics

### Verdict

**COMPATIBLE** -- readsb is an optimized drop-in replacement for dump1090-fa that offers better performance on ARM platforms like the RPi5. It compiles natively on aarch64, uses less CPU and memory than its predecessor, and maintains full API and protocol compatibility. All build dependencies are available in Kali repositories. readsb is the recommended ADS-B decoder for the Argos platform due to its superior efficiency and active maintenance.

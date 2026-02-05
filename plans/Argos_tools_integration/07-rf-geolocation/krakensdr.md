# KrakenSDR

> **RISK CLASSIFICATION**: LOW RISK
> Passive RF direction-of-arrival receiver with no transmit capability; receives and processes coherent IQ samples only. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python-based DOA with NumPy/SciPy; validated on RPi4, RPi5 provides better performance

| Method               | Supported | Notes                                                                                                         |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | USB passthrough (`--privileged --device=/dev/bus/usb`) for 5-channel receiver; python:3.11-slim-bookworm base |
| **Native Install**   | YES       | All dependencies (librtlsdr, NumPy, SciPy) available as ARM64 packages on Kali 2025.4                         |

---

## Tool Description

KrakenSDR is a 5-channel coherent RTL-SDR array designed for real-time direction of arrival (DOA) estimation using the MUSIC (MUltiple SIgnal Classification) algorithm. It receives RF signals across five synchronized RTL-SDR tuners sharing a common clock and noise source, producing calibrated phase-difference measurements that resolve the bearing to any transmitter within its frequency range (24 MHz to 1.766 GHz). The system includes a Python-based backend for signal processing and a web-based UI for real-time bearing display, heatmap generation, and integration with mapping systems. When paired with DF Aggregator and multiple deployed units, it enables full RF transmitter triangulation and geolocation on the tactical map.

## Category

RF Direction Finding / Coherent SDR Array / Passive Geolocation

## Repository

https://github.com/krakenrf/krakensdr_doa

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - KrakenSDR DOA runs fully in Docker. The application consists of a Python signal processing backend (using NumPy/SciPy for MUSIC algorithm computation) and a Dash-based web UI. Both run as standard userspace processes. The only hardware dependency is USB passthrough for the KrakenSDR 5-channel receiver unit, which presents as a composite USB device exposing five RTL-SDR endpoints.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for the KrakenSDR hardware unit (exposes 5 RTL-SDR tuners as a single composite device)
- `--privileged` - Required for direct USB device access to the KrakenSDR hardware and its internal USB hub
- No `--net=host` strictly required, but recommended for simplified access to the web UI and for DF Aggregator network discovery
- Host kernel module `dvb_usb_rtl28xxu` must be **blacklisted** to prevent the kernel from claiming the RTL-SDR tuners before the application can access them
- Standard USB drivers (`usbcore`, `ehci_hcd`, `xhci_hcd`) must be loaded (default on Kali)
- Host `udev` rules for RTL-SDR device permissions (auto-configured by `rtl-sdr` package or manually via `/etc/udev/rules.d/`)

### Docker-to-Host Communication

- Web UI served on port **8080** (configurable) - map to host via `-p 8080:8080` or use `--net=host`
- Data output port **8081** for JSON bearing/DOA data stream - consumed by DF Aggregator or Argos integration layer
- KrakenSDR settings API available on the web UI port for programmatic configuration
- Volume mount recommended for persistent configuration: `-v /host/kraken-config:/app/settings`
- For multi-unit deployments, each KrakenSDR instance must be network-accessible to the DF Aggregator service

---

## Install Instructions (Docker on Kali RPi 5)

### Prerequisites (Host)

```bash
# Blacklist kernel DVB driver to prevent it from claiming RTL-SDR tuners
echo 'blacklist dvb_usb_rtl28xxu' | sudo tee /etc/modprobe.d/blacklist-rtlsdr.conf
sudo modprobe -r dvb_usb_rtl28xxu

# Install RTL-SDR udev rules on host
sudo apt-get update && sudo apt-get install -y rtl-sdr
# Unplug and replug KrakenSDR after udev rules are installed
```

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ARG KRAKEN_VERSION=main

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    cmake \
    libusb-1.0-0-dev \
    librtlsdr-dev \
    rtl-sdr \
    libfftw3-dev \
    libatlas-base-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Clone KrakenSDR DOA repository
RUN cd /opt && \
    git clone --recursive --branch ${KRAKEN_VERSION} \
    https://github.com/krakenrf/krakensdr_doa.git

WORKDIR /opt/krakensdr_doa

# Install Python dependencies
RUN pip install --no-cache-dir \
    numpy \
    scipy \
    dash \
    dash-bootstrap-components \
    plotly \
    pyrtlsdr \
    requests \
    Flask \
    gunicorn

# Build the coherent RTL-SDR driver (librtlsdr with coherent patch)
RUN if [ -d "krakensdr_driver" ]; then \
    cd krakensdr_driver && \
    mkdir -p build && cd build && \
    cmake .. -DINSTALL_UDEV_RULES=OFF && \
    make -j$(nproc) && \
    make install && \
    ldconfig; \
    fi

EXPOSE 8080 8081

ENTRYPOINT ["bash", "gui_run.sh"]
```

### Build and Run

```bash
# Build the Docker image
docker build -t argos/krakensdr .

# Run KrakenSDR DOA with USB passthrough
docker run -d --rm \
  --name krakensdr \
  --privileged \
  --device=/dev/bus/usb \
  -p 8080:8080 \
  -p 8081:8081 \
  -v $(pwd)/kraken-config:/opt/krakensdr_doa/settings \
  argos/krakensdr

# Verify the web UI is accessible
curl -s http://localhost:8080 | head -5

# Alternative: use host networking for simpler multi-unit setups
docker run -d --rm \
  --name krakensdr \
  --privileged \
  --device=/dev/bus/usb \
  --net=host \
  -v $(pwd)/kraken-config:/opt/krakensdr_doa/settings \
  argos/krakensdr
```

### Argos Integration

```bash
# KrakenSDR exposes DOA bearing data as JSON on port 8081
# Argos can poll or stream this data for tactical map overlay:
#   - bearing_angle: estimated direction to transmitter (degrees)
#   - confidence: MUSIC algorithm confidence metric
#   - frequency: center frequency being monitored
#   - latitude/longitude: KrakenSDR unit position (GPS-fed)
#
# Example JSON output:
# {"bearing": 142.5, "confidence": 0.87, "freq_mhz": 433.92,
#  "lat": 38.8977, "lon": -77.0365, "timestamp": 1706000000}
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - KrakenSDR DOA software is Python-based with NumPy/SciPy for signal processing, all of which have mature ARM64 (aarch64) wheel builds. The project has been explicitly tested and documented for Raspberry Pi 4 deployment by the KrakenRF team. The RPi5 Cortex-A76 cores provide substantially better floating-point performance than the RPi4 Cortex-A72 cores, improving MUSIC algorithm computation speed. The coherent RTL-SDR driver compiles natively on ARM64 without modification.

### Hardware Constraints

- **CPU**: MUSIC algorithm DOA computation is moderately CPU-intensive. The RPi5 4x Cortex-A76 at 2.4 GHz handles real-time DOA processing comfortably, with significant headroom over the RPi4 where it was originally validated. Multi-channel coherent processing uses approximately 30-50% of available CPU.
- **RAM**: Runtime memory consumption is approximately 500MB-1GB depending on FFT size and averaging settings. Well within the 8GB available on the target system.
- **Storage**: Application and dependencies require approximately 1-2GB of disk space. Minimal storage I/O during operation.
- **Hardware**: Requires the KrakenSDR 5-channel coherent receiver (~$150 USD) connected via USB. The unit draws approximately 1.5A from USB; an externally powered USB hub is recommended on the RPi5 to ensure stable power delivery to all five tuners.
- **Antenna**: Requires a 5-element uniform circular antenna array (UCA) matched to the target frequency. KrakenRF provides reference antenna array designs.
- **GPS**: Optional but strongly recommended for georeferenced bearings. USB GPS module (e.g., u-blox 7/8) provides position data for map integration.

### Verdict

**COMPATIBLE** - KrakenSDR is a top-5 priority tool for Argos and runs natively on the Raspberry Pi 5 with ARM64 support. The RPi5 provides better performance than the RPi4 where KrakenSDR was originally validated. Docker containerization provides clean dependency isolation. The combination of KrakenSDR hardware (~$150), RPi5, and the MUSIC DOA algorithm delivers professional-grade RF direction finding at a fraction of the cost of commercial DF systems. Deploy multiple units with DF Aggregator for full transmitter triangulation on the Argos tactical map.

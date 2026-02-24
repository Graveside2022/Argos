# OpenWebRX

> **✅ ALREADY INTEGRATED IN ARGOS** — Docker container configured in `docker/docker-compose.portainer-dev.yml` (port 8073, USB passthrough, `privileged: true`). API proxy at `src/routes/api/openwebrx/control/+server.ts`. Environment variables `PUBLIC_OPENWEBRX_URL` and `OPENWEBRX_PASSWORD` in `.env`. **No additional integration work required.**

> **RISK CLASSIFICATION**: LOW RISK
> Passive web-based SDR receiver with no transmit capability; provides receive-only demodulation and visualization via browser interface. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Official Docker image provides multi-arch arm64 builds; already installed natively on Argos system

| Method               | Supported | Notes                                                                                          |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | **ACTIVE** — already in `docker-compose.portainer-dev.yml` with web UI on port 8073            |
| **Native Install**   | YES       | Already installed on Argos system; all dependencies available as ARM64 packages in Kali 2025.4 |

---

## Tool Description

OpenWebRX is a multi-user web-based SDR receiver application that enables real-time radio reception, demodulation, and visualization directly in a web browser. It supports a wide range of SDR hardware including HackRF, RTL-SDR, USRP, Airspy, and SoapySDR-compatible devices. The application provides a spectrum waterfall display, AM/FM/SSB/CW/digital mode demodulation, and allows multiple simultaneous users to tune independently on the same receiver. OpenWebRX is installed on the Argos system and typically runs on port 8073, providing a complementary browser-based SDR interface alongside the Argos built-in spectrum analyzer.

## Category

Web-Based SDR Receiver / Multi-User Radio Interface / Signal Demodulation

## Repository

https://github.com/jketterl/openwebrx (OpenWebRX+, actively maintained fork)

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - OpenWebRX has an official Docker image maintained by the project. It runs cleanly in Docker with USB passthrough for the SDR hardware. The application is a self-contained web server that serves the receiver interface to browsers.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for SDR hardware (HackRF, RTL-SDR, or other supported device)
- `--privileged` - Required for direct USB device access to SDR hardware
- No `--net=host` strictly required; port mapping via `-p 8073:8073` is sufficient
- Host kernel module `dvb_usb_rtl28xxu` must be **blacklisted** if using RTL-SDR dongles
- Host `udev` rules for SDR device permissions

### Docker-to-Host Communication

- Web UI served on port **8073** (configurable) - map via `-p 8073:8073`
- Audio streaming to browser via WebSocket (included in web UI port)
- Volume mount for persistent configuration: `-v /host/openwebrx-config:/var/lib/openwebrx`
- Volume mount for recorded audio/data: `-v /host/recordings:/tmp/openwebrx`
- SDR device passed through via USB; no additional host services required

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Official Docker Image (Recommended)

```bash
# Pull the official OpenWebRX+ Docker image
docker pull jketterl/openwebrx-full:latest

# Run with HackRF USB passthrough
docker run -d --rm \
  --name openwebrx \
  --privileged \
  --device=/dev/bus/usb \
  -p 8073:8073 \
  -v $(pwd)/openwebrx-config:/var/lib/openwebrx \
  jketterl/openwebrx-full:latest

# Run with RTL-SDR USB passthrough
docker run -d --rm \
  --name openwebrx \
  --privileged \
  --device=/dev/bus/usb \
  -p 8073:8073 \
  -v $(pwd)/openwebrx-config:/var/lib/openwebrx \
  jketterl/openwebrx-full:latest

# Verify the web UI is accessible
curl -s http://localhost:8073 | head -5

# Access the web UI in a browser:
# http://<rpi5-ip>:8073
```

### Option B: Custom Dockerfile

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-setuptools \
    rtl-sdr \
    librtlsdr-dev \
    hackrf \
    libhackrf-dev \
    libsoapysdr-dev \
    soapysdr-module-all \
    sox \
    netcat-openbsd \
    csdr \
    && rm -rf /var/lib/apt/lists/*

RUN cd /opt && \
    git clone https://github.com/jketterl/openwebrx.git && \
    cd openwebrx && \
    pip install --no-cache-dir --break-system-packages .

WORKDIR /opt/openwebrx

EXPOSE 8073

ENTRYPOINT ["python3", "openwebrx.py"]
```

```bash
# Build custom image
docker build -t argos/openwebrx .

# Run with SDR hardware
docker run -d --rm \
  --name openwebrx \
  --privileged \
  --device=/dev/bus/usb \
  -p 8073:8073 \
  -v $(pwd)/openwebrx-config:/var/lib/openwebrx \
  argos/openwebrx
```

### Option C: Native Install (Already Installed)

```bash
# OpenWebRX is already installed on the Argos system.
# Verify installation:
which openwebrx || dpkg -l | grep openwebrx

# Start natively:
openwebrx
# Access at http://localhost:8073
```

### SDR Device Configuration

```bash
# OpenWebRX supports multiple SDR backends. Configure via the web admin
# interface at http://localhost:8073/settings or via configuration file.
#
# Common device configurations:
#
# HackRF One:
#   Type: soapysdr
#   Device: driver=hackrf
#
# RTL-SDR:
#   Type: rtl_sdr
#   Device: 0 (device index)
#
# USRP:
#   Type: soapysdr
#   Device: driver=uhd
#
# Multiple devices can be configured simultaneously for different
# frequency bands. Each device appears as a separate "profile" in
# the web UI that users can switch between.
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - OpenWebRX and its dependencies are available as ARM64 packages. The official Docker image provides multi-architecture builds including arm64. The csdr DSP library, which handles real-time signal processing, compiles natively on aarch64 with NEON SIMD optimization for the Cortex-A76. All Python components are architecture-independent.

### Hardware Constraints

- **CPU**: Real-time demodulation is moderately CPU-intensive depending on the mode and bandwidth. AM/FM demodulation at standard broadcast bandwidths uses approximately 10-20% of a single Cortex-A76 core. Wideband digital modes (DMR, D-STAR, C4FM) use more CPU. Multiple simultaneous users increase CPU load proportionally.
- **RAM**: Approximately 200-400MB runtime memory. Each active user session adds approximately 20-50MB for independent tuning buffers. Well within 8GB for typical multi-user scenarios.
- **Storage**: Application and dependencies require approximately 500MB-1GB. Audio recordings consume storage proportional to duration and sample rate.
- **Hardware**: Requires at least one supported SDR device (HackRF, RTL-SDR, USRP, Airspy). Uses the same SDR hardware as other Argos modules. Note that SDR hardware cannot be shared simultaneously between OpenWebRX and other applications (e.g., HackRF Spectrum).
- **Network**: Web interface requires network access from client browsers. Audio streaming bandwidth is approximately 50-100 kbps per active user.

### Verdict

**COMPATIBLE** - OpenWebRX runs natively on the Raspberry Pi 5 with full ARM64 support. It is already installed on the Argos system and provides a complementary browser-based SDR interface. The official Docker image supports arm64 architecture for clean containerized deployment. The RPi5 Cortex-A76 cores handle real-time demodulation and multi-user access without difficulty. Port 8073 is the standard access point.

# SoapyRemote

> **RISK CLASSIFICATION**: LOW RISK
> Network SDR streaming server/client. Makes local SDR hardware available to remote applications over the network. No signal interception or transmission capability on its own — infrastructure/transport tool only.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — C++ with CMake; Debian packages available for ARM64 (`Architecture: any`); SoapySDR ecosystem confirmed on RPi

| Method               | Supported | Notes                                                                                                       |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| **Docker Container** | PARTIAL   | No official image; custom Dockerfile needed (simple: CMake + SoapySDR); SDR USB passthrough for server mode |
| **Native Install**   | YES       | Build from source with CMake; SoapySDR available in Debian/Kali ARM64 repos                                 |

---

## Tool Description

SoapyRemote is a network transport layer for the SoapySDR abstraction framework. It allows any SoapySDR-compatible SDR hardware to be accessed over the network, effectively separating the SDR hardware from the processing application. Run the SoapyRemote server on the device with the SDR attached, and any SoapySDR application on another machine can use the remote SDR as if it were locally connected.

Key capabilities:

- **Server mode** (`SoapySDRServer`): Exposes local SDR hardware over the network
    - Automatic device discovery via Avahi/mDNS (zero-configuration networking)
    - Supports all SoapySDR device modules: HackRF, RTL-SDR, USRP, Airspy, BladeRF, LimeSDR, PlutoSDR
    - Low-latency TCP/UDP streaming of IQ samples
    - Multiple concurrent client connections
    - Configurable sample format, compression, and MTU
- **Client mode** (`remote:driver=remote,remote=<ip>`): Connect to a remote SoapySDR server
    - Transparent to applications — any SoapySDR app works without modification
    - Automatic format negotiation between client and server
    - Reconnection handling for network interruptions
- **Use cases**:
    - SDR antenna at an elevated/remote position, processing at a base station
    - Multiple processing tools sharing one SDR
    - Distributed sensor networks with centralized processing
    - Remote access to lab SDR equipment

## Category

SDR Infrastructure / Network SDR Streaming / Distributed SDR Architecture

## Repository

- **GitHub**: https://github.com/pothosware/SoapyRemote
- **Language**: C++
- **License**: Boost Software License
- **Stars**: ~142

---

## Docker Compatibility

### Can it run in Docker?

**PARTIAL** — No official Docker image. Custom Dockerfile is straightforward (CMake + SoapySDR + device modules). Server mode requires SDR USB passthrough and network access. Client mode requires no special permissions.

### Docker Requirements (Server Mode)

- `--privileged` — Required for USB passthrough to SDR hardware
- `--device=/dev/bus/usb` — USB passthrough for SDR hardware
- `--net=host` — Recommended for Avahi/mDNS device discovery and low-latency streaming
- Port 55132 (default SoapyRemote server port) if not using `--net=host`
- Host `udev` rules for SDR device permissions
- SoapySDR device modules for connected hardware (e.g., `soapysdr-module-hackrf`)

### Dockerfile

```dockerfile
FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    pkg-config \
    libsoapysdr-dev \
    libavahi-client-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/pothosware/SoapyRemote.git /build/SoapyRemote

WORKDIR /build/SoapyRemote
RUN mkdir build && cd build && \
    cmake .. && \
    make -j$(nproc) && \
    make install

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsoapysdr0.8 \
    soapysdr-module-hackrf \
    soapysdr-module-rtlsdr \
    libavahi-client3 \
    avahi-daemon \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/SoapySDR/modules*/libremoteSupport.so /usr/local/lib/SoapySDR/modules0.8/
COPY --from=builder /usr/local/bin/SoapySDRServer /usr/local/bin/
RUN ldconfig

EXPOSE 55132

ENTRYPOINT ["SoapySDRServer"]
CMD ["--bind"]
```

### Docker Run Command

```bash
# Build the image
docker build -t argos/soapy-remote .

# Run SoapyRemote server (expose local SDR over network)
docker run -d \
  --name soapy-remote \
  --restart unless-stopped \
  --privileged \
  --net=host \
  --device=/dev/bus/usb \
  argos/soapy-remote \
  --bind

# Run with specific bind address and port
docker run -d \
  --name soapy-remote \
  --restart unless-stopped \
  --privileged \
  --device=/dev/bus/usb \
  -p 55132:55132 \
  argos/soapy-remote \
  --bind="0.0.0.0:55132"

# Test remote SDR from client machine
# On any machine with SoapySDR installed:
# SoapySDRUtil --find="driver=remote,remote=<pi-ip>"
# SoapySDRUtil --probe="driver=remote,remote=<pi-ip>"
```

---

## Install Instructions (Native)

```bash
# ============================================
# SoapyRemote Native Install on Kali Linux RPi5
# ============================================

# Install SoapySDR and device modules
sudo apt-get update
sudo apt-get install -y \
  libsoapysdr-dev \
  soapysdr-tools \
  soapysdr-module-hackrf \
  soapysdr-module-rtlsdr

# Optional: Avahi for automatic discovery
sudo apt-get install -y libavahi-client-dev avahi-daemon

# Build SoapyRemote from source
sudo apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config

cd /opt
sudo git clone https://github.com/pothosware/SoapyRemote.git
cd SoapyRemote
sudo mkdir build && cd build
sudo cmake ..
sudo make -j4
sudo make install
sudo ldconfig

# Verify installation
SoapySDRServer --help

# Verify local SDR devices are detected
SoapySDRUtil --find

# ============================================
# Usage
# ============================================

# Start SoapyRemote server (binds to all interfaces)
SoapySDRServer --bind

# Start with specific bind address
SoapySDRServer --bind="0.0.0.0:55132"

# From a remote client, find the remote SDR
SoapySDRUtil --find="driver=remote,remote=<pi-ip>"

# From a remote client, probe the remote SDR
SoapySDRUtil --probe="driver=remote,remote=<pi-ip>"

# Use remote SDR with any SoapySDR-compatible tool
# Example: Use remote HackRF with acarsdec via SoapySDR
# On client machine:
# acarsdec -s -d "driver=remote,remote=<pi-ip>" 131.550 131.525 131.725

# Example: Use remote RTL-SDR with dumpvdl2
# On client machine:
# dumpvdl2 --soapysdr "driver=remote,remote=<pi-ip>" 136650000

# Create systemd service for persistent SoapyRemote server
sudo tee /etc/systemd/system/soapy-remote.service << 'SERVICEEOF'
[Unit]
Description=SoapyRemote SDR Network Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/SoapySDRServer --bind
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload
sudo systemctl enable soapy-remote
sudo systemctl start soapy-remote
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: Full — Debian packages `Architecture: any`; SoapySDR ecosystem confirmed on RPi ARM64 |
| Kali Repo Available   | :x: SoapyRemote not in repos (SoapySDR core is); build SoapyRemote from source                           |
| Hardware Requirements | Any SoapySDR-compatible SDR (HackRF, RTL-SDR, USRP, Airspy, etc.); network connection for remote access  |
| Performance on RPi5   | :white_check_mark: Good — C++ networking overhead is minimal; actual DSP load is on the client side      |

### RPi5-Specific Notes

- SoapySDR core framework and device modules (hackrf, rtlsdr) install via apt on Kali ARM64
- Only SoapyRemote itself needs to be built from source — straightforward CMake build
- Server mode CPU usage is minimal — it's primarily a network I/O task (forwarding samples)
- The heavy signal processing happens on the remote client, not on the RPi 5
- RPi 5 USB 3.0 ports provide adequate bandwidth for SDR sample streaming
- Network bandwidth: at 20 MSPS complex float32 (HackRF max), streaming requires ~160 Mbps — works on Gigabit Ethernet, may strain WiFi
- Avahi/mDNS enables automatic discovery of the SoapyRemote server by clients on the same network

### Argos Integration Notes

- Enables future multi-node Argos deployments: SDR at a remote observation post, processing at the TOC
- RPi 5 + HackRF as a remote SDR sensor node, with SoapyRemote streaming to a more powerful processing machine
- Not needed for single-node deployment but valuable infrastructure for scaling
- Any SoapySDR-compatible tool in the Argos suite can use remote SDRs transparently
- SoapyHackRF bridge is also the mechanism that tools like acarsdec and dumpvdl2 use to access HackRF — SoapyRemote extends this over the network

### Verdict

**COMPATIBLE** — SoapyRemote builds and runs on RPi 5 with minimal resource usage. It's an infrastructure tool that enables distributed SDR architectures — not immediately needed for single-node Argos but provides valuable scaling capability for multi-node deployments. Lower priority for initial setup, higher priority when expanding to distributed sensor configurations.

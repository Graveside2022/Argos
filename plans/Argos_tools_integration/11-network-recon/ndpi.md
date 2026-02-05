# nDPI

> **RISK CLASSIFICATION**: MODERATE RISK
> Deep packet inspection library that identifies 300+ application protocols from network traffic. Passive analysis tool with no active network manipulation. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — C library compiles natively on ARM64; ntop project actively supports ARM64

| Method               | Supported | Notes                                                                                         |
| -------------------- | --------- | --------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `debian:bookworm-slim` base; builds from source with autotools; `--net=host` for live capture |
| **Native Install**   | YES       | Available via `apt install ndpi ntopng` or compile from source on ARM64                       |

---

## Tool Description

nDPI (ntop Deep Packet Inspection) is an open-source C library for deep packet inspection, developed by ntop. It identifies over 300 application-layer protocols and services from network traffic by analyzing packet headers, payload patterns, and behavioral characteristics. nDPI supports protocol detection for encrypted traffic (TLS/QUIC fingerprinting), application classification (social media, streaming, VPN, tunneling), and risk scoring. It provides both a C library API and Python bindings for integration into monitoring pipelines.

## Category

Deep Packet Inspection / Protocol Identification / Traffic Analysis

## Repository

https://github.com/ntop/nDPI

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - nDPI runs in Docker with host networking for live traffic capture, or without special networking for offline PCAP analysis. The library compiles from source on ARM64 with standard build tools.

### Host OS-Level Requirements

- `--net=host` - Required for live traffic capture on host network interfaces
- `--privileged` - Required only if capturing traffic on raw network interfaces (not needed for PCAP file analysis)
- No USB device passthrough required (operates on network traffic, not USB hardware)
- Host kernel modules: Standard networking stack; no additional modules required
- Optional: `libpcap` on host for packet capture (included in most Kali installations)

### Docker-to-Host Communication

- Live traffic capture requires `--net=host` for access to host network interfaces
- PCAP files can be analyzed without host networking via volume mount: `-v /host/pcaps:/pcaps`
- nDPI results can be exported via JSON output to mounted volumes
- Integration with ntopng possible via shared network namespace

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install

```bash
# Install from Kali repos (ntopng includes nDPI)
sudo apt-get update && sudo apt-get install -y ndpi ntopng

# Or build from source for latest version
sudo apt-get install -y build-essential git autoconf automake libtool \
    libpcap-dev libjson-c-dev libgcrypt20-dev
git clone https://github.com/ntop/nDPI.git /opt/nDPI
cd /opt/nDPI
./autogen.sh
./configure
make -j$(nproc)
sudo make install
```

### Option B: Docker

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    autoconf \
    automake \
    libtool \
    libpcap-dev \
    libjson-c-dev \
    libgcrypt20-dev \
    pkg-config \
    python3 \
    python3-dev \
    python3-pip \
    tcpdump \
    tshark \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/ntop/nDPI.git /opt/ndpi

WORKDIR /opt/ndpi

RUN ./autogen.sh && \
    ./configure && \
    make -j$(nproc) && \
    make install && \
    ldconfig

RUN mkdir -p /pcaps /output

ENTRYPOINT ["ndpiReader"]
CMD ["--help"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/ndpi .

# Run - analyze a PCAP file
docker run --rm -it \
  -v $(pwd)/pcaps:/pcaps \
  -v $(pwd)/output:/output \
  argos/ndpi -i /pcaps/capture.pcap -v 2 -j /output/results.json

# Run - live traffic capture on host interface
docker run --rm -it \
  --privileged \
  --net=host \
  argos/ndpi -i eth0 -v 2

# Run - live capture with JSON output
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/output:/output \
  argos/ndpi -i eth0 -v 2 -j /output/live_analysis.json

# Run - analyze specific protocol categories
docker run --rm -it \
  --privileged \
  --net=host \
  argos/ndpi -i eth0 -p /opt/ndpi/example/protos.txt
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - nDPI compiles natively on ARM64 (aarch64) with standard autotools build chain. The ntop project actively supports ARM64 platforms. All dependencies (libpcap, libjson-c, libgcrypt) are available in Kali ARM64 repositories.

### Hardware Constraints

- CPU: DPI analysis is moderately CPU-intensive at high traffic volumes. Cortex-A76 quad-core handles typical LAN traffic volumes (100-500 Mbps) without difficulty. High-throughput analysis (1 Gbps+) may show elevated CPU usage
- RAM: ~200-500MB depending on traffic volume and number of tracked flows; well within 8GB
- Hardware: No specialized hardware required. Uses standard network interfaces for traffic capture
- Storage: ~200MB for compiled library and Docker image. Output files scale with analysis duration

### Verdict

**COMPATIBLE** - nDPI compiles and runs natively on Kali RPi 5 ARM64. The library is lightweight and well-optimized for traffic analysis. Suitable for field-deployed network reconnaissance where protocol identification enhances situational awareness. Python bindings enable integration with Argos analytics pipelines.

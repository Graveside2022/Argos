# p0f

> **RISK CLASSIFICATION**: LOW RISK
> Completely passive OS fingerprinting tool that identifies operating systems from TCP/IP stack behavior without sending any packets. Zero detection risk. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Lightweight C binary; pre-built package in Kali ARM64 repos

| Method               | Supported | Notes                                                                                         |
| -------------------- | --------- | --------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `debian:bookworm-slim` base; compiles from source with libpcap; `--net=host` for live capture |
| **Native Install**   | YES       | `apt install p0f`; recommended over Docker due to minimal footprint                           |

---

## Tool Description

p0f is a passive traffic fingerprinting tool that identifies operating systems, network devices, and connection properties by analyzing the unique characteristics of TCP/IP stack implementations. Unlike active scanners such as Nmap, p0f never sends any packets; it operates entirely by observing existing network traffic. It analyzes TCP SYN/SYN+ACK packets, HTTP headers, MTU values, window sizes, and other protocol-level signatures to determine the OS, browser, link type, and network distance of communicating hosts.

## Category

Passive OS Fingerprinting / Network Intelligence / Traffic Analysis

## Repository

https://github.com/p0f/p0f

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - p0f runs cleanly in Docker with host networking for live traffic capture. It is a lightweight C binary with minimal dependencies and no GUI requirement.

### Host OS-Level Requirements

- `--net=host` - Required for access to host network interfaces for passive traffic monitoring
- `--privileged` - Required for raw packet capture (promiscuous mode) on network interfaces
- No USB device passthrough required (operates on network traffic only)
- No additional host kernel modules required beyond standard networking stack
- No `--device` flags needed

### Docker-to-Host Communication

- Requires `--net=host` for passive monitoring of host network traffic
- p0f fingerprint database updates via volume mount or image rebuild
- Log output via volume mount: `-v /host/p0f-logs:/logs`
- Can also analyze offline PCAP files without host networking
- Emits no network traffic; completely undetectable to targets

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended)

```bash
sudo apt-get update && sudo apt-get install -y p0f
```

### Option B: Docker

```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    libpcap-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/p0f/p0f.git /opt/p0f

WORKDIR /opt/p0f

RUN make -j$(nproc)

RUN mkdir -p /logs

ENTRYPOINT ["./p0f"]
CMD ["-h"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/p0f .

# Run - passive monitoring on host interface
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/p0f-logs:/logs \
  argos/p0f -i eth0 -o /logs/p0f.log

# Run - monitor all interfaces
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/p0f-logs:/logs \
  argos/p0f -i any -o /logs/p0f.log

# Run - analyze a PCAP file (no host networking needed)
docker run --rm -it \
  -v $(pwd)/pcaps:/pcaps \
  -v $(pwd)/p0f-logs:/logs \
  argos/p0f -r /pcaps/capture.pcap -o /logs/p0f.log

# Run - with API socket for integration
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/p0f-logs:/logs \
  argos/p0f -i eth0 -o /logs/p0f.log -s /logs/p0f.sock
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - p0f is a lightweight C application that compiles natively on ARM64 with standard gcc and libpcap. Pre-built package available in Kali ARM64 repositories via `apt install p0f`.

### Hardware Constraints

- CPU: Extremely lightweight; passive packet analysis uses negligible CPU even at high traffic volumes. A single Cortex-A76 core handles gigabit traffic monitoring
- RAM: Very low memory footprint (~10-30MB); negligible impact on 8GB system
- Hardware: No specialized hardware required. Uses standard network interfaces. Works with any Ethernet or WiFi interface
- Storage: Minimal (<10MB binary plus fingerprint database)

### Verdict

**COMPATIBLE** - p0f is one of the lightest network analysis tools available. Pre-built ARM64 package in Kali repos. Docker adds no benefit beyond isolation; native install recommended. The tool's completely passive nature makes it ideal for covert network reconnaissance where detection avoidance is critical.

# Satori

> **RISK CLASSIFICATION**: MODERATE RISK
> Device fingerprinting tool that identifies network devices via DHCP, CDP, mDNS, and UPnP protocol signatures. Primarily passive with some active query modes. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python application; no architecture-specific dependencies

| Method               | Supported | Notes                                                                                                           |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `python:3.11-slim-bookworm` base; `--privileged` and `--net=host` for broadcast traffic capture                 |
| **Native Install**   | YES       | Pure Python with pip-installable dependencies (pypacker, pcapyplus, untangle, requests); runs natively on ARM64 |

---

## Tool Description

Satori is a network device fingerprinting tool that identifies device types, operating systems, and manufacturers by analyzing protocol-specific signatures in DHCP requests, Cisco Discovery Protocol (CDP) announcements, mDNS/Bonjour broadcasts, UPnP SSDP responses, and HTTP User-Agent headers. It maintains an XML-based fingerprint database that maps protocol characteristics to specific device models and OS versions. Satori operates primarily in passive mode, observing broadcast traffic, but can also actively query devices for enhanced identification accuracy.

## Category

Device Fingerprinting / Network Asset Identification / Passive Reconnaissance

## Repository

https://github.com/xnih/satori

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Satori runs in Docker with host networking for live traffic capture. It is a Python application with standard library dependencies and no GUI requirement for core fingerprinting operations.

### Host OS-Level Requirements

- `--net=host` - Required for passive capture of broadcast traffic (DHCP, mDNS, SSDP) on host network
- `--privileged` - Required for raw packet capture on network interfaces
- No USB device passthrough required (network-only tool)
- No additional host kernel modules required
- Broadcast traffic monitoring requires the interface to be on the same network segment as target devices

### Docker-to-Host Communication

- Requires `--net=host` for access to LAN broadcast traffic (DHCP, mDNS, CDP, UPnP)
- Fingerprint database and results via volume mount: `-v /host/satori:/data`
- Can also analyze PCAP files offline without host networking
- Active query mode sends standard protocol requests (SSDP M-SEARCH, mDNS queries) that blend with normal network traffic

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    git \
    libpcap-dev \
    tcpdump \
    tshark \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/xnih/satori.git /opt/satori

WORKDIR /opt/satori

RUN pip install --no-cache-dir \
    pypacker \
    pcapyplus \
    untangle \
    requests \
    netifaces \
    2>/dev/null || true

RUN mkdir -p /data

ENTRYPOINT ["python3", "satori.py"]
CMD ["--help"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/satori .

# Run - passive fingerprinting on host interface
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/satori-data:/data \
  argos/satori -i eth0

# Run - analyze a PCAP file
docker run --rm -it \
  -v $(pwd)/pcaps:/pcaps \
  -v $(pwd)/satori-data:/data \
  argos/satori -r /pcaps/capture.pcap

# Run - fingerprint specific target via active probing
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/satori-data:/data \
  argos/satori -i eth0 -t 192.168.1.0/24

# Run - DHCP fingerprinting only
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/satori-data:/data \
  argos/satori -i eth0 --dhcp
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Satori is a pure Python application with no architecture-specific compiled extensions. All dependencies (pypacker, pcapyplus, untangle, requests, netifaces) are available for ARM64 on Kali Linux via pip or apt.

### Hardware Constraints

- CPU: Lightweight Python application; passive traffic monitoring and fingerprint matching are not computationally intensive. Cortex-A76 handles this with minimal load
- RAM: ~100-200MB during operation; fingerprint database is small (XML-based). Well within 8GB
- Hardware: No specialized hardware required. Standard Ethernet or WiFi interface for traffic capture. Works best on wired LAN segments where broadcast traffic is visible
- Storage: Minimal (<100MB including Python dependencies and fingerprint database)

### Verdict

**COMPATIBLE** - Satori runs natively on Kali RPi 5 ARM64 as a pure Python application. No platform constraints. The tool is lightweight and ideal for passive network asset discovery during field deployments. The fingerprint database can be extended with custom signatures for targeted device identification.

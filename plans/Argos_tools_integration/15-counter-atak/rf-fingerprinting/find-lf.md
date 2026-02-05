# find-lf

> **RISK CLASSIFICATION**: LOW RISK - PASSIVE POSITIONING
> Multi-sensor WiFi positioning system using distributed Raspberry Pi nodes for passive device triangulation. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Go server and Python scanner both run natively on ARM64; requires 3+ sensor nodes for triangulation

| Method               | Supported | Notes                                                                                                     |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Server runs cleanly in Docker; scanner nodes need `--privileged` and `--net=host` for monitor mode        |
| **Native Install**   | YES       | Go cross-compiles to ARM64; Python scanner has no arch-specific deps; native recommended for sensor nodes |

---

## Tool Description

find-lf (FIND Low-Frequency) is a distributed WiFi device positioning system that uses multiple Raspberry Pi nodes as passive WiFi sensors to triangulate device locations through probe request sniffing and RSSI fingerprinting. Each sensor node captures WiFi probe requests and beacon signal strengths, reports them to a central server, which then uses machine learning (random forests / SVM) to estimate device positions within a monitored area. Originally designed for indoor positioning, it can be adapted for outdoor area monitoring with sufficient sensor density. Part of the FIND (Framework for Internal Navigation and Discovery) ecosystem by schollz.

## Category

WiFi Positioning / Distributed Sensing / Passive Device Triangulation

## Repository

https://github.com/schollz/find-lf

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - The central server component runs cleanly in Docker. The sensor nodes (scanners) require WiFi monitor mode access and are better run natively on each RPi, though they can also be containerized with privileged access.

### Host OS-Level Requirements

- **Server component**: No special privileges needed. Standard Docker networking suffices.
- **Scanner (sensor) component**:
    - `--privileged` required for WiFi monitor mode
    - `--net=host` required for wireless interface access
    - Host must have a WiFi adapter capable of monitor mode
    - Host kernel modules: `cfg80211`, `mac80211`, adapter-specific driver

### Docker-to-Host Communication

- **Scanners to Server**: Each scanner node sends captured probe request data (MAC address, RSSI, timestamp) to the central server via HTTP API. Standard Docker networking on the server side.
- **WiFi Adapter**: Scanner nodes access the WiFi adapter in monitor mode via host networking.
- **Database**: Central server stores fingerprint data in a local database. Mount a volume for persistence.

---

## Install Instructions (Docker on Kali RPi 5)

### Central Server (Docker)

```dockerfile
FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git

RUN git clone https://github.com/schollz/find-lf.git /opt/find-lf

WORKDIR /opt/find-lf/server

RUN go build -o /usr/local/bin/find-lf-server .

FROM alpine:3.19

COPY --from=builder /usr/local/bin/find-lf-server /usr/local/bin/

RUN apk add --no-cache ca-certificates

EXPOSE 8003

ENTRYPOINT ["find-lf-server"]
```

```bash
# Build server
docker build -t argos/find-lf-server -f Dockerfile.server .

# Run server
docker run -d --rm \
  --name find-lf-server \
  -p 8003:8003 \
  -v $(pwd)/find-lf-data:/data \
  argos/find-lf-server
```

### Scanner Node (each RPi sensor)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    iw \
    wireless-tools \
    aircrack-ng \
    tshark \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/schollz/find-lf.git /opt/find-lf

WORKDIR /opt/find-lf/node

RUN pip install --no-cache-dir requests

ENTRYPOINT ["python", "scan.py"]
```

```bash
# Build scanner
docker build -t argos/find-lf-scanner -f Dockerfile.scanner .

# Run scanner on each RPi node
docker run -d --rm \
  --name find-lf-scanner \
  --privileged \
  --net=host \
  argos/find-lf-scanner \
  --server http://192.168.1.100:8003 \
  --interface wlan1mon \
  --group "building-a" \
  --node "sensor-1"
```

### Native Scanner Install (recommended for sensor nodes)

```bash
# On each RPi sensor node
git clone https://github.com/schollz/find-lf.git /opt/find-lf
cd /opt/find-lf/node

# Put WiFi adapter in monitor mode
sudo airmon-ng start wlan1

# Run scanner
python3 scan.py \
  --server http://192.168.1.100:8003 \
  --interface wlan1mon \
  --group "building-a" \
  --node "sensor-1"
```

### Deployment Architecture

```
Sensor RPi #1 (wlan1mon)  ──┐
                             │   HTTP POST
Sensor RPi #2 (wlan1mon)  ──┼── (MAC, RSSI, timestamp) ──→  Central Server RPi
                             │                                    |
Sensor RPi #3 (wlan1mon)  ──┘                               ML Positioning
                                                                  |
                                                            Device Location
                                                            Estimates (x, y)
```

### Training Phase

```bash
# 1. Walk through the monitored area with a known device
# 2. At each reference point, submit a learning request:
curl -X POST http://server:8003/learn \
  -d '{"group":"building-a","location":"room-101","mac":"AA:BB:CC:DD:EE:FF"}'

# 3. After sufficient training data, trigger model training:
curl -X POST http://server:8003/train \
  -d '{"group":"building-a"}'

# 4. Query device positions:
curl http://server:8003/location?group=building-a&mac=AA:BB:CC:DD:EE:FF
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Both the Go server and Python scanner components compile and run natively on aarch64. Go cross-compiles cleanly to ARM64, and the Python scanner has no architecture-specific dependencies.

### Hardware Constraints

- **CPU**: Low per node - each scanner performs passive packet capture. The central server runs ML inference for positioning, which is moderate but well within Cortex-A76 capabilities.
- **RAM**: Scanner nodes: < 100MB each. Central server: 200-500MB depending on number of tracked devices and fingerprint database size.
- **Hardware**: Each sensor node requires a USB WiFi adapter with monitor mode support. Minimum 3 sensor nodes recommended for reasonable triangulation accuracy.
- **Network**: All sensor nodes must have network connectivity to the central server (WiFi, Ethernet, or separate radio link).

### Verdict

**COMPATIBLE** - find-lf runs natively on Raspberry Pi 5 for both server and scanner roles. The distributed architecture aligns well with Argos deployment scenarios where multiple RPi nodes can be positioned around an area of interest. Primary constraint is the requirement for 3+ RPi nodes with WiFi adapters for effective triangulation, which increases hardware cost and deployment complexity.

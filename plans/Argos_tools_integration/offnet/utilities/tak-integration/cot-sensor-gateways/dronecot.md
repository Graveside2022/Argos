# dronecot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting Drone Remote ID detection data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install dronecot` on ARM64; pure Python with no compilation  |

---

## Tool Description

dronecot is a Cursor-on-Target (CoT) gateway that converts Drone Remote ID broadcast data into CoT messages for TAK ecosystem consumption. It bridges drone detection data from sources such as WiFi-based Remote ID receivers and DJI DroneID decoders, placing detected drones as markers on ATAK, WinTAK, and iTAK tactical map displays. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

Drone Detection / CoT Gateway / Tactical Display Bridge

## Repository

https://github.com/snstac/dronecot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application that reads drone detection data from network sources and outputs CoT messages. No direct hardware access required. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required (does not access hardware directly)
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast; standard Docker networking works for TAK Server TCP/UDP connections

### Docker-to-Host Communication

- **Drone Data Source**: dronecot reads from Remote ID data feeds over the network (HTTP JSON, ZMQ, or other supported input formats). The actual drone detection hardware (WiFi adapter, SDR) runs separately.
- **TAK Output**: Sends CoT messages to TAK Server via TCP/UDP or to ATAK multicast (239.2.3.1:6969). Multicast requires `--net=host`.
- **Configuration**: Environment variables or config file mounted via volume.

---

## Install Instructions (Docker on Kali RPi 5)

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir dronecot

ENTRYPOINT ["dronecot"]
```

### Build and Run

```bash
# Build
docker build -t argos/dronecot .

# Run with TAK Server (TCP connection)
docker run -d --rm \
  --name dronecot \
  -e FEED_URL="http://192.168.1.100:4224/data.json" \
  -e COT_URL="tcp://tak-server:8087" \
  -e POLL_INTERVAL="3" \
  argos/dronecot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name dronecot \
  --net=host \
  -e FEED_URL="http://localhost:4224/data.json" \
  -e COT_URL="udp://239.2.3.1:6969" \
  -e POLL_INTERVAL="3" \
  argos/dronecot

# Run with config file
docker run -d --rm \
  --name dronecot \
  -v $(pwd)/dronecot.ini:/etc/dronecot.ini \
  argos/dronecot -c /etc/dronecot.ini
```

### Example Configuration (dronecot.ini)

```ini
[dronecot]
FEED_URL = http://192.168.1.100:4224/data.json
POLL_INTERVAL = 3

[pytak]
COT_URL = tcp://tak-server:8087
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python package. All dependencies (pytak, aiohttp) have ARM64 wheels or are pure Python. Installs cleanly via pip on aarch64 with no compilation required.

### Hardware Constraints

- **CPU**: Negligible - lightweight polling and message formatting.
- **RAM**: < 50MB total footprint.
- **Hardware**: No direct hardware required. Depends on a separate Drone Remote ID detection system (WiFi adapter in monitor mode, DJI DroneID decoder, or other Remote ID receiver) running on the host or network.
- **Network**: Requires network connectivity to both the drone data source and the TAK Server or multicast network.

### Verdict

**COMPATIBLE** - dronecot runs natively on Raspberry Pi 5 without any limitations. Lightweight Python process that bridges drone detection data from Argos or standalone receivers to the TAK ecosystem. Critical for real-time drone tracking on ATAK tactical displays in the field.

# djicot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting DJI-specific drone telemetry data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install djicot` on ARM64; pure Python with no compilation    |

---

## Tool Description

djicot is a Cursor-on-Target (CoT) gateway that converts DJI drone telemetry data into CoT messages for TAK ecosystem consumption. It specifically handles the DJI proprietary OcuSync and Enhanced WiFi protocols, extracting drone position, home point, operator location, speed, altitude, and serial number data for display on ATAK, WinTAK, and iTAK tactical maps. Complementary to dronecot, which handles generic Remote ID -- djicot provides DJI-specific protocol support with richer telemetry fields. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

DJI Drone Telemetry / CoT Gateway / Tactical Display Bridge

## Repository

https://github.com/snstac/djicot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application that reads DJI telemetry data from network sources and outputs CoT messages. No direct hardware access required. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required (does not access hardware directly)
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast; standard Docker networking works for TAK Server TCP/UDP connections

### Docker-to-Host Communication

- **DJI Data Source**: djicot reads from a DJI DroneID decoder feed over the network. The actual DJI detection hardware (WiFi adapter or SDR running a DJI protocol decoder) operates separately on the host or network.
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

RUN pip install --no-cache-dir djicot

ENTRYPOINT ["djicot"]
```

### Build and Run

```bash
# Build
docker build -t argos/djicot .

# Run with TAK Server (TCP connection)
docker run -d --rm \
  --name djicot \
  -e FEED_URL="http://192.168.1.100:4224/dji.json" \
  -e COT_URL="tcp://tak-server:8087" \
  -e POLL_INTERVAL="3" \
  argos/djicot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name djicot \
  --net=host \
  -e FEED_URL="http://localhost:4224/dji.json" \
  -e COT_URL="udp://239.2.3.1:6969" \
  -e POLL_INTERVAL="3" \
  argos/djicot

# Run with config file
docker run -d --rm \
  --name djicot \
  -v $(pwd)/djicot.ini:/etc/djicot.ini \
  argos/djicot -c /etc/djicot.ini
```

### Example Configuration (djicot.ini)

```ini
[djicot]
FEED_URL = http://192.168.1.100:4224/dji.json
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
- **Hardware**: No direct hardware required. Depends on a separate DJI DroneID detection system (WiFi adapter or SDR running DJI protocol decoder) running on the host or network.
- **Network**: Requires network connectivity to both the DJI data source and the TAK Server or multicast network.

### Verdict

**COMPATIBLE** - djicot runs natively on Raspberry Pi 5 without any limitations. Deploy alongside dronecot for comprehensive drone detection coverage -- djicot handles DJI-specific telemetry with richer data fields (operator location, serial number, home point) while dronecot covers generic FAA Remote ID broadcasts.

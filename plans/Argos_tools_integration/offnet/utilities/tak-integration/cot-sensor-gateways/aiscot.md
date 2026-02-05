# aiscot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting AIS maritime vessel tracking data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install aiscot` on ARM64; pure Python with no compilation    |

---

## Tool Description

aiscot is a Cursor-on-Target (CoT) gateway that converts Automatic Identification System (AIS) maritime vessel data into CoT messages for TAK ecosystem consumption. It bridges ship tracking data from AIS-catcher or other AIS receivers, placing vessel positions, course, speed, and identification data as markers on ATAK, WinTAK, and iTAK tactical map displays. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

Maritime AIS / CoT Gateway / Tactical Display Bridge

## Repository

https://github.com/snstac/aiscot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application that reads AIS vessel data from network sources and outputs CoT messages. No direct hardware access required. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required (does not access hardware directly)
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast; standard Docker networking works for TAK Server TCP/UDP connections

### Docker-to-Host Communication

- **AIS Data Source**: aiscot reads from AIS-catcher or other AIS receivers via HTTP JSON feed (typically `http://host:8100/ships.json`) or NMEA UDP stream. The actual AIS receiver hardware (RTL-SDR dongle running AIS-catcher) runs separately on the host or network.
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

RUN pip install --no-cache-dir aiscot

ENTRYPOINT ["aiscot"]
```

### Build and Run

```bash
# Build
docker build -t argos/aiscot .

# Run with TAK Server (TCP connection)
docker run -d --rm \
  --name aiscot \
  -e FEED_URL="http://192.168.1.100:8100/ships.json" \
  -e COT_URL="tcp://tak-server:8087" \
  -e POLL_INTERVAL="10" \
  argos/aiscot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name aiscot \
  --net=host \
  -e FEED_URL="http://localhost:8100/ships.json" \
  -e COT_URL="udp://239.2.3.1:6969" \
  -e POLL_INTERVAL="10" \
  argos/aiscot

# Run with config file
docker run -d --rm \
  --name aiscot \
  -v $(pwd)/aiscot.ini:/etc/aiscot.ini \
  argos/aiscot -c /etc/aiscot.ini
```

### Example Configuration (aiscot.ini)

```ini
[aiscot]
FEED_URL = http://192.168.1.100:8100/ships.json
POLL_INTERVAL = 10

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
- **Hardware**: No direct hardware required. Depends on a separate AIS receiver (AIS-catcher + RTL-SDR dongle tuned to 161.975/162.025 MHz) running on the host or network.
- **Network**: Requires network connectivity to both the AIS data source and the TAK Server or multicast network.

### Verdict

**COMPATIBLE** - aiscot runs natively on Raspberry Pi 5 without any limitations. Lightweight Python process that bridges existing Argos AIS-catcher maritime vessel data to the TAK ecosystem. Deploy alongside AIS-catcher for immediate ship tracking on ATAK tactical displays.

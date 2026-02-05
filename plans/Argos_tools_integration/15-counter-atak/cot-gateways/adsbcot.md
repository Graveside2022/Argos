# adsbcot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting existing ADS-B aircraft tracking data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install adsbcot` on ARM64; pure Python with no compilation   |

---

## Tool Description

adsbcot is a Cursor-on-Target (CoT) gateway that converts ADS-B aircraft tracking data into CoT messages for consumption by TAK Server, ATAK, WinTAK, and iTAK clients. It bridges existing dump1090, readsb, or tar1090 ADS-B receiver output directly onto tactical map displays without requiring custom integration code. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

ADS-B / CoT Gateway / Tactical Display Bridge

## Repository

https://github.com/snstac/adsbcot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application with no hardware dependencies of its own. adsbcot reads from an existing ADS-B data source (dump1090, readsb) over the network and outputs CoT messages to a TAK Server or multicast address. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required (does not access hardware directly)
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast; standard Docker networking works for TAK Server TCP/UDP connections

### Docker-to-Host Communication

- **ADS-B Source**: adsbcot connects to dump1090/readsb via HTTP (typically `http://host:8080/data/aircraft.json`) or Beast binary protocol (port 30005). If dump1090 runs on the host, the container needs network access to the host.
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

RUN pip install --no-cache-dir adsbcot

ENTRYPOINT ["adsbcot"]
```

### Build and Run

```bash
# Build
docker build -t argos/adsbcot .

# Run with TAK Server (TCP connection)
docker run -d --rm \
  --name adsbcot \
  -e FEED_URL="http://192.168.1.100:8080/data/aircraft.json" \
  -e COT_URL="tcp://tak-server:8087" \
  -e POLL_INTERVAL="5" \
  argos/adsbcot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name adsbcot \
  --net=host \
  -e FEED_URL="http://localhost:8080/data/aircraft.json" \
  -e COT_URL="udp://239.2.3.1:6969" \
  -e POLL_INTERVAL="5" \
  argos/adsbcot

# Run with config file
docker run -d --rm \
  --name adsbcot \
  -v $(pwd)/adsbcot.ini:/etc/adsbcot.ini \
  argos/adsbcot -c /etc/adsbcot.ini
```

### Example Configuration (adsbcot.ini)

```ini
[adsbcot]
FEED_URL = http://192.168.1.100:8080/data/aircraft.json
POLL_INTERVAL = 5

[pytak]
COT_URL = tcp://tak-server:8087
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python package. All dependencies (pytak, aiohttp) have ARM64 wheels or are pure Python. Installs cleanly via pip on aarch64 with no compilation required.

### Hardware Constraints

- **CPU**: Negligible - lightweight polling and message formatting. Single-digit CPU percentage on Cortex-A76.
- **RAM**: < 50MB total footprint.
- **Hardware**: No direct hardware required. Depends on a separate ADS-B receiver (dump1090 + RTL-SDR dongle) running on the host or network.
- **Network**: Requires network connectivity to both the ADS-B data source and the TAK Server or multicast network.

### Verdict

**COMPATIBLE** - adsbcot runs natively on Raspberry Pi 5 without any limitations. Lightweight Python process that bridges existing Argos dump1090 ADS-B data to the TAK ecosystem. Deploy alongside existing ADS-B infrastructure for immediate tactical aircraft tracking on ATAK displays.

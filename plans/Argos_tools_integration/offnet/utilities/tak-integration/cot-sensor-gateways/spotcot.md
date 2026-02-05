# spotcot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting Spot satellite tracker data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install spotcot` on ARM64; pure Python with no compilation   |

---

## Tool Description

spotcot is a Cursor-on-Target (CoT) gateway that converts Globalstar Spot satellite tracker position data into CoT messages for TAK ecosystem consumption. It polls the Spot API to retrieve GPS positions from Spot tracker devices operating via the Globalstar satellite constellation, then pushes those positions as markers on ATAK, WinTAK, and iTAK tactical map displays. An alternative to inrcot for organizations using Spot rather than Garmin inReach satellite trackers. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

Satellite Tracking / CoT Gateway / Off-Grid Position Reporting

## Repository

https://github.com/snstac/spotcot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application that polls the Spot API over HTTPS and outputs CoT messages. No hardware access required. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast; standard Docker networking works for TAK Server TCP/UDP connections

### Docker-to-Host Communication

- **Spot API**: spotcot polls the Globalstar Spot API (`https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/`) over HTTPS. Requires outbound internet access from the container.
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

RUN pip install --no-cache-dir spotcot

ENTRYPOINT ["spotcot"]
```

### Build and Run

```bash
# Build
docker build -t argos/spotcot .

# Run with TAK Server
docker run -d --rm \
  --name spotcot \
  -e SPOT_FEED_ID="YOUR_SPOT_FEED_ID" \
  -e COT_URL="tcp://tak-server:8087" \
  -e POLL_INTERVAL="150" \
  argos/spotcot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name spotcot \
  --net=host \
  -e SPOT_FEED_ID="YOUR_SPOT_FEED_ID" \
  -e COT_URL="udp://239.2.3.1:6969" \
  -e POLL_INTERVAL="150" \
  argos/spotcot

# Run with config file
docker run -d --rm \
  --name spotcot \
  -v $(pwd)/spotcot.ini:/etc/spotcot.ini \
  argos/spotcot -c /etc/spotcot.ini
```

### Example Configuration (spotcot.ini)

```ini
[spotcot]
SPOT_FEED_ID = YOUR_SPOT_FEED_ID
POLL_INTERVAL = 150

[pytak]
COT_URL = tcp://tak-server:8087
```

### Prerequisites

- Globalstar Spot tracker device (Spot Gen4, Spot X, or Spot Trace)
- Active Spot satellite subscription with tracking service
- Spot Shared Page enabled with a feed ID
- Feed ID obtained from findmespot.com account

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python package. All dependencies (pytak, aiohttp) have ARM64 wheels or are pure Python. Installs cleanly via pip on aarch64 with no compilation required.

### Hardware Constraints

- **CPU**: Negligible - infrequent HTTPS polling (typically every 2.5-5 minutes, matching Spot device reporting intervals) and CoT message formatting.
- **RAM**: < 50MB total footprint.
- **Hardware**: No hardware attached to the RPi 5. The Spot tracker operates independently via the Globalstar satellite constellation. The RPi 5 running spotcot only needs internet access to poll the Spot API.
- **Network**: Requires outbound HTTPS connectivity to api.findmespot.com.

### Verdict

**COMPATIBLE** - spotcot runs natively on Raspberry Pi 5 without any limitations. Provides satellite-based off-grid asset tracking on TAK displays for organizations using Globalstar Spot trackers. Lower priority than inrcot (Garmin inReach) due to Spot's less frequent reporting intervals and more limited device capabilities, but useful for fleets already equipped with Spot devices.

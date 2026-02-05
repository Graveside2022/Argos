# inrcot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting Garmin inReach satellite tracker data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install inrcot` on ARM64; pure Python with no compilation    |

---

## Tool Description

inrcot is a Cursor-on-Target (CoT) gateway that converts Garmin inReach satellite tracker position data into CoT messages for TAK ecosystem consumption. It polls the Garmin inReach MapShare web API to retrieve GPS positions from inReach devices operating via the Iridium satellite constellation, then pushes those positions as markers on ATAK, WinTAK, and iTAK tactical map displays. Enables off-grid asset tracking in environments with no cellular or internet infrastructure -- the tracked asset only needs satellite sky visibility. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

Satellite Tracking / CoT Gateway / Off-Grid Position Reporting

## Repository

https://github.com/snstac/inrcot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application that polls the Garmin inReach MapShare web API over HTTPS and outputs CoT messages. No hardware access required. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast; standard Docker networking works for TAK Server TCP/UDP connections

### Docker-to-Host Communication

- **inReach API**: inrcot polls the Garmin MapShare API (`https://share.garmin.com/Feed/Share/<username>`) over HTTPS. Requires outbound internet access from the container.
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

RUN pip install --no-cache-dir inrcot

ENTRYPOINT ["inrcot"]
```

### Build and Run

```bash
# Build
docker build -t argos/inrcot .

# Run with TAK Server
docker run -d --rm \
  --name inrcot \
  -e FEED_URL="https://share.garmin.com/Feed/Share/YOUR_MAPSHARE_ID" \
  -e COT_URL="tcp://tak-server:8087" \
  -e POLL_INTERVAL="60" \
  argos/inrcot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name inrcot \
  --net=host \
  -e FEED_URL="https://share.garmin.com/Feed/Share/YOUR_MAPSHARE_ID" \
  -e COT_URL="udp://239.2.3.1:6969" \
  -e POLL_INTERVAL="60" \
  argos/inrcot

# Run with config file
docker run -d --rm \
  --name inrcot \
  -v $(pwd)/inrcot.ini:/etc/inrcot.ini \
  argos/inrcot -c /etc/inrcot.ini
```

### Example Configuration (inrcot.ini)

```ini
[inrcot]
FEED_URL = https://share.garmin.com/Feed/Share/YOUR_MAPSHARE_ID
POLL_INTERVAL = 60

[pytak]
COT_URL = tcp://tak-server:8087
```

### Prerequisites

- Garmin inReach device (Mini, Explorer, or Messenger series)
- Active Garmin inReach satellite subscription
- MapShare page enabled in Garmin Explore account settings
- MapShare feed URL or username

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python package. All dependencies (pytak, aiohttp) have ARM64 wheels or are pure Python. Installs cleanly via pip on aarch64 with no compilation required.

### Hardware Constraints

- **CPU**: Negligible - infrequent HTTPS polling (typically every 60 seconds) and CoT message formatting.
- **RAM**: < 50MB total footprint.
- **Hardware**: No hardware attached to the RPi 5. The Garmin inReach device operates independently via the Iridium satellite constellation. The RPi 5 running inrcot only needs internet access to poll the Garmin MapShare API.
- **Network**: Requires outbound HTTPS connectivity to share.garmin.com.

### Verdict

**COMPATIBLE** - inrcot runs natively on Raspberry Pi 5 without any limitations. Provides satellite-based off-grid asset tracking on TAK displays. Ideal for tracking personnel or vehicles carrying Garmin inReach devices in areas without cellular coverage. The RPi 5 acts as the bridge between the Garmin cloud API and the local TAK network.

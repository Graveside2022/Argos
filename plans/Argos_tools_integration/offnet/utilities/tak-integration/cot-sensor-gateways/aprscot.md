# aprscot

> **RISK CLASSIFICATION**: LOW RISK - DATA BRIDGE
> Passive data bridge converting APRS amateur radio position data to CoT format for TAK displays. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python PyTAK gateway, no architecture-specific dependencies

| Method               | Supported | Notes                                                             |
| -------------------- | --------- | ----------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight `python:3.11-slim` image; no privileged access needed |
| **Native Install**   | YES       | `pip install aprscot` on ARM64; pure Python with no compilation   |

---

## Tool Description

aprscot is a Cursor-on-Target (CoT) gateway that converts Automatic Packet Reporting System (APRS) amateur radio position reports into CoT messages for TAK ecosystem consumption. It bridges APRS-IS (Internet gateway) or local APRS packet data, placing station positions, callsigns, and status information as markers on ATAK, WinTAK, and iTAK tactical map displays. Useful for tracking APRS-equipped assets such as vehicles, repeaters, weather stations, and personnel carrying amateur radio equipment. Part of the snstac CoT gateway ecosystem maintained by Sensors & Signals LLC.

## Category

APRS Amateur Radio / CoT Gateway / Tactical Display Bridge

## Repository

https://github.com/snstac/aprscot

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pure Python application that reads APRS data from APRS-IS servers or local TNC connections and outputs CoT messages. No direct hardware access required for APRS-IS mode. Fully containerizable.

### Host OS-Level Requirements

- No `--privileged` required
- No `--device` passthrough required for APRS-IS network mode
- Optional `--device=/dev/ttyUSB0` if using a local TNC (Terminal Node Controller) serial connection
- No kernel modules required
- `--net=host` optional: only needed if using TAK multicast

### Docker-to-Host Communication

- **APRS-IS Mode**: aprscot connects to APRS-IS servers (e.g., rotate.aprs2.net:14580) over standard TCP. No host setup needed beyond internet connectivity.
- **Local TNC Mode**: If using a local APRS radio/TNC, serial device passthrough is needed.
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

RUN pip install --no-cache-dir aprscot

ENTRYPOINT ["aprscot"]
```

### Build and Run

```bash
# Build
docker build -t argos/aprscot .

# Run with APRS-IS and TAK Server
docker run -d --rm \
  --name aprscot \
  -e APRS_CALLSIGN="N0CALL" \
  -e APRS_FILTER="r/34.05/-118.24/100" \
  -e COT_URL="tcp://tak-server:8087" \
  argos/aprscot

# Run with ATAK multicast (requires host network)
docker run -d --rm \
  --name aprscot \
  --net=host \
  -e APRS_CALLSIGN="N0CALL" \
  -e APRS_FILTER="r/34.05/-118.24/100" \
  -e COT_URL="udp://239.2.3.1:6969" \
  argos/aprscot

# Run with config file
docker run -d --rm \
  --name aprscot \
  -v $(pwd)/aprscot.ini:/etc/aprscot.ini \
  argos/aprscot -c /etc/aprscot.ini
```

### Example Configuration (aprscot.ini)

```ini
[aprscot]
APRS_CALLSIGN = N0CALL
APRS_FILTER = r/34.05/-118.24/100

[pytak]
COT_URL = tcp://tak-server:8087
```

### APRS-IS Filter Syntax

- `r/lat/lon/range` - Range filter (km radius from point)
- `p/prefix` - Callsign prefix filter
- `b/callsign1/callsign2` - Specific callsign filter
- `t/type` - Packet type filter

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Pure Python package. All dependencies (pytak, aprslib) have ARM64 wheels or are pure Python. Installs cleanly via pip on aarch64 with no compilation required.

### Hardware Constraints

- **CPU**: Negligible - lightweight network polling and message formatting.
- **RAM**: < 50MB total footprint.
- **Hardware**: No direct hardware required for APRS-IS (internet) mode. Local RF APRS reception requires an amateur radio and TNC or Dire Wolf software modem with an audio interface.
- **Network**: Requires internet connectivity for APRS-IS mode, or local serial/USB connection for TNC mode.

### Verdict

**COMPATIBLE** - aprscot runs natively on Raspberry Pi 5 without any limitations. Niche but useful for tracking APRS-equipped assets in the field. Most practical in APRS-IS (internet) mode for broad area monitoring, or with a local VHF receiver for RF-based tracking without internet dependency.

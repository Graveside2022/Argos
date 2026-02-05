# IMSI-catcher (Oros42)

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Passive IMSI collection and cell tower mapping. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                                    |
| -------------------- | --------- | -------------------------------------------------------- |
| **Docker Container** | YES       | Python + gr-gsm, RTL-SDR USB passthrough                 |
| **Native Install**   | YES       | Lightweight Python wrapper, uses existing gr-gsm install |

---

## Tool Description

Lightweight Python tool for passive IMSI collection using RTL-SDR and gr-gsm. Scans nearby GSM cell towers, decodes broadcast channels, and extracts IMSI/TMSI identifiers from phones performing location updates or call setup. Generates a map of nearby cell towers with their frequencies, cell IDs, and detected subscriber identifiers. Simple wrapper around gr-gsm tools (`grgsm_scanner`, `grgsm_decode`) with automated IMSI extraction and logging.

## Category

GSM IMSI Collector / Cell Tower Mapper

## Repository

https://github.com/Oros42/IMSI-catcher

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Python wrapper around gr-gsm. Requires RTL-SDR USB passthrough. Same container as gr-gsm with the Python scripts added.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - RTL-SDR USB passthrough
- `--privileged` - For RTL-SDR USB access
- No kernel modules needed
- No `--net=host` required

### Docker-to-Host Communication

- CLI output (stdout) with IMSI/TMSI data
- Log files via volume mount
- No network services

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended)

```bash
# Install gr-gsm first (dependency)
sudo apt install -y gr-gsm python3-numpy python3-scipy python3-scapy rtl-sdr

# Clone IMSI-catcher
git clone https://github.com/Oros42/IMSI-catcher.git /opt/imsi-catcher
cd /opt/imsi-catcher
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    gr-gsm gnuradio rtl-sdr \
    python3-numpy python3-scipy python3-scapy python3 git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Oros42/IMSI-catcher.git /opt/imsi-catcher

WORKDIR /opt/imsi-catcher
ENTRYPOINT ["python3"]
```

```bash
# Build
docker build -t argos/imsi-catcher .

# Run - scan for nearby towers and collect IMSIs
docker run --rm --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/logs:/opt/imsi-catcher/logs \
  argos/imsi-catcher simple_IMSI-catcher.py --sniff

# Run - scan towers first, then sniff specific frequency
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/imsi-catcher grgsm_scanner

docker run --rm --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/logs:/opt/imsi-catcher/logs \
  argos/imsi-catcher simple_IMSI-catcher.py -f 945.2e6
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Pure Python wrapper. Depends on gr-gsm which is available in Kali ARM64 repos.

### Hardware Constraints

- **CPU**: Minimal — gr-gsm does the heavy lifting, which is lightweight GSM decoding.
- **RAM**: < 200MB.
- **SDR**: Requires RTL-SDR dongle (~$25). Also works with HackRF One (installed).

### Verdict

**COMPATIBLE** - Runs well on RPi 5. Uses existing gr-gsm installation plus a cheap RTL-SDR. Native install recommended. This is one of the most accessible IMSI collection tools — low hardware cost, simple setup, immediate results.

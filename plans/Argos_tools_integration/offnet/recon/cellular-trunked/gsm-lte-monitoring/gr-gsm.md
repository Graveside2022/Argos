# gr-gsm

> **✅ ALREADY INTEGRATED IN ARGOS** — `grgsm_livemon` (the core binary from gr-gsm) is managed by the GSM Evil subsystem: 14 server files in `src/lib/server/services/gsm-evil/`, 12 API routes at `/api/gsm-evil/*`, 6 UI components, dedicated `gsm-evil-store.ts`, and SSE streaming via `intelligent-scan-stream`. **No additional integration work required.**

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> GSM signal interception and IMSI collection capability. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                                            |
| -------------------- | --------- | ---------------------------------------------------------------- |
| **Docker Container** | YES       | GNU Radio + SDR USB passthrough                                  |
| **Native Install**   | YES       | **ACTIVE** — `grgsm_livemon` already spawned by GSM Evil service |

---

## Tool Description

GNU Radio blocks for receiving, decoding, and analyzing GSM transmissions. Decodes GSM signaling channels (BCCH, CCCH, SDCCH) to extract IMSI identifiers, TMSI mappings, cell tower information, and SMS messages. Supports A5/1 stream cipher cracking for encrypted GSM traffic analysis. Can capture and decode live GSM traffic from nearby cell towers using SDR hardware.

## Category

GSM Passive Interception / IMSI Collection

## Repository

https://github.com/ptrkrysik/gr-gsm

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - gr-gsm can run in a Docker container with SDR hardware passthrough. GNU Radio and its dependencies are available for ARM64 in Kali/Debian repositories.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for SDR hardware (HackRF, RTL-SDR)
- `--privileged` - Required for raw USB device access
- No special kernel modules beyond standard USB drivers
- Host must have `udev` rules for SDR device permissions (usually auto-configured)

### Docker-to-Host Communication

- No network port mappings required (standalone CLI tool)
- Output PCAP files via volume mount: `-v /host/output:/output`
- Optionally pipe decoded data to Wireshark on host via named pipe or shared volume

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt update
sudo apt install -y gr-gsm
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    gr-gsm \
    gnuradio \
    librtlsdr-dev \
    rtl-sdr \
    hackrf \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /output
ENTRYPOINT ["grgsm_decode"]
```

```bash
# Build
docker build -t argos/gr-gsm .

# Run - scan for GSM base stations
docker run --rm --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/gr-gsm grgsm_scanner

# Run - capture and decode GSM traffic
docker run --rm --privileged \
  --device=/dev/bus/usb \
  -v $(pwd)/output:/output \
  argos/gr-gsm grgsm_livemon -f 945.2e6
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - gr-gsm is available in Kali Linux ARM64 repositories as a pre-built package. GNU Radio has full ARM64 support.

### Hardware Constraints

- CPU: GSM decoding is lightweight - 4x Cortex-A76 is more than sufficient
- RAM: Minimal requirements (~200MB), well within 8GB
- SDR: Requires HackRF One (installed) or RTL-SDR for signal reception

### Verdict

**COMPATIBLE** - gr-gsm is one of the easiest tools to deploy on RPi 5. Available via `apt install` on Kali ARM64. Docker adds overhead with no benefit for this tool; native install recommended.

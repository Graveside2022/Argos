# Kalibrate-hackrf

> **RISK CLASSIFICATION**: MODERATE RISK
> GSM tower scanning and frequency reconnaissance. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                            |
| -------------------- | --------- | ------------------------------------------------ |
| **Docker Container** | YES       | Lightweight C, HackRF USB passthrough            |
| **Native Install**   | YES       | Recommended — uses existing HackRF, minimal deps |

---

## Tool Description

GSM base station scanner and SDR frequency calibration tool. Scans for all GSM towers in range and identifies their frequencies, frequency offsets, and signal strengths. Fork of the original `kalibrate-rtl` adapted for HackRF One hardware. Used as the first step in cellular reconnaissance — mapping the GSM landscape before targeting specific towers with gr-gsm or GSM Evil. Also calibrates SDR frequency offset for more accurate signal reception.

## Category

Cellular Reconnaissance / GSM Tower Scanner

## Repository

https://github.com/scateu/kalibrate-hackrf

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Lightweight C application with minimal dependencies. Requires only HackRF USB passthrough.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - HackRF One USB passthrough
- `--privileged` - For HackRF USB access
- No kernel modules needed (HackRF uses standard USB)
- No `--net=host` required

### Docker-to-Host Communication

- CLI output only (stdout) — results printed to terminal
- No files written, no network services
- Can redirect output to file via volume mount

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended)

```bash
sudo apt install -y libhackrf-dev hackrf automake autoconf libtool
git clone https://github.com/scateu/kalibrate-hackrf.git /opt/kalibrate-hackrf
cd /opt/kalibrate-hackrf
./bootstrap
./configure
make -j4
sudo make install
```

### Option B: Docker

```dockerfile
FROM kalilinux/kali-rolling:latest

RUN apt-get update && apt-get install -y \
    build-essential automake autoconf libtool \
    libhackrf-dev hackrf git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/scateu/kalibrate-hackrf.git /opt/kal && \
    cd /opt/kal && ./bootstrap && ./configure && make -j$(nproc) && make install

ENTRYPOINT ["kal"]
```

```bash
# Build
docker build -t argos/kalibrate .

# Run - scan GSM900 band
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/kalibrate -s GSM900

# Run - scan GSM850 band (US)
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/kalibrate -s GSM850

# Run - calibrate frequency offset against known tower
docker run --rm --privileged \
  --device=/dev/bus/usb \
  argos/kalibrate -f 945.2e6
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Standard C with autotools build system. No architecture-specific code. Compiles cleanly on ARM64.

### Hardware Constraints

- **CPU**: Minimal — simple frequency scanning. Any modern ARM works.
- **RAM**: < 50MB. Negligible.
- **SDR**: Uses HackRF One (already installed on Argos).

### Verdict

**COMPATIBLE** - Excellent fit for RPi 5. Lightweight, uses existing HackRF hardware, compiles natively on ARM64. Native install is preferred over Docker. This should be one of the first tools deployed — it maps the GSM landscape before any other cellular tool is used.

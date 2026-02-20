# Rayhunter

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION**: LOW RISK
> Defensive IMSI catcher detection tool. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                     |
| -------------------- | --------- | ----------------------------------------- |
| **Docker Container** | YES       | Rust binary, Orbic device USB passthrough |
| **Native Install**   | YES       | Rust cross-compiles cleanly to ARM64      |

---

## Tool Description

EFF's (Electronic Frontier Foundation) $20 IMSI catcher detector. Runs on the Orbic RC400L mobile hotspot (~$20 device) and monitors cellular baseband activity for signs of IMSI catcher / fake base station attacks. Provides simple red/green visual alerts: green = normal cellular activity, red = suspicious activity detected. Logs all baseband events as PCAP files for forensic analysis. Written in Rust for performance and memory safety.

Detects: forced encryption downgrades, unusual cell reselection patterns, suspicious identity requests, and other indicators of cell-site simulator presence.

## Category

IMSI Catcher Detection / Defensive Cellular Security

## Repository

https://github.com/EFForg/rayhunter

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - The analysis/server component can run in Docker. However, Rayhunter's primary deployment is flashed onto the Orbic RC400L device itself. The host-side component that communicates with the Orbic device over USB can be containerized.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for Orbic RC400L hotspot
- No `--privileged` needed if specific USB device is passed
- No kernel modules required
- No `--net=host` needed

### Docker-to-Host Communication

- USB serial communication with Orbic device
- REST API for status queries (optional)
- PCAP file output via volume mount
- Web UI for alert dashboard

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Flash to Orbic Device (Primary Method)

```bash
# Rayhunter runs ON the Orbic device, not on the RPi
# The RPi connects to the Orbic via USB to retrieve data

# Install Rust toolchain for cross-compilation
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Clone and build
git clone https://github.com/EFForg/rayhunter.git /opt/rayhunter
cd /opt/rayhunter

# Follow EFF's flashing instructions for Orbic RC400L
# The device runs the detection firmware independently
```

### Option B: Docker (analysis component only)

```dockerfile
FROM rust:1.88-slim-bookworm AS builder

RUN apt-get update && apt-get install -y \
    git \
    pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/EFForg/rayhunter.git /opt/rayhunter
WORKDIR /opt/rayhunter
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /opt/rayhunter/target/release/rayhunter-daemon /usr/local/bin/
RUN apt-get update && apt-get install -y libssl3 && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["rayhunter-daemon"]
```

```bash
# Build
docker build -t argos/rayhunter .

# Run analysis daemon
docker run --rm \
  --device=/dev/bus/usb \
  -v $(pwd)/pcaps:/data \
  -p 8080:8080 \
  argos/rayhunter
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Rust cross-compiles cleanly to ARM64/aarch64. The Orbic device itself runs on a Qualcomm ARM chip. The analysis tools compile natively on RPi 5.

### Hardware Constraints

- **CPU**: Minimal — data analysis, not signal processing.
- **RAM**: < 100MB.
- **Hardware**: Requires Orbic RC400L mobile hotspot (~$20). This is a separate device connected via USB.

### Verdict

**COMPATIBLE** - Rayhunter is ideal for RPi 5 deployment. The Orbic device does the cellular monitoring independently; the RPi 5 connects via USB to retrieve and display detection alerts. $20 hardware cost. Top-5 priority tool for Argos.

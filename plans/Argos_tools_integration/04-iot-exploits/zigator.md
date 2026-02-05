# Zigator

> **RISK CLASSIFICATION**: LOW RISK
> Passive ZigBee traffic analyzer for offline packet inspection and protocol analysis. No active attack or transmission capability. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — pure Python package; no hardware needed for offline PCAP analysis

| Method               | Supported | Notes                                                |
| -------------------- | --------- | ---------------------------------------------------- |
| **Docker Container** | YES       | No special flags needed; volume mount for PCAP files |
| **Native Install**   | YES       | `pip install zigator` on ARM64; recommended method   |

---

## Tool Description

Zigator is a ZigBee traffic analysis and visualization tool developed for security research. It parses ZigBee packet captures (PCAP files) and provides detailed protocol-layer dissection, encryption analysis, network topology mapping, and statistical summaries. The tool can identify security-relevant patterns in captured traffic including unencrypted key transport, weak security configurations, and anomalous network behavior. It operates entirely offline on previously captured packet data, requiring no radio hardware for analysis operations.

## Category

ZigBee Traffic Analysis / Passive Protocol Inspection

## Repository

https://github.com/akestoridis/zigator

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Zigator runs cleanly in Docker with no hardware dependencies for offline analysis. It is a pure Python tool that processes PCAP files. No USB passthrough or privileged mode required for its primary analysis functionality.

### Host OS-Level Requirements

- No `--device` flags required for offline PCAP analysis
- No `--privileged` required
- No special kernel modules
- If combined with live capture (via KillerBee/zbdump), the capture tool handles hardware access separately

### Docker-to-Host Communication

- Volume mount for input PCAP files and output reports: `-v /host/data:/app/data`
- No network port mappings required
- Output formats include text reports and structured data suitable for further processing
- Analysis results can be piped to Argos data pipeline via shared volume

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: pip install (Recommended for simplicity)

```bash
pip install zigator
```

### Option B: Docker

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir zigator

# Alternative: install from source for latest version
# RUN git clone https://github.com/akestoridis/zigator.git /opt/zigator && \
#     cd /opt/zigator && \
#     pip install --no-cache-dir .

WORKDIR /app/data
VOLUME ["/app/data"]

ENTRYPOINT ["zigator"]
CMD ["--help"]
```

```bash
# Build
docker build -t argos/zigator .

# Run - display help and available analysis commands
docker run --rm \
  argos/zigator --help

# Run - analyze a ZigBee PCAP capture file
docker run --rm \
  -v $(pwd)/zigbee-captures:/app/data \
  argos/zigator /app/data/capture.pcap

# Run - parse and extract packet details from capture
docker run --rm \
  -v $(pwd)/zigbee-captures:/app/data \
  argos/zigator parse /app/data/capture.pcap

# Run - analyze encryption usage in capture
docker run --rm \
  -v $(pwd)/zigbee-captures:/app/data \
  argos/zigator analyze-encryption /app/data/capture.pcap

# Run - generate network topology from capture
docker run --rm \
  -v $(pwd)/zigbee-captures:/app/data \
  argos/zigator print-network /app/data/capture.pcap

# Run - interactive shell for batch analysis
docker run --rm -it \
  -v $(pwd)/zigbee-captures:/app/data \
  --entrypoint /bin/bash \
  argos/zigator
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Zigator is a pure Python package available via pip. It installs directly on ARM64 with `pip install zigator`. No compiled extensions or architecture-specific dependencies. Works on any Python 3.8+ environment.

### Hardware Constraints

- CPU: Lightweight for typical PCAP sizes. Large captures (100MB+) may take longer to process but remain well within Cortex-A76 capability
- RAM: Depends on capture file size. Typical ZigBee captures are small (ZigBee is a low-data-rate protocol at 250 kbps). Analysis of multi-hour captures may use 200-500MB of RAM, well within 8GB
- Hardware: No radio hardware required for offline analysis. Pair with KillerBee's `zbdump` or other 802.15.4 sniffers for live capture, then analyze offline with Zigator
- Storage: Minimal - analysis output is small text/data files

### Verdict

**COMPATIBLE** - Zigator is one of the simplest IoT tools to deploy on any platform including Raspberry Pi 5. Pure Python, no hardware dependencies for analysis, minimal resource usage. Docker is optional and adds unnecessary overhead for this tool; a simple `pip install zigator` is the recommended deployment method. Pairs well with KillerBee for a capture-then-analyze workflow.

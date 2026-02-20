# Responder

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Active network poisoner that responds to LLMNR, NBT-NS, and mDNS broadcast queries to capture NTLMv2 password hashes and plaintext credentials from Windows hosts. Enables credential theft on LAN segments. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python; pre-built package in Kali ARM64 repos

| Method               | Supported | Notes                                                                                              |
| -------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | `python:3.11-slim-bookworm` base; requires `--privileged` and `--net=host` for broadcast poisoning |
| **Native Install**   | YES       | `apt install responder`; recommended for simpler network stack interaction                         |

---

## Tool Description

Responder is a Python-based LLMNR/NBT-NS/mDNS poisoner and credential harvester. It listens for name resolution broadcast queries on the local network and responds with the attacker's IP address, causing victim machines to authenticate against the attacker's rogue services. Responder includes built-in rogue servers for HTTP, SMB, MSSQL, FTP, LDAP, and other protocols, capturing NTLMv1/v2 hashes, plaintext credentials, and NTLM challenge/response pairs. Captured hashes can be cracked offline with Hashcat or John the Ripper.

## Category

LLMNR/NBT-NS Poisoning / Credential Harvesting / Active Network Attacks

## Repository

https://github.com/lgandx/Responder

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Responder runs in Docker with host networking. It is a Python application that operates on Layer 2/3 broadcast protocols and requires direct access to host network interfaces for poisoning attacks.

### Host OS-Level Requirements

- `--net=host` - Required for receiving LLMNR/NBT-NS/mDNS broadcast traffic and sending poisoned responses on the host LAN segment
- `--privileged` - Required for binding to low ports (UDP 137, 138, 5353) and raw socket operations
- No USB device passthrough required (network-only tool)
- No additional host kernel modules required
- Requires being on the same network segment as target Windows hosts

### Docker-to-Host Communication

- Full host network stack access via `--net=host` for broadcast traffic interception
- Captured credentials stored in Responder logs directory; persist via volume mount: `-v /host/responder:/opt/Responder/logs`
- Rogue services bind to host interface ports (80, 443, 445, 389, etc.); ensure no conflicts with existing host services
- SQLite database for captured hashes: persist via volume mount

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Native Install (Recommended - available in Kali repos)

```bash
sudo apt-get update && sudo apt-get install -y responder
```

### Option B: Docker

```dockerfile
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y \
    git \
    gcc \
    libffi-dev \
    libssl-dev \
    net-tools \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/lgandx/Responder.git /opt/Responder

WORKDIR /opt/Responder

RUN pip install --no-cache-dir \
    netifaces \
    aioquic \
    2>/dev/null || true

RUN mkdir -p /opt/Responder/logs

ENTRYPOINT ["python3", "Responder.py"]
CMD ["--help"]
```

### Build and Run

```bash
# Build the image
docker build -t argos/responder .

# Run - start Responder on host interface
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/responder-logs:/opt/Responder/logs \
  argos/responder -I eth0

# Run - with WPAD proxy rogue (captures HTTP credentials)
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/responder-logs:/opt/Responder/logs \
  argos/responder -I eth0 -wF

# Run - analyze mode only (passive, no poisoning)
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/responder-logs:/opt/Responder/logs \
  argos/responder -I eth0 -A

# Run - on WiFi interface
docker run --rm -it \
  --privileged \
  --net=host \
  -v $(pwd)/responder-logs:/opt/Responder/logs \
  argos/responder -I wlan0

# After capture - crack NTLMv2 hashes with Hashcat:
# hashcat -m 5600 responder-logs/Responder-Session.log /path/to/wordlist.txt
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - Responder is a pure Python application with no architecture-specific compiled components. Pre-built package available in Kali ARM64 repositories via `apt install responder`.

### Hardware Constraints

- CPU: Minimal CPU requirements; listening for broadcast queries and serving rogue responses is lightweight. Cortex-A76 handles this effortlessly
- RAM: Very low memory footprint (~50-100MB); negligible on 8GB system
- Hardware: No specialized hardware required. Standard Ethernet or WiFi interface on the same LAN segment as targets. Wired connections preferred for reliability
- Storage: Minimal. Captured credential databases are small (text/SQLite)

### Verdict

**COMPATIBLE** - Responder runs natively on Kali RPi 5 ARM64 with pre-built package in Kali repos. No platform constraints. The tool is extremely lightweight and field-deployable. Native install is recommended for simplicity; Docker provides isolation when running alongside other network tools to avoid port conflicts.

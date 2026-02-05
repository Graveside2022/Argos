# MQTT Pwn

> **RISK CLASSIFICATION**: MODERATE RISK
> Network-based MQTT broker exploitation tool capable of broker discovery, topic enumeration, credential brute-forcing, and message injection. No RF hardware required. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — pure Python network tool; no hardware or architecture constraints

| Method               | Supported | Notes                                                                                     |
| -------------------- | --------- | ----------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | No special flags; --net=host for local network targets; official docker-compose available |
| **Native Install**   | YES       | pip install; all Python deps have ARM64 wheels                                            |

---

## Tool Description

MQTT Pwn is an MQTT protocol penetration testing framework developed by Akamai. It provides a CLI-based interactive shell for discovering, enumerating, and exploiting MQTT brokers and IoT infrastructure. Key capabilities include MQTT broker scanning, topic discovery and subscription monitoring, credential brute-forcing, message injection and manipulation, system information extraction, and Shodan integration for finding exposed MQTT brokers on the internet. It targets the MQTT protocol directly over TCP/IP, requiring no radio hardware.

## Category

MQTT Protocol Exploitation / IoT Network Penetration Testing

## Repository

https://github.com/akamai-threat-research/mqtt-pwn

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - MQTT Pwn runs cleanly in Docker with no special hardware requirements. It is a pure network tool that communicates with MQTT brokers over TCP. The project includes an official docker-compose configuration.

### Host OS-Level Requirements

- No `--device` flags required (no hardware dependencies)
- No `--privileged` required
- No special kernel modules
- Standard network access is sufficient
- Optional: `--net=host` if targeting MQTT brokers on the local network segment

### Docker-to-Host Communication

- Network access to target MQTT brokers (TCP port 1883 for unencrypted, 8883 for TLS)
- Optional port mapping for the tool's internal database: not typically exposed
- Volume mount for persistent data and scan results: `-v /host/data:/app/data`
- Bridge networking works for remote targets; `--net=host` recommended for local network targets

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Docker Compose (Recommended - official method)

```bash
git clone https://github.com/akamai-threat-research/mqtt-pwn.git
cd mqtt-pwn

# Build and run with docker-compose
docker-compose up -d

# Attach to the interactive shell
docker-compose exec mqtt-pwn /bin/bash
```

### Option B: Standalone Docker

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    libffi-dev \
    libssl-dev \
    nmap \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/akamai-threat-research/mqtt-pwn.git /app

WORKDIR /app
RUN pip install --no-cache-dir -r requirements.txt

VOLUME ["/app/data"]

ENTRYPOINT ["python3"]
CMD ["run.py"]
```

```bash
# Build
docker build -t argos/mqtt-pwn .

# Run - interactive MQTT Pwn shell (cmd2-based CLI)
docker run --rm -it \
  --net=host \
  -v $(pwd)/mqtt-data:/app/data \
  argos/mqtt-pwn run.py

# Run - with bridge networking for remote targets
docker run --rm -it \
  -v $(pwd)/mqtt-data:/app/data \
  argos/mqtt-pwn run.py

# Run - interactive shell for manual exploration
docker run --rm -it \
  --net=host \
  -v $(pwd)/mqtt-data:/app/data \
  --entrypoint /bin/bash \
  argos/mqtt-pwn

# Run - scan local network for MQTT brokers
docker run --rm -it \
  --net=host \
  -v $(pwd)/mqtt-data:/app/data \
  --entrypoint /bin/bash \
  argos/mqtt-pwn -c "nmap -p 1883,8883 --open 192.168.1.0/24"
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 FULLY COMPATIBLE** - MQTT Pwn is pure Python with no architecture-specific dependencies. All Python packages (paho-mqtt, cryptography, requests) provide ARM64 wheels. The tool performs network operations only, with no hardware or platform-specific requirements.

### Hardware Constraints

- CPU: Lightweight - MQTT protocol operations are trivial for any modern CPU. Brute-force credential attacks are I/O-bound (network latency) rather than CPU-bound. Single Cortex-A76 core handles all operations without strain
- RAM: Minimal usage (~50-100MB). Database of scan results may grow with extensive enumeration but remains small
- Network: Requires network connectivity to target MQTT brokers. Ethernet or WiFi. No RF hardware needed
- Storage: Scan results database is minimal (kilobytes to low megabytes)

### Verdict

**COMPATIBLE** - MQTT Pwn is the most deployment-friendly tool in the IoT exploits category. No hardware dependencies, no architecture concerns, minimal resource usage. Docker deployment is clean and recommended for isolation. The tool complements RF-based IoT assessment tools by covering the network-side MQTT protocol layer commonly used by IoT devices for cloud communication. Ideal for testing MQTT-based IoT infrastructure without requiring physical proximity to target devices.

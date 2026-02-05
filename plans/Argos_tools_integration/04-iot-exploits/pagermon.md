# Pagermon

> **RISK CLASSIFICATION**: MODERATE RISK
> Intercepts and decodes live pager traffic (POCSAG/FLEX) which may contain sensitive personal, medical, or emergency services communications. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Node.js web app + multimon-ng decoder both run natively on ARM64

| Method               | Supported | Notes                                                                                      |
| -------------------- | --------- | ------------------------------------------------------------------------------------------ |
| **Docker Container** | YES       | Node.js server in container; RTL-SDR pipeline on host or in container with USB passthrough |
| **Native Install**   | YES       | All components (Node.js, multimon-ng, rtl-sdr) available in Kali ARM64 repos               |

---

## Tool Description

Pagermon is a pager signal monitoring and decoding platform with a web-based interface. It receives, decodes, and displays POCSAG and FLEX pager transmissions captured via RTL-SDR hardware and multimon-ng decoding. The system provides a searchable database of intercepted messages, filtering by capcode (pager address), agency name, and message content. It supports alerting, API access, and plugin-based extensibility for automated message processing.

## Category

Pager Signal Interception / SIGINT Collection

## Repository

https://github.com/pagermon/pagermon

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Pagermon runs well in Docker. It is a Node.js web application with a SQLite or MySQL backend. The RTL-SDR reception and multimon-ng decoding pipeline can run either inside the container or on the host, piping decoded output into the Pagermon server.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for RTL-SDR dongle (if running the full reception pipeline inside Docker)
- `--privileged` - Required only if RTL-SDR is accessed from within the container
- No special kernel modules beyond standard USB drivers
- If running `rtl_fm` on the host and piping to the container, no USB passthrough is needed for the Pagermon container itself

### Docker-to-Host Communication

- Port mapping required: `-p 3000:3000` for the Pagermon web interface
- Volume mount for persistent database: `-v /host/data:/app/server/db`
- If using host-side `rtl_fm | multimon-ng` pipeline, decoded messages are sent to the Pagermon API endpoint via HTTP POST
- Optional MQTT integration for forwarding decoded messages to Argos data pipeline

---

## Install Instructions (Docker on Kali RPi 5)

### Option A: Docker with external reception pipeline (Recommended)

```dockerfile
FROM node:18-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/pagermon/pagermon.git /app

WORKDIR /app/server
RUN npm install --production

WORKDIR /app/client
RUN npm install --production && npm run build

WORKDIR /app/server
EXPOSE 3000

CMD ["node", "app.js"]
```

```bash
# Build
docker build -t argos/pagermon .

# Run - Pagermon web server
docker run -d --name pagermon \
  -p 3000:3000 \
  -v $(pwd)/pagermon-data:/app/server/db \
  --restart unless-stopped \
  argos/pagermon

# On the host, run the reception pipeline feeding into Pagermon
# Install multimon-ng on host if not present
sudo apt install -y multimon-ng rtl-sdr

# Start the reception pipeline (adjust frequency for local pager infrastructure)
rtl_fm -f 929.6125M -s 22050 -g 48 - | multimon-ng -t raw -a POCSAG512 -a POCSAG1200 -a POCSAG2400 -f alpha - | \
  while read line; do
    curl -s -X POST http://localhost:3000/api/messages -H 'Content-Type: application/json' \
      -d "{\"message\": \"$line\"}"
  done
```

### Option B: Docker with full pipeline inside container

```dockerfile
FROM node:18-slim

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    rtl-sdr \
    librtlsdr-dev \
    multimon-ng \
    socat \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/pagermon/pagermon.git /app

WORKDIR /app/server
RUN npm install --production

WORKDIR /app/client
RUN npm install --production && npm run build

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /app/server
EXPOSE 3000

CMD ["/usr/bin/supervisord"]
```

```bash
# Build
docker build -t argos/pagermon-full .

# Run with RTL-SDR passthrough
docker run -d --name pagermon \
  --privileged \
  --device=/dev/bus/usb \
  -p 3000:3000 \
  -v $(pwd)/pagermon-data:/app/server/db \
  --restart unless-stopped \
  argos/pagermon-full
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 COMPATIBLE** - Node.js has full ARM64 support. multimon-ng compiles natively on ARM64. RTL-SDR tools are available in Kali ARM64 repos. All components of the Pagermon stack run without modification on aarch64.

### Hardware Constraints

- CPU: Lightweight - `rtl_fm` and `multimon-ng` decoding uses minimal CPU. The Node.js web server is similarly lightweight. Total CPU usage under 10% of a single Cortex-A76 core during normal operation
- RAM: ~100-200MB for the Node.js server plus SQLite database. Well within the 8GB available
- SDR: Requires one RTL-SDR dongle dedicated to pager frequency monitoring. Cannot share with other RTL-SDR applications simultaneously
- Storage: Message database grows over time; plan for periodic cleanup or archival. Typical pager traffic generates a few MB per day

### Verdict

**COMPATIBLE** - Pagermon runs without issues on Raspberry Pi 5 with Kali Linux. The Node.js web interface and multimon-ng decoder are both lightweight and ARM64-native. Docker deployment is recommended for clean isolation of the web server. The reception pipeline can run on the host or inside the container depending on operational requirements.

# cotproxy

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> This tool is part of a controlled military/defense training toolkit. cotproxy operates as a man-in-the-middle (MITM) proxy for TAK/CoT traffic, capable of intercepting, inspecting, modifying, delaying, and re-routing Cursor-on-Target messages between TAK clients and servers. This includes the ability to alter GPS coordinates in transit, inject false mission data, modify contact callsigns, suppress alerts, and manipulate situational awareness feeds in real-time. Use is restricted exclusively to authorized red-team operations, TAK security auditing, and controlled training environments. Unauthorized interception or modification of operational TAK traffic may constitute a federal offense.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python asyncio proxy, no architecture-specific dependencies

| Method               | Supported | Notes                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| **Docker Container** | YES       | `--network host` strongly recommended for transparent proxying          |
| **Native Install**   | YES       | `pip install cotproxy` on ARM64; pytak-based with no compilation needed |

---

## Tool Description

cotproxy is an in-line Cursor-on-Target (CoT) transformation proxy developed by the snstac team. It sits between TAK clients (ATAK/WinTAK/iTAK) and TAK servers (FreeTAKServer, TAK Server), intercepting all CoT message traffic flowing in both directions. cotproxy can apply configurable transformation rules to modify CoT events in transit -- changing coordinates, altering callsigns, filtering event types, injecting delays, adding or removing detail elements, and routing messages to alternative destinations. The tool supports both TCP and UDP CoT transports and integrates with the pytak framework. For Argos counter-ATAK operations, cotproxy enables real-time manipulation of adversary TAK communications, testing blue-force tracking integrity, validating CoT authentication mechanisms, and demonstrating the impact of unsecured TAK network architectures.

## Category

TAK Protocol / MITM Proxy / Traffic Manipulation / Red Team

## Repository

- **Source**: https://github.com/snstac/cotproxy
- **Language**: Python
- **License**: MIT

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Base Python 3.9+ image (ARM64-compatible)
- Network access to both TAK clients and TAK server (proxy position)
- Host network mode strongly recommended for transparent proxying
- TLS certificates if proxying encrypted TAK connections
- Port exposure for upstream and downstream CoT connections

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

LABEL maintainer="Argos Project"
LABEL description="cotproxy - CoT transformation proxy for TAK networks"
LABEL risk="HIGH - SENSITIVE SOFTWARE"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev \
        libssl-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir cotproxy

WORKDIR /app

# Directory for TLS certificates and transform rules
RUN mkdir -p /app/certs /app/rules

COPY . /app/

EXPOSE 8087 8088

CMD ["cotproxy"]
```

### Docker Run Command

```bash
# Run as transparent CoT proxy between TAK clients and server
docker run -it --rm \
    --name argos-cotproxy \
    --network host \
    -e COT_URL="tcp://tak-server:8087" \
    -e COTPROXY_LISTEN_PORT="8088" \
    argos-cotproxy

# Run with TLS termination
docker run -it --rm \
    --name argos-cotproxy \
    --network host \
    -e COT_URL="ssl://tak-server:8089" \
    -e COTPROXY_LISTEN_PORT="8088" \
    -e PYTAK_TLS_CLIENT_CERT="/app/certs/client.pem" \
    -e PYTAK_TLS_CLIENT_KEY="/app/certs/client.key" \
    -e PYTAK_TLS_CLIENT_CAFILE="/app/certs/ca.pem" \
    -v $(pwd)/certs:/app/certs:ro \
    argos-cotproxy

# Run with custom transformation rules
docker run -it --rm \
    --name argos-cotproxy \
    --network host \
    -e COT_URL="tcp://tak-server:8087" \
    -e COTPROXY_LISTEN_PORT="8088" \
    -v $(pwd)/rules:/app/rules:ro \
    argos-cotproxy \
    cotproxy --config /app/rules/transform.ini
```

---

## Install Instructions (Native)

```bash
# Install via pip (recommended)
pip install cotproxy

# Or install from source
git clone https://github.com/snstac/cotproxy.git
cd cotproxy
pip install .

# Verify installation
cotproxy --help

# Check version
python -c "import cotproxy; print('cotproxy loaded')"
```

### Basic Usage Example

```bash
# Basic transparent proxy: listen on 8088, forward to TAK server on 8087
export COT_URL="tcp://tak-server:8087"
export COTPROXY_LISTEN_PORT="8088"
cotproxy

# TAK clients connect to cotproxy on port 8088 instead of the TAK server
# cotproxy forwards traffic to the real server on port 8087
# All CoT messages pass through cotproxy and can be inspected/modified
```

### Transform Rules Example

```python
# Example cotproxy transform function
# Modify all incoming PLI events to offset coordinates

import xml.etree.ElementTree as ET

def transform_cot(cot_event: bytes) -> bytes:
    """Offset all position reports by a fixed amount."""
    root = ET.fromstring(cot_event)
    point = root.find("point")
    if point is not None:
        # Offset latitude by 0.001 degrees (~111 meters)
        lat = float(point.get("lat", 0))
        point.set("lat", str(lat + 0.001))
    return ET.tostring(root)
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| ARM64 Support         | ✅ Pure Python, architecture-independent                                                |
| Kali Repo Available   | ❌ Not in Kali repos, install via pip                                                   |
| Hardware Requirements | Minimal -- network interface for proxying TAK traffic                                   |
| Performance on RPi5   | Excellent -- asyncio event loop handles high-throughput CoT message streams efficiently |

### Platform Details

- **Tested Architecture**: aarch64 (ARM64)
- **Python Requirement**: Python 3.9+
- **Key Dependencies**: pytak, takproto, asyncio
- **Memory Footprint**: ~40-60MB RAM under active proxying
- **CPU Impact**: Low -- I/O-bound proxy operations are efficient on Cortex-A76
- **Network Requirements**: Dual network access (client-facing and server-facing), or host network mode
- **Throughput**: Capable of handling hundreds of CoT messages per second on RPi5

### Operational Security Notes

- cotproxy sees all CoT traffic in cleartext, including position data and mission information
- TLS-wrapped TAK connections require valid certificates for interception
- Proxy presence may be detectable via latency analysis or certificate inspection
- All intercepted/modified traffic should be logged for post-operation analysis
- Network positioning (ARP spoofing, DNS redirect) may be required to redirect TAK clients to the proxy

### Verdict

**COMPATIBLE** -- Pure Python asyncio proxy with no native architecture constraints. Runs efficiently on Raspberry Pi 5 ARM64 with Kali Linux. The event-driven proxy architecture is well-suited to the RPi5 Cortex-A76 cores, handling real-time CoT message interception and transformation with low latency and minimal resource usage. Ideal for portable TAK security auditing from a field-deployable device.

# pytak

> **RISK CLASSIFICATION**: MODERATE RISK
> This tool is part of a controlled military/defense training toolkit. pytak provides full TAK network client/server capabilities, enabling connection to TAK servers and injection of CoT messages into live TAK networks. Message injection and network impersonation capabilities require authorized use only in training, research, and controlled red-team environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python asyncio framework, no architecture-specific dependencies

| Method               | Supported | Notes                                                                      |
| -------------------- | --------- | -------------------------------------------------------------------------- |
| **Docker Container** | YES       | Lightweight Python image; `--network host` recommended for UDP multicast   |
| **Native Install**   | YES       | `pip install pytak` on ARM64; pure Python with optional TLS crypto support |

---

## Tool Description

pytak is a higher-level Python TAK client and server framework built on top of takproto. It provides a complete asyncio-based framework for connecting to TAK servers (FreeTAKServer, TAK Server), handling authentication (TLS client certificates, credential-based), managing bidirectional CoT message routing, and implementing TAK data gateways. pytak serves as the foundation for all snstac TAK gateway projects (adsbcot, aprscot, inrcot, etc.) and is the recommended way to build Python applications that interact with TAK networks. For Argos, pytak enables the platform to act as a TAK data source -- pushing RF intelligence, detected devices, and sensor data as CoT events into ATAK/WinTAK/iTAK clients for real-time situational awareness overlay.

## Category

TAK Protocol / Network Framework / Situational Awareness Integration

## Repository

- **Source**: https://github.com/snstac/pytak
- **Language**: Python
- **License**: MIT

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Base Python 3.9+ image (ARM64-compatible)
- Network access to TAK server (TCP/UDP ports, typically 8087/8089/8443)
- TLS certificates volume-mounted if using authenticated TAK connections
- No special hardware or device access required
- Optional: host network mode for UDP multicast CoT scenarios

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

LABEL maintainer="Argos Project"
LABEL description="pytak - Python TAK client/server framework"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        python3-dev \
        libssl-dev && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir pytak

WORKDIR /app

# Directory for TLS certificates
RUN mkdir -p /app/certs

COPY . /app/

CMD ["python", "-c", "import pytak; print(f'pytak {pytak.__version__} loaded successfully')"]
```

### Docker Run Command

```bash
# Run with TAK server connection (TCP CoT)
docker run -it --rm \
    --name argos-pytak \
    --network host \
    -e COT_URL="tcp://tak-server:8087" \
    -v $(pwd)/certs:/app/certs:ro \
    argos-pytak \
    python /app/my_tak_gateway.py

# Run with TLS authentication
docker run -it --rm \
    --name argos-pytak \
    --network host \
    -e COT_URL="ssl://tak-server:8089" \
    -e PYTAK_TLS_CLIENT_CERT="/app/certs/client.pem" \
    -e PYTAK_TLS_CLIENT_KEY="/app/certs/client.key" \
    -e PYTAK_TLS_CLIENT_CAFILE="/app/certs/ca.pem" \
    -v $(pwd)/certs:/app/certs:ro \
    argos-pytak \
    python /app/my_tak_gateway.py

# Run with UDP multicast (ATAK mesh networking)
docker run -it --rm \
    --name argos-pytak \
    --network host \
    -e COT_URL="udp://239.2.3.1:6969" \
    argos-pytak \
    python /app/my_tak_gateway.py
```

---

## Install Instructions (Native)

```bash
# Install via pip (recommended)
pip install pytak

# Or install from source
git clone https://github.com/snstac/pytak.git
cd pytak
pip install .

# Verify installation
python -c "import pytak; print(f'pytak version: {pytak.__version__}')"

# Install with all optional dependencies
pip install pytak[with_crypto]
```

### Basic Usage Example

```python
import asyncio
import pytak

class ArgosCoTWorker(pytak.QueueWorker):
    """Example worker that generates CoT events from Argos data."""

    async def handle_data(self, data):
        """Handle incoming CoT data from TAK network."""
        print(f"Received CoT: {data}")

    async def run(self, number_of_iterations=-1):
        """Generate CoT events from Argos sensor data."""
        while True:
            cot_event = pytak.gen_cot_xml(
                uid="ARGOS-SENSOR-001",
                cot_type="a-f-G-U-C",
                lat="38.8977",
                lon="-77.0365",
                callsign="ARGOS-RF"
            )
            await self.put_queue(cot_event)
            await asyncio.sleep(10)  # Send every 10 seconds

async def main():
    config = {
        "COT_URL": "tcp://tak-server:8087",
        "CALLSIGN": "ARGOS",
    }
    clitool = pytak.CLITool(config)
    await clitool.setup()

    worker = ArgosCoTWorker(clitool.tx_queue, config)
    clitool.add_task(worker)

    await clitool.run()

asyncio.run(main())
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| ARM64 Support         | ✅ Pure Python, architecture-independent                                            |
| Kali Repo Available   | ❌ Not in Kali repos, install via pip                                               |
| Hardware Requirements | Minimal -- network interface for TAK server connectivity                            |
| Performance on RPi5   | Excellent -- asyncio-based, low CPU/RAM footprint even with sustained CoT streaming |

### Platform Details

- **Tested Architecture**: aarch64 (ARM64)
- **Python Requirement**: Python 3.9+
- **Key Dependencies**: takproto, asyncio, cryptography (optional, for TLS)
- **Memory Footprint**: ~30-50MB RAM under active use
- **CPU Impact**: Low -- asyncio event loop is efficient for I/O-bound CoT message routing
- **Network Requirements**: TCP/UDP access to TAK server or multicast group

### Verdict

**COMPATIBLE** -- Pure Python asyncio framework with no native architecture constraints. Runs efficiently on Raspberry Pi 5 ARM64 with Kali Linux. The asyncio-based design is well-suited to the RPi5 Cortex-A76 cores, handling sustained CoT message generation and routing with minimal resource usage. This is the foundation library for integrating Argos sensor data into TAK networks and serves as the base for all snstac gateway tools.

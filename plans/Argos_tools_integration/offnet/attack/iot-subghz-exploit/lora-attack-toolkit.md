# LoRa Attack Toolkit (LAF)

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> LoRaWAN protocol exploitation toolkit capable of packet analysis, replay attacks, DevAddr spoofing, frame counter bypass, gateway impersonation, and denial of service against LoRaWAN infrastructure. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Go + Python toolkit; uses docker-compose with PostgreSQL for data storage

| Method               | Supported | Notes                                                                      |
| -------------------- | --------- | -------------------------------------------------------------------------- |
| **Docker Container** | YES       | Official Dockerfile (Go + Python); docker-compose with PostgreSQL          |
| **Native Install**   | PARTIAL   | Requires Go toolchain + Python + PostgreSQL; complex multi-component setup |

---

## Tool Description

The LoRa Attack Framework (LAF) by IOActive is a security auditing toolkit for LoRaWAN networks. It works at the **network infrastructure level** — intercepting and analyzing traffic between LoRaWAN gateways and network servers (via MQTT, UDP packet forwarder protocol, and The Things Network API). It does NOT communicate directly with LoRa radio hardware. Instead, it taps into the network backend to collect LoRaWAN packets, stores them in a PostgreSQL database, and provides analysis and attack tools including traffic analysis, device fingerprinting, packet replay, and cryptographic auditing. The core packet processing uses a Go shared library (`lorawanWrapper.so`) for LoRaWAN protocol handling, with Python scripts for data collection and analysis.

## Category

LoRaWAN Network Infrastructure Auditing / IoT Protocol Security Testing

## Repository

https://github.com/IOActive/laf

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - The repo includes an official `Dockerfile` (based on `golang:latest`) and `docker-compose.yml`. The toolkit is a multi-service application: the main LAF container (Go + Python) plus a PostgreSQL database for storing captured LoRaWAN data. Docker Compose is the recommended deployment method.

### Host OS-Level Requirements

- No USB device passthrough needed (operates over network, not radio hardware)
- No `--privileged` needed
- No `--net=host` needed (but may need network access to target LoRaWAN infrastructure)
- PostgreSQL container runs alongside (defined in docker-compose.yml)

### Docker-to-Host Communication

- Network access to LoRaWAN gateway packet forwarders (UDP)
- Network access to MQTT brokers (if using MQTT data collector)
- PostgreSQL on port 5432 (inter-container)
- pgAdmin web UI on port 5001 (optional, for database inspection)
- Volume mount for persistent database storage

---

## Install Instructions (Docker on Kali RPi 5)

### Docker Compose (Recommended — uses repo's official config)

```bash
# Clone LAF repository
git clone https://github.com/IOActive/laf.git /opt/laf
cd /opt/laf

# Start all services (LAF + PostgreSQL + pgAdmin)
docker compose up -d

# The LAF container stays running (CMD sleep infinity)
# Execute tools inside it:
docker compose exec tools bash
```

### Official Dockerfile (from repo)

```dockerfile
FROM golang:latest

RUN apt-get update && apt-get install -y python3-pip

WORKDIR /root/app
ENV PYTHONPATH="/root/app" \
    GOPATH="/root/go"

ADD ./requirements.txt /root/app/requirements.txt

RUN pip3 install --trusted-host pypi.python.org -r requirements.txt

ADD . /root/app/

RUN go get -d ./...

RUN rm /usr/bin/python
RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /root/app/lorawanwrapper/utils
RUN go build -o lorawanWrapper.so -buildmode=c-shared *.go

WORKDIR /root/app
CMD sleep infinity
```

### Official docker-compose.yml (from repo)

```yaml
version: '3.0'

services:
    tools:
        build: .
        volumes:
            - .:/app
        environment:
            DB_HOST: db
            DB_NAME: loraguard_db
            DB_USERNAME: postgres
            DB_PASSWORD: postgres
            DB_PORT: 5432
            ENVIRONMENT: DEV
        networks:
            - app
    db:
        image: postgres:10.1-alpine
        restart: always
        environment:
            POSTGRES_DB: loraguard_db
            POSTGRES_USER: postgres
            POSTGRES_PASSWORD: postgres
        ports:
            - '5432:5432'
        volumes:
            - data:/var/lib/postgresql/iotsecurity
        networks:
            - app
    pgadmin4:
        image: dpage/pgadmin4
        environment:
            - 'PGADMIN_DEFAULT_EMAIL=pgadmin'
            - 'PGADMIN_DEFAULT_PASSWORD=pgadmin'
        ports:
            - '5001:80'
        networks:
            - app

volumes:
    data:

networks:
    app:
        driver: 'bridge'
```

### Actual Python Dependencies (requirements.txt)

```
paho-mqtt
sqlalchemy
psycopg2-binary
python-dateutil
websocket_client
requests==2.22.0
```

### Usage (inside the LAF container)

```bash
# Data collectors — connect to LoRaWAN infrastructure and capture packets:
# python3 auditing/datacollectors/PacketForwarderCollector.py   # UDP packet forwarder
# python3 auditing/datacollectors/GenericMqttCollector.py       # MQTT broker
# python3 auditing/datacollectors/LoraServerIOCollector.py      # LoRa Server (ChirpStack)
# python3 auditing/datacollectors/TTNCollector.py               # The Things Network

# Analysis — process captured data:
# python3 auditing/analyzers/LafProcessData.py

# Network tools:
# python3 tools/GateviceSender.py    # Gateway device sender
# python3 tools/TcpProxy.py          # TCP proxy for traffic interception
# python3 tools/UdpProxy.py          # UDP proxy for packet forwarder MITM
# python3 tools/UdpSender.py         # UDP packet sender
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED WITH CAVEATS** - The Go compiler supports ARM64 natively. Python dependencies install cleanly. PostgreSQL ARM64 images are available. However, the `golang:latest` Docker image is large and the Go shared library build adds complexity. The `psycopg2-binary` wheel may need compilation on ARM64.

### Hardware Constraints

- **CPU**: Lightweight — packet analysis and database queries. Well within RPi 5 capability.
- **RAM**: ~500MB for LAF + PostgreSQL + pgAdmin. Feasible on 8GB RPi.
- **Storage**: Go toolchain + PostgreSQL data can use 2-3GB.
- **Hardware**: No LoRa radio hardware needed. LAF works over the network — it connects to LoRaWAN gateways, MQTT brokers, or network servers via TCP/UDP. Requires network access to target LoRaWAN infrastructure.

### Verdict

**COMPATIBLE** - LAF runs on RPi 5 via Docker Compose. The Go + Python + PostgreSQL stack is heavier than pure Python tools but well within RPi 5 resources. Key distinction: this tool does NOT interface with LoRa radio hardware directly — it audits LoRaWAN network infrastructure by intercepting gateway-to-server communications. Useful for testing LoRaWAN deployments where you have network access to the backend infrastructure.

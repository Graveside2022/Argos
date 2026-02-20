# Open5GS

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Complete 4G/5G core network for rogue base station operations. Military education/training toolkit - Not for public release.

> **WARNING: DOCKER IMAGES UNAVAILABLE** - The documented Docker images (open5gs/open5gs:latest) do not exist on Docker Hub. Building from source or using community-maintained images may be required.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                                     |
| -------------------- | --------- | --------------------------------------------------------- |
| **Docker Container** | YES       | Official ARM64 Docker support, docker-compose recommended |
| **Native Install**   | YES       | ARM64 packages available, pure software core network      |

---

## Tool Description

Open-source C-language implementation of 4G EPC (Evolved Packet Core) and 5G Core network, implementing 3GPP Release-17. Open5GS is the backend "brain" that makes a rogue LTE/5G base station functional. When paired with srsRAN as the radio access network (RAN), it creates a complete rogue cellular network. Handles subscriber management (HSS/UDM), session management (SMF/PGW), mobility management (AMF/MME), and data plane (UPF/SGW). Without Open5GS, srsRAN can only passively sniff — with it, you can stand up a full fake LTE/5G tower.

2.4K GitHub stars, actively maintained, pushed to daily.

## Category

Core Network / 4G EPC + 5G Core

## Repository

https://github.com/open5gs/open5gs

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - Open5GS has official Docker support with docker-compose configurations. Pure software network stack with no hardware dependencies. One of the most Docker-friendly tools in the inventory.

### Host OS-Level Requirements

- No USB device passthrough needed (pure software)
- `--net=host` OR custom Docker network for inter-container communication
- MongoDB for subscriber database (separate container)
- TUN/TAP interface for data plane: `--cap-add=NET_ADMIN --device=/dev/net/tun`
- Port mappings for control plane interfaces (S1AP, NGAP, PFCP, GTP)

### Docker-to-Host Communication

- S1AP/NGAP: Port 38412 (SCTP) — connection from srsRAN eNB/gNB
- PFCP: Port 8805 (UDP) — session management
- GTP-U: Port 2152 (UDP) — user plane data
- Web UI: Port 9999 (TCP) — subscriber management dashboard
- MongoDB: Port 27017 (TCP) — subscriber database

---

## Install Instructions (Docker on Kali RPi 5)

### Docker Compose (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
    mongodb:
        image: mongo:6.0
        container_name: open5gs-mongo
        volumes:
            - mongo_data:/data/db
        restart: unless-stopped

    open5gs:
        image: open5gs/open5gs:latest
        container_name: open5gs-core
        depends_on:
            - mongodb
        environment:
            - DB_URI=mongodb://mongodb/open5gs
        cap_add:
            - NET_ADMIN
        devices:
            - /dev/net/tun
        network_mode: host
        restart: unless-stopped

    webui:
        image: open5gs/webui:latest
        container_name: open5gs-webui
        depends_on:
            - mongodb
        environment:
            - DB_URI=mongodb://mongodb/open5gs
        ports:
            - '9999:9999'
        restart: unless-stopped

volumes:
    mongo_data:
```

```bash
# Deploy
docker compose up -d

# Access subscriber management UI
# http://localhost:9999 (admin/1423)

# Add subscriber (for rogue BTS)
# Use web UI or CLI to add IMSI/Ki/OPc values
```

### Alternative: Build from source

```bash
sudo apt install -y python3-pip python3-setuptools python3-wheel \
    ninja-build build-essential flex bison git cmake \
    libsctp-dev libgnutls28-dev libgcrypt-dev libssl-dev \
    libidn11-dev libmongoc-dev libbson-dev libyaml-dev \
    libnghttp2-dev libmicrohttpd-dev libcurl4-gnutls-dev \
    libtins-dev libtalloc-dev meson mongodb
git clone https://github.com/open5gs/open5gs /opt/open5gs
cd /opt/open5gs
meson build --prefix=/opt/open5gs/install
ninja -C build && ninja -C build install
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 SUPPORTED** - Open5GS builds natively on ARM64 using the Meson build system. Debian/Ubuntu packages support ARM64. Docker images support multi-arch including arm64.

### Hardware Constraints

- **CPU**: Core network processing is lightweight — packet forwarding, subscriber lookups. 4x Cortex-A76 is adequate.
- **RAM**: ~500MB for all network functions + MongoDB. Well within 8GB.
- **Network**: Requires only standard network interfaces. No SDR hardware needed — this is a pure software component.

### Verdict

**COMPATIBLE** - Excellent fit for RPi 5. Open5GS runs as a pure software core network. Deploy via Docker Compose for clean isolation. The RPi 5 runs the core network while a separate x86 laptop with USRP runs srsRAN as the radio access network, connecting to Open5GS over the LAN.

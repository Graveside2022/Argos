# Meshstellar — Lightweight Meshtastic Mesh Network Monitor

## Overview

Monitors Meshtastic LoRa mesh networks via MQTT. Compiled Rust binary with SQLite storage and web UI. Designed for resource-constrained devices like Raspberry Pi.

## Links

- **GitHub:** https://github.com/jurriaan/meshstellar
- **Docker:** ghcr.io/jurriaan/meshstellar:latest
- **Docker Compose Example:** https://github.com/jurriaan/meshstellar/blob/main/docker-compose.yml.example

## What It Does

Connects to an MQTT broker, receives decoded Meshtastic Protocol Buffer messages, stores them in SQLite, and serves a web UI showing node health (battery, SNR, RSSI, channel utilization), traffic monitoring, and network topology.

## Hardware Requirements

- **RAM:** ~10–30 MB (Rust binary + SQLite) + ~5 MB for Mosquitto MQTT broker
- **CPU:** ARM64 native (pre-built ARM64 Docker image)
- **Hardware:** Meshtastic-compatible LoRa radio (~$25–35, e.g., Heltec LoRa 32 V3) connected via USB and configured to uplink to MQTT
- **Pi 5 8GB:** ✅ PASS — among the lightest tools in the inventory

## Install on Raspberry Pi 5 (Kali ARM64)

### Docker Install (Recommended)

```bash
# Install MQTT broker
sudo apt install -y mosquitto mosquitto-clients

# Run Meshstellar
docker run -d --name meshstellar \
  -p 8080:8080 \
  -e MQTT_HOST=localhost \
  -e MQTT_TOPIC="meshtastic/2/json/#" \
  -v meshstellar-data:/home/meshstellar \
  ghcr.io/jurriaan/meshstellar:latest

# Web UI at http://localhost:8080
```

### Docker Compose

```yaml
version: '3'
services:
    meshstellar:
        image: ghcr.io/jurriaan/meshstellar:latest
        ports:
            - '8080:8080'
        environment:
            MQTT_HOST: mosquitto
            MQTT_TOPIC: 'meshtastic/2/json/#'
        volumes:
            - meshstellar-data:/home/meshstellar
        depends_on:
            - mosquitto
    mosquitto:
        image: eclipse-mosquitto:latest
        ports:
            - '1883:1883'
        volumes:
            - mosquitto-data:/mosquitto/data
volumes:
    meshstellar-data:
    mosquitto-data:
```

### Configure Meshtastic Node

Set your Meshtastic radio to uplink to MQTT:

- Enable MQTT module in Meshtastic settings
- Set MQTT server to Pi's IP address
- Set topic prefix to `meshtastic/2/json`

## Capabilities

- MQTT-based Meshtastic mesh monitoring
- Node discovery and tracking
- Message capture and storage
- Signal quality stats (SNR, RSSI)
- Battery level monitoring
- Channel utilization metrics
- SQLite persistent storage
- Web UI dashboard

## Why We Care

Only RECON capability for LoRa mesh networks in our inventory. See every Meshtastic device in the area, read messages, map the mesh network. At ~15 MB total RAM, it's essentially free to run alongside other tools. Chosen over MeshSense (Electron, 200–400 MB) for Pi RAM efficiency.

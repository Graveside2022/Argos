# SniffleToTAK

## DO NOT INSTALL -- Required hardware not available

> **RISK CLASSIFICATION: LOW RISK**

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                          |
| -------------------- | --------- | ---------------------------------------------- |
| **Docker Container** | YES       | Lightweight Python, BLE dongle USB passthrough |
| **Native Install**   | YES       | All Python dependencies have ARM64 wheels      |

---

## Description

Proxy tool that bridges the Sniffle Bluetooth 5 Long Range Extended sniffer to the TAK (Team Awareness Kit) ecosystem. Captures BLE drone Remote ID broadcasts using a Sniffle-compatible dongle (TI CC1352/CC26x2), converts them to Cursor on Target (CoT) format, and relays them to TAK servers or ATAK multicast networks. Enables real-time drone tracking on tactical displays.

## Category

BLE Drone Detection / TAK Integration / Tactical Display Bridge

## Source

- **Repository**: https://github.com/alphafox02/SniffleToTAK
- **Status**: EXPERIMENTAL / ACTIVE
- **Language**: Python
- **Dependencies**: cffi, cryptography, lxml, pycparser, pyzmq

## Docker Compatibility

| Attribute                | Value                                                                        |
| ------------------------ | ---------------------------------------------------------------------------- |
| Docker Compatible        | Yes                                                                          |
| ARM64 (aarch64) Support  | Yes                                                                          |
| Base Image               | python:3.11-slim                                                             |
| Privileged Mode Required | Yes (USB serial access to BLE dongle)                                        |
| Host Network Required    | Yes (for TAK multicast on local network) or No (if using TAK server via TCP) |
| USB Device Passthrough   | TI CC1352R or CC26x2 Sniffle-compatible dongle (`/dev/ttyACM0` or similar)   |
| Host Kernel Modules      | cdc_acm (USB serial, typically built-in on Kali)                             |

### Docker-to-Host Communication

- **USB Serial**: Sniffle BLE dongle appears as `/dev/ttyACM0` on host. Must be passed to container via `--device` flag.
- **Network**: If using TAK multicast, container must use `--net=host` to access multicast traffic. If using a TAK server over TCP/UDP, standard Docker networking suffices.
- **ZeroMQ**: Tool uses ZMQ internally for data pipeline; no host ZMQ setup needed.

## Install Instructions (Docker)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    libxml2-dev \
    libxslt1-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/alphafox02/SniffleToTAK.git /opt/sniffletotak

WORKDIR /opt/sniffletotak

RUN pip install --no-cache-dir \
    cffi \
    cryptography \
    lxml \
    pycparser \
    pyzmq

CMD ["python", "sniffletotak.py"]
```

```bash
# Build
docker build -t sniffletotak .

# Run with BLE dongle and TAK multicast
docker run -it --rm \
  --net=host \
  --device=/dev/ttyACM0:/dev/ttyACM0 \
  -v $(pwd)/config.ini:/opt/sniffletotak/config.ini \
  sniffletotak

# Run with TAK server (no host network needed)
docker run -it --rm \
  --device=/dev/ttyACM0:/dev/ttyACM0 \
  -v $(pwd)/config.ini:/opt/sniffletotak/config.ini \
  sniffletotak
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                                                                                     |
| Architecture     | aarch64 native (all Python dependencies have ARM64 wheels)                                                                                              |
| RAM Requirement  | ~128MB (lightweight Python proxy)                                                                                                                       |
| Limiting Factors | Requires TI CC1352R/CC26x2 Sniffle-compatible BLE dongle (separate hardware purchase ~$20-30). Dongle must be flashed with Sniffle firmware before use. |

# DroneSecurity

> **RISK CLASSIFICATION: LOW RISK**

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                         |
| -------------------- | --------- | --------------------------------------------- |
| **Docker Container** | YES       | Python signal processing, SDR USB passthrough |
| **Native Install**   | YES       | numpy/scipy have ARM64 wheels                 |

---

## Description

Proof-of-concept receiver that reverse-engineers and decodes DJI's proprietary DroneID protocol from raw RF samples. Published at NDSS 2023 by RUB-SysSec. Extracts drone GPS coordinates, serial numbers, and operator location from DJI OFDM frames captured via SDR. This is a passive receive-only tool that does not transmit. Note: only works with DJI DroneID protocol, not WiFi/Bluetooth-based FAA Remote ID.

## Category

Passive DJI DroneID Protocol Decoder / RF Signal Analysis

## Source

- **Repository**: https://github.com/RUB-SysSec/DroneSecurity
- **Branch**: public_squash
- **Status**: ACTIVE (NDSS 2023 publication)
- **Language**: Python
- **Dependencies**: numpy 1.22, scipy 1.8, matplotlib 3.5, bitarray, crcmod, Pillow

## Docker Compatibility

| Attribute                | Value                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Docker Compatible        | Yes                                                                                           |
| ARM64 (aarch64) Support  | Yes                                                                                           |
| Base Image               | python:3.10-slim                                                                              |
| Privileged Mode Required | Yes (if using live SDR capture)                                                               |
| Host Network Required    | No                                                                                            |
| USB Device Passthrough   | HackRF One or USRP (`/dev/bus/usb`) for live capture; none needed for offline sample analysis |
| Host Kernel Modules      | hackrf or uhd (depending on SDR hardware)                                                     |

### Docker-to-Host Communication

- For **offline analysis** (processing saved IQ samples): no host communication needed. Mount sample files as a Docker volume.
- For **live capture**: SDR hardware must be passed through via USB. Host needs udev rules for HackRF/USRP.

## Install Instructions (Docker)

```dockerfile
FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    git \
    libhackrf-dev \
    && rm -rf /var/lib/apt/lists/*

RUN git clone -b public_squash \
    https://github.com/RUB-SysSec/DroneSecurity.git \
    /opt/dronesecurity

WORKDIR /opt/dronesecurity

RUN pip install --no-cache-dir \
    bitarray==2.4.1 \
    crcmod==1.7 \
    matplotlib==3.5.1 \
    numpy==1.22.3 \
    Pillow==9.4.0 \
    scipy==1.8.0

CMD ["python", "src/droneid_receiver_offline.py"]
```

```bash
# Build
docker build -t dronesecurity .

# Run with sample files (offline analysis)
docker run -it --rm \
  -v /path/to/samples:/opt/dronesecurity/samples \
  dronesecurity

# Run with live SDR capture
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  dronesecurity
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                                                                                                                     |
| Architecture     | aarch64 native (numpy, scipy have ARM64 wheels)                                                                                                                                         |
| RAM Requirement  | ~512MB (signal processing with numpy/scipy)                                                                                                                                             |
| Limiting Factors | OFDM demodulation is CPU-intensive; RPi5 Cortex-A76 handles it adequately for near-real-time analysis. Older pinned dependency versions may need updating for ARM64 wheel availability. |

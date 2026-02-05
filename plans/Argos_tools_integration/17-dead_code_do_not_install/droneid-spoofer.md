# DroneID-Spoofer

> **HIGH RISK - SENSITIVE SOFTWARE**
> Injects fake DJI DroneID and FAA Remote ID broadcast frames to create phantom drones on detection systems. Spoofs operator location, serial numbers, and GPS coordinates. Undermines drone airspace monitoring and counter-UAS systems. Violates FAA Remote ID regulations.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                       |
| -------------------- | --------- | ------------------------------------------- |
| **Docker Container** | YES       | Python + scapy, WiFi adapter with injection |
| **Native Install**   | YES       | Pure Python, all deps have ARM64 wheels     |

---

## Description

Collection of tools for crafting and broadcasting spoofed DJI DroneID and Open Drone ID (ODID) Remote ID frames over WiFi. Uses scapy or ESP-based hardware to inject 802.11 beacon frames containing fake drone identification data, including fabricated GPS positions, serial numbers, and operator locations. Fools DJI Aeroscope and FAA-compliant Remote ID receivers into displaying nonexistent drones.

## Category

Remote ID Spoofing / Counter-Detection / 802.11 Frame Injection

## Source

Multiple implementations:

- **proto17/dji_droneid**: https://github.com/proto17/dji_droneid (DJI DroneID demodulation + frame crafting via SDR)
- **DJIDroneIDspoofer**: https://github.com/llorencroma/DJIDroneIDspoofer (scapy-based beacon injection, targets DJI Aeroscope)
- **droneRemoteIDSpoofer**: https://github.com/cyber-defence-campus/droneRemoteIDSpoofer (Python, ASD-STAN + DJI format spoofing)
- **Status**: EXPERIMENTAL
- **Language**: Python
- **Dependencies**: scapy, WiFi adapter with monitor mode + injection

## Docker Compatibility

| Attribute                | Value                                                           |
| ------------------------ | --------------------------------------------------------------- |
| Docker Compatible        | Yes                                                             |
| ARM64 (aarch64) Support  | Yes                                                             |
| Base Image               | python:3.11-slim                                                |
| Privileged Mode Required | Yes (raw WiFi frame injection)                                  |
| Host Network Required    | Yes (direct WiFi interface access)                              |
| USB Device Passthrough   | WiFi adapter with injection support (e.g., Alfa AWUS036AXML)    |
| Host Kernel Modules      | cfg80211, mac80211, WiFi adapter driver (mt76x2u for Alfa AXML) |

### Docker-to-Host Communication

- WiFi adapter must be in **monitor mode** on the host before passing to Docker, or container runs with `--privileged` plus `NET_ADMIN`/`NET_RAW` capabilities.
- Container needs `--net=host` to access the wireless interface directly for raw frame injection.
- No TCP/IP networking needed; operates at the 802.11 layer.

## Install Instructions (Docker)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    iw \
    wireless-tools \
    && rm -rf /var/lib/apt/lists/*

# Install scapy-based DJI DroneID spoofer
RUN git clone https://github.com/llorencroma/DJIDroneIDspoofer.git /opt/dji-spoofer

# Install Remote ID spoofer (ASD-STAN + DJI format)
RUN git clone https://github.com/cyber-defence-campus/droneRemoteIDSpoofer.git /opt/remoteid-spoofer

RUN pip install --no-cache-dir scapy inputs==0.5

WORKDIR /opt/dji-spoofer

CMD ["/bin/bash"]
```

```bash
# Build
docker build -t droneid-spoofer .

# Set WiFi adapter to monitor mode on host
sudo ip link set wlan1 down
sudo iw dev wlan1 set type monitor
sudo ip link set wlan1 up

# Run with WiFi injection
docker run -it --rm \
  --privileged \
  --net=host \
  droneid-spoofer

# Inside container:
# python3 main.py --interface wlan1 --lat 38.8977 --lon -77.0365 --serial FAKE123
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                                                                                            |
| Architecture     | aarch64 native (pure Python + scapy)                                                                                                                           |
| RAM Requirement  | ~128MB                                                                                                                                                         |
| Limiting Factors | WiFi adapter must support monitor mode AND frame injection. Not all adapters support injection on ARM64 Kali. Alfa AWUS036AXML (mt76x2u) is confirmed working. |

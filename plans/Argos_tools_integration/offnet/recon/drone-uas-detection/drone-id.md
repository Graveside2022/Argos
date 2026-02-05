# Drone ID

> **RISK CLASSIFICATION: LOW RISK**

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** | Recommended: **NATIVE** (already part of Argos)

| Method               | Supported | Notes                                                     |
| -------------------- | --------- | --------------------------------------------------------- |
| **Docker Container** | YES       | Runs as part of main Argos container                      |
| **Native Install**   | YES       | Built into Argos application — no separate install needed |

---

## Description

Argos built-in Remote Drone Identification module. Passively decodes DJI DroneID broadcast frames from WiFi traffic to extract drone GPS position, serial number, operator location, and flight telemetry. This is a receive-only capability that performs no transmission.

## Category

Passive DJI Detection / Remote ID Decoding

## Source

Built into the Argos application (`src/lib/components/` and `src/lib/services/`). Not a separate third-party tool.

## Docker Compatibility

| Attribute                | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Docker Compatible        | Yes                                                          |
| ARM64 (aarch64) Support  | Yes                                                          |
| Base Image               | Part of main Argos container (node:20-slim)                  |
| Privileged Mode Required | No (but WiFi adapter needs monitor mode on host)             |
| Host Network Required    | No                                                           |
| USB Device Passthrough   | WiFi adapter with monitor mode (e.g., Alfa AWUS036AXML)      |
| Host Kernel Modules      | cfg80211, mac80211, WiFi adapter driver (mt76 for Alfa AXML) |

### Docker-to-Host Communication

- WiFi adapter must be placed in monitor mode on the **host OS** before passing to Docker, or the container must run with `--privileged` and `NET_ADMIN` capability to configure the adapter itself.
- Host must have appropriate WiFi drivers loaded (`modprobe mt76x2u` or equivalent for adapter in use).

## Install Instructions (Docker)

This module is part of the main Argos Docker container and does not require separate installation. The WiFi adapter must be passed through:

```bash
# Ensure WiFi adapter driver is loaded on host
sudo modprobe mt76x2u  # for Alfa AWUS036AXML

# Put adapter in monitor mode on host
sudo ip link set wlan1 down
sudo iw dev wlan1 set type monitor
sudo ip link set wlan1 up

# Pass adapter to Argos container
docker run -d \
  --name argos \
  --net=host \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  argos:latest
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                            |
| Architecture     | aarch64 native                                                                                 |
| RAM Requirement  | Included in Argos (~512MB total for Argos)                                                     |
| Limiting Factors | Requires WiFi adapter with monitor mode support; onboard Pi WiFi does not support monitor mode |

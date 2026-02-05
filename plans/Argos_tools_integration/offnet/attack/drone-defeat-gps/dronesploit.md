# dronesploit

> **HIGH RISK - SENSITIVE SOFTWARE**
> Modular drone exploitation framework capable of hijacking drone control links, intercepting video feeds, and executing protocol-level attacks against commercial drones. Can take over or disrupt airborne drones.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                   |
| -------------------- | --------- | --------------------------------------- |
| **Docker Container** | YES       | Pure Python, `pip install dronesploit`  |
| **Native Install**   | YES       | Pure Python, all deps have ARM64 wheels |

---

## Description

Metasploit-style drone pentesting framework console built on sploitkit. Provides a modular interface for drone exploitation including MAVLink protocol attacks, DJI protocol exploitation, FPV video stream hijacking, and controller spoofing. Organized into attack modules with a familiar `use/set/run` workflow.

## Category

Drone Exploitation Framework / Protocol Attack Suite

## Source

- **Repository**: https://github.com/dhondta/dronesploit
- **Status**: BETA
- **Language**: Python
- **Dependencies**: sploitkit >= 0.5.8 (which pulls in rich, prompt_toolkit, etc.)
- **Install**: `pip install dronesploit`

## Docker Compatibility

| Attribute                | Value                                                                    |
| ------------------------ | ------------------------------------------------------------------------ |
| Docker Compatible        | Yes                                                                      |
| ARM64 (aarch64) Support  | Yes                                                                      |
| Base Image               | python:3.11-slim                                                         |
| Privileged Mode Required | Yes (WiFi injection for deauth modules, network access)                  |
| Host Network Required    | Yes (for WiFi-based attacks targeting drone control links)               |
| USB Device Passthrough   | WiFi adapter with monitor mode + injection (for wireless attack modules) |
| Host Kernel Modules      | cfg80211, mac80211, WiFi adapter driver                                  |

### Docker-to-Host Communication

- WiFi adapter must be in monitor mode for wireless attack modules. Configure on host or pass with `--privileged`.
- Requires `--net=host` for modules that interact with drone WiFi networks directly.
- Some modules may need raw socket access (`NET_RAW`, `NET_ADMIN` capabilities).

## Install Instructions (Docker)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    git \
    aircrack-ng \
    wireless-tools \
    iw \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir dronesploit

CMD ["dronesploit"]
```

```bash
# Build
docker build -t dronesploit .

# Run with WiFi adapter and host networking
docker run -it --rm \
  --privileged \
  --net=host \
  -v /dev/bus/usb:/dev/bus/usb \
  dronesploit
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs on RPi5     | Yes                                                                                                                                                                                                |
| Architecture     | aarch64 native (pure Python, pip install works on ARM64)                                                                                                                                           |
| RAM Requirement  | ~256MB                                                                                                                                                                                             |
| Limiting Factors | Some exploit modules depend on specific WiFi chipset capabilities (injection support). WiFi adapter must support monitor mode and packet injection. Not all modules may have been tested on ARM64. |

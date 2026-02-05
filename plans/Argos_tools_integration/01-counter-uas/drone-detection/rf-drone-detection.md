# RF-Drone-Detection

> **RISK CLASSIFICATION: LOW RISK**

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES**

| Method               | Supported | Notes                                          |
| -------------------- | --------- | ---------------------------------------------- |
| **Docker Container** | YES       | Python + GNU Radio, HackRF USB passthrough     |
| **Native Install**   | YES       | All dependencies available in Kali ARM64 repos |

---

## Description

Passive RF signature analysis tool that detects drone presence by monitoring radio frequency communications between drones and their controllers. Uses GNU Radio on SDR hardware (HackRF One) to observe RF patterns and applies machine learning (scikit-learn) to classify detected signals. Identifies DJI drones by matching MAC address prefixes (62:60:1F, 60:60:1F) in WiFi monitor mode.

## Category

Passive RF Detection / Machine Learning Signal Classification

## Source

- **Repository**: https://github.com/tesorrells/RF-Drone-Detection
- **Status**: RESEARCH
- **Language**: Python 3.7+
- **Dependencies**: Managed via Pipfile (pipenv); includes matplotlib, numpy, pandas, scikit-learn, GNU Radio

## Docker Compatibility

| Attribute                | Value                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Docker Compatible        | Yes                                                                |
| ARM64 (aarch64) Support  | Yes                                                                |
| Base Image               | python:3.11-slim                                                   |
| Privileged Mode Required | Yes (SDR USB access)                                               |
| Host Network Required    | No                                                                 |
| USB Device Passthrough   | HackRF One (`/dev/bus/usb`) or WiFi adapter for MAC detection mode |
| Host Kernel Modules      | hackrf (for HackRF), cfg80211/mac80211 (for WiFi monitor mode)     |

### Docker-to-Host Communication

- HackRF One must be accessible via USB passthrough. Host needs `hackrf` udev rules installed.
- For WiFi-based detection mode, WiFi adapter must be in monitor mode (configured on host or via `--privileged`).
- No network ports required; tool operates on raw RF data.

## Install Instructions (Docker)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    gnuradio \
    gr-osmosdr \
    hackrf \
    libhackrf-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/tesorrells/RF-Drone-Detection.git /opt/rf-drone-detection

WORKDIR /opt/rf-drone-detection

COPY Pipfile Pipfile.lock* ./
RUN pip install --no-cache-dir pipenv && \
    pipenv install --system --deploy || \
    pipenv install --system

CMD ["python", "src/wifi_monitor.py"]
```

```bash
# Build
docker build -t rf-drone-detection .

# Run with HackRF passthrough
docker run -it --rm \
  --privileged \
  -v /dev/bus/usb:/dev/bus/usb \
  rf-drone-detection
```

## Kali Linux Raspberry Pi 5 Compatibility

| Attribute        | Value                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Runs on RPi5     | Yes                                                                                                                      |
| Architecture     | aarch64 native (all Python dependencies have ARM64 wheels)                                                               |
| RAM Requirement  | ~256MB (light ML inference with scikit-learn)                                                                            |
| Limiting Factors | GNU Radio on ARM64 compiles from source in Kali repos; scikit-learn inference is CPU-bound but lightweight on Cortex-A76 |

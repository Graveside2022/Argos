# DF Aggregator

> **RISK CLASSIFICATION**: LOW RISK
> Passive data aggregation and triangulation service with no RF capability; processes bearing data from remote KrakenSDR units to estimate transmitter positions. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Pure Python network service with no hardware dependencies; minimal resource usage

| Method               | Supported | Notes                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| **Docker Container** | YES       | No special flags needed; lightweight python:3.11-slim-bookworm image, ~100-200MB RAM |
| **Native Install**   | YES       | Standard Python packages (NumPy, SciPy, Dash) all available as ARM64 wheels          |

---

## Tool Description

DF Aggregator is the companion triangulation service for KrakenSDR, designed to aggregate direction-of-arrival (DOA) bearing data from multiple geographically distributed KrakenSDR units and compute estimated transmitter locations using multilateration. It collects real-time bearing lines from each KrakenSDR node over the network, plots them on an interactive map, and calculates the intersection point where the bearing lines converge to identify the physical location of an RF transmitter. The web-based interface displays all KrakenSDR stations, their individual bearing lines, confidence ellipses, and the estimated transmitter position with accuracy metrics.

## Category

RF Triangulation / Multi-Sensor Geolocation / Data Fusion

## Repository

https://github.com/krakenrf/krakensdr_doa (companion component within the KrakenSDR ecosystem)

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - DF Aggregator is a pure software service with no hardware dependencies. It is a Python web application that communicates with remote KrakenSDR instances over the network to collect bearing data. It requires no USB devices, no kernel modules, and no privileged access. It is an ideal candidate for Docker containerization.

### Host OS-Level Requirements

- No `--device` flags required (no hardware interaction)
- No `--privileged` required (pure network service)
- No `--net=host` strictly required, but simplifies discovery of KrakenSDR nodes on the local network
- No kernel modules required
- No special udev rules required
- Requires only standard network connectivity to reach each KrakenSDR instance on their data ports

### Docker-to-Host Communication

- Web UI served on port **8082** (configurable) - map to host via `-p 8082:8082`
- Outbound connections to each KrakenSDR unit's data port (default **8081**) to poll bearing data
- JSON API endpoint for Argos integration to retrieve computed transmitter locations
- Volume mount for persistent configuration and station definitions: `-v /host/df-config:/app/settings`
- Configuration file defines the IP addresses and ports of all KrakenSDR stations in the network

---

## Install Instructions (Docker on Kali RPi 5)

> **NOTE: NOT A STANDALONE TOOL** — DF Aggregator is NOT a separate script or application. It is built into the main KrakenSDR DOA web interface (`gui_run.sh`). There is no `df_aggregator.py` in the `krakenrf/krakensdr_doa` repository. The bearing aggregation and triangulation functionality is part of the KrakenSDR DOA web UI at `_ui/_web_interface/`. Deploy using the same KrakenSDR DOA container described in [krakensdr.md](krakensdr.md).

### Deployment (via KrakenSDR DOA)

The DF aggregation feature is accessed through the KrakenSDR DOA web interface. No separate container is needed. When multiple KrakenSDR units are deployed on the same network, the DOA web UI provides bearing overlay and triangulation views.

```bash
# Deploy the main KrakenSDR DOA container (includes DF aggregation)
# See krakensdr.md for full Dockerfile and build instructions
docker run -d --rm \
  --name krakensdr \
  --privileged \
  --device=/dev/bus/usb \
  --net=host \
  -v $(pwd)/kraken-config:/opt/krakensdr_doa/settings \
  argos/krakensdr

# The web UI at http://localhost:8080 includes:
# - Real-time DOA bearing display
# - Multi-station bearing aggregation
# - Triangulated transmitter position estimation
# - Heatmap overlay on interactive map
```

### Station Configuration

```bash
# DF Aggregator requires a configuration file defining KrakenSDR stations.
# Each station entry specifies the network address of a KrakenSDR unit:
#
# Station configuration example (settings/stations.json):
# {
#   "stations": [
#     {
#       "id": "station_alpha",
#       "ip": "192.168.1.101",
#       "port": 8081,
#       "latitude": 38.8977,
#       "longitude": -77.0365,
#       "label": "North Observation Post"
#     },
#     {
#       "id": "station_bravo",
#       "ip": "192.168.1.102",
#       "port": 8081,
#       "latitude": 38.8900,
#       "longitude": -77.0200,
#       "label": "East Observation Post"
#     }
#   ]
# }
```

### Argos Integration

```bash
# DF Aggregator provides triangulated transmitter positions as JSON.
# Argos can query the API to overlay estimated transmitter locations
# on the tactical map:
#
# GET http://localhost:8082/api/targets
# Response:
# {
#   "targets": [
#     {
#       "latitude": 38.893,
#       "longitude": -77.028,
#       "confidence": 0.82,
#       "num_bearings": 3,
#       "freq_mhz": 433.92,
#       "error_ellipse_m": 150,
#       "timestamp": 1706000000
#     }
#   ]
# }
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - DF Aggregator is a pure Python application with standard scientific computing dependencies (NumPy, SciPy) that have mature ARM64 wheel builds. No compiled native extensions specific to the project. The Dash web framework and all visualization libraries run without modification on aarch64. No architecture-specific considerations.

### Hardware Constraints

- **CPU**: Minimal CPU usage. Triangulation computations (bearing line intersection, least-squares estimation) are lightweight mathematical operations. A single Cortex-A76 core handles the workload with negligible utilization, even when aggregating data from multiple KrakenSDR stations simultaneously.
- **RAM**: Approximately 100-200MB runtime memory. The application maintains bearing history and target state in memory, but data volumes are small. Negligible impact on the 8GB available.
- **Storage**: Application and dependencies require approximately 500MB of disk space. Log files are minimal.
- **Network**: Requires reliable network connectivity to all KrakenSDR stations. Latency and bandwidth requirements are minimal (small JSON payloads at 1-10 Hz update rate). Works over WiFi, Ethernet, or mesh networks.
- **Hardware**: No dedicated hardware required. DF Aggregator is a pure software service. It consumes data from KrakenSDR units deployed elsewhere on the network.

### Verdict

**COMPATIBLE** - DF Aggregator is a lightweight pure-Python service that runs effortlessly on the Raspberry Pi 5. It has no hardware dependencies of its own and minimal resource requirements. Docker containerization is straightforward with no special flags needed. This service is the critical link that transforms individual KrakenSDR bearing measurements into actionable transmitter geolocation data on the Argos tactical map. Deploy alongside two or more KrakenSDR units for effective triangulation.

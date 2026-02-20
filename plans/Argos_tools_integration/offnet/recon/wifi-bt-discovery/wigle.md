# WiGLE (Wireless Geographic Logging Engine)

> **RISK CLASSIFICATION**: LOW RISK
> This tool is part of a controlled military/defense training toolkit. WiGLE is a public database and REST API for wireless network geolocation data. It provides historical and crowdsourced network mapping information. Use of the API is subject to WiGLE's terms of service. Data contributed to WiGLE becomes publicly accessible. Ensure operational security by not uploading sensitive scan data from classified or restricted environments.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — REST API service; only requires HTTP client (Python/curl)

| Method               | Supported | Notes                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| **Docker Container** | YES       | Minimal Python container for API client; no special requirements        |
| **Native Install**   | YES       | Only needs `python3-requests` or `curl`; fully architecture-independent |

---

## Tool Description

WiGLE (Wireless Geographic Logging Engine) is the world's largest crowdsourced database of wireless network locations, containing billions of WiFi access point, Bluetooth device, and cell tower observations submitted by wardrivers worldwide. WiGLE provides a REST API for querying network data by geographic coordinates, BSSID, SSID, or other parameters, returning network metadata including location, encryption type, signal strength, and observation history. The service includes a web-based map interface for browsing network density and coverage, user statistics and leaderboards, and data export capabilities. For Argos integration, WiGLE serves as an enrichment data source -- correlating locally detected networks against the global database to identify network history, movement patterns, and geographic distribution. This is a web service and API, not a standalone tool; it complements local scanning tools like Kismet and Sparrow-WiFi by providing historical context and broader geographic awareness.

## Category

Wardriving / Network Geolocation Database / Wireless Intelligence / OSINT

## Repository

- **Website**: https://wigle.net
- **API Documentation**: https://api.wigle.net/swagger
- **GitHub**: https://github.com/wiglenet (WiGLE organization -- API clients and tools)
- **Language**: REST API (JSON), Python/Java/JavaScript client libraries available
- **License**: API access is free with registration; data contributed under WiGLE terms of service

---

## Docker Compatibility

### Can it run in Docker?

YES

### Docker Requirements

- Network/internet access for API communication
- WiGLE API credentials (API Name and API Token from wigle.net account)
- No hardware requirements (API client only)
- Minimal container with Python or curl for API access

### Dockerfile

```dockerfile
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install minimal dependencies
RUN apt-get update && apt-get install -y \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Python WiGLE API client
RUN pip install --no-cache-dir requests

# Create API client script
RUN mkdir -p /opt/wigle

COPY <<'EOF' /opt/wigle/wigle_client.py
#!/usr/bin/env python3
"""Simple WiGLE API client for Argos integration."""

import os
import sys
import json
import requests
from base64 import b64encode

WIGLE_API_BASE = "https://api.wigle.net/api/v2"

def get_auth_header():
    api_name = os.environ.get("WIGLE_API_NAME", "")
    api_token = os.environ.get("WIGLE_API_TOKEN", "")
    if not api_name or not api_token:
        print("Error: Set WIGLE_API_NAME and WIGLE_API_TOKEN environment variables")
        sys.exit(1)
    credentials = b64encode(f"{api_name}:{api_token}".encode()).decode()
    return {"Authorization": f"Basic {credentials}"}

def search_networks(lat, lon, radius=0.01, ssid=None):
    params = {
        "latrange1": lat - radius,
        "latrange2": lat + radius,
        "longrange1": lon - radius,
        "longrange2": lon + radius,
    }
    if ssid:
        params["ssid"] = ssid
    resp = requests.get(f"{WIGLE_API_BASE}/network/search",
                       headers=get_auth_header(), params=params)
    return resp.json()

def lookup_bssid(bssid):
    params = {"netid": bssid}
    resp = requests.get(f"{WIGLE_API_BASE}/network/detail",
                       headers=get_auth_header(), params=params)
    return resp.json()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="WiGLE API Client")
    parser.add_argument("--search", action="store_true", help="Search by location")
    parser.add_argument("--lookup", type=str, help="Lookup BSSID")
    parser.add_argument("--lat", type=float, help="Latitude")
    parser.add_argument("--lon", type=float, help="Longitude")
    parser.add_argument("--radius", type=float, default=0.01, help="Search radius")
    parser.add_argument("--ssid", type=str, help="Filter by SSID")
    args = parser.parse_args()

    if args.lookup:
        print(json.dumps(lookup_bssid(args.lookup), indent=2))
    elif args.search and args.lat and args.lon:
        print(json.dumps(search_networks(args.lat, args.lon, args.radius, args.ssid), indent=2))
    else:
        parser.print_help()
EOF

RUN chmod +x /opt/wigle/wigle_client.py

WORKDIR /opt/wigle

ENTRYPOINT ["python3", "wigle_client.py"]
```

### Docker Run Command

```bash
# Search for networks near a GPS coordinate
docker run -it --rm \
    -e WIGLE_API_NAME=your_api_name \
    -e WIGLE_API_TOKEN=your_api_token \
    --name wigle \
    wigle:latest --search --lat 38.8977 --lon -77.0365 --radius 0.005

# Lookup a specific BSSID
docker run -it --rm \
    -e WIGLE_API_NAME=your_api_name \
    -e WIGLE_API_TOKEN=your_api_token \
    --name wigle \
    wigle:latest --lookup AA:BB:CC:DD:EE:FF

# Search with SSID filter
docker run -it --rm \
    -e WIGLE_API_NAME=your_api_name \
    -e WIGLE_API_TOKEN=your_api_token \
    --name wigle \
    wigle:latest --search --lat 38.8977 --lon -77.0365 --ssid "TargetNetwork"

# Quick API test with curl
docker run -it --rm \
    --entrypoint curl \
    wigle:latest \
    -s -H "Authorization: Basic $(echo -n 'API_NAME:API_TOKEN' | base64)" \
    "https://api.wigle.net/api/v2/stats/countries"
```

---

## Install Instructions (Native)

```bash
# WiGLE is a web service -- no traditional installation required
# Install Python client dependencies for API access

sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-requests curl jq

# Create WiGLE API credentials:
# 1. Register at https://wigle.net
# 2. Go to Account -> API Token
# 3. Generate API Name and API Token

# Set credentials as environment variables
export WIGLE_API_NAME="your_api_name"
export WIGLE_API_TOKEN="your_api_token"

# Test API access with curl
curl -s -H "Authorization: Basic $(echo -n "$WIGLE_API_NAME:$WIGLE_API_TOKEN" | base64)" \
    "https://api.wigle.net/api/v2/stats/countries" | jq .

# Search networks by location
curl -s -H "Authorization: Basic $(echo -n "$WIGLE_API_NAME:$WIGLE_API_TOKEN" | base64)" \
    "https://api.wigle.net/api/v2/network/search?latrange1=38.89&latrange2=38.90&longrange1=-77.04&longrange2=-77.03" | jq .

# Lookup specific BSSID
curl -s -H "Authorization: Basic $(echo -n "$WIGLE_API_NAME:$WIGLE_API_TOKEN" | base64)" \
    "https://api.wigle.net/api/v2/network/detail?netid=AA:BB:CC:DD:EE:FF" | jq .

# --- Optional: Install official WiGLE Android app for mobile wardriving ---
# Available on Google Play Store for Android devices
# Exports to CSV/KML compatible with WigleToTAK
```

---

## Kali Linux Raspberry Pi 5 Compatibility

| Criteria              | Status                                                               |
| --------------------- | -------------------------------------------------------------------- |
| ARM64 Support         | :white_check_mark: REST API -- fully architecture-independent        |
| Kali Repo Available   | N/A (web service, not a package)                                     |
| Hardware Requirements | Internet connectivity only, no special hardware                      |
| Performance on RPi5   | :white_check_mark: Excellent -- minimal resource usage for API calls |

### Additional Notes

- **Web Service**: WiGLE is a cloud service with a REST API, not a standalone tool to install. Integration involves making HTTP API calls from Argos
- **API Rate Limits**: Free accounts have daily query limits; commercial API access available for higher throughput
- **Registration Required**: A free WiGLE account is required for API access. Register at https://wigle.net
- **Data Enrichment**: Primary use case for Argos is enriching locally-scanned networks (from Kismet) with historical WiGLE data -- when was a network first seen globally, where else has it been observed, movement patterns
- **OPSEC Warning**: Do NOT upload wardriving data from classified or sensitive environments to WiGLE; the data becomes publicly accessible
- **API Endpoints**: Key endpoints include network/search (geographic search), network/detail (BSSID lookup), network/comment (community notes), stats (global statistics), bluetooth/search (BT device lookup), cell/search (cell tower lookup)
- **Data Formats**: API returns JSON; supports CSV export for bulk data
- **Offline Use**: WiGLE data can be downloaded for offline use via the WiGLE data export feature for registered users with sufficient contributions
- **Cell Tower Data**: WiGLE also contains cell tower observations, which can complement Argos's GSM/LTE scanning capabilities
- **Integration with Kismet**: Kismet can directly upload wardriving results to WiGLE, and WiGLE data can be queried to enrich Kismet's local observations

### Verdict

**COMPATIBLE** -- WiGLE is a REST API service that works identically on any platform with internet access. The RPi5 can make API calls with minimal resource usage using Python requests, curl, or any HTTP client. The primary integration path for Argos is using the WiGLE API to enrich locally-scanned network data with historical and geographic context from the global WiGLE database.

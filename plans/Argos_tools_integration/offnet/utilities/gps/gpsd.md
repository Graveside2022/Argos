# gpsd

> **✅ ALREADY INTEGRATED IN ARGOS** — GPS daemon installed via `apt install gpsd gpsd-clients`. Argos integration: `src/lib/server/services/gps/` (7 files: `gps-position-service.ts`, `gps-satellite-service.ts`, `gps-socket.ts`, `gps-data-parser.ts`, `gps-satellite-circuit-breaker.ts`, `gps-response-builder.ts`, `gps-types.ts`), 3 API routes at `/api/gps/*` (position, location, satellites), dedicated `gps-store.ts`, circuit breaker pattern (30s cooldown after 3 failures, 5s position cache). **No additional integration work required.**
>
> **Future tool interactions:** `gps-sdr-sim` (GPS spoofing — generates fake GPS signals via HackRF, can confuse gpsd if received), `find-lf` (RF geolocation — complementary to GPS for indoor positioning), `direwolf` (APRS — can use gpsd for position beaconing), all CoT gateways (use GPS position for TAK map placement), `readsb`/`tar1090` (ADS-B — can use gpsd for receiver geolocation).

> **RISK CLASSIFICATION**: LOW RISK
> Passive GPS receiver daemon. Receives standard GPS satellite signals and provides location data via a local TCP socket. No transmit capability. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Already deployed as core positioning service

| Method               | Supported | Notes                                                                      |
| -------------------- | --------- | -------------------------------------------------------------------------- |
| **Docker Container** | N/A       | gpsd requires direct USB access to GPS dongle; native install recommended  |
| **Native Install**   | YES       | **ACTIVE** — `apt install gpsd gpsd-clients` on Kali ARM64                 |

---

## Tool Description

gpsd is a GPS service daemon that monitors one or more GPS receivers attached to a host computer through serial or USB ports, making all GPS data available via a local TCP socket (default port 2947) using a JSON-based protocol. It supports virtually all GPS hardware including USB GPS dongles (u-blox, SiRFstar, MediaTek chipsets), Bluetooth GPS receivers, and serial GPS modules. gpsd handles automatic device detection, baud rate negotiation, NMEA/binary protocol parsing, and provides normalized position, velocity, time, and satellite data to any number of client applications simultaneously. In Argos, gpsd is the foundation for all geolocation — it provides real-time GPS coordinates used by the tactical map, signal geolocation, CoT position reporting, and wardriving logs.

## Category

GPS / Positioning / Geolocation Service

## Repository

- **Source**: https://gitlab.com/gpsd/gpsd
- **Documentation**: https://gpsd.io/
- **Language**: C/Python
- **License**: BSD-2-Clause

---

## Install Instructions (Native on Kali RPi 5)

### Installation

```bash
# Install gpsd and client utilities
sudo apt-get update && sudo apt-get install -y gpsd gpsd-clients

# Verify installation
gpsd --version
```

### Configuration

```bash
# Edit gpsd defaults
sudo nano /etc/default/gpsd
```

Recommended `/etc/default/gpsd` configuration:

```
# Devices gpsd should collect data from at boot time
DEVICES="/dev/ttyACM0"

# Other options
GPSD_OPTIONS="-n"

# Automatically hot add/remove GPS devices via udev
USBADD="true"

# Start gpsd automatically
START_DAEMON="true"
```

### Start and Enable

```bash
# Start gpsd
sudo systemctl start gpsd

# Enable on boot
sudo systemctl enable gpsd

# Verify it's running
sudo systemctl status gpsd

# Test GPS data
gpsmon
# or
gpspipe -w -n 5
# or
cgps -s
```

### udev Rules (for stable device naming)

Already configured in `scripts/ops/setup-host.sh`. GPS dongles typically enumerate as `/dev/ttyACM0` or `/dev/ttyUSB0`. udev rules can assign a stable symlink:

```bash
# Example rule in /etc/udev/rules.d/99-argos-gps.rules
SUBSYSTEM=="tty", ATTRS{idVendor}=="1546", ATTRS{idProduct}=="01a7", SYMLINK+="gps0"
```

---

## Argos Integration Details

### Architecture

```
GPS Dongle (USB) → gpsd (TCP :2947) → GpsService (circuit breaker) → /api/gps/* → gps-store → Map
```

### Service Pattern

The GPS service uses a **circuit breaker** pattern:
- Connects to gpsd via TCP socket (`gps-socket.ts`)
- After 3 consecutive failures, enters 30-second cooldown
- During cooldown, returns cached position (5s TTL) or null
- Automatically recovers when gpsd becomes available again

### Key Files

| File | Purpose |
|---|---|
| `src/lib/server/services/gps/gps-position-service.ts` | Main position data service |
| `src/lib/server/services/gps/gps-satellite-service.ts` | Satellite visibility data |
| `src/lib/server/services/gps/gps-socket.ts` | TCP socket connection to gpsd |
| `src/lib/server/services/gps/gps-data-parser.ts` | NMEA/JSON response parsing |
| `src/lib/server/services/gps/gps-satellite-circuit-breaker.ts` | Circuit breaker implementation |
| `src/lib/server/services/gps/gps-response-builder.ts` | API response formatting |
| `src/lib/server/services/gps/gps-types.ts` | TypeScript type definitions |
| `src/lib/stores/tactical-map/gps-store.ts` | Client-side GPS state store |

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/gps/position` | GET | Current GPS position (lat, lon, alt, speed, heading) |
| `/api/gps/location` | GET | Formatted location data |
| `/api/gps/satellites` | GET | Satellite visibility and signal strength |

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** — gpsd is available in Kali ARM64 repositories. Compiles and runs natively on aarch64. All client tools (gpsmon, cgps, gpspipe) included.

### Hardware Constraints

- **CPU**: Negligible — GPS data parsing is trivial for any CPU
- **RAM**: < 10MB total footprint
- **Hardware**: Requires a USB GPS dongle (u-blox 7/8/9/10 recommended). The Argos platform uses a standard USB GPS dongle connected to the powered USB hub
- **Network**: No network required — gpsd communicates with GPS hardware via serial/USB and serves data on localhost TCP port 2947

### Supported GPS Hardware

| Chipset | Model Examples | Status |
|---|---|---|
| u-blox 7 | VK-172, G-Mouse | ✅ Tested |
| u-blox 8 | BN-880, NEO-M8N | ✅ Recommended |
| u-blox 9 | NEO-M9N, ZED-F9P | ✅ High precision |
| SiRFstar IV | GlobalSat BU-353S4 | ✅ Compatible |
| MediaTek | Various USB dongles | ✅ Compatible |

### Verdict

**COMPATIBLE** — gpsd is the standard GPS daemon for Linux and runs flawlessly on Raspberry Pi 5 ARM64. Already deployed as part of the Argos core infrastructure. Provides the positioning foundation for all geolocation, tactical mapping, and CoT position reporting features.

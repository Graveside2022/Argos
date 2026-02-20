# BTLE Scanner

> **RISK CLASSIFICATION**: LOW RISK
> Passive BLE scanning and advertisement monitoring with no transmission or exploitation capability. Military education/training toolkit - Not for public release.

---

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Built-in Argos module; runs within the main SvelteKit application

| Method               | Supported | Notes                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------- |
| **Docker Container** | YES       | Included in main Argos container; no separate image needed              |
| **Native Install**   | YES       | Part of Argos; uses RPi 5 onboard Bluetooth 5.0 or external USB adapter |

---

## Tool Description

BTLE Scanner is the Argos built-in Bluetooth Low Energy scanning and analysis module. It performs passive BLE device discovery by monitoring advertisement packets on BLE advertising channels (37, 38, 39). The module collects device MAC addresses, RSSI signal strength, advertisement data, service UUIDs, manufacturer data, and device names. All data is displayed in the Argos dashboard with real-time updates and integrates with the tactical map for BLE device geolocation when GPS is available.

## Category

BLE Passive Scanning / Device Discovery

## Repository

Built into the Argos application (`src/lib/components/` and `src/lib/services/`). Not a separate third-party tool.

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - BTLE Scanner is part of the main Argos container and runs within the Argos SvelteKit application. Bluetooth adapter access is provided through the Argos container configuration.

### Host OS-Level Requirements

- `--privileged` or `--cap-add=NET_ADMIN` - Required for BLE scanning via HCI
- `--net=host` - Required for Bluetooth HCI socket access
- `--device=/dev/bus/usb` - If using an external USB Bluetooth adapter
- Host kernel modules: `bluetooth`, `btusb`
- Host BlueZ stack must be installed for HCI device management

### Docker-to-Host Communication

- Bluetooth adapter must be available and up on the host
- Shares the main Argos container networking and volume configuration
- BLE scan results are served via the Argos web interface on port 5173
- No additional ports or services required beyond the main Argos deployment

---

## Install Instructions (Docker on Kali RPi 5)

### Deployment

BTLE Scanner is included in the main Argos container and does not require separate installation or its own Docker image.

```bash
# Ensure Bluetooth adapter is up on host
sudo hciconfig hci0 up

# Start Argos container with Bluetooth support
docker run -d \
  --name argos \
  --privileged \
  --net=host \
  --device=/dev/bus/usb \
  -v /var/run/dbus:/var/run/dbus \
  argos:latest

# Verify BLE scanning is operational
# Navigate to http://localhost:5173 and open the BLE Scanner panel
```

### Standalone Testing (without full Argos)

```bash
# Quick BLE scan from host to verify adapter works
sudo hcitool lescan

# Check BLE adapter status
hciconfig hci0
bluetoothctl show
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - BTLE Scanner is part of the Argos SvelteKit application which runs on Node.js. The BLE scanning backend uses standard BlueZ/HCI interfaces available on ARM64 Kali Linux. No architecture-specific dependencies.

### Hardware Constraints

- CPU: BLE scanning is lightweight; minimal CPU usage for passive advertisement monitoring on Cortex-A76
- RAM: Included within Argos application memory footprint (~512MB total for Argos)
- Hardware: Uses the Raspberry Pi 5 onboard Bluetooth 5.0 adapter (BCM2712) by default. An external USB Bluetooth adapter can be used for extended range or if the onboard adapter is allocated to another tool

### Verdict

**COMPATIBLE** - BTLE Scanner is a core Argos module that runs natively on the RPi 5 without any additional hardware or software beyond the standard Argos deployment. No separate Docker image or installation steps needed.

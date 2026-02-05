# HackRF Spectrum

> **RISK CLASSIFICATION**: LOW RISK
> Passive wideband spectrum analyzer with no transmit capability in this mode; uses hackrf_sweep for receive-only frequency scanning. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Argos built-in module; hackrf tools available as ARM64 packages in Kali repos

| Method               | Supported | Notes                                                                                               |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Part of main Argos container; USB passthrough (`--privileged --device=/dev/bus/usb`) for HackRF One |
| **Native Install**   | YES       | Already installed on Argos system; `hackrf` and `libhackrf-dev` ARM64 packages in Kali 2025.4       |

---

## Tool Description

HackRF Spectrum is the Argos built-in wideband spectrum analyzer module that uses the HackRF One's hackrf_sweep mode to perform rapid spectrum scanning across the full 1 MHz to 6 GHz frequency range at speeds up to 8 GHz/sec. It provides real-time waterfall displays, power spectral density plots, peak detection, and signal hunting capabilities directly within the Argos web interface. The module streams sweep data from the HackRF hardware via the backend Python emitter service to the SvelteKit frontend over WebSocket connections, enabling live spectrum monitoring from any browser connected to the Argos console.

## Category

Wideband Spectrum Analysis / Signal Detection / RF Monitoring

## Repository

Built into the Argos application. Frontend components in `src/lib/components/hackrf/`, backend service in `hackrf_emitter/`, API endpoints in `src/routes/api/hackrf/`.

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - HackRF Spectrum is part of the main Argos Docker container. The hackrf_sweep binary and associated libraries run as standard userspace processes. The only hardware dependency is USB passthrough for the HackRF One device.

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for the HackRF One device
- `--privileged` - Required for direct USB access to the HackRF hardware
- No `--net=host` strictly required for spectrum analysis alone, but the Argos container typically uses it for unified service access
- Host kernel: standard USB drivers only. No special kernel modules required. The `hackrf` userspace library handles all device communication.
- Host `udev` rules for HackRF permissions (installed by `hackrf` package or manually via `/etc/udev/rules.d/`)

### Docker-to-Host Communication

- Part of the main Argos container - uses the Argos WebSocket server (port **5173** dev / production port) for frontend streaming
- HackRF control API on port **8092** for spectrum configuration commands
- HackRF control API on port **3002** for hardware control operations
- No additional port mappings needed beyond standard Argos ports
- hackrf_sweep data flows: HackRF USB -> hackrf_sweep binary -> Python emitter -> WebSocket -> Browser

---

## Install Instructions (Docker on Kali RPi 5)

### Part of Main Argos Container

```bash
# HackRF Spectrum is included in the main Argos Docker deployment.
# No separate container build is needed.

# Ensure HackRF tools are available on the host for diagnostics:
sudo apt-get update && sudo apt-get install -y hackrf libhackrf-dev

# Verify HackRF device is detected:
hackrf_info

# The Argos container includes all HackRF dependencies:
# - hackrf tools (hackrf_sweep, hackrf_transfer, hackrf_info)
# - libhackrf
# - Python hackrf_emitter service
# - SvelteKit frontend components

# When running the Argos container, ensure USB passthrough:
docker run -d \
  --name argos \
  --privileged \
  --device=/dev/bus/usb \
  --net=host \
  -v /home/kali/Documents/Argos/Argos:/app \
  argos:latest
```

### Standalone hackrf_sweep Test

```bash
# Test hackrf_sweep directly on the host to verify hardware:
hackrf_sweep -f 2400:2500 -w 500000 -1 -r /dev/stdout | head -20

# Parameters:
#   -f 2400:2500   Sweep 2.4 GHz to 2.5 GHz (WiFi band)
#   -w 500000      500 kHz bin width
#   -1             Single sweep
#   -r /dev/stdout Output to stdout
```

### Argos Integration Architecture

```bash
# Data flow within the Argos container:
#
# TRANSMISSION (hackrf_controller.py):
# HackRF One (USB)
#   -> python_hackrf API (pyhackrf_transfer, native Cython)
#   -> [fallback: hackrf_transfer CLI binary via subprocess]
#   -> Flask API (app.py, port 8092)
#
# SPECTRUM ANALYSIS (sweepManager.ts):
# HackRF One (USB)
#   -> sweep_bridge.py (pyhackrf_sweep, native Cython)
#   -> [fallback: hackrf_sweep CLI binary]
#   -> ProcessManager.ts (stdout parsing)
#   -> WebSocket server (src/lib/server/websocket-server.ts)
#   -> Svelte stores (src/lib/stores/)
#   -> HackRF UI components (src/lib/components/hackrf/)
#   -> Browser (real-time waterfall, spectrum plot, signal list)
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - The hackrf tools (`hackrf_sweep`, `hackrf_info`, `hackrf_transfer`) and libhackrf are available as pre-built ARM64 packages in the Kali Linux repositories. The Python hackrf_emitter service uses the `python-hackrf` v1.5.0 native API (Cython wrapper around libhackrf) as its primary device control method, with automatic fallback to the CLI binaries if the API is unavailable. All SvelteKit frontend components are architecture-independent. No compilation required for standard installation.

### Hardware Constraints

- **CPU**: hackrf_sweep is CPU-efficient, using DMA transfers from the HackRF for data acquisition. The Python emitter service and WebSocket streaming add moderate CPU load. Total spectrum analysis pipeline consumes approximately 15-30% of RPi5 CPU capacity depending on sweep rate and display update frequency.
- **RAM**: Approximately 200-400MB for the complete spectrum analysis pipeline (hackrf_sweep buffers, Python emitter, WebSocket server, Node.js frontend). Well within available memory as part of the overall Argos application footprint.
- **Storage**: No significant storage requirements for real-time analysis. Optional signal logging to SQLite database (rf_signals.db) for historical analysis.
- **Hardware**: Requires HackRF One (~$300 USD) connected via USB. HackRF draws approximately 500mA from USB. The RPi5 USB ports can supply adequate power directly.
- **Display**: Accessed via web browser - any device on the network can view the spectrum display.

### Verdict

**COMPATIBLE** - HackRF Spectrum is a core Argos module that runs natively on the Raspberry Pi 5. It is already installed and integrated into the Argos application. ARM64 binary packages are available in Kali repositories. The RPi5 provides adequate CPU and memory resources for real-time wideband spectrum analysis with waterfall display at full sweep speed.

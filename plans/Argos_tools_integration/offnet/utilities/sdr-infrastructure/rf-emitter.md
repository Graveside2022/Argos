# RF Emitter

> **RISK CLASSIFICATION**: HIGH RISK - SENSITIVE SOFTWARE
> Active RF transmission capability using HackRF One; can generate and broadcast RF signals across 1 MHz to 6 GHz. Unauthorized transmission violates federal communications law. Military education/training toolkit - Not for public release.

## Deployment Classification

> **RUNS ON ARGOS RPi 5: YES** — Argos built-in module; hackrf_transfer and control scripts run natively on ARM64

| Method               | Supported | Notes                                                                                                       |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| **Docker Container** | YES       | Part of main Argos container; USB passthrough (`--privileged --device=/dev/bus/usb`) for HackRF One         |
| **Native Install**   | YES       | Already installed on Argos system; `hackrf` ARM64 packages in Kali 2025.4; half-duplex with HackRF Spectrum |

---

## Tool Description

RF Emitter is the Argos built-in HackRF signal transmission module that enables generation and broadcast of RF signals across the HackRF One's full 1 MHz to 6 GHz frequency range. It provides programmatic control over transmission frequency, bandwidth, gain, modulation, and waveform parameters through the Argos web interface and API. The module leverages the HackRF One's half-duplex transmit capability via the hackrf_transfer binary and Python control scripts, supporting both pre-generated waveform file playback and real-time signal generation. This is an active transmission tool that requires proper authorization, controlled RF environments, and compliance with all applicable regulations before use.

## Category

Active RF Transmission / Signal Generation / RF Testing

## Repository

Built into the Argos application. Backend service in `hackrf_emitter/`, API endpoints in `src/routes/api/hackrf/`, control interface in `src/lib/components/hackrf/`.

---

## Docker Compatibility Analysis

### Can it run in Docker?

**YES** - RF Emitter is part of the main Argos Docker container. The hackrf_transfer binary and Python control scripts run as standard userspace processes. The only hardware dependency is USB passthrough for the HackRF One device. The HackRF must not be simultaneously in use by hackrf_sweep (half-duplex operation).

### Host OS-Level Requirements

- `--device=/dev/bus/usb` - USB passthrough for the HackRF One device
- `--privileged` - Required for direct USB access to the HackRF hardware for transmission control
- No `--net=host` strictly required, but the Argos container typically uses it for unified service access
- Host kernel: standard USB drivers only. No special kernel modules required.
- Host `udev` rules for HackRF permissions
- **IMPORTANT**: HackRF One is half-duplex - cannot transmit and receive simultaneously. RF Emitter and HackRF Spectrum cannot operate at the same time on the same device.

### Docker-to-Host Communication

- Part of the main Argos container - uses the Argos API (port **8092** / **3002**) for transmission control commands
- WebSocket server provides real-time transmission status to the frontend
- No additional port mappings needed beyond standard Argos ports
- Transmission parameters controlled via REST API calls from the Argos frontend

---

## Install Instructions (Docker on Kali RPi 5)

### Part of Main Argos Container

```bash
# RF Emitter is included in the main Argos Docker deployment.
# No separate container build is needed.

# Ensure HackRF tools are available on the host for diagnostics:
sudo apt-get update && sudo apt-get install -y hackrf libhackrf-dev

# Verify HackRF device is detected and firmware is current:
hackrf_info

# The Argos container includes all RF Emitter dependencies:
# - hackrf tools (hackrf_transfer for transmission)
# - libhackrf
# - Python hackrf_emitter control service
# - SvelteKit frontend components
# - Pre-built waveform library (if applicable)

# Standard Argos container launch with USB passthrough:
docker run -d \
  --name argos \
  --privileged \
  --device=/dev/bus/usb \
  --net=host \
  -v /home/kali/Documents/Argos/Argos:/app \
  argos:latest
```

### Direct hackrf_transfer Usage (Host-Side Testing)

```bash
# Generate a test tone at 433.92 MHz (requires authorization):
# hackrf_transfer -t signal.raw -f 433920000 -s 2000000 -x 20

# Parameters:
#   -t signal.raw     Transmit file (8-bit I/Q samples)
#   -f 433920000      Center frequency in Hz
#   -s 2000000        Sample rate (2 MSPS)
#   -x 20             TX VGA gain (0-47 dB)
#
# WARNING: Ensure compliance with all applicable RF regulations.
# Use only in authorized environments (shielded rooms, licensed bands,
# or with explicit regulatory approval).
```

### Safety Controls

```bash
# RF Emitter integrates safety controls within Argos:
#
# 1. Transmission requires explicit user confirmation in the UI
# 2. Maximum power output limited by HackRF hardware (~10 dBm)
# 3. Frequency and bandwidth parameters validated before transmission
# 4. Transmission timeout enforced to prevent indefinite broadcasts
# 5. Emergency stop functionality via API and UI
# 6. All transmission events logged with timestamp, frequency, and duration
#
# The HackRF One has relatively low output power (~10 dBm / 10 mW)
# compared to commercial transmitters, limiting effective range.
# External amplifiers should NEVER be used without proper licensing.
```

---

## Kali Linux Raspberry Pi 5 Compatibility

### Architecture Support

**ARM64 NATIVE** - The hackrf tools (`hackrf_transfer`, `hackrf_info`) and libhackrf are available as pre-built ARM64 packages in the Kali Linux repositories. The Python emitter control scripts are architecture-independent. No compilation required.

### Hardware Constraints

- **CPU**: Transmission via hackrf_transfer uses DMA and is CPU-efficient. Real-time waveform generation (if implemented) would be more CPU-intensive but still within RPi5 capability. Approximately 10-20% CPU utilization during active transmission.
- **RAM**: Minimal memory requirements for transmission operations. Pre-generated waveform files are loaded from storage. Approximately 100-200MB including the control service.
- **Storage**: Waveform files can range from kilobytes (simple tones) to gigabytes (complex or long-duration signals). Adequate storage planning required for waveform libraries.
- **Hardware**: Requires HackRF One (~$300 USD) connected via USB. Appropriate antenna for the target frequency must be attached. The HackRF operates in half-duplex mode - transmit and receive operations are mutually exclusive.
- **Power**: HackRF draws approximately 500mA during transmission. RPi5 USB ports provide adequate power.

### Verdict

**COMPATIBLE** - RF Emitter is a core Argos module that runs natively on the Raspberry Pi 5. ARM64 binary packages are available in Kali repositories. The RPi5 provides adequate resources for RF signal transmission control. This module carries HIGH RISK classification due to active transmission capability and must be used only in authorized environments with proper regulatory compliance. All transmission events should be logged and auditable.

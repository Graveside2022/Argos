# Hardware Integration Patterns

## Auto-Detection System

**Scanner:** [src/lib/server/hardware/index.ts](../src/lib/server/hardware/index.ts)

- Continuous polling every 30 seconds
- USB enumeration + capability checking
- Categories: SDR, WiFi, Bluetooth, GPS, cellular, serial, network

**Graceful Degradation:**

- Features disabled if hardware missing (no crashes)
- UI shows "Hardware not detected" state
- Diagnostics: `scripts/diagnose-*.sh`

## Hardware Services

### HackRF (Port 8092)

- Real-time spectrum analysis (FFT streaming)
- Python backend: `hackrf_emitter/`
- WebSocket streaming of RF data

### Kismet (Port 2501)

- WiFi network scanning
- Device tracking (MAC, SSID, manufacturer)
- GPS integration
- WebSocket + REST API

### GSM Evil

- GSM signal monitoring
- IMSI detection
- GSMTAP pipeline for packet analysis

### USRP

- Ettus Research hardware
- Wider frequency range
- Power control and gain adjustment

## Docker USB Passthrough

**Required config:**

```yaml
# docker-compose.portainer-dev.yml
privileged: true
devices:
    - /dev/bus/usb:/dev/bus/usb
network_mode: host # Required for device enumeration
```

**Gotcha:** Container needs `--privileged` for SDR hardware access. Host networking required.

## Hardware Gotchas

**USB Permissions:**

- HackRF: udev rules for non-root access
- Kismet: CAP_NET_ADMIN for monitor mode
- GPS: dialout group membership

**RF Interference:**

- HackRF susceptible to USB 3.0 noise
- Use quality cables with ferrite cores
- Consider powered hub to isolate devices

**GPS Cold Start:**

- First fix: 2-5 minutes outdoors
- Needs clear sky view (no indoor fix)
- Check status: `cgps -s`

# OpenWebRX Configuration for Argos

This directory contains the configuration for the OpenWebRX SDR web interface integrated with Argos.

## Container Deployment

The OpenWebRX container is deployed using the `jketterl/openwebrx-hackrf:stable` Docker image, which includes pre-compiled HackRF support.

### Manual Deployment

```bash
docker run -d \
  --name openwebrx-hackrf \
  --device /dev/bus/usb:/dev/bus/usb \
  --privileged \
  -p 8073:8073 \
  -v openwebrx-hackrf-settings:/var/lib/openwebrx \
  --restart unless-stopped \
  jketterl/openwebrx-hackrf:stable
```

### Initialize Configuration

After first deployment, copy the preset configuration:

```bash
docker cp config/openwebrx/settings.json openwebrx-hackrf:/var/lib/openwebrx/settings.json
docker restart openwebrx-hackrf
```

### Portainer Deployment

The container can also be deployed via Portainer:

1. Navigate to Containers → Add Container
2. Name: `openwebrx-hackrf`
3. Image: `jketterl/openwebrx-hackrf:stable`
4. Port mapping: `8073:8073`
5. Restart policy: `unless-stopped`
6. Runtime & Resources:
    - Privileged mode: enabled
    - Devices: `/dev/bus/usb:/dev/bus/usb`
7. Volumes:
    - Volume: `openwebrx-hackrf-settings` → `/var/lib/openwebrx`

After deployment, initialize the configuration using the command above.

## Access

- Web Interface: `http://localhost:8073` or `http://<tailscale-ip>:8073`
- Embedded in Argos: Dashboard → Tools → OpenWebRX
- Default credentials: `admin` / `admin` (change after first login)

## Preset Profiles

The configuration includes 13 preset profiles for common radio bands:

### Broadcast

- **FM Broadcast** - 88-108 MHz (WFM)
- **AM Radio** - 530-1710 kHz (AM)

### Aviation & Emergency

- **Aviation Band** - 118-137 MHz (AM)
- **NOAA Weather Radio** - 162 MHz (NFM)
- **Marine VHF** - 156-162 MHz (NFM)
- **Public Safety** - 150-174 MHz (NFM)

### Ham Radio

- **2m Ham Band** - 144-148 MHz (NFM)
- **70cm Ham Band** - 420-450 MHz (NFM)
- **Shortwave Bands** - 3-30 MHz (AM)

### Other Services

- **ISM 433 MHz** - IoT/RC devices (NFM)
- **PMR446** - Personal Mobile Radio, Europe (NFM)
- **GMRS/FRS** - Walkie-talkies, US (NFM)
- **Wideband Scan** - General purpose (NFM)

## Hardware Requirements

- HackRF One SDR (1 MHz - 6 GHz)
- USB connection with adequate power supply
- Antenna appropriate for target frequency band

## Troubleshooting

### HackRF Not Detected

Check if the device is visible:

```bash
docker exec openwebrx-hackrf hackrf_info
docker exec openwebrx-hackrf SoapySDRUtil --find
```

### Configuration Issues

View OpenWebRX logs:

```bash
docker logs openwebrx-hackrf --tail 50
```

### Reset Configuration

```bash
docker exec openwebrx-hackrf rm -f /var/lib/openwebrx/settings.json
docker cp config/openwebrx/settings.json openwebrx-hackrf:/var/lib/openwebrx/settings.json
docker restart openwebrx-hackrf
```

## Integration with Argos

OpenWebRX is integrated into the Argos dashboard as an embedded iframe tool:

- Component: `src/lib/components/dashboard/views/OpenWebRXView.svelte`
- Listed in: `src/lib/components/dashboard/panels/ToolsPanel.svelte` (EXTERNAL section)
- Auto-started: Included in `scripts/startup-check.sh`

## References

- [OpenWebRX Official Wiki](https://github.com/jketterl/openwebrx/wiki)
- [HackRF Device Notes](https://github.com/jketterl/openwebrx/wiki/HackRF-device-notes)
- [Docker Deployment Guide](https://github.com/jketterl/openwebrx/wiki/Getting-Started-using-Docker)

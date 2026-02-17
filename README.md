# Argos -- SDR & Network Analysis Console

Real-time spectrum analysis, WiFi intelligence, GPS tracking, and tactical mapping on a Raspberry Pi.

## Hardware

- Raspberry Pi 5 (8GB RAM recommended, 64GB+ SD card)
- **USB 3.0 powered hub** (required -- the Pi cannot power all devices alone)
- HackRF One
- Alfa AWUS036AXML WiFi adapter
- USB GPS dongle (BU-353S4 or similar)
- Kali Linux installed on the Pi

## Install

```bash
git clone https://github.com/Graveside2022/Argos.git
cd Argos
sudo bash scripts/setup-host.sh
```

This installs Docker, Portainer, builds container images, configures GPS, and sets up auto-start on boot. Run it once.

## Deploy

1. Open **https://\<your-pi-ip\>:9443** in a browser (Portainer)
2. Create an admin account on first login
3. Go to **Stacks** > **Add Stack**, name it `argos`
4. Paste the contents of `docker/docker-compose.portainer-dev.yml`
5. Click **Deploy the stack**

## Open Argos

Go to **http://\<your-pi-ip\>:5173**

## Hardware Setup

Plug the Alfa adapter, HackRF, and GPS dongle into the powered USB hub, then connect the hub to the Pi. Argos detects hardware automatically. GPS needs 1--2 minutes for a first fix outdoors.

## After Reboot

Everything starts automatically. Just open http://\<your-pi-ip\>:5173.

## Troubleshooting

| Problem             | Fix                                              |
| ------------------- | ------------------------------------------------ |
| No GPS fix          | Go outside, wait 2 minutes                       |
| Page is blank       | Check Portainer -- are containers running?       |
| Alfa not detected   | Unplug and replug the USB hub                    |
| HackRF not detected | Run `hackrf_info` on the Pi terminal             |
| Port conflict       | Run `sudo lsof -i :5173` to find what's using it |

### Headless Debugging (Parrot Core / Field Ops)

When running on Parrot Core or in the field without a monitor, Argos includes tools for remote debugging:

1.  **Service Status**: The debug service runs automatically on port `9222`.
    ```bash
    systemctl status argos-headless
    ```
2.  **Manual Start**:
    ```bash
    ./scripts/dev/debug-headless.sh
    ```
3.  **Connect from Laptop**:
    Tunnel the remote debug port to your local machine:
    ```bash
    ssh -L 9222:localhost:9222 user@<pi-ip-address>
    ```
    Then open `chrome://inspect` in Chrome/Edge on your laptop to see the remote UI.

### Debugging

The `vite-oom-protect.sh` script now wraps the Vite process with `strace` to capture signal and exit events. Logs are saved to `/tmp/vite_strace_<timestamp>.log`. This is useful for identifying why the Vite server crashes or restarts unexpectedly.

### Production Deployment

See [SETUP.md](SETUP.md) for development environment, commands, and project structure.
See [Memory & Reliability](docs/operations/memory-reliability.md) for details on the self-healing monitor and performance tuning.

## License

MIT

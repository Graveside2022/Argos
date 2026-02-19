# Argos -- SDR & Network Analysis Console

Real-time spectrum analysis, WiFi intelligence, GSM monitoring, GPS tracking, and tactical mapping on a Raspberry Pi.

## Hardware

- Raspberry Pi 5 (8GB RAM recommended, 64GB+ SD card)
- **USB 3.0 powered hub** (required -- the Pi cannot power all devices alone)
- HackRF One
- Alfa AWUS036AXML WiFi adapter
- USB GPS dongle (BU-353S4 or similar)
- Kali Linux installed on the Pi

## Additional Tools

### Claude Code / claude-mem

`claude-mem` uses ChromaDB for vector search (semantic memory retrieval). The setup script automatically:

1. Installs ChromaDB via `pipx` and creates a systemd user service on port 8000
2. Enables `loginctl linger` so the service survives headless reboots
3. Sets `CHROMA_SSL=false` in `~/.zshenv` (required for local connections)
4. Switches claude-mem to `remote` mode (connects to the pre-running server instead of spawning ephemeral environments)

If you encounter orphaned `bun worker-service.cjs --daemon` processes, they are cleaned up automatically by the SessionStart hook in `.claude/hooks/cleanup-stale-daemons.sh`.

To verify ChromaDB is running:

```bash
systemctl --user status chroma-server
curl -s http://127.0.0.1:8000/api/v2/heartbeat
```

## Install

```bash
git clone https://github.com/Graveside2022/Argos.git
cd Argos
sudo bash scripts/ops/setup-host.sh
```

The setup script installs Node.js, Kismet, gpsd, Docker (for third-party tools only), ChromaDB, configures udev rules, GPS, npm dependencies, and generates `.env`. Argos itself runs natively on the host -- no Docker container.

## API Keys

The setup script prompts for these during first run. All are stored in `.env`.

| Key                   | Required | Source                                           | Purpose                                                     |
| --------------------- | -------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `ARGOS_API_KEY`       | Yes      | Auto-generated                                   | API authentication (fail-closed)                            |
| `STADIA_MAPS_API_KEY` | No       | [stadiamaps.com](https://stadiamaps.com/) (free) | Vector map tiles. Falls back to Google satellite without it |
| `OPENCELLID_API_KEY`  | No       | [opencellid.org](https://opencellid.org/) (free) | Cell tower database download for map overlay                |

To update keys after setup:

```bash
# Edit .env and set/change the key values
nano .env

# Restart to pick up changes
npm run dev
```

## Cell Tower Database

With an OpenCellID key, you can download the global cell tower database (~500MB) for offline tower lookups on the map:

```bash
bash scripts/ops/import-celltowers.sh
```

The setup script offers to do this during first install. To refresh the data later:

```bash
rm data/celltowers/cell_towers.csv.gz
bash scripts/ops/import-celltowers.sh
```

## Map Tiles

Argos supports two map tile sources:

- **Vector tiles (Stadia Maps)** -- detailed tactical view with building outlines, street names, and POI labels. Requires `STADIA_MAPS_API_KEY`.
- **Satellite tiles (Google)** -- aerial imagery fallback when no Stadia key is set.

The map automatically detects which source is available and switches accordingly.

## Open Argos

```bash
npm run dev
```

Then open **http://\<your-pi-ip\>:5173** in a browser.

## After Reboot

If systemd services are installed, Argos starts automatically:

```bash
sudo systemctl status argos-final
```

Otherwise, start manually with `npm run dev`.

## Hardware Setup

Plug the Alfa adapter, HackRF, and GPS dongle into the powered USB hub, then connect the hub to the Pi. Argos detects hardware automatically. GPS needs 1--2 minutes for a first fix outdoors.

## Troubleshooting

| Problem             | Fix                                              |
| ------------------- | ------------------------------------------------ |
| No GPS fix          | Go outside, wait 2 minutes                       |
| Page is blank       | Check `npm run dev` output for errors            |
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

The `vite-oom-protect.sh` script wraps the Vite process with `strace` to capture signal and exit events. Logs are saved to `/tmp/vite_strace_<timestamp>.log`. Useful for identifying why the Vite server crashes or restarts unexpectedly.

## More Info

See [SETUP.md](SETUP.md) for development commands, architecture, and project structure.
See [Memory & Reliability](docs/operations/memory-reliability.md) for the self-healing monitor and performance tuning.

## License

MIT

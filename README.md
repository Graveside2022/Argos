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

`claude-mem` uses ChromaDB for vector search (semantic memory retrieval). It requires **Bun** (worker daemon) and **uv** (spawns `chroma-mcp` subprocess). The setup script automatically:

1. Installs **Bun** and **uv** if not present (claude-mem runtime dependencies)
2. Installs ChromaDB via `pipx` and creates a systemd user service on port 8000
3. Enables `loginctl linger` so the service survives headless reboots
4. Sets `CHROMA_SSL=false` in three locations for reliable propagation:
    - `/etc/environment` -- PAM-level, read on any login (SSH, Termius, local)
    - `~/.config/environment.d/chroma.conf` -- systemd user services
    - `~/.zshenv` -- interactive zsh sessions
5. Switches claude-mem to `remote` mode (connects to the pre-running server instead of spawning ephemeral environments)

6. Installs a `SessionStart` hook (`~/.claude/hooks/ensure-chroma-env.sh`) that cleans up orphaned workers (>30s old) and kills workers missing `CHROMA_SSL=false`

The `CHROMA_SSL=false` variable is critical because `chroma-mcp` 0.2.6+ defaults `--ssl` to `true`. Without it, the MCP bridge tries HTTPS against the local HTTP server and fails silently.

**Important:** The orphan cleanup hook uses a 30-second age check to avoid a race condition with claude-mem's own `SessionStart` hook. Without this guard, the cleanup kills the freshly-spawned worker before it can register the session, causing observations to silently stop recording for the entire Claude Code session.

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

The interactive setup script guides you through provisioning:

- **Express mode**: Install all 26 components with one keypress
- **Customize mode**: Choose individual components from groups (Core Infrastructure, SDR & Signal Tools, Development Tools, System Services)
- **Unattended mode**: Use `--yes` flag to skip prompts

It installs Node.js 22, Bun, uv, Kismet, gpsd, Docker (for third-party tools only), ChromaDB (with systemd service), agent-browser (Playwright-based browser automation), configures udev rules, GPS, npm dependencies, and generates `.env`. Argos itself runs natively on the host -- no Docker container.

## Tailscale (Remote Access)

Tailscale is installed by the setup script. After running `setup-host.sh`:

```bash
# 1. Authenticate with your Tailscale account
sudo tailscale up

# 2. Enable Tailscale DNS (REQUIRED — prevents empty resolv.conf)
sudo tailscale set --accept-dns=true
```

**Why `accept-dns` is required:** On Kali Linux / Raspberry Pi, `eth0` is managed by `ifupdown` while NetworkManager manages WiFi. When no NM-managed connection provides DNS, NetworkManager writes an empty `/etc/resolv.conf` — breaking all name resolution (git, npm, apt, everything). Tailscale DNS (`100.100.100.100`) handles both MagicDNS and public DNS resolution. The setup script also installs a NetworkManager fallback DNS config (`8.8.8.8`, `1.1.1.1`) as a safety net.

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

| Problem                          | Fix                                              |
| -------------------------------- | ------------------------------------------------ |
| No DNS / can't resolve hostnames | Run `sudo tailscale set --accept-dns=true`       |
| No GPS fix                       | Go outside, wait 2 minutes                       |
| Page is blank                    | Check `npm run dev` output for errors            |
| Alfa not detected                | Unplug and replug the USB hub                    |
| HackRF not detected              | Run `hackrf_info` on the Pi terminal             |
| Port conflict                    | Run `sudo lsof -i :5173` to find what's using it |

### Headless Debugging (Parrot Core / Field Ops)

When running on Parrot Core or in the field without a monitor, Argos includes tools for remote debugging:

1.  **Service Status**: The debug service runs automatically on port `9224`.
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
    ssh -L 9224:localhost:9224 user@<pi-ip-address>
    ```
    Then open `chrome://inspect` in Chrome/Edge on your laptop to see the remote UI.

### Debugging

The `vite-oom-protect.sh` script launches Vite with OOM protection (`oom_score_adj=-500`) on the entire process tree. Do **not** wrap Vite with `strace -f` — it ptrace-attaches to child processes, which strips SUID bits from `sudo` and capture helpers (breaking Kismet, GSM Evil, and any service requiring privilege escalation).

## More Info

See [SETUP.md](SETUP.md) for development commands, architecture, and project structure.
See [Memory & Reliability](docs/operations/memory-reliability.md) for the self-healing monitor and performance tuning.

## License

MIT

# Argos -- SDR & Network Analysis Console

![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi%205-c51a4a)
![OS](https://img.shields.io/badge/OS-Kali%20Linux-557C94)
![Stack](https://img.shields.io/badge/stack-SvelteKit%202-FF3E00)
![License](https://img.shields.io/badge/license-MIT-blue)

Argos is a SvelteKit-based SDR and network analysis console deployed natively on Raspberry Pi 5 (Kali Linux). It wraps native CLI tools (hackrf_sweep, Kismet, gpsd, grgsm_livemon) into a real-time web dashboard with WebSocket push, MapLibre GL mapping, and MIL-STD-2525C symbology. Built for Army EW training at NTC/JMRC.

## Key Features

- Three spectrum analyzers: OpenWebRX, NovaSDR, SDR++ (via noVNC)
- Sparrow-WiFi integration (VNC + REST agent)
- Real-time spectrum waterfall + peak-hold
- Kismet WiFi/BLE scanning
- GSM monitoring (IMSI collection)
- GPS tracking + MapLibre GL mapping
- RF propagation modeling (Signal-Server + Navy APM)
- TAK integration (SA broadcast, cert management)
- AI agent (Claude Sonnet 4)
- Tactical framework: 82 Python modules, 13 workflows

## Hardware Requirements

| Device                   | Role                                        | Required    |
| ------------------------ | ------------------------------------------- | ----------- |
| Raspberry Pi 5 (8GB RAM) | Compute platform                            | Yes         |
| HackRF One               | Spectrum analysis                           | Yes         |
| u-blox GPS dongle        | Positioning                                 | Yes         |
| Alfa WiFi adapter        | WiFi scanning (wlan0 reserved for internet) | Yes         |
| USB 3.0 powered hub      | Power delivery for peripherals              | Yes         |
| 500GB+ NVMe SSD          | Storage                                     | Recommended |

## Quick Start

```bash
git clone https://github.com/Graveside2022/Argos.git && cd Argos
sudo bash scripts/ops/setup-host.sh
npm run dev
```

The setup script installs Node.js, Bun, uv, Kismet, gpsd, Docker (for third-party tools only), ChromaDB, configures udev rules, GPS, npm dependencies, and generates `.env`. Open `http://<your-pi-ip>:5173` in a browser.

## Architecture

```
Hardware (HackRF/Alfa/GPS)
  -> Services (native CLI wrappers)
  -> REST API (66 routes, createHandler factory)
  -> WebSocket (real-time push)
  -> Svelte 5 Dashboard (runes, Tailwind v4)
```

**Stack**: SvelteKit 2 + Svelte 5, TypeScript strict, Tailwind CSS v4, better-sqlite3, MapLibre GL, ws, node-pty

## SDR Options

| Tool      | Type   | Access       | HackRF |
| --------- | ------ | ------------ | ------ |
| OpenWebRX | Docker | iframe :8073 | Shared |
| NovaSDR   | Docker | iframe :9002 | Shared |
| SDR++     | Native | noVNC :6082  | Shared |

## API Keys

The setup script prompts for these during first run. All are stored in `.env`.

| Key                   | Required | Source                                           | Purpose                          |
| --------------------- | -------- | ------------------------------------------------ | -------------------------------- |
| `ARGOS_API_KEY`       | Yes      | Auto-generated                                   | API authentication (fail-closed) |
| `STADIA_MAPS_API_KEY` | No       | [stadiamaps.com](https://stadiamaps.com/) (free) | Vector map tiles                 |
| `OPENCELLID_API_KEY`  | No       | [opencellid.org](https://opencellid.org/) (free) | Cell tower database              |

## Tactical Framework

The `tactical/` directory contains an autonomous pentesting framework with 82 Python modules wrapping Kali Linux security tools and 13 workflow playbooks. See [tactical/CLAUDE.md](tactical/CLAUDE.md) for the complete module inventory and execution rules.

```bash
npx tsx tactical/modules/module_runner.ts --runner-help
```

## Troubleshooting

| Problem                          | Fix                                    |
| -------------------------------- | -------------------------------------- |
| No DNS / can't resolve hostnames | `sudo tailscale set --accept-dns=true` |
| No GPS fix                       | Go outside, wait 2 minutes             |
| Page is blank                    | Check `npm run dev` output for errors  |
| Alfa not detected                | Unplug and replug the USB hub          |
| HackRF not detected              | Run `hackrf_info` on the Pi terminal   |
| Port conflict                    | `sudo lsof -i :5173`                   |

### Headless Debugging

For field operations without a monitor:

```bash
# Service status
systemctl status argos-headless

# SSH tunnel from laptop
ssh -L 9224:localhost:9224 user@<pi-ip>
```

Then open `chrome://inspect` in Chrome/Edge to see the remote UI.

## Documentation

- [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) -- full architecture reference (1,011 files)
- [SETUP.md](SETUP.md) -- development setup and commands
- [tactical/CLAUDE.md](tactical/CLAUDE.md) -- tactical module guide
- [docs/operations/memory-reliability.md](docs/operations/memory-reliability.md) -- self-healing monitor and performance tuning

## License

MIT

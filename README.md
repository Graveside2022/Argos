# Argos — SDR & Network Analysis Console

Real-time spectrum analysis, WiFi network intelligence, GPS tracking, and tactical mapping. Runs entirely in Docker containers on a Raspberry Pi.

## Requirements

- Raspberry Pi 5 (4GB+ RAM)
- Ethernet connection or WiFi (for initial setup)
- HackRF One (SDR operations)
- External USB WiFi adapter (Kismet scanning — Alfa AWUS036AXML or similar)
- GPS module on USB serial (optional, for positioning)

## Install

```bash
git clone https://github.com/Graveside2022/Argos.git
cd Argos
sudo bash scripts/setup-host.sh
```

This installs Docker, Portainer, builds the container images, configures gpsd, and sets up boot services. Run it once.

## Deploy the Stack

1. Open Portainer at `https://<your-pi-ip>:9443`
2. Create an admin account on first login
3. Go to **Stacks** > **Add Stack**
4. Name it `argos`
5. Paste the contents of `docker/docker-compose.portainer-dev.yml` into the web editor
6. Click **Deploy the stack**

Both containers (Argos + HackRF backend) will start with hot reload enabled. Edit code locally — changes appear instantly in the containers.

## Access

| Service               | URL                         |
| --------------------- | --------------------------- |
| Argos Console         | `http://<your-pi-ip>:5173`  |
| Portainer             | `https://<your-pi-ip>:9443` |
| Kismet (when running) | `http://<your-pi-ip>:2501`  |
| HackRF API            | `http://<your-pi-ip>:8092`  |

## What Runs Where

**In containers (Docker):**

- Argos SvelteKit app (port 5173)
- HackRF Flask backend (port 8092)
- Kismet (started from within the Argos container via the web UI)

**On the host:**

- Docker + Portainer
- gpsd (GPS daemon)
- Tailscale or other networking (your choice)

The Argos container runs with `network_mode: host` and `privileged: true` so it can access WiFi hardware directly.

## After a Reboot

Everything starts automatically:

- Docker and Portainer are systemd services
- Containers have `restart: unless-stopped`
- `scripts/startup-check.sh` runs at boot to verify all services and start gpsd

Run it manually anytime: `sudo bash scripts/startup-check.sh`

## Safety

- Kismet will **never** run on `wlan0` (the Pi's built-in WiFi). Only external USB adapters (`wlan1`+) are used.
- Bluetooth is disabled at the firmware level to free USB power budget.
- All SDR/WiFi operations happen inside containers.

## Development

Code is mounted into the container via volume. Edit files normally on the host — Vite hot reload picks up changes instantly.

```
src/routes/          # Pages and API endpoints
src/lib/components/  # UI components by feature
src/lib/stores/      # Svelte state management
src/lib/server/      # Server-side services
src/lib/services/    # Business logic
scripts/             # Host management scripts
docker/              # Dockerfiles and compose configs
hackrf_emitter/      # HackRF Python backend
```

## License

MIT

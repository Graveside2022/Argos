# Argos Console Setup Guide

## Prerequisites

### Required Software

- **Node.js 22.x** (LTS)
- **npm 10.x** (comes with Node.js)
- **Git**

### System Requirements

- Raspberry Pi 5 (8GB RAM recommended) or Linux x86_64
- Kali Linux 2025.4 or Parrot OS 7.1 (Debian-based)
- NVMe SSD recommended for performance
- USB 3.0 powered hub for multiple RF devices

## Quick Start

### Automated Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Argos

# Run provisioning script (installs all dependencies)
sudo bash scripts/ops/setup-host.sh

# Start development server
npm run dev
```

The provisioning script handles: Node.js, Kismet, gpsd, Docker (for third-party tools), udev rules, npm dependencies, and `.env` generation.

### Manual Setup

```bash
# Install dependencies
npm ci

# Copy environment template and configure
cp .env.example .env
# Edit .env — set ARGOS_API_KEY (min 32 chars) and service passwords

# Start development server
npm run dev
```

### Environment Configuration

Edit `.env` with your configuration:

```bash
# Authentication (REQUIRED — system will not start without this)
ARGOS_API_KEY=<generate with: openssl rand -hex 32>

# Database
DATABASE_PATH=./rf_signals.db

# Kismet WiFi Scanner
KISMET_API_URL=http://localhost:2501
KISMET_PASSWORD=<set a strong password>

# Map Tiles (optional — falls back to Google satellite)
STADIA_MAPS_API_KEY=<get from https://stadiamaps.com/>

# Cell Tower Database (optional — enables cell tower overlay)
OPENCELLID_API_KEY=<get from https://opencellid.org/>
```

### Database Setup

```bash
npm run db:migrate
```

### Cell Tower Database

```bash
# Download global cell tower database (~500MB, offline lookups)
bash scripts/ops/import-celltowers.sh

# To refresh the data later:
rm data/celltowers/cell_towers.csv.gz
bash scripts/ops/import-celltowers.sh
```

Requires `OPENCELLID_API_KEY` in `.env`. The setup script offers to download during first install.

### Access the Application

- **Development**: http://localhost:5173/
- **Network**: http://[device-ip]:5173/

## Architecture

### What Runs Where

Argos runs **natively on the host** — no Docker container for the main application. RF tools (Kismet, HackRF, gr-gsm, etc.) also run natively. Docker is only used for third-party tools with complex dependencies:

| Component           | Runs On       | Notes                                        |
| ------------------- | ------------- | -------------------------------------------- |
| Argos SvelteKit App | Host (native) | `npm run dev` or systemd service             |
| Kismet              | Host (native) | WiFi scanning, installed via package manager |
| HackRF tools        | Host (native) | `hackrf_sweep`, `hackrf_info`, etc.          |
| gpsd                | Host (native) | GPS daemon                                   |
| OpenWebRX           | Docker        | SDR web interface, on-demand                 |
| Bettercap           | Docker        | Network recon, on-demand                     |

### Service URLs

| Service      | Port | Description                  |
| ------------ | ---- | ---------------------------- |
| Argos Web UI | 5173 | Main application             |
| Kismet       | 2501 | WiFi/network scanning        |
| OpenWebRX    | 8073 | Spectrum viewer (Docker)     |
| Bettercap    | 8081 | Network recon API (Docker)   |
| Portainer    | 9443 | Container management (HTTPS) |

### Docker (Third-Party Tools Only)

```bash
# Start OpenWebRX
docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d openwebrx

# Start Bettercap
docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d bettercap
```

## Development Commands

### Essential

```bash
npm run dev           # Development server (port 5173)
npm run dev:clean     # Kill existing processes and start fresh
npm run build         # Production build
```

### Code Quality

```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix lint errors
npm run typecheck     # TypeScript validation
```

### Testing

```bash
npm run test          # All tests
npm run test:unit     # Unit tests only
npm run test:security # Security tests
npm run test:e2e      # Playwright E2E tests
```

### Database

```bash
npm run db:migrate    # Run migrations
npm run db:rollback   # Rollback migration
```

## Production Deployment

### Systemd Services

```bash
# Install all services
sudo bash scripts/ops/install-services.sh

# Start production server
sudo systemctl start argos-final

# Start Kismet
sudo systemctl start argos-kismet

# Check status
sudo systemctl status argos-final
```

### Build for Production

```bash
npm run build
node build
```

### Environment Variables

Production `.env` must have:

- `NODE_ENV=production`
- `ARGOS_API_KEY` (min 32 chars)
- All service passwords configured

## Hardware Integration

### Supported Hardware

- **HackRF One** — SDR for spectrum analysis
- **Alfa AWUS036AXML** — WiFi adapter for Kismet
- **USB GPS dongle** — Location tracking (BU-353S4 or similar)
- **USRP B205** — Alternative SDR (optional)

**USB 3.0 powered hub REQUIRED** — Pi 5 cannot power HackRF + Alfa + GPS simultaneously.

## Troubleshooting

### Port 5173 Already in Use

```bash
npm run dev:clean     # Kills existing processes and restarts
```

### Node.js Version Issues

```bash
node --version        # Should be 22.x
```

### Build Failures

```bash
npm run typecheck     # Check TypeScript errors
npm run lint          # Check lint errors
npm run build         # Verify build
```

### Database Reset

```bash
rm rf_signals.db
npm run db:migrate
```

## Project Structure

```
Argos/
├── src/                    # Source code
│   ├── routes/            # SvelteKit routes + API
│   ├── lib/               # Components, stores, server code
│   └── app.html           # HTML template
├── static/                # Static assets
├── scripts/               # Utility and ops scripts
├── tests/                 # Test files
├── config/                # Vite, ESLint, terminal plugin
├── deployment/            # Systemd service files
└── docker/                # Docker (third-party tools only)
```

# Argos Console Setup Guide

## Prerequisites

### Required Software

- **Node.js 20.x** (Required for Vite 7.0.3 compatibility)
- **npm 10.x** (Usually comes with Node.js 20)
- **Git** (for cloning repository)

### System Requirements

- Linux-based OS (Ubuntu 20.04+ recommended)
- 2GB+ RAM (configured for Node.js with `--max-old-space-size=2048`)
- Network access for hardware integration (HackRF, USRP, Kismet)

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd Argos

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev:simple
```

### 2. Environment Configuration

Edit `.env` file with your specific configuration:

```bash
# Database Configuration
DATABASE_PATH=./rf_signals.db

# API Endpoints
KISMET_API_URL=http://localhost:2501
HACKRF_API_URL=http://localhost:8092
GSM_EVIL_API_URL=http://localhost:3001

# Environment
NODE_ENV=development
```

### 3. Database Setup

```bash
# Run database migrations
npm run db:migrate
```

### 4. Access the Application

- **Local Development**: http://localhost:5173/
- **Network Access**: http://[your-ip]:5173/

## Development Commands

### Essential Commands

```bash
npm run dev           # Full dev server with hardware auto-start
npm run dev:simple    # Dev server without hardware auto-start
npm run build         # Production build
npm run preview       # Preview production build
```

### Code Quality

```bash
npm run lint          # Run ESLint
npm run lint:fix      # Fix ESLint errors
npm run typecheck     # TypeScript type checking
npm run format        # Format with Prettier
```

### Testing

```bash
npm run test          # All tests
npm run test:unit     # Unit tests only
npm run test:e2e      # End-to-end tests
npm run test:coverage # Coverage report
```

### Database Management

```bash
npm run db:migrate    # Run migrations
npm run db:rollback   # Rollback migration
```

## Architecture

### What Runs Where

Argos runs as a Docker container with `privileged` access and `host` networking. The container holds the SvelteKit web app, Kismet, and basic networking tools. RF tools like `grgsm_livemon_headless`, `aircrack-ng`, and `tcpdump` run on the **host** (the Raspberry Pi itself), not inside the container.

The bridge between container and host is `src/lib/server/hostExec.ts`, which uses `nsenter -t 1 -m` to execute commands on the host filesystem from inside Docker. This is why the Dockerfile does not install GNURadio or gr-gsm — those tools must exist on the host OS.

### Service URLs

| Service        | Port | Description                  |
| -------------- | ---- | ---------------------------- |
| Argos Web UI   | 5173 | Main application             |
| Portainer      | 9443 | Container management (HTTPS) |
| Kismet         | 2501 | WiFi/network scanning        |
| HackRF Backend | 8092 | Spectrum analyzer API        |
| GSM Evil       | 3001 | GSM monitoring API           |
| OpenWebRX      | 8073 | Spectrum viewer web UI       |

### Docker Compose

Only one compose file matters for deployment: `docker/docker-compose.portainer-dev.yml`. It defines four services: `argos` (main app), `hackrf-backend`, `openwebrx`, and `bettercap`. All other compose files in `docker/` and `config/docker/` are legacy variants kept in `archive/docker-variants/`.

The compose file uses `${ARGOS_DIR}` for volume mounts. This variable is set in `docker/.env`, which `setup-host.sh` generates automatically.

## Hardware Integration

### Supported Hardware

- **HackRF One** - SDR for spectrum analysis
- **Alfa AWUS036AXML** - WiFi adapter for Kismet scanning
- **USB GPS dongle** - Location tracking (BU-353S4 or similar)
- **USRP B205** - Alternative SDR platform (optional)

### Hardware Services

The application integrates with external services running on:

- **Port 2501**: Kismet (WiFi/Network scanning)
- **Port 8092**: HackRF spectrum analyzer
- **Port 3001**: GSM Evil (GSM monitoring)

## Troubleshooting

### Common Issues

#### Port 5173 Already in Use

```bash
npm run kill-dev     # Kill existing dev server
npm run dev:simple   # Restart
```

#### Node.js Version Issues

```bash
node --version       # Should be 20.x
npm --version        # Should be 10.x
```

#### Build Failures

```bash
npm run lint         # Check for linting errors
npm run typecheck    # Check TypeScript errors
npm run build        # Verify build works
```

#### Database Issues

```bash
# Reset database (WARNING: This deletes all data)
rm rf_signals.db
npm run db:migrate
```

## Production Deployment

### Build for Production

```bash
npm run build
npm run preview      # Test production build locally
```

### Environment Variables

Ensure production `.env` has:

- `NODE_ENV=production`
- Correct API endpoints for your hardware setup
- Security keys if using authentication

### SystemD Services

See `deployment/` directory for SystemD service files for:

- Main Argos application
- Hardware service management
- Process monitoring

## Project Structure

```
Argos/
├── src/                    # Source code
│   ├── routes/            # SvelteKit routes
│   ├── lib/               # Components and utilities
│   └── app.html          # Main HTML template
├── static/                # Static assets
├── scripts/               # Deployment and utility scripts
├── tests/                 # Test files
├── config/                # Configuration files
└── deployment/           # SystemD services
```

## Development Notes

- Uses **SvelteKit 2.22.3** with **Svelte 5.35.5**
- **Vite 7.0.3** for fast development
- **TypeScript 5.8.3** for type safety
- **Tailwind CSS 3.4.15** for styling
- **SQLite** database with R-tree spatial indexing

## Getting Help

### Check Status

```bash
npm run status           # If available
git status              # Check git state
npm run typecheck       # Check for errors
```

### Logs and Debugging

- Development logs: Check browser console
- Server logs: Check terminal where dev server runs
- Hardware logs: See `scripts/` directory for diagnostics

### Support

- Check existing issues in the repository
- Review documentation in `docs/` directory
- Hardware setup guides in `docs/guides/`

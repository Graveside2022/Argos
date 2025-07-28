# Argos Brownfield Architecture Document

## Introduction

This document captures the CURRENT STATE of the Argos codebase, a comprehensive RF drone detection and localization system. It includes technical debt, workarounds, and real-world patterns to serve as a reference for AI agents working on enhancements.

### Document Scope

Focused on areas relevant to: RF signal detection, drone tracking, and aerial platform integration with HackRF/USRP hardware for autonomous signal hunting.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-07-27 | 1.0 | Initial brownfield analysis | Winston (AI Architect) |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Entry**: `src/app.html` (SvelteKit app entry)
- **Server Configuration**: `src/lib/server/env.ts`, `vite.config.ts`
- **Core Services**: `src/lib/services/`
- **API Routes**: `src/routes/api/`
- **Hardware Integration**: 
  - HackRF: `src/lib/services/hackrf/`
  - USRP: `src/lib/services/usrp/`
  - GSM Evil: `src/lib/services/gsm-evil/`
- **Drone Features**: `src/lib/services/drone/`, `src/lib/components/drone/`
- **Tactical Map**: `src/routes/tactical-map-simple/`
- **Database**: `database/rf_signals.db`, `src/lib/server/database/`

### Enhancement Impact Areas for RF Drone Detection

- `src/lib/services/drone/flightPathAnalyzer.ts` - Flight path analysis
- `src/lib/services/localization/` - RSSI localization algorithms
- `src/lib/services/map/` - Signal visualization and heatmaps
- `src/lib/services/hackrf/sweepManager.ts` - RF sweep control
- `src/lib/services/usrp/sweepManager.ts` - USRP integration
- `src/routes/tactical-map-simple/` - Real-time visualization

## High Level Architecture

### Technical Summary

Argos is a real-time RF signal detection and visualization platform built with SvelteKit, integrating multiple SDR hardware platforms (HackRF, USRP) with sophisticated signal processing and visualization capabilities. The system combines web technologies with Python/shell scripts for hardware control.

### Actual Tech Stack (from package.json)

| Category | Technology | Version | Notes |
|----------|------------|---------|--------|
| Runtime | Node.js | 18+ | Memory limits configured |
| Framework | SvelteKit | 2.22.3 | SSR + API routes |
| UI Components | Svelte | 5.35.5 | Latest Svelte 5 |
| Database | SQLite/Better-SQLite3 | 12.2.0 | Local file-based |
| Maps | Leaflet | 1.9.4 | With clustering/heatmap |
| WebSockets | ws | 8.18.3 | Real-time data streaming |
| Build | Vite | 7.0.3 | Fast HMR development |
| Testing | Vitest/Playwright | 3.2.4/1.53.2 | Unit + E2E tests |
| Python Backend | Flask | Various | HackRF emitter service |
| Hardware | HackRF/USRP | Native | Via shell/Python scripts |

### Repository Structure Reality Check

- Type: Monorepo with mixed languages
- Package Manager: npm (with extensive shell scripts)
- Notable: Heavy reliance on shell scripts for hardware control
- Critical: Python services run alongside Node.js

## Source Tree and Module Organization

### Project Structure (Actual)

```text
Argos/
├── src/
│   ├── lib/
│   │   ├── components/     # UI components (organized by feature)
│   │   ├── services/       # Business logic & hardware integration
│   │   ├── stores/         # Svelte stores for state management
│   │   ├── server/         # Server-side utilities
│   │   └── database/       # DB schemas and DAL
│   └── routes/            # SvelteKit routes + API endpoints
├── scripts/               # 200+ shell scripts (!!!)
├── hackrf_emitter/        # Separate Python backend
├── docs/                  # Extensive documentation
├── deployment/            # SystemD services
├── docker/                # Container configs
└── database/              # SQLite DB file
```

### Key Modules and Their Purpose

- **HackRF Service**: `src/lib/services/hackrf/hackrfService.ts` - Main RF sweep control
- **USRP Integration**: `src/lib/services/usrp/` - Alternative SDR hardware support
- **GSM Evil**: `src/lib/services/gsm-evil/server.ts` - GSM signal detection (legacy integration)
- **Drone Analytics**: `src/lib/services/drone/flightPathAnalyzer.ts` - 3D flight path analysis
- **Signal Processing**: `src/lib/services/hackrf/signalProcessor.ts` - Real-time signal analysis
- **RSSI Localization**: `src/lib/services/localization/RSSILocalizer.ts` - Signal triangulation
- **Map Services**: `src/lib/services/tactical-map/` - GPS, cell tower, and signal mapping

## Data Models and APIs

### Data Models

- **Signal Storage**: See `src/lib/server/database/schema.ts`
- **WebSocket Messages**: Type definitions in `src/lib/types/`
- **Store Types**: Defined alongside stores in `src/lib/stores/`

### API Specifications

REST API Endpoints (all under `/api/`):
- **HackRF Control**: `/api/hackrf/*` - Start/stop sweeps, get status
- **USRP Control**: `/api/rf/usrp-power` - USRP-specific operations  
- **GSM Evil**: `/api/gsm-evil/*` - GSM scanning and IMSI detection
- **DroneID**: `/api/droneid/` - Remote ID detection
- **Signals DB**: `/api/signals/` - Signal storage and retrieval
- **WebSocket**: `/api/ws/` - Real-time data streaming

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Shell Script Proliferation**: 200+ shell scripts with hardcoded paths, many duplicating functionality
2. **Mixed Process Management**: Python/Node.js/Shell processes managed through various mechanisms
3. **Hardware Integration**: Direct shell command execution without proper abstraction
4. **Database Performance**: No proper indexing strategy, cleanup is manual
5. **Memory Management**: Frequent OOM issues, requires manual `--max-old-space-size`
6. **GSM Evil Integration**: Legacy codebase with SocketIO proxy workarounds

### Workarounds and Gotchas

- **Environment Variables**: KISMET_API_URL must be set even if not using Kismet
- **Port Conflicts**: Multiple services compete for ports (3000, 3002, 5173, 8073, 8092)
- **USB Persistence**: USB devices reset frequently, requires `nuclear-usb-reset.sh`
- **Process Zombies**: HackRF processes don't always clean up, needs manual killing
- **Path Dependencies**: Many scripts have hardcoded `/home/pi/` or `/home/ubuntu/` paths
- **SystemD Services**: Multiple overlapping service definitions in `deployment/`

## Integration Points and External Dependencies

### External Services

| Service | Purpose | Integration Type | Key Files |
|---------|---------|------------------|-----------|
| HackRF One | RF Sweeping | Shell commands | `scripts/auto-start-hackrf.sh` |
| USRP B205 | Alternative SDR | Python/UHD | `scripts/usrp_*.py` |
| GSM Evil | GSM Detection | SocketIO Proxy | `scripts/gsm-evil-*.sh` |
| OpenWebRX | SDR Streaming | Docker | `docker-compose-openwebrx-*.yml` |
| Kismet | WiFi Scanning | REST API | `src/lib/server/kismet/` |
| OpenCellID | Cell Tower DB | JSON Import | `scripts/setup-opencellid.sh` |

### Internal Integration Points

- **Frontend ↔ Backend**: SvelteKit SSR + API routes
- **WebSocket Streaming**: EventSource for real-time data
- **Process Communication**: Mix of files, sockets, and HTTP
- **Hardware Control**: Shell scripts executed via Node.js `child_process`

## Development and Deployment

### Local Development Setup

```bash
# 1. Clone and navigate
cd /home/ubuntu/projects/Argos

# 2. Install dependencies (will fail without fixes)
npm install

# 3. Fix hardcoded paths (CRITICAL)
bash fix-hardcoded-paths.sh

# 4. Set environment variables
export KISMET_API_URL="http://localhost:2501"
export DATABASE_PATH="./database/rf_signals.db"

# 5. Start development (includes HackRF auto-start)
npm run dev
```

**Known Setup Issues**:
- Node.js memory limits require override
- HackRF may not start automatically
- Database migrations don't run automatically
- SystemD services conflict with dev mode

### Build and Deployment Process

- **Build Command**: `npm run build` (Vite production build)
- **Deployment Scripts**: 
  - `deploy-dragon-os.sh` - Full system deployment
  - `install-from-git.sh` - Git-based installation
  - `quick-install.sh` - Curl-based quick install
- **Environments**: Development only (no staging/prod configs)
- **SystemD Services**: 6+ service definitions with overlapping responsibilities

## Testing Reality

### Current Test Coverage

- Unit Tests: ~30% coverage (Vitest)
- Integration Tests: Minimal, focus on API endpoints
- E2E Tests: Basic Playwright tests for UI
- Visual Regression: Custom screenshot comparison
- Performance Tests: Memory leak detection

### Running Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:e2e      # Playwright E2E
npm run test:visual   # Visual regression
```

**Test Infrastructure Issues**:
- Tests require running services
- No proper test database isolation
- Hardware mocking is incomplete
- Many tests are skipped/broken

## Enhancement Impact Analysis for RF Drone Detection

### Files That Will Need Modification

Based on the PRD requirements for aerial RF detection:

**Core Signal Processing**:
- `src/lib/services/hackrf/sweepManager.ts` - Add drone-mounted sweep modes
- `src/lib/services/hackrf/signalProcessor.ts` - Enhanced signal classification
- `src/lib/services/localization/RSSILocalizer.ts` - 3D localization support

**Drone Integration**:
- `src/lib/services/drone/flightPathAnalyzer.ts` - Already supports path analysis
- `src/lib/stores/drone.ts` - Add real-time telemetry integration
- `src/lib/components/drone/MissionControl.svelte` - Autonomous mission planning

**Visualization**:
- `src/routes/tactical-map-simple/` - Add 3D altitude visualization
- `src/lib/services/map/heatmapService.ts` - 3D heatmap generation
- `src/lib/services/map/webglHeatmapRenderer.ts` - GPU-accelerated rendering

### New Files/Modules Needed

- `src/lib/services/drone/telemetryReceiver.ts` - MAVLink/drone telemetry
- `src/lib/services/drone/missionPlanner.ts` - Autonomous flight planning
- `src/lib/services/rf/directionFinding.ts` - Signal direction algorithms
- `src/lib/services/rf/signalClassifier.ts` - ML-based signal classification
- `scripts/drone-mavlink-bridge.sh` - Drone communication bridge

### Integration Considerations

- Must integrate with existing HackRF sweep pipeline
- Need to handle mobile platform (vibration, orientation changes)
- Real-time processing constraints on Raspberry Pi
- Power management for drone battery life
- Failsafe mechanisms for autonomous operation
- Data recording for post-flight analysis

## Appendix - Useful Commands and Scripts

### Frequently Used Commands

```bash
npm run dev              # Start development server
npm run dev:full         # Start ALL services
npm run kill-all         # Kill all processes

# Hardware control
./scripts/auto-start-hackrf.sh      # Start HackRF sweep
./scripts/nuclear-usb-reset.sh      # Reset USB devices
./scripts/gsm-evil-fixed.sh         # Start GSM detection

# Deployment
bash deploy-dragon-os.sh            # Full deployment
bash install-from-git.sh            # Install from git

# Debugging
./debug-hackrf.js                   # Debug HackRF issues
./scripts/diagnose-usrp-hardware.sh # USRP diagnostics
```

### Debugging and Troubleshooting

- **Logs**: Check console output (no centralized logging)
- **Process Status**: `ps aux | grep -E "(hackrf|python|node)"`
- **Port Conflicts**: `lsof -i :5173` (and other ports)
- **USB Issues**: `dmesg | grep -i usb` for device errors
- **Memory**: `free -h` and check for OOM killer
- **Common Fix**: Restart everything with `npm run kill-all && npm run dev`

### Critical Warnings

1. **NEVER** run multiple instances of HackRF sweep
2. **ALWAYS** check USB device status before starting
3. **DO NOT** modify shell scripts without fixing paths
4. **BEWARE** of SystemD service conflicts in production
5. **MONITOR** memory usage - system will crash at ~2GB

This document reflects the actual state of the Argos system as of July 2025, including all technical debt and operational realities.
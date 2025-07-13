# ArgosFinal Migration Project - Handoff Document

## Executive Summary

The ArgosFinal project is a strategic migration initiative to consolidate two existing Raspberry Pi applications into a unified SvelteKit platform. The project is currently **40% complete**, with backend APIs mostly implemented and frontend migration in progress.

### Project Goals

- **Consolidate** HackRF Sweep Monitor (port 3002) and Kismet Operations Center into one application
- **Preserve** 100% visual fidelity - users should see no difference
- **Maintain** all existing functionality without breaking changes
- **Improve** maintainability through unified codebase and modern TypeScript/SvelteKit stack

### Current Status

- ✅ **Backend APIs**: 85% complete (HackRF and Kismet proxy APIs functional)
- 🚧 **Frontend Components**: 15% complete (basic structure, partial HackRF UI)
- ⏳ **Testing**: 10% complete (API test scripts created, hardware testing pending)
- ✅ **Documentation**: 75% complete (comprehensive technical docs available)

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Browser                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼ Port 8006
┌─────────────────────────────────────────────────────────────────┐
│                 ArgosFinal (SvelteKit)                          │
│  - Unified UI for HackRF & Kismet                              │
│  - Client-side routing                                          │
│  - Real-time state management                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼ Port 8005
┌─────────────────────────────────────────────────────────────────┐
│              Express Backend API (Existing)                     │
│  - Business logic                                               │
│  - Service orchestration                                        │
│  - WebSocket server                                             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┬────────────────┐
        ▼                           ▼                ▼
┌──────────────┐          ┌──────────────┐  ┌──────────────┐
│   HackRF     │          │    Kismet    │  │  WigleToTAK  │
│   Device     │          │   Service    │  │   Service    │
└──────────────┘          └──────────────┘  └──────────────┘
```

### Technology Stack

- **Frontend**: SvelteKit 2.0, TypeScript 5.0, Tailwind CSS 3.3
- **Backend API**: Express.js (existing, port 8005)
- **State Management**: Svelte stores with WebSocket/SSE integration
- **Real-time**: Server-Sent Events (SSE) for HackRF, WebSockets for Kismet
- **Build Tools**: Vite 5.0, PostCSS

### Project Structure

```
/home/pi/projects/ArgosFinal/
├── src/
│   ├── routes/              # Pages and API endpoints
│   │   ├── hackrf/          # HackRF UI pages
│   │   ├── kismet/          # Kismet UI pages
│   │   └── api/             # SvelteKit API routes
│   │       ├── hackrf/      # HackRF endpoints
│   │       └── kismet/      # Kismet proxy endpoints
│   ├── lib/
│   │   ├── server/          # Server-side logic
│   │   │   ├── hackrf/      # Sweep manager
│   │   │   └── kismet/      # Proxy & services
│   │   ├── components/      # UI components
│   │   ├── services/        # API clients
│   │   ├── stores/          # State management
│   │   └── styles/          # Preserved CSS
│   └── app.css              # Global styles
├── static/                  # Static assets
└── docs/                    # Technical documentation
```

## How to Continue the Migration

### Immediate Next Steps

#### 1. Complete HackRF Frontend (Priority 1)

```bash
# Components to implement:
- src/lib/components/hackrf/SpectrumChart.svelte (real chart, not placeholder)
- src/lib/components/hackrf/ControlPanel.svelte
- src/lib/components/hackrf/ThemeSelector.svelte

# Connect to real-time data:
- Integrate SSE stream in src/routes/hackrf/+page.svelte
- Update hackrf store with live data
- Test with actual HackRF device
```

#### 2. Implement Kismet Frontend (Priority 2)

```bash
# Create these components:
- src/lib/components/kismet/DeviceList.svelte
- src/lib/components/kismet/MapView.svelte
- src/lib/components/kismet/ServiceControl.svelte
- src/lib/components/kismet/ScriptExecutor.svelte
- src/lib/components/kismet/AlertManager.svelte

# Port existing HTML/JS functionality
# Preserve all CSS classes and structure
```

#### 3. Complete WebSocket Integration

```bash
# Implement in src/lib/server/kismet/webSocketManager.ts:
- Proxy WebSocket connections to Kismet
- Handle reconnection logic
- Manage multiple client connections

# Test with:
npm run dev
# Then connect to ws://localhost:8006/api/kismet/ws
```

### Development Workflow

#### Daily Development Process

1. **Start Development Server**

    ```bash
    cd /home/pi/projects/ArgosFinal
    npm run dev
    # Server runs on http://localhost:8006
    ```

2. **Run Type Checking**

    ```bash
    npm run check:watch
    # Keep this running in another terminal
    ```

3. **Test Against Services**
    ```bash
    # Ensure backend is running on port 8005
    # Start HackRF hardware if testing spectrum features
    # Ensure Kismet is accessible
    ```

#### Working with Components

1. **NEVER modify original CSS** - all styles are in `/src/lib/styles/`
2. **Match HTML structure exactly** - compare with original applications
3. **Preserve all data attributes and classes**
4. **Test visual fidelity** - screenshot comparisons

#### API Integration Pattern

```typescript
// Example: Using the API service
import { hackrfAPI } from '$lib/services/api';

// In your component
const response = await hackrfAPI.startSweep({
	start_freq: 100000000,
	end_freq: 1000000000,
	bin_size: 1000000
});
```

### Key Migration Rules

#### ❌ DO NOT

- Change any visual appearance
- "Improve" or "modernize" UI elements
- Refactor working code unnecessarily
- Add features not in original
- Modify CSS files

#### ✅ DO

- Preserve exact HTML structure
- Keep all CSS classes and IDs
- Maintain all animations/transitions
- Test constantly against originals
- Document any deviations

## Testing Procedures

### 1. Visual Regression Testing

```bash
# Take screenshots of original apps
# HackRF on port 3002
# Kismet Ops Center (current)

# Compare with migrated versions
# Use browser DevTools for pixel-perfect comparison
# Check all interactive states
```

### 2. API Testing

```bash
# Test HackRF APIs
node test-sweep-manager.js

# Test Kismet proxy
node test-kismet-proxy.js

# Test individual endpoints
curl http://localhost:8006/api/hackrf/health
curl http://localhost:8006/api/kismet/devices/list
```

### 3. Hardware Integration Testing

```bash
# With HackRF connected:
1. Start sweep via UI
2. Verify spectrum display updates
3. Test frequency cycling (10-second intervals)
4. Test stop/emergency stop

# With Kismet running:
1. Verify device list populates
2. Test service controls (start/stop/restart)
3. Verify WebSocket updates
```

### 4. Performance Testing

```bash
# Monitor with:
htop  # CPU/Memory usage
iotop # Disk I/O
netstat -an | grep 8006  # Network connections

# Check for:
- Memory leaks in SSE connections
- CPU usage during spectrum updates
- WebSocket connection limits
```

## Deployment Instructions

### 1. Build Production Version

```bash
cd /home/pi/projects/ArgosFinal
npm run build
# Output in ./build directory
```

### 2. Create Systemd Service

```bash
# Create /etc/systemd/system/argos-final.service
[Unit]
Description=ArgosFinal SvelteKit Application
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/projects/ArgosFinal
Environment="NODE_ENV=production"
Environment="PORT=8006"
Environment="BACKEND_API_URL=http://localhost:8005"
ExecStart=/usr/bin/node build/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 3. Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable argos-final
sudo systemctl start argos-final
sudo systemctl status argos-final
```

### 4. Configure Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name argos.local;

    location / {
        proxy_pass http://localhost:8006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE support
    location /api/hackrf/data-stream {
        proxy_pass http://localhost:8006;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
    }
}
```

### 5. Migration Cutover Process

```bash
# 1. Deploy ArgosFinal alongside existing services
sudo systemctl start argos-final

# 2. Test on port 8006
curl http://localhost:8006/api/hackrf/health

# 3. Update DNS/nginx to point to new service

# 4. Monitor for issues
journalctl -u argos-final -f

# 5. Once stable, stop old services
sudo systemctl stop hackrf-sweep-monitor  # port 3002
# Keep Express backend running on 8005
```

## Contact Points and Resources

### Project Resources

- **Source Code**: `/home/pi/projects/ArgosFinal/`
- **Original HackRF App**: Port 3002 (for comparison)
- **Express Backend**: Port 8005 (must keep running)
- **Documentation**: `/home/pi/projects/ArgosFinal/docs/`

### Key Files for Reference

- `MIGRATION_SUMMARY.md` - Overall migration strategy
- `PHASE_STATUS_DETAILED.md` - Current progress details
- `API_CONFIGURATION.md` - API endpoint documentation
- `docs/hackrf-backend-analysis.md` - HackRF implementation details
- `docs/kismet-proxy-api.md` - Kismet API documentation

### External Dependencies

- **HackRF Device**: USB connection required for spectrum analysis
- **Kismet Service**: Must be running for WiFi operations
- **Express Backend**: Port 8005 (provides business logic)
- **WigleToTAK**: For TAK integration features

### Troubleshooting Resources

#### Common Issues

1. **"Cannot connect to backend"**
    - Ensure Express backend is running on port 8005
    - Check BACKEND_API_URL environment variable

2. **"HackRF not detected"**
    - Check USB connection: `lsusb | grep HackRF`
    - Ensure hackrf_sweep is in PATH

3. **"Kismet connection failed"**
    - Verify Kismet is running
    - Check API key in environment variables
    - Test with: `curl -H "Cookie: KISMET=your_api_key" http://localhost:2501/system/status.json`

4. **"WebSocket connection drops"**
    - Check nginx configuration for upgrade headers
    - Monitor with browser DevTools Network tab

#### Debug Commands

```bash
# Check services
systemctl status argos-final
systemctl status kismet

# View logs
journalctl -u argos-final -n 100
tail -f /home/pi/tmp/kismet.log

# Test connectivity
netstat -tlnp | grep -E "8005|8006|2501"

# Monitor processes
ps aux | grep -E "node|kismet|hackrf"
```

### Development Guidelines

#### Code Style

- TypeScript strict mode enabled
- Svelte component naming: PascalCase
- API routes: kebab-case
- Follow existing patterns in codebase

#### Git Workflow

```bash
# Feature branch
git checkout -b feature/complete-hackrf-ui

# Commit with descriptive messages
git add .
git commit -m "feat: implement spectrum chart with real-time updates"

# Keep commits focused and atomic
```

#### Testing Requirements

- Visual comparison before marking complete
- API endpoint testing required
- Hardware integration verification
- Performance benchmarking

### Success Metrics

- **Zero visual differences** from original applications
- **100% feature parity** with existing functionality
- **Sub-second response times** for all operations
- **Stable operation** for 24+ hours continuous use
- **Clean migration** with no user-facing disruption

### Final Notes

This migration prioritizes stability and exact preservation over modernization. Any deviation from the original applications should be considered a bug. The goal is an invisible technical migration that improves maintainability while preserving the exact user experience.

When in doubt:

1. Compare with the original application
2. Preserve rather than improve
3. Test exhaustively before proceeding
4. Document any unavoidable changes

The project is well-structured and the path forward is clear. Focus on completing the frontend components while maintaining the strict visual and functional requirements.

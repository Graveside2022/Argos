# ArgosFinal Infrastructure Documentation

## Core Infrastructure Components

### 1. WebSocket Services

The application uses WebSocket connections for real-time data streaming from HackRF and Kismet services.

#### WebSocket Server

- **Port**: 8005 (configurable via `WS_PORT` environment variable)
- **Endpoints**:
    - `ws://localhost:8005/hackrf` - HackRF real-time spectrum data
    - `ws://localhost:8005/kismet` - Kismet device tracking updates

#### Starting WebSocket Server

```bash
# Development mode (with auto-reload)
npm run ws:dev

# Production mode
npm run ws:start

# Start everything together
npm run dev:all
```

### 2. API Services

RESTful API endpoints for command and control operations.

#### HackRF API Endpoints

- `GET /api/hackrf/health` - Check HackRF connection status
- `POST /api/hackrf/start-sweep` - Start frequency sweep
- `POST /api/hackrf/stop-sweep` - Stop frequency sweep
- `GET /api/hackrf/cycle-status` - Get current sweep cycle status
- `POST /api/hackrf/emergency-stop` - Emergency stop all operations
- `POST /api/hackrf/force-cleanup` - Force cleanup resources

#### Kismet API Endpoints

- `GET /api/kismet/service/status` - Get Kismet service status
- `POST /api/kismet/service/start` - Start Kismet service
- `POST /api/kismet/service/stop` - Stop Kismet service
- `POST /api/kismet/service/restart` - Restart Kismet service
- `GET /api/kismet/devices/list` - Get device list
- `GET /api/kismet/devices/stats` - Get device statistics
- `GET /api/kismet/scripts/list` - List available scripts
- `POST /api/kismet/scripts/execute` - Execute a script

### 3. Client Services

#### WebSocket Clients

Located in `/src/lib/services/websocket/`:

- `hackrf.ts` - HackRF WebSocket client with automatic reconnection
- `kismet.ts` - Kismet WebSocket client with device tracking
- `base.ts` - Base WebSocket class with heartbeat and reconnection logic

#### API Clients

Located in `/src/lib/services/api/`:

- `hackrf.ts` - HackRF REST API client
- `kismet.ts` - Kismet REST API client
- `system.ts` - System status API client
- `config.ts` - Shared API configuration and utilities

### 4. Testing Infrastructure

#### Test Page

Access the test page at `http://localhost:5173/test` to:

- Test all API connections
- Verify WebSocket connectivity
- Monitor real-time data flow
- View connection status and logs

#### Test Script

Run the infrastructure test:

```bash
./test-infrastructure.sh
```

This will:

1. Install dependencies
2. Build the project
3. Start WebSocket server
4. Start development server
5. Verify all connections

### 5. Store Management

Svelte stores for state management:

- `/src/lib/stores/hackrf.ts` - HackRF state (spectrum data, sweep status)
- `/src/lib/stores/kismet.ts` - Kismet state (devices, alerts, status)
- `/src/lib/stores/connection.ts` - Connection status for all services

### 6. Configuration

#### Environment Variables

- `WS_PORT` - WebSocket server port (default: 8005)
- `VITE_API_URL` - API base URL (default: http://localhost:5173)

#### Package Scripts

```json
{
	"dev": "vite dev",
	"dev:all": "npm run ws:dev & npm run dev",
	"ws:dev": "tsx src/websocket-dev.ts",
	"ws:start": "node websocket-server.js",
	"build": "vite build",
	"preview": "vite preview"
}
```

### 7. CSS Framework

The application uses a pixel-perfect CSS implementation with:

- Monochrome theme (`monochrome-theme.css`)
- Geometric backgrounds (`geometric-backgrounds.css`)
- Custom components (`custom-components-exact.css`)
- Saasfly button styles (`saasfly-buttons.css`)

All styles are preserved exactly as designed and validated through:

- CSS integrity checks
- HTML structure validation
- Visual regression testing

### 8. Development Workflow

1. **Start Development Environment**:

    ```bash
    npm run dev:all
    ```

2. **Access Application**:
    - Main app: http://localhost:5173
    - Test page: http://localhost:5173/test
    - HackRF: http://localhost:5173/hackrf
    - Kismet: http://localhost:5173/kismet

3. **Monitor Logs**:
    - WebSocket server logs in terminal
    - Browser DevTools for client-side logs
    - Network tab for API/WS traffic

4. **Run Tests**:
    ```bash
    ./test-infrastructure.sh
    ```

### 9. Production Deployment

1. **Build Application**:

    ```bash
    npm run build
    ```

2. **Start Services**:

    ```bash
    npm run ws:start &
    npm run preview
    ```

3. **Configure Reverse Proxy**:
    - Route `/api/*` to SvelteKit server
    - Route WebSocket connections to port 8005
    - Serve static assets from `build/`

### 10. Troubleshooting

#### WebSocket Connection Issues

- Check if port 8005 is available: `lsof -i :8005`
- Verify WebSocket server is running: `ps aux | grep websocket`
- Check browser console for connection errors

#### API Connection Issues

- Verify SvelteKit server is running: `curl http://localhost:5173`
- Check API endpoints: `curl http://localhost:5173/api/hackrf`
- Review server logs for errors

#### CSS/Visual Issues

- Run CSS integrity check: `npm run framework:check-css`
- Validate HTML structure: `npm run framework:check-html`
- Generate visual baselines: `npm run framework:generate-visual-baselines`

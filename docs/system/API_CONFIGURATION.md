# ArgosFinal API Configuration Guide

## Architecture Overview

ArgosFinal uses a separated frontend/backend architecture:

- **Frontend (Port 8006)**: SvelteKit application serving the user interface
- **Backend (Port 8005)**: Express.js API server handling business logic and service integration

## Port Configuration

### Production Ports

- **8005**: Express Backend API Server
    - REST API endpoints
    - WebSocket server
    - Service proxying (Kismet, WigleToTAK, etc.)
    - Authentication and session management
- **8006**: SvelteKit Frontend Application
    - User interface
    - Client-side routing
    - API client services
    - Real-time WebSocket connections

### Integration Ports (External Services)

- **2501**: Kismet service
- **3002**: HackRF Sweep Monitor (to be migrated)
- **8000**: WigleToTAK service
- **8073**: OpenWebRX
- **8092**: Spectrum Analyzer

## Data Flow

```
┌─────────────────┐     HTTP/WS      ┌──────────────────┐
│                 │ ──────────────> │                  │
│  SvelteKit UI   │                 │  Express API     │
│   Port 8006     │ <────────────── │   Port 8005      │
│                 │    JSON/Events   │                  │
└─────────────────┘                 └──────────────────┘
                                             │
                                             │ Proxies/Integrates
                                             ▼
                                    ┌─────────────────┐
                                    │ External        │
                                    │ Services        │
                                    │ (Kismet, etc.)  │
                                    └─────────────────┘
```

## API Endpoints

### Frontend to Backend Communication

The SvelteKit frontend makes API calls to the Express backend:

```javascript
// Frontend API configuration (in SvelteKit)
const API_BASE_URL = 'http://localhost:8005/api';

// Example API calls from frontend
fetch(`${API_BASE_URL}/hackrf/status`);
fetch(`${API_BASE_URL}/kismet/devices`);
fetch(`${API_BASE_URL}/system/info`);

// WebSocket connection from frontend
const ws = new WebSocket('ws://localhost:8005');
```

### Backend API Routes (Express - Port 8005)

```
/api/hackrf/*      - HackRF control and monitoring
/api/kismet/*      - Kismet integration and proxying
/api/system/*      - System information and control
/api/wigle/*       - WigleToTAK proxy endpoints
/api/devices/*     - Device management
/api/antenna/*     - Antenna configuration
/api/alerts/*      - Alert management
/api/geofences/*   - Geofence configuration
```

## Environment Configuration

### Frontend (.env for SvelteKit)

```bash
# API endpoint for backend
PUBLIC_API_BASE_URL=http://localhost:8005
PUBLIC_WS_URL=ws://localhost:8005

# Direct service endpoints (for legacy compatibility)
PUBLIC_KISMET_URL=http://localhost:2501
PUBLIC_WIGLETOAK_URL=http://localhost:8000
PUBLIC_OPENWEBRX_URL=http://localhost:8073
PUBLIC_SPECTRUM_ANALYZER_URL=http://localhost:8092
```

### Backend Configuration (Express)

```javascript
// Express server configuration
const PORT = process.env.PORT || 8005;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8006';

// CORS configuration to allow frontend access
app.use(
	cors({
		origin: FRONTEND_URL,
		credentials: true
	})
);
```

## Migration Strategy

### Current State

- HackRF Monitor: Standalone on port 3002
- Kismet Operations: Express backend (8005) + legacy frontend

### Target State

- Express Backend: Port 8005 (existing, enhanced)
- SvelteKit Frontend: Port 8006 (new, replacing legacy UIs)

### Migration Steps

1. Keep Express backend running on port 8005
2. Deploy SvelteKit frontend on port 8006
3. Configure frontend to connect to backend API
4. Gradually migrate UI components from legacy to SvelteKit
5. Maintain API compatibility throughout migration

## WebSocket Integration

### Backend WebSocket Setup (Express)

```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
	// Handle real-time updates
	ws.on('message', (message) => {
		// Process incoming messages
	});

	// Send updates to frontend
	ws.send(
		JSON.stringify({
			type: 'device_update',
			data: deviceData
		})
	);
});
```

### Frontend WebSocket Client (SvelteKit)

```javascript
import { writable } from 'svelte/store';

const ws = new WebSocket('ws://localhost:8005');
const deviceUpdates = writable([]);

ws.onmessage = (event) => {
	const data = JSON.parse(event.data);
	if (data.type === 'device_update') {
		deviceUpdates.update((devices) => [...devices, data.data]);
	}
};
```

## Service Proxying

The Express backend acts as a proxy to various services:

```javascript
// Kismet proxy example
app.use(
	'/api/kismet/proxy',
	createProxyMiddleware({
		target: 'http://localhost:2501',
		changeOrigin: true,
		pathRewrite: { '^/api/kismet/proxy': '' }
	})
);

// WigleToTAK proxy
app.use(
	'/api/wigle',
	createProxyMiddleware({
		target: 'http://localhost:8000',
		changeOrigin: true
	})
);
```

## Authentication Flow

1. User accesses frontend (port 8006)
2. Frontend sends credentials to backend API (port 8005)
3. Backend validates and creates session
4. Frontend stores session token
5. All subsequent API calls include session token

## Development Workflow

### Start Backend (Terminal 1)

```bash
cd /path/to/backend
npm run dev  # Starts Express on port 8005
```

### Start Frontend (Terminal 2)

```bash
cd /home/pi/projects/ArgosFinal
npm run dev  # Starts SvelteKit on port 8006
```

### Access Application

- Frontend UI: http://localhost:8006
- Backend API: http://localhost:8005/api
- API Documentation: http://localhost:8005/api/docs (if implemented)

## Troubleshooting

### CORS Issues

Ensure the Express backend allows requests from the SvelteKit frontend:

```javascript
app.use(
	cors({
		origin: 'http://localhost:8006',
		credentials: true
	})
);
```

### WebSocket Connection Failed

Check that both frontend and backend WebSocket URLs match:

- Frontend connects to: `ws://localhost:8005`
- Backend listens on port 8005

### API Calls Failing

Verify the API base URL in frontend configuration:

```javascript
// Should point to Express backend
const API_BASE_URL = 'http://localhost:8005/api';
```

## Production Deployment

### Using PM2

```bash
# Backend
pm2 start server.js --name "argos-backend" --port 8005

# Frontend
pm2 start npm --name "argos-frontend" -- run preview -- --port 8006
```

### Using systemd

Create service files for both frontend and backend with appropriate port configurations.

## Security Considerations

1. **API Authentication**: All API endpoints should validate session tokens
2. **CORS Policy**: Restrict to specific frontend origin in production
3. **WebSocket Security**: Implement authentication for WebSocket connections
4. **Proxy Security**: Validate and sanitize all proxied requests
5. **HTTPS**: Use HTTPS in production for both frontend and backend

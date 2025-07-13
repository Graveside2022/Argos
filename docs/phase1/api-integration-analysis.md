# API Integration Analysis

## Executive Summary

This document provides a comprehensive analysis of all API endpoints, data formats, and integration requirements for the ArgosFinal system. The architecture uses SvelteKit for the frontend (port 8006) and includes both REST APIs and real-time communication via Server-Sent Events (SSE) and WebSockets.

## Architecture Overview

### Port Configuration

- **8006**: SvelteKit Frontend Application
- **8005**: Express Backend API Server (referenced but separate)
- **2501**: Kismet Service
- **8000**: WigleToTAK Service
- **8073**: OpenWebRX
- **8092**: Spectrum Analyzer

### Data Flow

```
┌─────────────────┐     HTTP/SSE/WS    ┌──────────────────┐
│  SvelteKit UI   │ ────────────────> │  API Routes      │
│   Port 8006     │ <──────────────── │   (+server.ts)   │
└─────────────────┘    JSON/Events     └──────────────────┘
                                               │
                                               │ Proxies/Integrates
                                               ▼
                                      ┌─────────────────┐
                                      │ External        │
                                      │ Services        │
                                      │ (Kismet, etc.)  │
                                      └─────────────────┘
```

## REST API Endpoints

### HackRF API Endpoints

#### Base Endpoint: `/api/hackrf`

1. **GET /api/hackrf**
    - **Purpose**: List available HackRF endpoints
    - **Response Format**:

    ```json
    {
    	"success": true,
    	"message": "HackRF API",
    	"version": "1.0.0",
    	"endpoints": [
    		"/api/hackrf/health",
    		"/api/hackrf/start-sweep",
    		"/api/hackrf/stop-sweep",
    		"/api/hackrf/cycle-status",
    		"/api/hackrf/emergency-stop",
    		"/api/hackrf/force-cleanup",
    		"/api/hackrf/data-stream"
    	],
    	"timestamp": 1234567890
    }
    ```

2. **GET /api/hackrf/health**
    - **Purpose**: Check HackRF device health
    - **Response Type**: `ApiResponse<HackRFHealth>`
    - **Response Format**:

    ```json
    {
    	"success": true,
    	"data": {
    		"connected": true,
    		"serialNumber": "string",
    		"firmwareVersion": "string",
    		"temperature": 45.2,
    		"deviceInfo": "string",
    		"lastUpdate": 1234567890
    	},
    	"timestamp": 1234567890
    }
    ```

3. **POST /api/hackrf/start-sweep**
    - **Purpose**: Start frequency sweep
    - **Request Body**: `SweepConfig`

    ```json
    {
    	"centerFrequency": 433000000,
    	"bandwidth": 2000000,
    	"sampleRate": 2000000,
    	"lnaGain": 30,
    	"vgaGain": 20,
    	"ampEnable": false,
    	"numSweeps": 100,
    	"frequencies": [
    		{ "value": 433, "unit": "MHz" },
    		{ "value": 868, "unit": "MHz" }
    	],
    	"cycleTime": 5000
    }
    ```

    - **Response Type**: `ApiResponse<SweepStatus>`

4. **POST /api/hackrf/stop-sweep**
    - **Purpose**: Stop current sweep
    - **Response**: Success confirmation

5. **GET /api/hackrf/cycle-status**
    - **Purpose**: Get cycle configuration status
    - **Response**: Current cycle settings

6. **POST /api/hackrf/emergency-stop**
    - **Purpose**: Emergency stop all operations
    - **Response**: Stop confirmation

7. **POST /api/hackrf/force-cleanup**
    - **Purpose**: Force cleanup of resources
    - **Response**: Cleanup confirmation

8. **GET /api/hackrf/data-stream**
    - **Purpose**: Server-Sent Events stream
    - **Response**: SSE stream with events:
        - `connected`: Initial connection
        - `sweep_data`: Spectrum data updates
        - `status`: Status changes
        - `error`: Error messages
        - `cycle_config`: Cycle configuration
        - `status_change`: Status changes
        - `heartbeat`: Keep-alive

### Kismet API Endpoints

#### Base Endpoint: `/api/kismet`

1. **GET /api/kismet**
    - **Purpose**: List all Kismet endpoints
    - **Response**: Endpoint documentation

2. **Service Management**
    - **GET /api/kismet/service/status**: Get service status
    - **POST /api/kismet/service/start**: Start service
    - **POST /api/kismet/service/stop**: Stop service
    - **POST /api/kismet/service/restart**: Restart service

3. **Device Management**
    - **GET /api/kismet/devices/list**: List WiFi devices
        - Query params: `type`, `ssid`, `manufacturer`, `minSignal`, `maxSignal`, `seenWithin`
    - **GET /api/kismet/devices/stats**: Get device statistics

4. **Script Management**
    - **GET /api/kismet/scripts/list**: List available scripts
    - **POST /api/kismet/scripts/execute**: Execute script
        ```json
        {
        	"scriptPath": "/path/to/script.sh"
        }
        ```

5. **Configuration**
    - **GET /api/kismet/config**: Get configuration
    - **Response Type**: `KismetConfig`

6. **Proxy Endpoint**
    - **ALL /api/kismet/proxy/[...path]**: Generic proxy to Kismet API
    - Supports GET, POST, PUT, DELETE
    - Preserves query parameters
    - Handles JSON and text bodies

7. **WebSocket Endpoint**
    - **GET /api/kismet/ws**: WebSocket connection (requires platform implementation)

## Data Types

### HackRF Types

```typescript
interface SweepConfig {
	centerFrequency: number;
	bandwidth?: number;
	sampleRate?: number;
	lnaGain?: number;
	vgaGain?: number;
	txvgaGain?: number;
	ampEnable?: boolean;
	antennaEnable?: boolean;
	binSize?: number;
	numSweeps?: number;
	sweepRate?: number;
	frequencies?: Array<{ value: number; unit: string }>;
	cycleTime?: number;
}

interface SweepStatus {
	state: 'idle' | 'running' | 'stopping' | 'error';
	currentFrequency?: number;
	sweepProgress?: number;
	totalSweeps?: number;
	completedSweeps?: number;
	startTime?: number;
	error?: string;
}

interface SpectrumData {
	timestamp: string;
	frequency: number; // Peak frequency in MHz
	power: number; // Peak power in dB
	unit?: string;
	binData?: number[]; // Array of power values
	metadata?: {
		targetFrequency?: { value: number; unit: string };
		currentIndex?: number;
		totalFrequencies?: number;
		frequencyRange?: {
			low: number;
			high: number;
			center: number;
		};
		binWidth?: number;
		signalStrength?: string;
		date?: string;
		time?: string;
		peakBinIndex?: number;
	};
}

interface HackRFHealth {
	connected: boolean;
	serialNumber?: string;
	firmwareVersion?: string;
	temperature?: number;
	deviceInfo?: string;
	error?: string;
	lastUpdate: number;
}

interface ApiResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: number;
}
```

### Kismet Types

```typescript
interface KismetServiceStatus {
	running: boolean;
	pid?: number;
	uptime?: number;
	memory?: number;
	cpu?: number;
	error?: string;
}

interface KismetDevice {
	mac: string;
	ssid?: string;
	manufacturer?: string;
	type: 'AP' | 'Client' | 'Bridge' | 'Unknown';
	channel?: number;
	frequency?: number;
	signal?: number;
	lastSeen: string;
	firstSeen: string;
	packets: number;
	dataPackets?: number;
	encryptionType?: string[];
	location?: {
		lat?: number;
		lon?: number;
		alt?: number;
	};
}

interface KismetConfig {
	interfaces: string[];
	channels: number[];
	hopRate: number;
	logLevel: string;
	logPath: string;
	alertsEnabled: boolean;
	gpsEnabled: boolean;
	remoteCapture?: {
		enabled: boolean;
		sources: string[];
	};
}

interface DeviceStats {
	total: number;
	byType: {
		AP: number;
		Client: number;
		Bridge: number;
		Unknown: number;
	};
	byEncryption: Record<string, number>;
	byManufacturer: Record<string, number>;
	activeInLast5Min: number;
	activeInLast15Min: number;
}
```

## Real-Time Communication

### Server-Sent Events (SSE)

**Endpoint**: `/api/hackrf/data-stream`

**Event Types**:

1. **connected**: Initial connection confirmation
2. **sweep_data**: Real-time spectrum data
3. **status**: Status updates
4. **error**: Error notifications
5. **cycle_config**: Cycle configuration changes
6. **status_change**: State transitions
7. **heartbeat**: Keep-alive signal (every 30s)

**Connection Example**:

```javascript
const eventSource = new EventSource('/api/hackrf/data-stream');

eventSource.addEventListener('sweep_data', (event) => {
	const data = JSON.parse(event.data);
	// Process spectrum data
});

eventSource.addEventListener('error', (event) => {
	const error = JSON.parse(event.data);
	console.error('HackRF error:', error);
});
```

### WebSocket Communication

**Note**: The current implementation uses SSE for HackRF. WebSocket endpoints are defined but require platform-specific implementation.

**Planned WebSocket Features**:

- Bidirectional communication
- Lower latency for real-time data
- Binary data support
- Compression options

## Authentication & Security

### Current State

- No authentication mechanism implemented in the analyzed endpoints
- CORS headers would be configured at the server level
- API responses include timestamps for audit trails

### Recommendations

1. Implement API key or token-based authentication
2. Add rate limiting for resource-intensive endpoints
3. Validate all input parameters
4. Implement request signing for sensitive operations
5. Add audit logging for all API calls

## Error Response Patterns

### Standard Error Format

```json
{
	"success": false,
	"error": "Error message",
	"timestamp": 1234567890
}
```

### HTTP Status Codes

- **200**: Success
- **400**: Bad Request (invalid parameters)
- **404**: Not Found
- **500**: Internal Server Error
- **503**: Service Unavailable (e.g., Kismet not running)

### Error Handling in Proxy

The Kismet proxy distinguishes between:

- Connection errors (503): "Cannot connect to Kismet"
- Other errors (500): General server errors

## Integration Requirements

### Frontend Integration

1. **API Client Services**: Use provided TypeScript clients in `/src/lib/services/api/`
2. **Store Management**: Svelte stores for state management
3. **Real-time Updates**: SSE for HackRF, polling or WebSocket for Kismet
4. **Error Handling**: Implement retry logic with exponential backoff

### Backend Requirements

1. **Service Management**: Process management for external services
2. **Data Transformation**: Convert between internal and external formats
3. **Caching**: Consider caching for frequently accessed data
4. **Connection Pooling**: Reuse connections to external services

### External Service Dependencies

1. **HackRF**: Requires hackrf_sweep process
2. **Kismet**: HTTP API on port 2501
3. **WigleToTAK**: Service on port 8000
4. **OpenWebRX**: Service on port 8073

## Performance Considerations

### Data Volume

- HackRF sweep data: High frequency updates (10-100Hz)
- Kismet device updates: Moderate (1-10Hz)
- Consider data aggregation and throttling

### Connection Management

- SSE connections have timeout/reconnection logic
- Heartbeat mechanism prevents proxy timeouts
- Connection pooling for backend services

### Caching Strategy

- Cache device manufacturer lookups
- Cache script listings (refresh on demand)
- Consider Redis/DragonflyDB for shared cache

## Migration Considerations

### From Legacy System

1. Map legacy endpoints to new structure
2. Maintain backward compatibility during transition
3. Gradual migration of clients
4. Feature flags for new functionality

### To Microservices

1. Each service (HackRF, Kismet) could be separate
2. API Gateway pattern for unified access
3. Service mesh for inter-service communication
4. Distributed tracing for debugging

## Testing Requirements

### Unit Tests

- Test each endpoint independently
- Mock external service responses
- Validate error handling

### Integration Tests

- Test full request/response cycle
- Verify proxy functionality
- Test SSE event delivery

### Load Tests

- Simulate multiple concurrent SSE connections
- Test high-frequency data updates
- Verify system behavior under load

## Documentation Requirements

### API Documentation

- OpenAPI/Swagger specification
- Interactive API explorer
- Example requests/responses
- WebSocket protocol documentation

### Integration Guides

- Frontend integration examples
- Authentication setup
- Real-time data handling
- Error recovery patterns

## Summary

The API architecture provides:

1. **RESTful endpoints** for control operations
2. **SSE streams** for real-time data
3. **Proxy endpoints** for service integration
4. **Type-safe interfaces** for development
5. **Extensible design** for future enhancements

Key integration points:

- HackRF: SSE-based real-time spectrum data
- Kismet: RESTful API with proxy support
- WebSocket: Defined but requires implementation
- Error handling: Consistent patterns across APIs
- Data formats: JSON for all communications

# HackRF Backend Implementation Analysis

## Overview

The HackRF backend consists of two main components:

1. **server.js** - Express server handling HTTP API endpoints and SSE connections
2. **sweeperService.js** - Core service managing HackRF sweep operations

## API Endpoints

### 1. **POST /start-sweep**

Starts a frequency sweep operation.

**Request Body:**

```json
{
	"frequency": 433000000, // Single frequency in Hz (optional)
	"frequencies": [
		// Array of frequencies (optional)
		{ "value": 433000000, "unit": "Hz" },
		{ "value": 915, "unit": "MHz" }
	],
	"cycleTime": 10, // Time per frequency in seconds
	"unit": "Hz" // Unit for single frequency
}
```

**Response:**

```json
{
  "success": true,
  "message": "Multi-frequency cycling started",
  "mode": "cycling",
  "config": {
    "frequencies": [...],
    "cycleTime": 10000,
    "cycleTimeSeconds": 10,
    "totalFrequencies": 2
  }
}
```

### 2. **POST /stop-sweep**

Stops the current sweep operation with full process verification.

**Response:**

```json
{
	"success": true,
	"message": "Sweep stopped and verified",
	"timestamp": "2025-01-25T12:00:00.000Z",
	"finalState": {
		"isRunning": false,
		"processRunning": false
	}
}
```

### 3. **GET /data-stream**

Server-Sent Events (SSE) endpoint for real-time sweep data.

**Event Types:**

- `status_change` - Sweep status updates
- `cycle_config` - Frequency cycle configuration
- `sweep_data` - Real-time sweep data
- `error` - Error notifications
- `emergency_stop` - Emergency stop notifications
- `state_sync` - State synchronization updates
- `server_reset` - Server reset notifications
- `frequency_transition_update` - Frequency switching updates
- `health_status_update` - Service health updates
- `recovery_attempt` - Recovery operation notifications

### 4. **GET /cycle-status**

Gets current cycling status.

**Response:**

```json
{
  "success": true,
  "isRunning": true,
  "isCycling": true,
  "frequencies": [...],
  "currentIndex": 0,
  "cycleTime": 10000,
  "processHealth": "healthy"
}
```

### 5. **POST /force-cleanup**

Forces cleanup of all HackRF processes.

**Response:**

```json
{
	"success": true,
	"message": "HackRF process cleanup completed successfully"
}
```

### 6. **POST /emergency-stop**

Emergency stop bypassing all state checks.

**Response:**

```json
{
	"success": true,
	"message": "Emergency stop completed - all processes terminated",
	"timestamp": "2025-01-25T12:00:00.000Z"
}
```

### 7. **POST /manual-sync**

Manual state synchronization.

**Response:**

```json
{
  "success": true,
  "message": "State synchronization completed",
  "beforeState": {...},
  "afterState": {...},
  "changes": {...},
  "timestamp": "2025-01-25T12:00:00.000Z"
}
```

### 8. **POST /server-reset**

Resets server to clean state.

**Response:**

```json
{
  "success": true,
  "message": "Server reset completed successfully",
  "clientsNotified": 2,
  "finalState": {...},
  "timestamp": "2025-01-25T12:00:00.000Z"
}
```

### 9. **GET /health**

Comprehensive health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-01-25T12:00:00.000Z",
  "uptime": {
    "ms": 3600000,
    "seconds": 3600,
    "minutes": 60,
    "hours": 1
  },
  "memory": {
    "rss": "150 MB",
    "heapTotal": "100 MB",
    "heapUsed": "80 MB",
    "external": "10 MB"
  },
  "hardware": {
    "hackrfDetected": true,
    "hackrfError": null,
    "hackrfDeviceInfo": "Device present"
  },
  "sweepService": {
    "initialized": true,
    "running": true,
    "status": {...}
  },
  "connections": {
    "sseClients": 2
  },
  "server": {
    "host": "0.0.0.0",
    "port": 3002,
    "nodeVersion": "v18.17.0",
    "platform": "linux",
    "arch": "arm64"
  },
  "stateValidation": {...},
  "splitBrainCheck": {...}
}
```

### 10. **GET /api/state-validation**

State validation check.

**Response:**

```json
{
  "success": true,
  "timestamp": "2025-01-25T12:00:00.000Z",
  "validation": {
    "valid": true,
    "issues": [],
    "checks": {...}
  },
  "splitBrainCheck": {
    "detected": false,
    "issues": [],
    "checks": {...}
  }
}
```

### 11. **GET /api/startup-health**

Startup health check.

**Response:**

```json
{
  "success": true,
  "timestamp": "2025-01-25T12:00:00.000Z",
  "startupCheck": {
    "cleanState": true,
    "issues": [],
    "checks": {...}
  }
}
```

### 12. **GET /api/connections**

Get SSE connection count.

**Response:**

```json
{
	"count": 2,
	"timestamp": "2025-01-25T12:00:00.000Z"
}
```

## Core SweeperService Features

### Process Management

- Spawns and manages `hackrf_sweep` subprocess
- Process group management for complete cleanup
- PID tracking and registry
- Automatic process recovery on failure
- Timeout handling for stuck processes

### Frequency Cycling

- Single frequency and multi-frequency support
- Configurable cycle time per frequency
- Automatic frequency switching
- Frequency validation and blacklisting
- Error tracking per frequency

### Error Recovery

- Exponential backoff retry logic
- Progressive recovery strategies:
    1. Simple wait and retry
    2. Aggressive process cleanup
    3. USB device reset
    4. Extended cooldown
- Device state tracking
- Failure rate limiting to prevent loops

### State Management

- State coherence checking
- Split-brain detection
- Automatic state resolution
- Clean state reset capabilities
- Startup validation

### Health Monitoring

- Periodic health checks
- Process health tracking
- Stuck process detection
- Orphaned process cleanup
- Memory usage monitoring

### SSE Event System

- Real-time data streaming
- Multiple event types
- Connection management
- Automatic cleanup of stale connections
- Event buffering and flushing

## Key Dependencies

- `child_process` - For spawning hackrf_sweep
- `express` - Web server framework
- Node.js built-in modules only (no external packages)

## Configuration

- Default port: 3002
- Default cycle time: 10 seconds
- Process timeout: 20 seconds
- Startup detection: 2.5 seconds
- Frequency switch timeout: 15 seconds
- Max consecutive errors: 8
- Max failures per minute: 5

## Process Flow

1. Client sends POST /start-sweep
2. Server validates request and checks device availability
3. SweeperService spawns hackrf_sweep process
4. Process output is parsed and sent via SSE
5. Automatic frequency cycling if multiple frequencies
6. Error recovery on failures
7. Clean shutdown on stop request

## Migration Considerations

1. Replace Express with SvelteKit API routes
2. Implement SSE using SvelteKit's streaming responses
3. Maintain process management logic
4. Port state management to stores
5. Implement WebSocket alternative to SSE if needed
6. Consider using Node.js worker threads for process isolation
7. Implement proper TypeScript types for all data structures

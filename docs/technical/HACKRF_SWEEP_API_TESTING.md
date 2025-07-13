# HackRF Sweep API Testing Documentation

## API Endpoints Overview

The HackRF Sweep service provides the following REST API endpoints:

### 1. Health Check

**Endpoint:** `GET /api/hackrf/health`
**Description:** Check HackRF device connectivity and status
**Response Format:**

```json
{
	"success": true,
	"data": {
		"connected": true,
		"deviceInfo": "hackrf_info version: 2022.09.1, libhackrf version: 2022.09.1 (0.7), Found HackRF...",
		"lastUpdate": 1751486873356
	},
	"timestamp": 1751486873356
}
```

### 2. Start Sweep

**Endpoint:** `POST /api/hackrf/start-sweep`
**Description:** Start a frequency sweep operation
**Request Format:**

```json
{
	"frequencies": [
		{ "value": 144, "unit": "MHz" },
		{ "value": 145, "unit": "MHz" }
	],
	"cycleTime": 5000 // Time in milliseconds per frequency
}
```

**Response Format (Success):**

```json
{
	"status": "success",
	"message": "Sweep started successfully",
	"frequencies": [
		{ "value": 144, "unit": "MHz" },
		{ "value": 145, "unit": "MHz" }
	],
	"cycleTime": 5000
}
```

**Response Format (Error):**

```json
{
	"status": "error",
	"message": "No frequencies provided" // or "Failed to start sweep"
}
```

### 3. Stop Sweep

**Endpoint:** `POST /api/hackrf/stop-sweep`
**Description:** Stop the current sweep operation
**Response Format:**

```json
{
	"success": true,
	"data": {
		"state": "stopping"
	},
	"timestamp": 1751487021959
}
```

### 4. Cycle Status

**Endpoint:** `GET /api/hackrf/cycle-status`
**Description:** Get current sweep status
**Response Format:**

```json
{
	"success": true,
	"data": {
		"state": "idle" // or "running", "stopping"
	},
	"timestamp": 1751487030743
}
```

### 5. Emergency Stop

**Endpoint:** `POST /api/hackrf/emergency-stop`
**Description:** Force stop all sweep operations immediately
**Response Format:**

```json
{
	"success": true,
	"data": {
		"stopped": true
	},
	"timestamp": 1751487081504
}
```

### 6. Force Cleanup

**Endpoint:** `POST /api/hackrf/force-cleanup`
**Description:** Clean up any lingering HackRF processes
**Response Format:**

```json
{
	"success": true,
	"data": {
		"cleaned": true
	},
	"timestamp": 1751487089982
}
```

### 7. Data Stream (SSE)

**Endpoint:** `GET /api/hackrf/data-stream`
**Description:** Server-Sent Events stream for real-time sweep data
**Headers:** `Accept: text/event-stream`
**Event Types:**

- `connected`: Initial connection confirmation
- `status`: Current sweep status
- `sweep_data`: Spectrum data from sweep
- `status_change`: Status change notifications
- `error`: Error events
- `cycle_config`: Cycle configuration
- `heartbeat`: Keep-alive messages (every 30 seconds)

**Example SSE Data:**

```
event: connected
data: {"message":"Connected to HackRF data stream","timestamp":"2025-07-02T20:10:07.549Z"}

event: status
data: {"state":"running","currentFrequency":144000000,"sweepProgress":0,"totalSweeps":2,"completedSweeps":0,"startTime":1751486997699}

event: sweep_data
data: {"timestamp":"2025-07-02T20:10:07.560Z","frequency":151.71568635,"power":-63.34,"unit":"MHz","binData":[-72.06,-74.63,...],"metadata":{"targetFrequency":{"value":145,"unit":"MHz"},"currentIndex":1,"totalFrequencies":2,"frequencyRange":{"low":150000000,"high":155000000,"center":152500000},"binWidth":98039.22,"signalStrength":"Weak"}}
```

## Behavioral Notes

### Frequency Cycling

- When multiple frequencies are provided, the system cycles through them automatically
- Default cycle time is 10 seconds (10000ms) per frequency
- Switching time between frequencies is calculated as 25% of cycle time (max 3 seconds)
- The sweep process is killed and restarted for each frequency change

### Frequency Units

- Supported units: Hz, KHz, MHz, GHz
- Default unit is MHz if not specified
- Frequencies are validated to be within HackRF range (1-7250 MHz)

### Error Handling

- Empty frequency array returns 400 error
- Out-of-range frequencies cause sweep start to fail
- Device busy errors occur when HackRF is in use by another process (e.g., OpenWebRX)
- The service includes automatic cleanup of orphaned processes

### Process Management

- Uses `hackrf_sweep` command with parameters:
    - `-f {freqMin}:{freqMax}` (frequency range in MHz)
    - `-g 20` (gain)
    - `-l 32` (LNA gain)
    - `-w 100000` (bin width)
- Processes are spawned with detached flag for better management
- Process group IDs are tracked for clean termination

### Session Management

- No authentication or session requirements detected
- CORS headers are set to allow cross-origin requests
- SSE connections can be closed by clients without affecting sweep operation

### Known Issues

1. **Device Busy**: OpenWebRX Docker container may hold the HackRF device
    - Solution: Stop OpenWebRX container before using sweep API
2. **SSE Connection Errors**: Closed SSE connections generate console errors but don't affect functionality
3. **Process Cleanup**: Sometimes requires force cleanup endpoint to clear stuck processes

## Testing Examples

```bash
# Check HackRF health
curl -s http://localhost:5173/api/hackrf/health | jq

# Start multi-frequency sweep
curl -s -X POST http://localhost:5173/api/hackrf/start-sweep \
  -H "Content-Type: application/json" \
  -d '{
    "frequencies": [
      {"value": 144, "unit": "MHz"},
      {"value": 433, "unit": "MHz"},
      {"value": 915, "unit": "MHz"}
    ],
    "cycleTime": 5000
  }' | jq

# Connect to SSE stream
curl -N -H "Accept: text/event-stream" http://localhost:5173/api/hackrf/data-stream

# Stop sweep
curl -X POST http://localhost:5173/api/hackrf/stop-sweep | jq

# Force cleanup
curl -X POST http://localhost:5173/api/hackrf/force-cleanup | jq
```

## Implementation Details

The service uses a singleton `SweepManager` class that:

- Maintains sweep state and process references
- Handles frequency cycling with timers
- Parses hackrf_sweep output and emits structured data
- Manages error recovery and device state tracking
- Provides EventEmitter interface for real-time updates

# Kismet Proxy API Documentation

## Overview

The Kismet proxy provides a secure interface to the Kismet REST API through the SvelteKit backend. It handles authentication, error handling, and data transformation.

## Configuration

The proxy reads configuration from environment variables:

- `KISMET_HOST` - Kismet server hostname (default: `localhost`)
- `KISMET_PORT` - Kismet server port (default: `2501`)
- `KISMET_API_KEY` - Kismet API key for authentication (required for most operations)

Example:

```bash
KISMET_API_KEY=your-api-key npm run dev
```

## API Endpoints

### Configuration & Status

#### GET /api/kismet/config

Returns proxy configuration and Kismet connection status.

Response:

```json
{
	"success": true,
	"data": {
		"proxy": {
			"host": "localhost",
			"port": "2501",
			"baseUrl": "http://localhost:2501",
			"apiKeyConfigured": true
		},
		"kismet": {
			"connected": true,
			"status": {
				/* Kismet system status */
			}
		}
	}
}
```

### Device Operations

#### GET /api/kismet/devices/list

Retrieve WiFi devices with optional filtering.

Query Parameters:

- `type` - Filter by device type: `AP`, `Client`, `Bridge`, `Unknown`
- `ssid` - Filter by SSID (partial match)
- `manufacturer` - Filter by manufacturer (partial match)
- `minSignal` - Minimum signal strength (dBm)
- `maxSignal` - Maximum signal strength (dBm)
- `seenWithin` - Devices seen within last N minutes

Example:

```
GET /api/kismet/devices/list?type=AP&minSignal=-70&seenWithin=5
```

Response:

```json
{
	"success": true,
	"data": [
		{
			"mac": "AA:BB:CC:DD:EE:FF",
			"ssid": "MyNetwork",
			"manufacturer": "Cisco",
			"type": "AP",
			"channel": 6,
			"frequency": 2437000000,
			"signal": -45,
			"firstSeen": "2024-01-01T12:00:00.000Z",
			"lastSeen": "2024-01-01T12:30:00.000Z",
			"packets": 1500,
			"dataPackets": 1200,
			"encryptionType": ["WPA2", "WPS"],
			"location": {
				"lat": 40.7128,
				"lon": -74.006,
				"alt": 10.5
			}
		}
	],
	"count": 1
}
```

#### GET /api/kismet/devices/stats

Get aggregated device statistics.

Response:

```json
{
	"success": true,
	"data": {
		"total": 50,
		"byType": {
			"AP": 10,
			"Client": 35,
			"Bridge": 2,
			"Unknown": 3
		},
		"byEncryption": {
			"WPA2": 8,
			"WPA3": 2,
			"Open": 5
		},
		"byManufacturer": {
			"Cisco": 5,
			"Apple": 15,
			"Samsung": 10
		},
		"activeInLast5Min": 25,
		"activeInLast15Min": 40
	}
}
```

### Generic Proxy Endpoints

#### /api/kismet/proxy/[...path]

Proxy any Kismet API endpoint directly.

Supported Methods: `GET`, `POST`, `PUT`, `DELETE`

Examples:

```
GET /api/kismet/proxy/system/status.json
GET /api/kismet/proxy/datasource/all_sources.json
POST /api/kismet/proxy/devices/views/all/devices.json
```

The proxy:

- Forwards requests to Kismet with proper authentication
- Handles all HTTP methods
- Preserves query parameters
- Supports JSON and text request bodies
- Returns wrapped responses with success/error status

## Error Handling

All endpoints return consistent error responses:

```json
{
	"success": false,
	"error": "Cannot connect to Kismet. Is it running?",
	"timestamp": "2024-01-01T12:00:00.000Z"
}
```

HTTP Status Codes:

- `200` - Success
- `500` - Server error
- `503` - Service unavailable (Kismet not running)

## Testing

Run the test script to verify functionality:

```bash
# Basic tests
node test-kismet-proxy.js

# With authentication
KISMET_API_KEY=your-key node test-kismet-proxy.js
```

## Security Notes

1. The API key is stored server-side and never exposed to the client
2. All requests are proxied through the backend for security
3. CORS is handled by the SvelteKit server
4. Input validation is performed on all filter parameters

## Common Kismet API Endpoints

Here are some useful Kismet endpoints accessible via the proxy:

- `/system/status.json` - System status and statistics
- `/datasource/all_sources.json` - List all data sources
- `/devices/views/all/devices.json` - All devices (POST with query)
- `/channels/channels.json` - Channel usage information
- `/messagebus/last-time/0/messages.json` - Recent messages
- `/alerts/definitions.json` - Alert definitions
- `/phy/phy80211/ssids/views/ssids.json` - SSID list

# Data Model: MIL-STD-2525 & TAK Integration

**Feature**: `005-milsymbol-tak-integration`
**Date**: 2026-02-17

## Entities

### TakServerConfig

_Configuration for connecting to a TAK Server instance._

| Field              | Type    | Required | Description                                      |
| ------------------ | ------- | -------- | ------------------------------------------------ |
| `id`               | UUID    | Yes      | Unique identifier for the configuration.         |
| `name`             | string  | Yes      | Human-readable name (e.g., "Team Server 1").     |
| `hostname`         | string  | Yes      | Hostname or IP address (e.g., `tak-server.com`). |
| `port`             | number  | Yes      | Port number (default: `8089`).                   |
| `protocol`         | enum    | Yes      | `tcp` or `tls`.                                  |
| `certPath`         | string  | No       | Path to client certificate (PEM) on server.      |
| `keyPath`          | string  | No       | Path to private key (PEM) on server.             |
| `caPath`           | string  | No       | Path to CA certificate (PEM) on server.          |
| `connectOnStartup` | boolean | Yes      | Whether to connect automatically.                |

### TakConnectionStatus

_Runtime status of the TAK connection._

| Field       | Type    | Description                                                           |
| ----------- | ------- | --------------------------------------------------------------------- |
| `connected` | boolean | Is the socket currently open?                                         |
| `state`     | enum    | `DISCONNECTED`, `CONNECTING`, `CONNECTED`, `AUTHENTICATING`, `ERROR`. |
| `lastError` | string? | Error message from the last failure.                                  |
| `latencyMs` | number  | Round-trip time to server.                                            |

### TakContact

_A remote entity tracked by the TAK server (User, Vehicle, Marker)._

| Field      | Type    | Description                                        |
| ---------- | ------- | -------------------------------------------------- |
| `uid`      | string  | Unique Identifier (CoT UID).                       |
| `callsign` | string  | Display name.                                      |
| `type`     | string  | CoT Type (e.g., `a-f-G-U-C-I`). Determines symbol. |
| `lat`      | number  | Latitude (WGS84).                                  |
| `lon`      | number  | Longitude (WGS84).                                 |
| `hae`      | number  | Height Above Ellipsoid (meters).                   |
| `course`   | number? | Heading (degrees).                                 |
| `speed`    | number? | Speed (m/s).                                       |
| `lastSeen` | ISO8601 | Timestamp of last update.                          |
| `team`     | string? | Team/Group name.                                   |
| `role`     | string? | Role (e.g., "Team Leader").                        |

### CotMessage

_Standard Cursor on Target XML structure (simplified for internal use)._

```typescript
interface CotMessage {
	event: {
		uid: string;
		type: string;
		time: string;
		start: string;
		stale: string;
		how: string;
		point: {
			lat: number;
			lon: number;
			hae: number;
			ce: number;
			le: number;
		};
		detail: {
			contact?: { callsign: string };
			track?: { course: number; speed: number };
			[key: string]: any;
		};
	};
}
```

## Storage Strategy

- **Configuration**: Stored in `rf_signals.db` (Table: `tak_configs`).
- **Certificates**: Stored in `data/certs/${configId}/`.
- **Contacts**: In-memory (server-side cache) + WebSocket push to frontend. Not persisted to DB to avoid stale data buildup (CoT relies on heartbeat).

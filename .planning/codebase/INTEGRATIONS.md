# External Integrations

> Mapped: 2026-02-24 | Source: .env.example, src/lib/server/services/, src/routes/api/

## Hardware Integrations

### HackRF One (SDR)

- **Interface**: `hackrf_sweep` CLI (spawned via `execFileAsync()`)
- **Service**: `src/lib/server/hackrf/sweep-manager.ts` (globalThis singleton)
- **Transport**: stdout binary data → EventEmitter → SSE (50ms throttle)
- **API**: `/api/hackrf/*` (6 routes) + `/api/rf/*` (5 routes) — both share the same singleton
- **Client**: `src/lib/hackrf/sweep-manager/` (BufferManager, ProcessManager, ErrorTracker, FrequencyCycler)

### Alfa WiFi Adapter

- **Interface**: Kismet REST API (polled every 2 seconds)
- **Service**: `src/lib/server/services/kismet/kismet-control-service.ts`
- **Transport**: REST poll → WebSocketManager fan-out → client WebSocket
- **API**: `/api/kismet/*` (6 routes)
- **Auth**: Kismet REST credentials (`KISMET_USER`, `KISMET_PASSWORD`, `KISMET_API_KEY`)

### GPS Dongle

- **Interface**: gpsd socket (TCP)
- **Service**: `src/lib/server/services/gps/gps-position-service.ts`, `gps-satellite-service.ts`
- **Pattern**: Circuit breaker (30s cooldown after 3 failures, 5s position cache)
- **API**: `/api/gps/*` (3 routes)
- **Supporting files**: `gps-socket.ts`, `gps-data-parser.ts`, `gps-satellite-circuit-breaker.ts`, `gps-response-builder.ts`, `gps-types.ts`

### GSM/GRGSM (SDR)

- **Interface**: `grgsm_livemon` CLI + GsmEvil2 Python scripts
- **Service**: `src/lib/server/services/gsm-evil/` (14 files)
- **Transport**: stdout stream parsing → SSE async generator
- **API**: `/api/gsm-evil/*` (12 routes including `intelligent-scan-stream`)
- **Config**: `GSMEVIL_DIR` env var for GsmEvil2 clone path

## External Service Integrations

### Kismet WiFi Scanner

- **URL**: `KISMET_API_URL` (default: `http://localhost:2501`)
- **Protocol**: REST API (HTTP POST with JSON/form bodies)
- **Auth**: Basic auth (`KISMET_REST_USER`/`KISMET_REST_PASSWORD`) + API key
- **WebSocket**: Proxied via SvelteKit WebSocket at `/api/kismet/ws`
- **Service files**: `kismet-service.ts`, `kismet-service-transform.ts`, `kismet-service-types.ts`, `kismet/kismet-control-service.ts`, `kismet/kismet-control-service-extended.ts`

### TAK Server (Cursor-on-Target)

- **Service**: `src/lib/server/tak/tak-service.ts` (globalThis singleton)
- **Protocol**: CoT over TLS (TCP with mutual TLS auth)
- **Features**: Certificate management, truststore import, enrollment
- **API**: `/api/tak/*` (6 routes: config, connection, certs, enroll, import-package, truststore)
- **Libraries**: `@tak-ps/node-cot`, `@tak-ps/node-tak`

### OpenCelliD

- **Purpose**: Cell tower geolocation lookup
- **Auth**: `OPENCELLID_API_KEY` env var
- **API**: `/api/cell-towers/nearby/+server.ts`
- **Service**: `src/lib/server/services/cell-towers/cell-tower-service.ts`

### Stadia Maps

- **Purpose**: Map tile serving
- **Auth**: `STADIA_MAPS_API_KEY` env var
- **API**: `/api/map-tiles/[...path]/+server.ts` (proxy)

### Weather Service

- **API**: `/api/weather/current/+server.ts`
- **Purpose**: Weather data proxy for mission planning overlay

## Docker-hosted Third-party Tools

### OpenWebRX

- **URL**: `PUBLIC_OPENWEBRX_URL` (default: `http://localhost:8073`)
- **API**: `/api/openwebrx/control/+server.ts`
- **Container**: Docker only (not native)

### Bettercap

- **Auth**: `BETTERCAP_USER`/`BETTERCAP_PASSWORD`
- **Container**: Docker only (not native)

## AI Integration

### Claude Sonnet 4 (AI Agent)

- **Provider**: Anthropic API
- **Model**: `claude-sonnet-4-20250514`
- **Runtime**: `src/lib/server/agent/runtime.ts`
- **API**: `/api/agent/stream/+server.ts` (SSE streaming), `/api/agent/status/+server.ts`

### MCP Servers (7 diagnostic servers)

- **Framework**: `@modelcontextprotocol/sdk` (1.26.0)
- **Base**: `src/lib/server/mcp/shared/base-server.ts`, `shared/api-client.ts`
- **Dynamic loader**: `src/lib/server/mcp/dynamic-server.ts`
- **Communication**: HTTP API to localhost:5173 (cannot import SvelteKit internals)
- **Servers**:
  | Server | File | Purpose |
  |---|---|---|
  | hardware-debugger | `servers/hardware-debugger.ts` | Hardware detection diagnostics |
  | system-inspector | `servers/system-inspector.ts` | System resource monitoring |
  | streaming-inspector | `servers/streaming-inspector.ts` | WebSocket/SSE diagnostics |
  | database-inspector | `servers/database-inspector.ts` | SQLite query/schema |
  | api-debugger | `servers/api-debugger.ts` | API endpoint testing |
  | test-runner | `servers/test-runner.ts` | Test execution |
  | gsm-evil | `servers/gsm-evil-server.ts` | GSM Evil diagnostics |

## Database

### SQLite (rf_signals.db)

- **Driver**: `better-sqlite3` (12.2.0) — synchronous, no ORM
- **Singleton**: `src/lib/server/db/database.ts` (RFDatabase, globalThis)
- **Migrations**: `scripts/db-migrate.ts` (via `tsx`)
- **Config**: `DATABASE_PATH` env var (default: `./rf_signals.db`)
- **API**: `/api/signals/*` (4 routes), `/api/database/*` (3 routes), `/api/db/*` (1 route)

## Environment Variables (Required)

| Variable         | Purpose                          | Validation                                 |
| ---------------- | -------------------------------- | ------------------------------------------ |
| `ARGOS_API_KEY`  | API authentication (fail-closed) | Zod: min 32 chars                          |
| `KISMET_API_URL` | Kismet server URL                | Zod: valid URL                             |
| `DATABASE_PATH`  | SQLite database path             | Zod: min 1 char, default `./rf_signals.db` |
| `NODE_ENV`       | Environment mode                 | Zod: enum development/production/test      |

Validated at startup by `src/lib/server/env.ts` using Zod. System exits if validation fails.

## Integration Patterns

1. **CLI wrapping**: Native tools (hackrf_sweep, grgsm_livemon) spawned via `execFileAsync()` — no shell, argument arrays only
2. **Service polling**: Kismet polled every 2s, results fanned out via WebSocket
3. **Circuit breaker**: GPS service uses 3-failure/30s-cooldown pattern
4. **SSE streaming**: HackRF (50ms throttle) and GSM Evil (async generator) use Server-Sent Events
5. **Singleton services**: Hardware services use `globalThis` keys for HMR survival
6. **Result tuples**: New code uses `safe()`/`safeSync()` from `src/lib/server/result.ts`

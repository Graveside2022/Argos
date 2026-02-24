# Architecture

> Mapped: 2026-02-24 | Source: src/hooks.server.ts, src/lib/server/, src/routes/api/

## Architectural Pattern

**Layered monolith** — SvelteKit application with clear server/client boundary:

```
┌─────────────────────────────────────────────────────────────────┐
│ Hardware Layer (native CLI tools on host OS)                     │
│   hackrf_sweep | gpsd | grgsm_livemon | Kismet | GsmEvil2       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ child process / TCP / REST
┌──────────────────────────▼──────────────────────────────────────┐
│ Service Layer (src/lib/server/services/, hackrf/, tak/)          │
│   SweepManager | GpsService | GsmEvilService | KismetService    │
│   TakService | CellTowerService | HardwareDetector              │
│   Pattern: globalThis singletons, circuit breakers, retry       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ function calls
┌──────────────────────────▼──────────────────────────────────────┐
│ API Layer (src/routes/api/) — 19 REST domains, ~63 routes       │
│   Auth gate → Rate limiter → Body size → Route handler          │
│   Patterns: createHandler() factory (6 routes) or try-catch     │
│   Transport: REST + SSE (hackrf, gsm-evil, agent) + WebSocket   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / SSE / WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│ Client Layer (src/lib/stores/, components/, websocket/)          │
│   14 Svelte stores (runes) ← BaseWebSocket + SSE EventSource    │
│   UI: Lunaris design system (Palantir tokens + shadcn bridge)   │
│   Map: MapLibre GL + MIL-STD-2525C symbology                    │
└─────────────────────────────────────────────────────────────────┘
```

## Security Architecture

Security is enforced in `src/hooks.server.ts` as a middleware pipeline:

1. **Fail-closed startup**: `validateSecurityConfig()` halts if `ARGOS_API_KEY` missing/short
2. **WebSocket auth**: Token query param or X-API-Key header (cookies NOT checked for WS)
3. **API auth**: X-API-Key header OR HMAC-derived `__argos_session` cookie
4. **Rate limiting**: 200 req/min API, 30 req/min hardware, 60 req/min Tailscale
5. **Body size limiting**: 10MB general, 64KB hardware control endpoints
6. **Security headers**: CSP, HSTS, X-Frame-Options via `applySecurityHeaders()`
7. **Auth audit logging**: All auth events logged via `logAuthEvent()`

Key security files:

- `src/lib/server/auth/auth-middleware.ts` — API key + HMAC cookie validation
- `src/lib/server/security/input-sanitizer.ts` — 6 input validators (IP, hostname, interface, PID, path, string)
- `src/lib/server/security/auth-audit.ts` — Auth event logging
- `src/lib/server/middleware/rate-limit-middleware.ts` — Rate limiting
- `src/lib/server/middleware/security-headers.ts` — CSP + security headers
- `src/lib/server/middleware/ws-connection-handler.ts` — WebSocket connection handling

Only unauthenticated endpoint: `/api/health`

## Data Flow Patterns

### Pattern 1: CLI Wrapper → SSE (HackRF, GSM Evil)

```
Native CLI (stdout) → Service singleton (EventEmitter) → API route → SSE → Client store
```

- HackRF: `hackrf_sweep` → `SweepManager` → `/api/hackrf/data-stream` (50ms throttle)
- GSM Evil: `grgsm_livemon` → `GsmEvilService` → `/api/gsm-evil/intelligent-scan-stream` (async generator)

### Pattern 2: REST Poll → WebSocket Fan-out (Kismet)

```
Kismet REST API (2s poll) → KismetService → WebSocketManager → ws clients → Client store
```

### Pattern 3: Socket Client → REST API (GPS)

```
gpsd (TCP socket) → GpsService (circuit breaker, 5s cache) → /api/gps/* → Client store
```

### Pattern 4: TLS Connection (TAK)

```
TAK Server (mutual TLS) ↔ TakService (auto-reconnect) → /api/tak/* → Client store
```

## Singleton Pattern

Server-side state survives Vite HMR via `globalThis` string keys:

```typescript
const KEY = '__argos_sweepManager';
const g = globalThis as Record<string, unknown>;
export const sweepManager: SweepManager =
	(g[KEY] as SweepManager) ?? ((g[KEY] = new SweepManager()) as SweepManager);
```

Used by: SweepManager, WebSocketManager, RateLimiter, RFDatabase, TakService, HardwareMonitor

## Error Handling Strategy

Three co-existing patterns (from newest to oldest):

| Pattern                  | Location                               | Usage                                                                 |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------- |
| `safe()` / `safeSync()`  | `src/lib/server/result.ts`             | Result tuple `[data, null] \| [null, Error]` — preferred for new code |
| `createHandler()`        | `src/lib/server/api/create-handler.ts` | Route factory with Zod validation — 6 routes                          |
| `try-catch` + `errMsg()` | `src/lib/server/api/error-utils.ts`    | Legacy pattern — ~60 routes                                           |

Supporting utilities:

- `withRetry()` (`src/lib/server/retry.ts`) — Exponential/linear backoff, configurable predicate
- `withTimeout()` (`src/lib/server/timeout.ts`) — Promise timeout wrapper
- `normalizeError()` (`src/lib/server/api/error-utils.ts`) — Non-Error to Error conversion

## Circular Dependency Resolution

8 cycles broken by extracting shared types into dedicated `*-types.ts` files:

- `gsm-evil-types.ts`, `gsm-scan-types.ts`, `gps-types.ts`, `kismet-service-types.ts`
- Import the types file (not the service) when only type information is needed

## Real-time Transport

| Transport | Endpoints                                        | Library                                 | Notes                                         |
| --------- | ------------------------------------------------ | --------------------------------------- | --------------------------------------------- |
| WebSocket | `/api/kismet/ws`                                 | `ws` (server), `BaseWebSocket` (client) | 256KB payload, heartbeat, exponential backoff |
| SSE       | `/api/hackrf/data-stream`, `/api/rf/data-stream` | Native Response stream                  | 50ms throttle via EventEmitter                |
| SSE       | `/api/gsm-evil/intelligent-scan-stream`          | Async generator → ReadableStream        | Variable rate                                 |
| SSE       | `/api/agent/stream`                              | Native Response stream                  | AI agent streaming                            |

## Deployment Architecture

- **Native execution** on Raspberry Pi 5 (no Docker for main app)
- **Systemd services**: 10 unit files in `deployment/`
- **Docker**: Only for OpenWebRX + Bettercap (third-party tools)
- **Dev server**: tmux session with OOM protection (`vite-oom-protect.sh`)
- **Keepalive**: `argos-dev-monitor.service` polls port 5173 every 10s
- **Memory protection**: earlyoom + zram + cgroup v2 limits

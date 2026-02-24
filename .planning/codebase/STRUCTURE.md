# Directory Structure

> Mapped: 2026-02-24 | Source: filesystem analysis, 1,169 files total

## Top-Level Layout

```
Argos/
├── src/                           # Application source
│   ├── routes/                    # SvelteKit file-based routing
│   ├── lib/                       # Shared library code ($lib alias)
│   ├── hooks.server.ts            # Security middleware chain + WebSocket upgrade
│   ├── hooks.client.ts            # Client-side error handling
│   ├── app.css                    # Global styles (Tailwind + Lunaris tokens)
│   └── app.html                   # HTML shell template
├── tests/                         # Test suites (separate from src/)
├── config/                        # Build & tool configuration
├── scripts/                       # Operations & dev scripts
├── deployment/                    # Systemd service files (10)
├── docs/                          # Documentation
├── specs/                         # Feature specifications
├── plans/                         # Integration & UI plans
├── static/                        # Static assets
├── _bmad/                         # BMAD framework tooling (not app code)
├── .planning/                     # GSD planning documents
└── .claude/                       # Claude Code configuration
```

## Source Directory (`src/`)

### Routes (`src/routes/`)

SvelteKit file-based routing. 19 API domains + 2 pages.

```
routes/
├── api/                           # REST API endpoints (~63 +server.ts files)
│   ├── hackrf/                    # HackRF sweep (6 routes: start, stop, emergency-stop, status, data-stream, root)
│   ├── rf/                        # RF signal CRUD (5 routes, shares sweepManager singleton)
│   ├── kismet/                    # Kismet proxy (6 routes: devices, status, start, stop, control, ws)
│   ├── gsm-evil/                  # GSM monitoring (12 routes: scan, status, control, frames, imsi, etc.)
│   ├── gps/                       # GPS (3 routes: position, location, satellites)
│   ├── tak/                       # TAK server (6 routes: config, connection, certs, enroll, import, truststore)
│   ├── signals/                   # Signal DB (4 routes: root, batch, statistics, cleanup)
│   ├── system/                    # System info (8 routes: info, stats, metrics, memory, services, logs, docker)
│   ├── hardware/                  # Hardware detection (3 routes: scan, status, details)
│   ├── agent/                     # AI agent (2 routes: stream, status)
│   ├── terminal/                  # Terminal (1 route: shells)
│   ├── weather/                   # Weather proxy (1 route: current)
│   ├── cell-towers/               # Cell tower lookup (1 route: nearby)
│   ├── database/                  # DB admin (3 routes: query, schema, health)
│   ├── db/                        # DB cleanup (1 route)
│   ├── map-tiles/                 # Map tile proxy (1 route: [...path])
│   ├── openwebrx/                 # OpenWebRX proxy (1 route: control)
│   ├── streaming/                 # Stream status (1 route: status)
│   └── health/                    # Health check (1 route, unauthenticated)
├── dashboard/                     # Dashboard page (keep-alive tab pattern)
│   ├── +page.svelte
│   └── +page.ts
├── gsm-evil/                      # GSM monitoring page (rendered as iframe)
│   ├── +page.svelte
│   └── +layout.svelte
└── +page.svelte                   # Root page (redirects to dashboard)
```

### Library (`src/lib/`)

```
lib/
├── server/                        # Server-only code (never imported client-side)
│   ├── services/                  # Hardware/protocol service wrappers
│   │   ├── gps/                   # GPS service (7 files)
│   │   ├── gsm-evil/              # GSM Evil service (14 files)
│   │   ├── kismet/                # Kismet service (2 files)
│   │   ├── cell-towers/           # Cell tower service (1 file)
│   │   ├── hardware/              # Hardware details service (2 files)
│   │   ├── kismet-service.ts      # Top-level Kismet service
│   │   ├── kismet-service-transform.ts
│   │   └── kismet-service-types.ts
│   ├── hackrf/                    # SweepManager singleton
│   │   └── sweep-manager.ts
│   ├── hardware/                  # Hardware detection & monitoring
│   │   └── detection/             # USB/serial/network scanner
│   ├── auth/                      # Authentication middleware
│   │   └── auth-middleware.ts
│   ├── security/                  # Input sanitizer + audit
│   │   ├── input-sanitizer.ts
│   │   └── auth-audit.ts
│   ├── middleware/                 # Rate limiting, security headers, WS handler
│   │   ├── rate-limit-middleware.ts
│   │   ├── security-headers.ts
│   │   └── ws-connection-handler.ts
│   ├── db/                        # RFDatabase singleton
│   │   └── database.ts
│   ├── kismet/                    # WebSocketManager singleton
│   │   └── web-socket-manager.ts
│   ├── tak/                       # TakService (CoT over TLS)
│   │   └── tak-service.ts (+ cert-manager, tak-package-parser, etc.)
│   ├── mcp/                       # 7 MCP diagnostic servers
│   │   ├── shared/                # base-server.ts, api-client.ts
│   │   ├── servers/               # 7 server implementations
│   │   ├── dynamic-server.ts      # Server loader
│   │   └── config-generator.ts
│   ├── api/                       # Shared API utilities
│   │   ├── error-utils.ts         # errMsg(), normalizeError()
│   │   └── create-handler.ts      # Route handler factory
│   ├── agent/                     # AI agent runtime
│   │   └── runtime.ts
│   ├── env.ts                     # Zod-validated environment variables
│   ├── exec.ts                    # execFileAsync() (safe child process)
│   ├── result.ts                  # safe()/safeSync() Result tuples
│   ├── retry.ts                   # withRetry() HOF
│   └── timeout.ts                 # withTimeout() HOF
├── components/                    # Svelte 5 UI components
│   ├── dashboard/                 # Dashboard components
│   │   ├── map/                   # MapLibre GL integration
│   │   ├── panels/                # Overview, Tools, Layers, Settings
│   │   └── tak/                   # TAK server config (6 components)
│   ├── gsm-evil/                  # GSM monitoring UI (6 components)
│   ├── status/                    # Status indicators
│   └── ui/                        # 8 shadcn-svelte families (36 files)
│       ├── alert-dialog/
│       ├── badge/
│       ├── button/
│       ├── input/
│       ├── select/
│       ├── separator/
│       ├── switch/
│       └── table/
├── stores/                        # 14 Svelte stores
│   ├── dashboard/                 # dashboard-store, terminal-store, tools-store, map-settings-store, agent-context-store
│   ├── tactical-map/              # gps-store, kismet-store, hackrf-store, map-store
│   ├── gsm-evil-store.ts
│   ├── tak-store.ts
│   ├── theme-store.svelte.ts
│   ├── connection.ts
│   └── persisted-writable.ts
├── hackrf/                        # Client-side sweep manager
│   └── sweep-manager/             # BufferManager, ProcessManager, ErrorTracker, FrequencyCycler
├── types/                         # 13 TypeScript type definition files
├── schemas/                       # 6 Zod validation schemas (api, database, hardware, kismet, rf, stores)
├── map/                           # Map utilities
│   ├── symbols/                   # MIL-STD-2525C symbol-factory.ts
│   ├── layers/                    # satellite-layer.ts, symbol-layer.ts
│   └── visibility-engine.ts
├── data/                          # Static data (tool-hierarchy, carrier mappings)
├── utils/                         # Logger, validation, signal processing, CoT parser
├── websocket/                     # BaseWebSocket (exponential backoff, heartbeat)
│   └── base.ts
└── styles/                        # palantir-design-system.css (Lunaris token bridge)
```

## Test Directory (`tests/`)

```
tests/
├── unit/                          # Unit tests (complements src/ co-located tests)
├── integration/                   # API + WebSocket integration (app.test.ts, api.test.ts, websocket.test.ts)
├── security/                      # 7 security test files (auth, injection, rate-limit, cors, headers, ws-auth, property-based, body-size, validation)
├── e2e/                           # Playwright E2E (smoke, user-flows, verify-kismet-ui)
├── visual/                        # Puppeteer + pixelmatch visual regression
├── performance/                   # Benchmarks (tak-markers, persistence, store, general)
├── load/                          # Load tests (dataVolumes)
└── setup.ts                       # Global mocks (WebSocket, fetch, localStorage, canvas, ResizeObserver)
```

## Configuration (`config/`)

| File                      | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `vite.config.ts`          | Tailwind + SvelteKit + terminal plugin + code splitting          |
| `eslint.config.js`        | Flat config: complexity ≤5, sonarjs cognitive ≤5, import sorting |
| `playwright.config.ts`    | E2E test configuration                                           |
| `vite-plugin-terminal.ts` | Custom Vite plugin for embedded terminal (node-pty)              |

## Scripts (`scripts/`)

```
scripts/
├── ops/                           # Production operations
│   ├── setup-host.sh              # Host provisioning (idempotent, Kali + Parrot OS)
│   ├── install-services.sh        # Install systemd services
│   └── keepalive-dev.sh           # Dev server keepalive daemon
├── dev/                           # Development scripts
│   ├── vite-oom-protect.sh        # OOM protection wrapper for Vite
│   ├── kill-dev.sh                # Kill dev server
│   └── auto-start-kismet.sh       # Auto-start Kismet
├── db-migrate.ts                  # Database migration runner
└── tmux-zsh-wrapper.sh            # Terminal store default shell
```

## Deployment (`deployment/`)

10 systemd service files with `__PROJECT_DIR__` tokens:

| Service                         | Purpose                      |
| ------------------------------- | ---------------------------- |
| `argos-dev.service`             | Dev server (Vite)            |
| `argos-dev-monitor.service`     | Dev server keepalive monitor |
| `argos-final.service`           | Production application       |
| `argos-kismet.service`          | Kismet WiFi scanner          |
| `argos-headless.service`        | Headless mode                |
| `argos-cpu-protector.service`   | CPU protection               |
| `argos-wifi-resilience.service` | WiFi reconnection            |
| `argos-droneid.service`         | Drone ID detection           |
| `argos-process-manager.service` | Process manager              |
| `gsmevil-patch.service`         | GSM Evil patches             |

## Naming Conventions

| Context             | Convention                   | Example                                       |
| ------------------- | ---------------------------- | --------------------------------------------- |
| Files               | kebab-case                   | `gps-position-service.ts`                     |
| Variables/Functions | camelCase                    | `sweepManager`, `getSweepManager()`           |
| Types/Interfaces    | PascalCase                   | `RetryOptions`, `SweepManager`                |
| Constants           | UPPER_SNAKE_CASE             | `MAX_BODY_SIZE`, `HARDWARE_PATH_PATTERN`      |
| Booleans            | is/has/should prefix         | `isKismetWsUpgrade`, `hasAttemptsLeft`        |
| SvelteKit routes    | `+page.svelte`, `+server.ts` | Standard convention                           |
| Test files          | `.test.ts` suffix            | `result.test.ts`                              |
| Type files          | `-types.ts` suffix           | `gsm-evil-types.ts` (circular dep resolution) |

## Key Locations Quick Reference

| Need to...           | Look at...                                                       |
| -------------------- | ---------------------------------------------------------------- |
| Add API route        | `src/routes/api/<domain>/+server.ts`                             |
| Add component        | `src/lib/components/<area>/<name>.svelte`                        |
| Add store            | `src/lib/stores/<name>-store.ts`                                 |
| Add service          | `src/lib/server/services/<domain>/`                              |
| Add schema           | `src/lib/schemas/<name>.ts`                                      |
| Add type             | `src/lib/types/<name>.ts`                                        |
| Add test             | `src/` (co-located) or `tests/<type>/`                           |
| Modify auth          | `src/lib/server/auth/auth-middleware.ts` + `src/hooks.server.ts` |
| Modify env           | `src/lib/server/env.ts` + `.env.example`                         |
| Modify design tokens | `src/lib/styles/palantir-design-system.css` + `src/app.css`      |

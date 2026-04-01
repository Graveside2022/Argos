# CLAUDE.md

<!-- SKIP AUTO-UPDATE -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- MANUAL ADDITIONS START -->

## Svelte MCP

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

### Available Svelte MCP Tools:

#### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

#### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

#### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

#### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.

## Codebase Overview

SvelteKit SDR & Network Analysis Console for Army EW training on RPi 5. Wraps native CLI tools (hackrf_sweep, gpsd, Kismet, grgsm_livemon) into a real-time web dashboard with WebSocket push, MapLibre GL mapping, and MIL-STD-2525C symbology.

**Stack**: SvelteKit 2 + Svelte 5 runes, TypeScript strict, Tailwind CSS, better-sqlite3, MapLibre GL, ws (WebSocket), node-pty
**Structure**: 754 files across 19 API domains (66 routes, 53 using createHandler), 17 stores, 8 UI component families (35 files), 5 MCP servers

For detailed architecture, module guide, data flows, and navigation guide, see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

IMPORTANT: READ THE CODEBASE_MAP.md before you begin any work. /home/kali/Documents/Argos/Argos/docs/CODEBASE_MAP.md

## Tactical AI Kill Chain Framework

The `tactical/` directory contains an autonomous pentesting framework with **82 Python modules** wrapping Kali Linux security tools, **13 workflow playbooks**, and a TypeScript module runner. For tactical operations (scanning, exploitation, AD attacks, OSINT, forensics, SDR/SIGINT), read the full agent context:

IMPORTANT: READ tactical/CLAUDE.md before any tactical/security work. It contains the complete module inventory, workflow list, database schema, and execution rules.

```bash
# Execute any tactical module
npx tsx tactical/modules/module_runner.ts <module> [args...]

# List all 82 available modules
npx tsx tactical/modules/module_runner.ts --runner-help

# Read a workflow playbook before executing
cat tactical/workflows/<ID>_<name>.md
```

## Commands

```bash
# Dev server (tmux + OOM protection)
npm run dev              # Start in tmux session with oom_score_adj=-500
npm run dev:simple       # Direct vite start (no tmux, lower memory limit)
npm run dev:clean        # Kill existing + restart fresh
npm run dev:logs         # Tail dev server output

# Build & check
npm run build            # Production build (catches errors tsc alone misses)
npm run typecheck        # svelte-check + tsc (uses ~650MB RAM — never run concurrent instances)
npm run lint             # ESLint with config/eslint.config.js
npm run lint:fix         # Auto-fix

# Testing
npx vitest run src/path/to/file.test.ts     # Single test file
npm run test:unit                            # All unit tests (src/ + tests/unit/)
npm run test:integration                     # tests/integration/
npm run test:security                        # tests/security/
npm run test:e2e                             # Playwright (config/playwright.config.ts)
npm run test:all                             # unit + integration + visual + performance

# Database
npm run db:migrate       # Run SQLite migrations
npm run db:rollback      # Rollback last migration

# File-scoped verification (use these before committing)
npx tsc --noEmit src/lib/FILE.ts
npx eslint src/lib/FILE.ts --config config/eslint.config.js
npx vitest run src/lib/FILE.test.ts
```

## Architecture

**Argos is a SvelteKit SDR & Network Analysis Console** deployed natively on Raspberry Pi 5 (Kali Linux). No Docker for the main app — Docker is only for third-party tools (OpenWebRX, Bettercap).

### Data Flow

```
Hardware (HackRF/Alfa/GPS)
  → src/lib/server/services/        # Hardware/protocol services (native CLI wrappers)
  → src/lib/server/hardware/        # Hardware detection & monitoring
  → src/routes/api/*/+server.ts     # REST API endpoints
  → WebSocket (src/hooks.server.ts) # Real-time push via WebSocketManager
  → src/lib/stores/                 # Client-side Svelte stores
  → src/lib/components/             # UI components
```

### Key Architectural Patterns

**Server-side services** (`src/lib/server/services/`): Hardware and protocol services that wrap native CLI tools (hackrf_sweep, gpsd, Kismet). These run as server-only code — never import from `$app/` or client stores.

**API authentication is fail-closed**: `ARGOS_API_KEY` env var is required (min 32 chars). System exits at startup without it. All `/api/*` routes (except `/api/health`) require either `X-API-Key` header or HMAC-derived session cookie. WebSocket auth uses query param `?token=` or header.

**Environment validation**: `src/lib/server/env.ts` uses Zod to validate env vars at startup. Import this module to get typed access to `env.DATABASE_PATH`, `env.KISMET_API_URL`, etc.

**Database**: Direct `better-sqlite3` calls against `rf_signals.db`. No ORM, no thin data-access wrappers. Migrations in `scripts/db-migrate.ts`.

**Security middleware stack** in `src/hooks.server.ts`: Auth gate → Rate limiter → Body size limiter → CSP headers. Rate limits: 200 req/min for API, 30 req/min for hardware control (60 req/min for Tailscale clients to accommodate GSM Evil rapid calls).

**MCP servers** (`src/lib/server/mcp/`): 5 always-on diagnostic servers for Claude Code integration (system-inspector, database-inspector, api-debugger, plus tailwindcss and svelte-remote). Additional servers (hardware-debugger, streaming-inspector, gsm-evil, test-runner) available via `--mcp-profile hardware` or `full`. They communicate with the running app via HTTP API (localhost:5173) — they cannot import SvelteKit internals.

### Source Layout

```
src/
├── routes/                    # SvelteKit file-based routing
│   ├── api/                   # 19 API domains (hackrf, kismet, gsm-evil, gps, tak, etc.)
│   ├── dashboard/             # Dashboard page
│   ├── gsm-evil/              # GSM monitoring page
│   └── +page.svelte           # Root page
├── lib/
│   ├── server/                # Server-only code (services, auth, db, hardware, security)
│   ├── components/            # Svelte components (dashboard, gsm-evil, status, ui/)
│   ├── stores/                # Svelte stores (connection, dashboard, gsm-evil, tak, theme)
│   ├── types/                 # TypeScript type definitions
│   ├── schemas/               # Zod validation schemas
│   ├── websocket/             # Client-side WebSocket utilities
│   └── utils/                 # Logger and shared utilities
├── hooks.server.ts            # Auth, rate limiting, WebSocket, CSP, security headers
└── hooks.client.ts            # Client-side error handling
config/                        # Vite, ESLint, Playwright, terminal plugin configs
tests/                         # unit/, integration/, security/, e2e/, visual/, performance/
scripts/ops/                   # setup-host.sh (provisioning), install-services.sh, keepalive
deployment/                    # Systemd service files
tactical/                      # AI kill chain framework
├── modules/                   # 82 Python tool wrappers + module_runner.ts
├── workflows/                 # 13 step-by-step playbooks (00-12)
├── wordlists/                 # Default credential files
└── CLAUDE.md                  # Agent context (full module inventory)
```

## Code Conventions

**TypeScript strict mode** is non-negotiable. No `any` (use `unknown` + type guards). No `@ts-ignore` without issue ID.

**Naming**: camelCase (vars/funcs), PascalCase (Types/Components), UPPER_SNAKE_CASE (constants), kebab-case (files). Booleans use `is/has/should` prefix.

**No barrel files** (`index.ts`) except for `src/lib/components/ui/` (shadcn-svelte). Import directly from the source file.

**No catch-all utils files** (`utils.ts`, `helpers.ts`). Place utility functions in domain-specific modules.

**File limits**: Max 300 lines/file, max 50 lines/function. Single responsibility per file.

**Error handling**: Explicit handling for all external operations. Typed error classes. No swallowed errors. User-visible errors must suggest corrective action.

**Component state handling**: Every component must handle ALL states: Empty, Loading, Default, Active, Error, Success, Disabled, Disconnected.

## Design System — Lunaris

The UI follows the **Lunaris design language** — a military-grade enterprise dashboard aesthetic (not cyberpunk). The definitive visual reference is `pencil-lunaris.pen` and the spec at `specs/012-lunaris-ui-redesign/design-reference.md`.

**Dark mode only**. Light mode removed.

### Color Architecture

Three layers in `src/app.css`, bridged via `src/lib/styles/palantir-design-system.css`:

- **Surface tokens**: `--background` (#111111), `--card` (#1A1A1A), `--border` (#2E2E2E) — deep black base with subtle layered depth
- **Accent**: Steel blue (#A8B8E0 default, Blue ★) — swappable via `--primary` across 13 MIL-STD palette themes. Used for brand text, progress bars, active indicators, AP markers
- **Semantic status** (independent of accent): Healthy #8BBFA0 (muted sage), Warning #D4A054 (warm gold), Error #FF5C33 (high-vis) / #C45B4A (desaturated panel), Inactive #555555

All colors must reference design tokens — no hardcoded hex in component markup. Status colors are always desaturated to harmonize with the dark theme. Color must never be the sole status indicator — always pair with a text label.

### Typography

Dual-font system, not monospace-only:

- **Fira Code** (monospace): ALL data — metrics, labels, IPs, coordinates, status text, section headers, command bar
- **Geist** (sans-serif): Tab labels, UI navigation chrome, weather text only

Six-step size scale: 24px (hero metrics) → 13px (brand) → 12px (secondary data) → 11px (primary rows) → 10px (status text) → 9px (section headers, UPPERCASE with letter-spacing 1.2+)

### Layout Structure

48px icon rail → 280px overview panel → fill map area → 240px bottom panel. 40px command bar fixed top. All spacing uses consistent tokens — no ad-hoc pixel values.

### Icons

Lucide for all navigation and status icons. Material Symbols Sharp for the bottom panel collapse caret only.

## Platform Constraints

**Target hardware**: Raspberry Pi 5 (8GB RAM, ARM Cortex-A76). Memory is scarce.

**OOM risk**: `svelte-check` uses ~650MB. Never run multiple instances concurrently. The `git-quality-gate.sh` hook runs typecheck before commits; no auto-typecheck on every edit.

**Performance budgets**: WebSocket messages < 16ms processing. Initial load < 3s. < 200MB heap. < 15% CPU. Use WebSockets over polling.

**Native execution**: Argos runs directly on the host OS, not in Docker. `src/lib/server/exec.ts` provides `execFileAsync()` for safe child process execution (no shell, argument arrays only).

## Git Workflow

**Branch naming**: `feature/NNN-feature-name` or `NNN-feature-name`.

**Commits**: One commit per task. Format: `type(scope): TXXX — description`. Never commit broken code.

**Forbidden**: WIP commits, mega commits, generic messages, force-push.

**Spec-kit workflow**: Features follow `spec.md` → `plan.md` → `tasks.md` in `specs/NNN-feature-name/`. CLAUDE.md is auto-updated by `.specify/scripts/bash/update-agent-context.sh` — but this file is protected by the SKIP AUTO-UPDATE marker above.

## Dependencies

No `npm install` without user approval. Pin exact versions. No ORMs. No CSS frameworks beyond Tailwind. No state management libraries (Redux/Zustand). No lodash.

<!-- MANUAL ADDITIONS END -->

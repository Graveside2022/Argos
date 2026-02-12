# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Argos — SDR & Network Analysis Console

Production-grade SvelteKit application for Army EW training, deployed on Raspberry Pi 5. Real-time RF spectrum analysis, WiFi intelligence, GPS tracking, and tactical mapping.

## Quick Start for Claude

When starting work on Argos, execute these commands to verify environment:

```bash
# 1. Verify you're in the correct directory
pwd  # Should be: /home/kali/Documents/Argos/Argos

# 2. Check environment setup
[ -f .env ] && echo "✓ .env exists" || echo "✗ .env missing - copy from .env.example"

# 3. Verify Node.js version
node --version  # Must be 20.x

# 4. Quick health check
npm run typecheck && echo "✓ Types valid" || echo "✗ Type errors exist"
```

This ensures you understand the project state before making changes.

## CRITICAL SECURITY RULES

**FAIL-CLOSED DESIGN — System refuses to start without proper security configuration.**

<security_rules>
<rule priority="critical" category="authentication">
  <name>Never bypass authentication</name>
  <scope>All /api/* routes except /api/health</scope>
  <enforcement>src/hooks.server.ts:27-30 validates before server starts</enforcement>
  <consequence>System refuses to start without ARGOS_API_KEY</consequence>
</rule>

<rule priority="critical" category="input_validation">
  <name>Always validate inputs before shell execution</name>
  <library>src/lib/server/security/input-sanitizer.ts</library>
  <pattern>Use execFile() with array args, never exec() with string interpolation</pattern>
  <validators>validatePid, validateInterfaceName, validateFrequency, validateNumericRange, sanitizeString, sanitizeFilePath</validators>
  <example>
    // ❌ WRONG - Shell injection risk
    exec(`hackrf_sweep -f ${userInput}`);

    // ✅ RIGHT - Validated + execFile
    const freq = validateFrequency(userInput);
    execFile('hackrf_sweep', ['-f', freq.toString()]);
  </example>
</rule>

<rule priority="critical" category="secrets">
  <name>Never commit secrets</name>
  <storage>.env file (gitignored)</storage>
  <generation>openssl rand -hex 32</generation>
  <validation>ARGOS_API_KEY must be min 32 chars</validation>
</rule>

<rule priority="critical" category="sql">
  <name>Always use parameterized queries</name>
  <rationale>SQLite injection is real</rationale>
  <pattern>Use prepared statements, never template SQL strings</pattern>
</rule>

<rule priority="high" category="rate_limiting">
  <name>Hardware endpoints MUST have rate limiting</name>
  <pattern>/api/(hackrf|kismet|gsm-evil|rf)/</pattern>
  <limit>64KB body limit enforced at src/hooks.server.ts</limit>
</rule>
</security_rules>

## Tech Stack

TypeScript 5.8.3, SvelteKit 2.22.3, Svelte 5.35.5, Tailwind CSS 3.4.15, SQLite (better-sqlite3), Vite 7.0.3, Vitest 3.2.4, Playwright 1.53.2

**Deployed on:** Raspberry Pi 5 (8GB RAM, NVMe SSD), Kali Linux 2025.4, Docker v27.5.1

**Hardware Requirement:** USB 3.0 powered hub REQUIRED — Pi cannot power HackRF + Alfa adapter + GPS simultaneously without it.

## Commands

```bash
# Development
npm run dev                  # Start dev server (port 5173, auto-validates .env)
npm run dev:clean            # Kill existing processes and start fresh
npm run dev:auto-kismet      # Auto-start Kismet before dev server
npm run dev:full             # Start all services (full stack)
npm run kismet:start         # Manually start Kismet with Alfa adapter
npm run kill-all             # Emergency: kill all Node/Python processes

# Testing & Quality
npm run test                 # Run all tests (Vitest)
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests
npm run test:security        # Security tests
npm run test:e2e             # Playwright E2E tests
npm run test:smoke           # Quick smoke test
npm run typecheck            # TypeScript validation
npm run lint                 # ESLint check
npm run lint:fix             # Auto-fix ESLint errors

# Framework Validation (CSS/HTML/Visual Integrity)
npm run framework:validate-all    # Run all framework checks
npm run framework:check-css       # CSS integrity check
npm run framework:check-html      # HTML structure validation
npm run framework:check-visual    # Visual regression testing

# Database
npm run db:migrate           # Run migrations
npm run db:rollback          # Rollback last migration

# MCP Servers (7 specialized diagnostic servers)
npm run mcp:system           # System health diagnostics
npm run mcp:streaming        # SSE/WebSocket stream debugging
npm run mcp:hardware         # HackRF/Kismet/GPS unified diagnostics
npm run mcp:database         # SQLite schema & query inspection
npm run mcp:api              # API endpoint testing & debugging
npm run mcp:test             # Test suite execution & validation
npm run mcp:gsm-evil         # GSM monitoring & IMSI capture
npm run mcp:install-b        # Install all MCP servers (host)
npm run mcp:install-c        # Install all MCP servers (container)
```

**Note:** Each Claude Code instance spawns all configured MCP servers (~30 processes, ~800MB RAM). Avoid running multiple Claude instances simultaneously on RPi5.

### MCP Server Usage Guide

**System Diagnostics:**
- `system-inspector` (5 tools) - Use FIRST for performance issues, crashes, Docker health, memory pressure, or multi-service errors
- `streaming-inspector` (3 tools) - Debug SSE/WebSocket issues (HackRF FFT stream, GSM scan progress, connection failures)
- `hardware-debugger` (5 tools) - Unified HackRF/Kismet/GPS diagnostics, USB conflicts, resource locks (consolidated from 3 separate servers)

**Development Tools:**
- `database-inspector` (5 tools) - Safe read-only queries, schema inspection, R-tree debugging (auto-blocks INSERT/UPDATE/DELETE, max 1000 rows)
- `api-debugger` (3 tools) - Test 58 API endpoints, diagnose auth/CORS issues, connectivity checks
- `test-runner` (3 tools) - Run unit/integration/e2e tests, typecheck, lint (use before commits/PRs)

**RF Operations:**
- `gsm-evil` (7 tools) - GSM monitoring, IMSI capture, tower scanning (requires exclusive HackRF access)

**Critical Rules:**
- All servers require `ARGOS_API_KEY` environment variable
- Use `system-inspector` first for any system-level investigation
- Use `hardware-debugger` when multiple RF devices might conflict
- Use `database-inspector` for queries, never direct SQL
- See @docs/mcp-servers.md for detailed tool documentation

## Project Structure

```
src/routes/api/              # REST API endpoints (feature-organized)
  ├── hackrf/                # HackRF spectrum analysis
  ├── kismet/                # WiFi scanning
  ├── gsm-evil/              # GSM monitoring
  └── agent/                 # Agent integration
src/lib/server/              # Server-only code (auth, security, WebSocket)
  ├── security/              # Input sanitization, rate limiting, CORS
  ├── mcp/                   # MCP server implementation (7 modular servers)
  └── hardware/              # Hardware detection and management
src/lib/stores/              # Svelte stores (reactive state)
src/lib/components/          # Reusable Svelte 5 components
tests/                       # unit/, integration/, e2e/, visual/, performance/
scripts/                     # Shell scripts for hardware management
config/                      # Vite, ESLint, Tailwind, terminal plugin
```

**Key Patterns:**
- **Service Layer**: Routes handle HTTP, business logic in `src/lib/services/`, DB access in `src/lib/server/db/`
- **Hardware Abstraction**: `src/lib/server/hardware/` detects/manages RF devices
- **Host-Container Bridge**: `src/lib/server/host-exec.ts` uses `nsenter` to run host commands from container (for gr-gsm, tcpdump, etc.)

## Code Conventions

**Svelte 5 Runes**: Use `$effect()` for reactive subscriptions, not manual `subscribe()`. Stores auto-cleanup.

```typescript
// ❌ WRONG - Manual subscription management
import { myStore } from './stores';
let value;
const unsubscribe = myStore.subscribe(v => value = v);
onDestroy(() => unsubscribe());

// ✅ RIGHT - Svelte 5 runes with auto-cleanup
import { myStore } from './stores';
$effect(() => {
  const value = $state(myStore);
  console.log('Value changed:', value);
}); // Auto-cleanup on component unmount
```

**Service Layer Pattern**: Routes handle HTTP concerns only. Business logic lives in `src/lib/services/`.

```typescript
// ❌ WRONG - Business logic in route handler
export async function POST({ request }) {
  const data = await request.json();
  const validated = validateInput(data);
  const result = await db.insert(validated);
  return json(result);
}

// ✅ RIGHT - Route delegates to service
export async function POST({ request }) {
  const data = await request.json();
  const result = await signalService.createSignal(data);
  return json(result);
}
```

**Error Handling**: Always use `errorResponse()` from [src/lib/server/security/error-response.ts](src/lib/server/security/error-response.ts). Never swallow errors silently.

**WebSocket Auth**: Extract token from query param (`?token=...`) or `X-API-Key` header. Auth happens in connection handler, not `verifyClient` (noServer mode). See [src/lib/server/websocket-server.ts:79-100](src/lib/server/websocket-server.ts#L79-L100).

## Gotchas

**Memory Limit**: Node.js heap capped at 1024MB (`--max-old-space-size=1024`). Don't load entire database into memory — use pagination.

**Docker Context**: Container uses `~/.claude/mcp.json`, NOT `~/.claude.json` (host-only). Host networking (`network_mode: host`) required for USB hardware access.

**Terminal Sessions**: Dashboard terminal (port 3001, node-pty) runs inside Docker via Vite plugin. After `npm install` on host, must run `docker exec argos-dev npm rebuild node-pty` to recompile native binary for container architecture. Supports 4 independent tmux sessions (tmux-0 through tmux-3) with persistent PTY sessions that survive WebSocket reconnections.

**R-tree Spatial Indexing**: For "find signals within N meters" queries, MUST use R-tree subquery. See [src/lib/server/db/](src/lib/server/db/) for patterns. Full table scans will OOM on large datasets.

**MCP Server Architecture**: Each server runs as standalone process via `npx tsx`, CANNOT import SvelteKit internals. Communicates via HTTP API to localhost:5173. All 7 modular servers located in [src/lib/server/mcp/servers/](src/lib/server/mcp/servers/).

**Environment Variables**: System WILL NOT START without `ARGOS_API_KEY` (min 32 chars) in `.env`. Validation enforced at [src/lib/server/env.ts](src/lib/server/env.ts).

## Verification Workflow (Always Run Before Committing)

Claude must execute these commands IN ORDER and report results:

```bash
# 1. Type Safety
npm run typecheck
# Expected: "0 errors"

# 2. Code Quality
npm run lint
# Expected: "0 warnings, 0 errors" (or run npm run lint:fix)

# 3. Unit Tests
npm run test:unit
# Expected: "All tests passed"

# 4. Security Tests
npm run test:security
# Expected: "All tests passed"

# 5. Build Verification
npm run build
# Expected: "✓ built in XXXms"
```

**If ANY step fails:**
1. Report the exact error
2. Identify root cause
3. Fix the issue
4. Re-run from step 1

**Do not proceed to commit if verification fails.**

**For hardware API changes:**
- Verify input validation added (use validators from `input-sanitizer.ts`)
- Verify auth required (check route is protected in `hooks.server.ts`)
- Verify rate limiting considered (pattern: `/api/(hackrf|kismet|gsm-evil|rf)/`)

**For security changes:**
- Check [src/hooks.server.ts](src/hooks.server.ts) for auth gate
- Verify no hardcoded secrets (search for API keys, tokens)
- Test with invalid API key (should return 401)

## Reference Documentation

Detailed guides in `docs/General Documentation/`: mcp-servers.md, security-architecture.md, hardware-patterns.md, websocket-guide.md, database-guide.md, testing-guide.md, deployment.md

---

**Security Model**: Fail-closed, defense-in-depth, OWASP compliant
**Memory Model**: 1GB Node.js heap, OOM protection via earlyoom + zram
**Deployment**: Raspberry Pi 5, Kali Linux 2025.4, Docker v27.5.1

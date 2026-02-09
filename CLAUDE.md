# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Argos — SDR & Network Analysis Console

Production-grade SvelteKit application for Army EW training, deployed on Raspberry Pi 5. Real-time RF spectrum analysis, WiFi intelligence, GPS tracking, and tactical mapping.

## CRITICAL SECURITY RULES

**FAIL-CLOSED DESIGN — System refuses to start without proper security configuration.**

1. **NEVER bypass authentication checks**. All `/api/*` routes protected except `/api/health`. Auth validated at [src/hooks.server.ts:27-30](src/hooks.server.ts#L27-L30) before server starts.

2. **ALWAYS validate inputs before shell execution**. Use validators from [src/lib/server/security/input-sanitizer.ts](src/lib/server/security/input-sanitizer.ts). Never use `exec()` with string interpolation — use `execFile()` with array args.

3. **NEVER commit secrets**. API keys live in `.env` (gitignored). Generate with: `openssl rand -hex 32`

4. **ALWAYS use parameterized queries**. Never template SQL strings. SQLite injection is real.

5. **Hardware endpoints MUST have rate limiting**. Pattern: `/api/(hackrf|kismet|gsm-evil|rf)/` — 64KB body limit enforced at [src/hooks.server.ts](src/hooks.server.ts).

## Tech Stack

TypeScript 5.8.3, SvelteKit 2.22.3, Svelte 5.35.5, Tailwind CSS 3.4.15, SQLite (better-sqlite3), Vite 7.0.3, Vitest 3.2.4, Playwright 1.53.2

**Deployed on:** Raspberry Pi 5 (8GB RAM, NVMe SSD), Kali Linux 2025.4, Docker v27.5.1

## Commands

```bash
# Development
npm run dev                  # Start dev server (port 5173, auto-validates .env)
npm run dev:clean            # Kill existing processes and start fresh
npm run kill-all             # Emergency: kill all Node/Python processes

# Testing & Quality
npm run test                 # Run all tests (Vitest)
npm run test:unit            # Unit tests only
npm run test:e2e             # Playwright E2E tests
npm run typecheck            # TypeScript validation
npm run lint                 # ESLint check
npm run lint:fix             # Auto-fix ESLint errors

# Database
npm run db:migrate           # Run migrations
npm run db:rollback          # Rollback last migration

# MCP Server
npm run mcp:start            # Start standalone MCP server for Claude integration
```

## Project Structure

```
src/routes/api/              # REST API endpoints (feature-organized)
  ├── hackrf/                # HackRF spectrum analysis
  ├── kismet/                # WiFi scanning
  ├── gsm-evil/              # GSM monitoring
  └── agent/                 # Ollama agent
src/lib/server/              # Server-only code (auth, security, WebSocket)
  ├── security/              # Input sanitization, rate limiting, CORS
  └── mcp/                   # MCP server implementation
src/lib/stores/              # Svelte stores (reactive state)
tests/                       # unit/, integration/, e2e/, visual/, performance/
```

## Code Conventions

**Svelte 5 Runes**: Use `$effect()` for reactive subscriptions, not manual `subscribe()`. Stores auto-cleanup.

**Service Layer Pattern**: Routes handle HTTP concerns only. Business logic lives in `src/lib/services/`. Database access in `src/lib/server/db/`.

**Error Handling**: Always use `errorResponse()` from [src/lib/server/security/error-response.ts](src/lib/server/security/error-response.ts). Never swallow errors silently (Phase 2.2.1 eliminated all empty `catch {}` blocks).

**WebSocket Auth**: Extract token from query param (`?token=...`) or `X-API-Key` header. Auth happens in connection handler, not `verifyClient` (noServer mode). See [src/lib/server/websocket-server.ts:79-100](src/lib/server/websocket-server.ts#L79-L100).

## Gotchas

**Memory Limit**: Node.js heap capped at 1024MB (`--max-old-space-size=1024`). Don't load entire database into memory — use pagination.

**Docker Context**: Container uses `~/.claude/mcp.json`, NOT `~/.claude.json` (host-only). Host networking (`network_mode: host`) required for USB hardware access.

**R-tree Spatial Indexing**: For "find signals within N meters" queries, MUST use R-tree subquery. See [src/lib/server/db/](src/lib/server/db/) for patterns. Full table scans will OOM on large datasets.

**MCP Server Architecture**: Runs as standalone process via `npx tsx`, CANNOT import SvelteKit internals. Communicates via HTTP API to localhost:5173. See [src/lib/server/mcp/dynamic-server.ts](src/lib/server/mcp/dynamic-server.ts).

**Environment Variables**: System WILL NOT START without `ARGOS_API_KEY` (min 32 chars) in `.env`. Validation enforced at [src/lib/server/env.ts](src/lib/server/env.ts).

## Reference Documentation

For detailed context on specific topics, see:

- **Security Architecture**: @docs/security-architecture.md (auth, sanitization, rate limiting)
- **Hardware Integration**: @docs/hardware-patterns.md (HackRF, Kismet, GPS, USB passthrough)
- **WebSocket Architecture**: @docs/websocket-guide.md (real-time data flow, backpressure)
- **Database Patterns**: @docs/database-guide.md (R-tree indexing, migrations, performance)
- **Testing Strategies**: @docs/testing-guide.md (hardware mocking, test organization)
- **Deployment Guide**: @docs/deployment.md (Raspberry Pi 5, Docker, OOM protection)

## After Making Changes

1. **Run tests**: `npm run test:unit` (fast feedback)
2. **Type check**: `npm run typecheck` (catches type errors)
3. **Lint**: `npm run lint:fix` (auto-fixes style issues)
4. **For hardware APIs**: Verify input validation added, auth required, rate limiting considered
5. **For security changes**: Check [src/hooks.server.ts](src/hooks.server.ts), verify no hardcoded secrets, test with invalid API key (should return 401)

---

**Security Model**: Fail-closed, defense-in-depth, OWASP compliant
**Memory Model**: 1GB Node.js heap, OOM protection via earlyoom + zram
**Deployment**: Raspberry Pi 5, Kali Linux 2025.4, Docker v27.5.1

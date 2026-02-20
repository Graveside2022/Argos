# Argos — SDR & Network Analysis Console

**Tech Stack**: TypeScript 5.8, SvelteKit 2.22, Svelte 5 (Runes), Tailwind 4, SQLite.
**Runtime**: Raspberry Pi 5 (Native Host), Kali Linux via systemd (NOT Docker).

## ⚡️ Key Commands

- `npm run dev:auto-kismet` # Start dev with Kismet (Preferred)
- `npm run mcp:install-b` # Install MCP servers
- `npm run framework:validate-all` # Visual/CSS/HTML integrity checks
- `npx tsx scripts/run-audit.ts` # Constitutional audit

## 🛡️ Critical Security (Fail-Closed)

1. **Auth**: `ARGOS_API_KEY` required for system start. Validated in `src/hooks.server.ts`.
2. **Input**: NEVER `exec()` strings. Use `execFile` with `src/lib/server/security/input-sanitizer.ts`.
3. **Rate Limit**: Hardware APIs (`/api/hackrf/*`) must have rate limits.
4. **No Secrets**: Secrets go in `.env` only.

## 🏗️ Architecture & Patterns

- **Svelte 5**: Use `$state()` and `$effect()`. **NEVER** use manual `subscribe()`.
- **Service Layer**: Business logic lives in `src/lib/services/`, NOT `+server.ts` routes.
- **Hardware**: Access via `src/lib/server/hardware/` abstraction.
- **Database**: Use `better-sqlite3`. **NO** full table scans on signal data (use R-tree `rtree_...`).

## 🧪 Verification Workflow

Run BEFORE commit:

1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run test:security`

## Active Technologies

- TypeScript 5.8 (strict mode) + SvelteKit 2.22, child_process (execFile, spawn), better-sqlite3, fs/promises (009-gsm-evil-exec-migration)
- SQLite via better-sqlite3 (replaces inline Python sqlite3 calls) (009-gsm-evil-exec-migration)

## Recent Changes

- 009-gsm-evil-exec-migration: Added TypeScript 5.8 (strict mode) + SvelteKit 2.22, child_process (execFile, spawn), better-sqlite3, fs/promises

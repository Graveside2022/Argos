# Codebase Convention Audit Report

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement remediation tasks.

**Goal:** Catalog all violations of CLAUDE.md, src/CLAUDE.md, and the Project Constitution across the Argos codebase.

**Date:** 2026-02-19 | **Branch:** 007-tak-server-p2 | **Audited by:** 4 parallel agents

**Architecture:** Read-only audit — no changes made. All violations documented with file paths, line numbers, and severity ratings.

---

## Violation Summary

| Category                   | Count               | Severity      | Rule Source            |
| -------------------------- | ------------------- | ------------- | ---------------------- |
| Files > 300 lines          | 55 files            | MEDIUM        | Constitution Art. 2.2  |
| Unsafe shell execution     | 5+ calls / 2 files  | **CRITICAL**  | CLAUDE.md Security #2  |
| Missing HackRF rate limits | 5 endpoints         | **IMPORTANT** | CLAUDE.md Security #3  |
| Missing Zod validation     | 2 routes            | IMPORTANT     | src/CLAUDE.md #3       |
| Raw throw in routes        | 2 instances         | IMPORTANT     | src/CLAUDE.md #3       |
| console.log in production  | ~21 calls / 4 files | IMPORTANT     | Constitution Art. 7.3  |
| Manual .subscribe()        | 2 calls / 2 files   | IMPORTANT     | CLAUDE.md Architecture |
| Raw input (not shadcn)     | 1 instance          | MEDIUM        | src/CLAUDE.md #4       |
| Hardcoded hex colors       | 1 file              | MEDIUM        | Constitution Art. 2.6  |
| Barrel files               | 0                   | N/A           | PASS                   |
| Catch-all utils            | 0                   | N/A           | PASS                   |

---

## Phase 1: CRITICAL Security Fixes

### S1. Replace unsafe shell calls in sweep-manager.ts

**Rule:** CLAUDE.md — "NEVER use unsafe shell strings. Use execFile with input-sanitizer.ts"

**File:** `src/lib/server/hackrf/sweep-manager.ts`

- Line 923: runs `timeout 3 hackrf_info` via shell string
- Line 972: runs `pgrep` + `grep` + `xargs kill` piped via shell string
- Line 980: runs `pkill -9 -x hackrf_sweep` via shell string
- Line 986: runs `pkill -9 -f hackrf_info` via shell string
- Line 991: runs `pkill -9 -f sweep_bridge.py` via shell string

**Fix:** Replace each with `execFile()` or `spawn()`. For piped commands (line 972), use `spawn` with explicit args. For pkill/pgrep, use `execFile('/usr/bin/pkill', ['-9', '-x', 'hackrf_sweep'])`.

**Risk:** LOW — all static strings with no user input, but the pattern must be eliminated.

### S2. Replace unsafe shell calls in system/info route

**File:** `src/routes/api/system/info/+server.ts`

- 11 shell command string calls for hostname, IP, CPU, disk, temperature

**Fix:** Replace with Node.js APIs where possible (`os.hostname()`, `os.cpus()`, `os.freemem()`). For hardware-specific commands, use `execFile()` with explicit argument arrays.

**Risk:** MEDIUM — some commands use shell pipes; replacement requires splitting into multiple calls or using Node.js stdlib alternatives.

### S3. Replace unsafe shell calls in process-manager.ts

**File:** `src/lib/hackrf/sweep-manager/process-manager.ts`

- Imports the unsafe shell function from child_process (line 4)

**Fix:** Verify usage context and replace with `execFile` or `spawn`.

---

## Phase 2: IMPORTANT Security Hardening

### S4. Add rate limiting to HackRF API endpoints

**Rule:** CLAUDE.md — "Hardware APIs (/api/hackrf/\*) must have rate limits"

**Files (all missing rate limits):**

- `src/routes/api/hackrf/+server.ts`
- `src/routes/api/hackrf/status/+server.ts`
- `src/routes/api/hackrf/start-sweep/+server.ts`
- `src/routes/api/hackrf/stop-sweep/+server.ts`
- `src/routes/api/hackrf/emergency-stop/+server.ts`

**Existing infra:** `src/lib/server/security/rate-limiter.ts` exists but is not imported by any HackRF route.

### S5. Add Zod validation to unvalidated POST routes

**Files:**

- `src/routes/api/db/cleanup/+server.ts` — accepts unvalidated `{ action, config }` body
- `src/routes/api/database/query/+server.ts` — accepts raw query strings, only keyword-blocks

### S6. Fix raw throw in routes

**Files:**

- `src/routes/api/hackrf/start-sweep/+server.ts:80` — throws raw Error instead of SvelteKit error()
- `src/routes/api/kismet/ws/+server.ts:6-8` — throws raw Error for missing WS upgrade

**Fix:** Use `throw error(400, 'message')` from `@sveltejs/kit` or return `json({ error }, { status })`.

---

## Phase 3: Convention Compliance (Quick Wins)

### C1. Remove console.log from production code

**Rule:** Constitution Art. 7.3 — "No console.log in production"

| File                                               | Count | Fix                                            |
| -------------------------------------------------- | ----- | ---------------------------------------------- |
| `src/lib/server/tak/TakService.ts`                 | 5     | Replace with console.warn or structured logger |
| `src/lib/map/layers/SymbolLayer.ts`                | 2     | Remove debug logs                              |
| `src/lib/components/dashboard/DashboardMap.svelte` | 6     | Remove debug logs                              |
| `src/routes/gsm-evil/+page.svelte`                 | 14    | Remove debug logs                              |

### C2. Convert manual .subscribe() to $store syntax

| File                  | Line | Current                                      | Fix                             |
| --------------------- | ---- | -------------------------------------------- | ------------------------------- |
| `DashboardMap.svelte` | 727  | `mapSettings.subscribe(...)`                 | Use `$mapSettings` in `$effect` |
| `LayersPanel.svelte`  | 18   | `mapSettings.stadiaAvailable.subscribe(...)` | Use `$derived`                  |

### C3. Fix raw input in LayersPanel

**File:** `src/lib/components/dashboard/panels/LayersPanel.svelte:73`
**Fix:** Import shadcn Input and replace raw `<input type="text">`.

### C4. Fix hardcoded hex colors in SymbolLayer

**File:** `src/lib/map/layers/SymbolLayer.ts:41-42`
**Fix:** Replace hardcoded white/black with CSS variable resolution.

---

## Phase 4: File Length Reduction (Long-term)

### Top 12 Over-Limit Files (sorted by excess lines)

| #   | File                                               | Lines | Excess | Priority   |
| --- | -------------------------------------------------- | ----- | ------ | ---------- |
| 1   | `components/dashboard/DashboardMap.svelte`         | 1,809 | +1,509 | HIGH       |
| 2   | `data/tool-hierarchy.ts`                           | 1,491 | +1,191 | LOW (data) |
| 3   | `server/hackrf/sweep-manager.ts`                   | 1,410 | +1,110 | HIGH       |
| 4   | `components/dashboard/TopStatusBar.svelte`         | 1,203 | +903   | HIGH       |
| 5   | `components/dashboard/panels/DevicesPanel.svelte`  | 1,047 | +747   | HIGH       |
| 6   | `data/carrier-mappings.ts`                         | 809   | +509   | LOW (data) |
| 7   | `components/dashboard/panels/OverviewPanel.svelte` | 769   | +469   | MEDIUM     |
| 8   | `components/dashboard/TerminalPanel.svelte`        | 742   | +442   | MEDIUM     |
| 9   | `server/mcp/dynamic-server.ts`                     | 716   | +416   | MEDIUM     |
| 10  | `components/dashboard/AgentChatPanel.svelte`       | 619   | +319   | MEDIUM     |
| 11  | `routes/gsm-evil/+page.svelte`                     | 576   | +276   | MEDIUM     |
| 12  | `server/kismet/web-socket-manager.ts`              | 611   | +311   | MEDIUM     |

Plus 43 more files between 301-520 lines.

**Notes:**

- `tool-hierarchy.ts` (1,491) and `carrier-mappings.ts` (809) are pure data — likely acceptable exceptions
- UI components need child component extraction (same pattern as TakConfigView refactor)
- Server files need modular decomposition (sweep-manager already partially done)
- Each large file refactor needs its own brainstorm/plan/execute cycle

---

## Scoped CSS Assessment

**25 files have style blocks, totaling ~3,000 lines of CSS.**

- **~90% justified** — MapLibre, xterm.js, responsive layouts, complex tables
- **~10% refactorable** (~100 lines across 5 files could use more Tailwind)
- **No action needed** for most scoped CSS — complex UI legitimately needs it

---

## What Passed

| Rule                       | Status                                       |
| -------------------------- | -------------------------------------------- |
| No barrel files (index.ts) | PASS                                         |
| No catch-all utils         | PASS                                         |
| shadcn Button usage        | PASS (all compliant)                         |
| shadcn component adoption  | PASS (badge, table, select, switch all used) |
| Auth gate on API routes    | PASS (hooks.server.ts)                       |
| Input sanitizer library    | PASS (exists and used in TAK code)           |

---

## Recommended Execution Order

1. **Phase 1** (CRITICAL security) — Do immediately, same branch or dedicated security branch
2. **Phase 3** (quick wins) — Can be done alongside Phase 1, low risk
3. **Phase 2** (security hardening) — After Phase 1, requires some design decisions
4. **Phase 4** (file length) — Long-term, one component per feature branch

# Concerns & Technical Debt

> Mapped: 2026-02-24 | Source: CLAUDE.md, MEMORY.md, codebase analysis

## Critical: Memory Pressure

The RPi 5 has 8GB RAM but only ~2.7GB effective headroom after baseline services.

| Process                      | Typical RSS         | Notes             |
| ---------------------------- | ------------------- | ----------------- |
| Claude Code                  | ~991 MB             | Main CLI session  |
| VS Code Server (Antigravity) | ~1,254 MB (6 procs) | oom_adj=-500      |
| Vite dev server              | ~353 MB             | oom_adj=-500      |
| Chromium debug               | ~408 MB             | Port 9224         |
| Chroma + claude-mem          | ~476 MB             | Persistent daemon |
| System                       | ~500 MB             | Kernel + services |

**Impact**: Running `npm run test:unit` (full suite) while VS Code is active can trigger OOM. Running multiple `svelte-check` instances (~650MB each) causes system freeze.

**Mitigations in place**:

- earlyoom (kills at 10% free): prefers ollama, bun; avoids sshd, tailscaled, vite
- zram: 4GB zstd compressed swap
- cgroup v2: MemoryMax=7680MB for user-1000.slice
- Lock file `/tmp/argos-typecheck.lock` prevents concurrent svelte-check
- `vite-oom-protect.sh` wrapper sets oom_score_adj=-500 on Vite tree

## High: Oversized Functions (~13 violations)

The 50-line function limit (Article 2.2) is violated by these functions:

| File                        | Lines         | Domain           |
| --------------------------- | ------------- | ---------------- |
| gsm-evil service functions  | 375, 242, 232 | GSM Evil         |
| `gsm-evil-store.ts`         | 321           | GSM Evil store   |
| `web-socket-manager.ts`     | 162           | WebSocket server |
| kismet store functions      | ~125          | Kismet           |
| GPS service functions       | 125, 122      | GPS              |
| map-setup functions         | 118           | Map              |
| hardware-detector functions | ~110          | Hardware         |
| db-migrate functions        | ~108          | Database         |
| l3-decoder functions        | 128, 98       | GSM              |

The GSM Evil subsystem is the worst offender with 4 of the top 5 oversized functions. These are candidates for extraction into smaller, focused helper functions.

## High: `any` Type Usage (16 instances)

| Category            | Count | Notes                            |
| ------------------- | ----- | -------------------------------- |
| Core violations     | 8     | Direct `any` usage               |
| eslint-disable      | 5     | Suppressed with disable comments |
| Record<string, any> | 2     | Generic object typing            |
| Type alias          | 1     | `LeafletLibrary = any`           |

Goal is zero `any` — use `unknown` + type guards instead.

## Medium: Mixed Error Handling Patterns

Three co-existing error handling strategies create inconsistency:

1. **Result tuples** (`safe()`/`safeSync()`) — 4-5 usages (new code)
2. **`createHandler()` factory** — 6 routes
3. **Manual try-catch + `errMsg()`** — ~60 routes (majority)

Migration from pattern 3 to pattern 1 would improve consistency, but the scope is large (~60 routes).

## Medium: Dual API Namespaces for HackRF

Both `/api/hackrf/` (6 routes) and `/api/rf/` (5 routes) control the **same** `sweepManager` singleton. Changes via one namespace affect the other. This creates confusion and potential race conditions if both are used simultaneously.

Recommendation: Deprecate one namespace or document the relationship clearly in each route.

## Medium: Mixed CSS Token Systems

Dashboard components use `--palantir-*` tokens. TAK and GSM Evil components use older shadcn tokens directly. The bridge layer (`palantir-design-system.css`) maps between them, but:

- Some components bypass the bridge and hardcode hex values
- TAK components don't use Palantir tokens at all
- Inconsistency in which token set to use for new components

## Medium: Leaflet + MapLibre Coexistence

Both `leaflet` (1.9.4) and `maplibre-gl` (5.6.1) are dependencies. MapLibre is the primary map engine, but Leaflet remains in the dependency tree with type definitions. This adds bundle weight and potential confusion.

## Low: Pre-existing Test Failures

4 test failures that pre-date recent work:

- `tests/load/dataVolumes.test.ts` — 3 failures
- `tests/performance/tak-markers.test.ts` — 1 failure

These don't block unit tests (`npm run test:unit` passes clean) but affect the full `test:all` suite.

## Low: GSM Evil Iframe Isolation

The GSM Evil page renders inside an iframe on the dashboard. This was done for process isolation but creates complexity:

- Separate layout (`+layout.svelte`)
- `gsm-evil-store.ts` is the largest store (321 lines)
- Communication between iframe and parent requires explicit message passing

## Low: No Enforced Coverage Thresholds

`@vitest/coverage-v8` is installed but no minimum coverage thresholds are configured. Coverage is opt-in via `npm run test:coverage`.

## Low: Deployment Token Substitution

Systemd service files in `deployment/` use `__PROJECT_DIR__` placeholder tokens that must be substituted at install time. `scripts/ops/install-services.sh` handles this, but manual edits to service files can accidentally revert tokens.

## Resolved Issues (Keeping for Context)

- **Barrel files**: All 26 eliminated (commit 5c045c5)
- **PascalCase files**: All 8 renamed to kebab-case (spec-016)
- **Constitution test failures**: 7 eliminated by spec-014 Phase 1 deletion
- **Shell injection**: Eliminated via `execFileAsync()` + input sanitizers
- **Auth bypass**: Fail-closed auth installed, `validateSecurityConfig()` at startup

# Claude Code Hooks Survey — Argos Project

**Date:** 2026-02-11
**Methodology:** Claude Code Hooks Architect v1.0
**Phase:** 1 (Survey)

---

## 1. Existing Automation Inventory

### Git Hooks (Husky)

**Location:** `.husky/pre-commit`
**Trigger:** `git commit`
**Actions:**
- Runs `npx lint-staged`
- lint-staged configuration (`.lintstagedrc.json`):
  - `*.{js,ts,svelte}`: ESLint --fix + Prettier --write
  - `*.{json,md,css,postcss,html}`: Prettier --write
  - `package.json`: Prettier --write

**Scope:** Code formatting and linting only (no tests, no typecheck, no security validation)

### Claude Code Permissions

**Location:** `.claude/settings.local.json`
**Type:** Pre-approved tool allowlist
**Contents:**
- **380 pre-approved Bash commands** (systemctl, curl, docker, npm, git, etc.)
- **Pre-approved MCP tools:** octocode (localSearchCode, githubSearch, etc.), argos-tools
- **Pre-approved Read paths:** `/usr/**`, `/home/kali/Documents/Argos/Argos/**`, `/etc/systemd/system/**`
- **Pre-approved WebFetch domains:** docs.svelte.dev, github.com, npm registries, etc.

**Purpose:** Reduce permission prompts for common operations

**Gap:** No runtime validation, no resource checks, no audit trail

---

## 2. Project Stack Analysis

### Core Technologies

- **Runtime:** Node.js 20.x, TypeScript 5.8.3
- **Framework:** SvelteKit 2.22.3, Svelte 5.35.5
- **Build:** Vite 7.0.3, ESBuild
- **Testing:** Vitest 3.2.4 (unit/integration), Playwright 1.53.2 (e2e)
- **Database:** SQLite (better-sqlite3)
- **Styling:** Tailwind CSS 3.4.15

### Development Tools

- **Linting:** ESLint 9.20.2 with TypeScript plugin
- **Formatting:** Prettier 3.6.2
- **Type Checking:** svelte-check 4.2.2
- **Git Hooks:** Husky 9.2.0, lint-staged 16.1.2

### Deployment Context

- **Hardware:** Raspberry Pi 5 Model B Rev 1.0 (8GB RAM, 4x Cortex-A76)
- **OS:** Kali Linux 2025.4 (Linux 6.12.34+rpt-rpi-2712, aarch64)
- **Storage:** 500GB NVMe SSD (Kingston SNV3S500G)
- **Container:** Docker v27.5.1, argos-dev container (network_mode: host)
- **USB Devices:** HackRF One, Alfa WiFi adapter (AWUS036ACH), GPS receiver

### Memory Constraints (CRITICAL)

- **System RAM:** 8GB total
- **Node.js Heap:** `--max-old-space-size=1024` (1GB limit)
- **OOM Protection:** earlyoom (-m 10 -s 50), zram (4GB compressed swap)
- **MCP Servers:** ~800MB when all 7 servers running (~30 processes)
- **Vitest:** `maxWorkers: 1` (prevents memory exhaustion)

**Critical Threshold:** Memory >70% = OOM risk zone

---

## 3. Pain Points & Risks (Hook Candidates)

### 3.1 Memory Management Risk (HIGH PRIORITY)

**Problem:** Operations that spike memory >70% can trigger OOM killer, crashing Claude Code or dev server.

**Examples:**
- Running vitest without worker limits (was causing 87% memory usage)
- Spawning multiple Claude Team agents simultaneously
- Loading large files into memory (>100MB)
- Running `npm install` with many packages

**Current Mitigation:** Manual monitoring, vitest config fix (Phase 1.5)

**Hook Solution:**
- **Event:** `PreToolUse` (before Bash, Task)
- **Matcher:** `tool == "Bash" && args.command.contains("vitest")` OR `tool == "Task"`
- **Action:** Check system memory via `free -m | awk '/Mem:/ {print $3/$2 * 100}'`
- **Behavior:** Block if memory >60%, warn if >50%
- **Speed:** <500ms (fast system call)

---

### 3.2 Hardware Access Conflicts (HIGH PRIORITY)

**Problem:** HackRF One can only be used by one process at a time. Concurrent access causes device busy errors.

**Examples:**
- Starting HackRF sweep while GSM Evil monitoring is active
- Running two spectrum analysis operations simultaneously
- Docker container + host both trying to access USB device

**Current Mitigation:** Manual coordination, API-level mutex (but no CLI protection)

**Hook Solution:**
- **Event:** `PreToolUse` (before Bash commands that access HackRF)
- **Matcher:** `args.command.contains("hackrf_") || args.command.contains("grgsm_")`
- **Action:** Check if HackRF is in use via `lsof | grep hackrf` or API `/api/hackrf/status`
- **Behavior:** Block with error message if device busy
- **Speed:** <300ms (lsof or HTTP health check)

---

### 3.3 Security Validation (CRITICAL PRIORITY)

**Problem:** Fail-closed security design requires ARGOS_API_KEY. System refuses to start without it, but no pre-flight check.

**Examples:**
- Starting dev server without `.env` file
- Missing or invalid API key (< 32 chars)
- MCP servers failing to authenticate

**Current Mitigation:** Runtime crash on startup (hooks.server.ts:27-30)

**Hook Solution:**
- **Event:** `SessionStart`
- **Matcher:** Always (global)
- **Action:**
  1. Check `.env` file exists
  2. Validate `ARGOS_API_KEY` present and ≥32 chars
  3. Verify `~/.claude/mcp.json` has matching key
- **Behavior:** Show warning + guidance if validation fails
- **Speed:** <100ms (file reads + regex)

---

### 3.4 Test Quality Gate (MEDIUM PRIORITY)

**Problem:** Code can be committed without running tests or typecheck. lint-staged only checks formatting.

**Examples:**
- Committing TypeScript errors (would fail CI)
- Committing broken tests (would fail test suite)
- Skipping security validation

**Current Mitigation:** Husky pre-commit only runs ESLint + Prettier

**Hook Solution:**
- **Event:** `PreToolUse` (before git commits)
- **Matcher:** `tool == "Bash" && args.command.contains("git commit")`
- **Action:**
  1. Run `npm run typecheck` (fast, <10s)
  2. Run `npm run test:unit` (slower, ~30s)
  3. Parse exit codes
- **Behavior:** Block commit if failures, allow override with flag
- **Speed:** 10-40s (conditional on test count)

---

### 3.5 Audit Trail (MEDIUM PRIORITY)

**Problem:** No record of what Claude does during sessions. Hard to reproduce issues or understand decision history.

**Examples:**
- What files were edited during a refactor?
- What commands were run before a crash?
- What reasoning led to a design choice?

**Current Mitigation:** None (conversation transcript only, no structured logging)

**Hook Solution:**
- **Event:** `PostToolUse` (after ALL tool calls)
- **Matcher:** Always (global)
- **Action:** Append to session log file (`~/.claude/sessions/<date>-audit.jsonl`):
  ```json
  {
    "timestamp": "2026-02-11T14:32:01Z",
    "tool": "Edit",
    "file": "src/lib/stores/connection.ts",
    "action": "deleted 6 unused functions",
    "success": true
  }
  ```
- **Behavior:** Async logging, never blocks
- **Speed:** <50ms (async write)

---

### 3.6 Resource Cleanup (LOW PRIORITY)

**Problem:** Dev servers, vitest processes, background agents left running when session ends.

**Examples:**
- Port 5173 occupied by orphaned Vite process
- Vitest workers consuming memory
- Background Task agents idle

**Current Mitigation:** Manual `npm run kill-all` or `sudo pkill`

**Hook Solution:**
- **Event:** `Stop` (when Claude Code exits)
- **Matcher:** Always (global)
- **Action:** Run cleanup script:
  ```bash
  pkill -f "vite.*5173"
  pkill -f "vitest"
  # Check for background tasks and warn
  ```
- **Behavior:** Best-effort cleanup, log failures
- **Speed:** <2s (process kills are fast)

---

### 3.7 Docker Context Awareness (LOW PRIORITY)

**Problem:** Commands run in wrong context (host vs container). Example: `npm install` on host requires `npm rebuild` in container for native modules (node-pty).

**Examples:**
- Running `npm install` on host → node-pty broken in container
- Editing files in container that need host reload
- Path mismatches between `/app` (container) and `/home/kali/Documents/Argos/Argos` (host)

**Current Mitigation:** Documentation (CLAUDE.md), manual awareness

**Hook Solution:**
- **Event:** `PostToolUse` (after npm/package operations)
- **Matcher:** `tool == "Bash" && args.command.contains("npm install")`
- **Action:** Show reminder:
  ```
  ⚠️  Reminder: npm install on host requires Docker rebuild:
  docker exec argos-dev npm rebuild node-pty
  ```
- **Behavior:** Information only, never blocks
- **Speed:** <10ms (stdout message)

---

## 4. Hook Needs Assessment

### Summary Table

| Priority | Problem | Hook Event | Matcher | Action | Speed | Impact |
|----------|---------|------------|---------|--------|-------|--------|
| **CRITICAL** | Security validation | SessionStart | Always | Check .env + API key | <100ms | Prevent startup failures |
| **HIGH** | Memory management | PreToolUse | vitest/Task | Check memory % | <500ms | Prevent OOM crashes |
| **HIGH** | Hardware conflicts | PreToolUse | hackrf_/grgsm_ | Check device status | <300ms | Prevent device busy errors |
| **MEDIUM** | Test quality gate | PreToolUse | git commit | Run typecheck/tests | 10-40s | Prevent bad commits |
| **MEDIUM** | Audit trail | PostToolUse | Always | Log to JSONL | <50ms | Enable debugging |
| **LOW** | Resource cleanup | Stop | Always | Kill orphaned processes | <2s | Free resources |
| **LOW** | Docker context | PostToolUse | npm install | Show reminder | <10ms | Reduce mistakes |

### Recommended Implementation Order

1. **Phase 2a: Critical Security** (SessionStart hook)
   - Validates environment before any work
   - Fast, zero operational impact
   - Prevents most common startup failure

2. **Phase 2b: High-Risk Blocking** (PreToolUse for memory + hardware)
   - Prevents crashes and device conflicts
   - Minimal latency (<500ms)
   - High ROI for stability

3. **Phase 2c: Audit Logging** (PostToolUse global)
   - Async, non-blocking
   - Enables future debugging
   - Low implementation risk

4. **Phase 3: Optional Enhancements** (Test gate, cleanup, Docker reminders)
   - Higher latency (test gate) or lower priority (cleanup)
   - Can be added incrementally

---

## 5. Hook Design Constraints

### Performance Budgets

- **SessionStart:** <500ms total (user won't notice)
- **PreToolUse:** <1s for blocking checks (acceptable delay)
- **PostToolUse:** <100ms for sync, async for anything longer
- **Stop:** <3s for cleanup (user already exiting)

### Failure Modes

- **Security hook fails:** Block session start, show clear error
- **Memory hook fails:** Allow operation (fail-open to avoid blocking work)
- **Hardware hook fails:** Allow operation, log warning
- **Audit hook fails:** Silent failure, log to stderr

### Pi5 Resource Sensitivity

- Avoid spawning subshells for every hook (use built-in checks where possible)
- Avoid HTTP calls if filesystem checks suffice
- Cache results for repeated checks (e.g., memory check valid for 5s)

---

## 6. Existing Automation Gaps

### What Husky Pre-Commit Does

✅ ESLint --fix (code quality)
✅ Prettier --write (formatting)

### What It DOESN'T Do

❌ TypeScript type checking
❌ Unit test execution
❌ Security test validation
❌ Build verification
❌ API key presence check
❌ Memory/resource validation

**Recommendation:** Keep Husky for fast formatting checks. Add Claude hooks for runtime safety and validation that can't be git-hooked.

---

## 7. Next Steps (Phase 2: Hook Design)

For each identified hook need, design:

1. **Trigger condition** (exact matcher logic)
2. **Check implementation** (bash script or API call)
3. **Response behavior** (block, warn, log, or inform)
4. **Error messages** (actionable guidance)
5. **Performance optimization** (caching, parallelization)
6. **Failure handling** (fail-open vs fail-closed)

**Output:** Hook design specification ready for Phase 3 installation.

---

## 8. References

- Claude Code Hooks Documentation: https://docs.claude.ai/code/hooks
- Argos Security Architecture: `docs/security-architecture.md`
- Argos Hardware Patterns: `docs/hardware-patterns.md`
- Memory Protection Config: `MEMORY.md` (earlyoom, zram, OOM scores)
- Vitest Config Fix: `vitest.config.ts:22-25` (maxWorkers: 1)

---

**Survey Status:** ✅ Complete
**Findings:** 7 hook candidates identified (3 high priority, 2 medium, 2 low)
**Ready for Phase 2:** Yes (hook design specification)

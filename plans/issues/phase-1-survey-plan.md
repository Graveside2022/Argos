# Phase 1: Survey Plan

**Date:** 2026-02-11
**Owners:** Survey-Production, Survey-Infrastructure
**Estimated Duration:** 3-4 hours
**Dependencies:** Phase 0 complete ✅
**Blocks:** Phase 1.5, 2, 3, 4, 5

---

## Objective

Produce a complete inventory and understanding of the codebase before making any changes. This phase is the foundation for all subsequent work. Without a complete survey, we risk breaking hidden dependencies or missing dead code.

**Principle:** "Understand before touching" (TF-4: Feathers' Legacy Code Change Algorithm)

---

## Team Structure

### Survey-Production Agent

**Scope:** All production code (Python + TypeScript/Svelte)
**Directories:** `src/`, `service/`, `hackrf_emitter/`
**Output:** `plans/issues/phase-1-survey-production-report.md`

### Survey-Infrastructure Agent

**Scope:** Tests, configs, docs, scripts
**Directories:** `tests/`, `config/`, `docs/`, `plans/`, `scripts/`, `build-tools/`, `deployment/`, `docker/`
**Output:** `plans/issues/phase-1-survey-infrastructure-report.md`

---

## Survey-Production: Detailed Tasks

### Task 1.1: File Inventory (Literal, Not Summarized)

For every `.py`, `.ts`, `.svelte`, `.js` file in `src/`, `service/`, `hackrf_emitter/`:

**Data to collect:**

```
File Path: <absolute path>
Size: <LOC>
Exports: <list every export by name>
Imports: <list every import by name and source>
Purpose: <one sentence>
Dependents: <which files import this>
Dependencies: <which files this imports>
Placement: <correct location? flag if misplaced>
Usage: <actively used? flag if suspected dead code>
Hotspot: <is this in top 10 hotspot list from Phase 0?>
```

**Method:**

1. Use `octocode` MCP server for semantic analysis (LSP-based)
2. Cross-reference with git history for usage patterns
3. Flag files with:
    - Zero imports (orphaned files)
    - Zero exports (utility-only files or dead)
    - Circular import chains
    - Imports from unexpected locations (coupling smell)

**Priority Order:**

1. Start with **critical hotspots** (top 10 from Phase 0)
2. Then high-churn files
3. Then stable files

**Output Format:**

```markdown
## File: src/routes/gsm-evil/+page.svelte

- **Size:** 3,096 LOC
- **Hotspot Rank:** #1 (10 changes, 6mo)
- **Exports:** None (Svelte component)
- **Imports:**
    - `$lib/stores/gsm-evil-store` (store)
    - `$lib/components/gsm-evil/ScanPanel.svelte` (component)
    - `$lib/services/gsm-evil/gsm-service` (service)
    - ... (full list)
- **Purpose:** GSM Evil monitoring dashboard with scan controls and IMSI display
- **Dependents:** None (route entry point)
- **Dependencies:** 47 imports (high coupling)
- **Placement:** ✅ Correct (route file)
- **Usage:** ✅ Active (main GSM Evil interface)
- **Code Smells Detected:**
    - God Class (3,096 LOC)
    - High coupling (47 imports)
    - Suspected duplicate code with API routes
```

**Deliverable:** Literal inventory of ~2,600 Python files + ~260 TypeScript/Svelte files

### Task 1.2: Function Inventory (Hotspot Files Only)

For **top 10 hotspot files only**, inventory all exported functions:

**Data to collect:**

```
Function Name: <name>
Location: <file:line>
Parameters: <list with types>
Return Type: <type>
Side Effects: <list each>
Global State: <what globals/shared state accessed>
External Services: <API calls, DB queries, hardware access>
Error Handling: <what errors handled>
Unhandled Errors: <what errors NOT handled>
Complexity: <LOC, cyclomatic complexity estimate>
Code Smells: <list detected smells>
```

**Method:**

1. Use `octocode.lspGotoDefinition` to find function definitions
2. Use `octocode.lspFindReferences` to find all call sites
3. Analyze function body for side effects (DB writes, state mutations, I/O)
4. Flag functions with:
    - > 30 LOC (long function smell)
    - > 3 parameters (parameter list smell)
    - > 2 levels of nesting (complexity smell)
    - Side effects not indicated by name (hidden side effect smell)

**Deliverable:** Function inventory for 10 hotspot files (~500-1000 functions estimated)

### Task 1.3: Dependency Graph

**Three dimensions:**

#### Upstream Dependencies (What must exist for this to work)

- Required libraries (npm packages, pip packages)
- Required files (imports)
- Required configuration (env vars, config files)
- Required external services (Kismet, HackRF hardware, GPS)

#### Downstream Dependencies (What breaks if this changes)

- Direct importers (files that import this)
- Indirect dependents (files that depend on importers)
- External consumers (MCP servers, API clients)
- Tests that depend on this

#### Peer Dependencies (What changes together)

- Circular dependencies (A imports B, B imports A)
- Shared types/interfaces (must change together)
- Temporal coupling (files committed together >50% of time)

**Method:**

```bash
# Upstream: analyze imports
octocode.localSearchCode pattern="^import|^from" path="src/"

# Downstream: find references
octocode.lspFindReferences for each export

# Peer: analyze git history
git log --since="6 months ago" --name-only --pretty=format:%H \
  | awk '/^$/{next} /^[0-9a-f]{40}$/{commit=$0; next} {print commit " " $0}' \
  | sort | uniq \
  | awk '{commits[$2]=commits[$2] " " $1} END {for (file in commits) print file, split(commits[file], a)}'
```

**Output Format:**

```markdown
## Dependency Graph

### Circular Dependencies (MUST RESOLVE)

1. `src/lib/stores/hackrf-store.ts` ↔ `src/lib/services/hackrf/hackrf-service.ts`
    - Store imports service for initialization
    - Service imports store for state updates
    - **Resolution:** Extract shared types to separate file

### High Coupling (>10 imports)

1. `src/routes/gsm-evil/+page.svelte` (47 imports)
2. `src/lib/components/dashboard/DashboardMap.svelte` (32 imports)

### Temporal Coupling (>50% co-commit rate)

1. `src/hooks.server.ts` + `src/lib/server/auth/auth-middleware.ts` (87% co-commit)
    - **Implication:** Auth middleware changes ripple to hooks
    - **Action:** Consider consolidation or better abstraction

### Orphaned Files (Zero imports)

1. `src/lib/utils/old-helper.ts` (DEAD CODE CANDIDATE)
```

**Deliverable:** Complete dependency graph with circular deps flagged

### Task 1.4: Seam Identification (Tightly Coupled Code)

For code with **high coupling** (>10 imports) or **circular dependencies**, identify seams for testability.

**Seam Types (TF-4: Feathers):**

1. **Object Seams** (Polymorphism)
    - Can we override a method in a subclass?
    - Can we inject a mock via inheritance?

2. **Link Seams** (Module Mocking)
    - Can we substitute a dependency at import time?
    - Can we use Vitest `vi.mock()` to replace imports?

3. **Preprocessing Seams** (Feature Flags)
    - Can we use environment variables to alter behavior?
    - Can we use feature flags to toggle code paths?

4. **Dependency Injection Points**
    - Where can we pass dependencies as parameters?
    - Where is code constructing dependencies internally (anti-pattern)?

**Method:**

1. Identify tightly coupled code (>10 imports, circular deps)
2. Analyze constructor/initialization code
3. Look for direct instantiation (`new Class()`) vs injection
4. Flag hard-coded dependencies (services, stores, hardware)
5. Propose seam type for each coupling point

**Output Format:**

```markdown
## Seams for Tightly Coupled Code

### File: src/lib/components/dashboard/DashboardMap.svelte (32 imports)

**Current Coupling:**

- Direct store imports (no injection): 8 stores
- Direct service instantiation: 3 services
- Hard-coded hardware references: 2 hardware managers

**Proposed Seams:**

1. **Link Seam: Store Mocking**
    - Current: `import { hackrfStore } from '$lib/stores/hackrf-store'`
    - Seam: Vitest can mock `$lib/stores/hackrf-store` module
    - Use: Inject mock store data for testing

2. **Dependency Injection: Service Layer**
    - Current: `const service = new HackRFService()`
    - Proposed: `const service = props.hackrfService ?? new HackRFService()`
    - Use: Inject mock service for testing

3. **Preprocessing Seam: Hardware Detection**
    - Current: Hard-coded hardware check
    - Proposed: `if (import.meta.env.TEST_MODE) { /* mock hardware */ }`
    - Use: Run component tests without real hardware
```

**Deliverable:** Seam map for all tightly coupled code

---

## Survey-Infrastructure: Detailed Tasks

### Task 2.1: Test Assessment

**Full test suite analysis:**

1. **Run Tests with Coverage**

    ```bash
    npm run test:coverage 2>&1 | tee /tmp/test-coverage-baseline.log
    ```

2. **Analyze Results:**
    - Overall coverage % (line, branch, function)
    - Coverage by directory (src/, tests/, service/, hackrf_emitter/)
    - Hotspot coverage (are top 10 hotspot files covered?)
    - Uncovered critical paths

3. **Identify Brittle Tests:**
    - Tests that fail on unrelated changes
    - Tests that test implementation details (mocking private methods)
    - Tests tightly coupled to implementation (break when refactoring)
    - Tests with hard-coded values (dates, IDs, paths)

4. **Categorize Tests:**
    - Unit tests: test single function/class
    - Integration tests: test multiple components together
    - E2E tests: test full user flows
    - Count and quality assessment for each

5. **Identify Test Gaps:**
    - Hotspot files with <60% coverage (CRITICAL)
    - Edge cases not tested (error paths, boundary values)
    - Missing integration tests (services + DB)
    - Missing E2E tests (critical user flows)

**Output Format:**

```markdown
## Test Assessment

### Coverage Summary

- **Overall:** 47% line coverage (Target: ≥80%)
- **src/:** 52% (good for UI layer)
- **service/:** 31% (CRITICAL GAP)
- **hackrf_emitter/:** 12% (CRITICAL GAP)

### Hotspot Coverage (Top 10)

| File                  | LOC   | Coverage | Gap (LOC) | Priority |
| --------------------- | ----- | -------- | --------- | -------- |
| gsm-evil/+page.svelte | 3,096 | 23%      | 2,384     | P0       |
| DashboardMap.svelte   | 1,436 | 41%      | 847       | P0       |
| TopStatusBar.svelte   | 1,195 | 38%      | 741       | P0       |

**Total Hotspot Gap:** 4,972 LOC uncovered in top 10 files

### Brittle Tests Identified

1. `tests/unit/services/hackrf/hackrfService.test.ts`
    - **Issue:** 401 auth errors (auth not configured for tests)
    - **Fix:** Mock auth or configure test auth

2. `tests/integration/database/signals.test.ts`
    - **Issue:** Fails if database has existing data
    - **Fix:** Use isolated test database, clean between tests

3. `tests/e2e/dashboard.spec.ts`
    - **Issue:** Hardcoded wait times (flaky on slow systems)
    - **Fix:** Use Playwright auto-wait, remove `sleep()`

### Test Gaps (Characterization Tests Needed)

1. **service/** Python backend (31% coverage)
    - Missing: Error handling tests
    - Missing: Edge case tests (malformed input, hardware failures)

2. **Hotspot files** (23-41% coverage)
    - gsm-evil/+page.svelte: Complex UI state machine (untested)
    - DashboardMap.svelte: Map interactions (untested)

### Test Quality Issues

- **58 tests failing** (mostly auth-related)
- **242 tests skipped** (60.5% skip rate - indicates incomplete suite)
- **1 unhandled error** (vitest-worker timeout)
```

**Deliverable:** Complete test assessment with coverage gaps and brittle test list

### Task 2.2: Configuration Audit

**For all config files in `config/`, `docker/`, `deployment/`:**

1. **Inventory:**
    - File path
    - Purpose (what uses this config)
    - Current usage (active, stale, unknown)
    - Stale keys (keys present but not read by code)
    - Missing keys (keys read by code but not in config)
    - Documentation (is purpose documented)

2. **Check for:**
    - Duplicate configs (same settings in multiple files)
    - Conflicting configs (different values for same setting)
    - Dead configs (files not loaded by any code)
    - Secrets in configs (API keys, passwords - security issue)

**Special Attention:**

- `.env` vs `.env.example` (are they in sync?)
- `docker-compose*.yml` (multiple versions - which is canonical?)
- `config/openwebrx/` (many config files - are all needed?)

**Output Format:**

```markdown
## Configuration Audit

### Active Configs

1. **config/vite.config.ts**
    - Purpose: Vite build configuration
    - Usage: ✅ Active (build process)
    - Issues: None
    - Stale keys: None detected

2. **config/openwebrx/** (27 files)
    - Purpose: OpenWebRX SDR configuration
    - Usage: ⚠️ Uncertain (is OpenWebRX still used?)
    - Issues: Duplicate configs across 3 subdirectories
    - Recommendation: Consolidate or document which is active

### Stale Configs (Dead Code Candidates)

1. **config/coral-worker.service**
    - Purpose: Coral TPU worker systemd service
    - Usage: ❌ Dead (Coral TPU removed in commit 92c6c3d)
    - Action: DELETE in Phase 2

### Security Issues

1. **ARGOS_API_KEY in .env**
    - Status: ✅ Gitignored, documented in .env.example
    - No issues

### Config Debt

- **Duplicate OpenWebRX configs** (openwebrx/, openwebrx-usrp-config/, openwebrx-usrp-working/)
- **Unclear which is active** (needs documentation)
```

**Deliverable:** Config inventory with stale/duplicate/security issues flagged

### Task 2.3: Documentation Audit

**For all `.md` files in `docs/`, `plans/`, project root:**

1. **Inventory:**
    - File path
    - Topic
    - Last updated (git log)
    - Accuracy (does it match current code?)
    - Completeness (is it missing critical info?)
    - Staleness (references removed features?)

2. **Check for:**
    - Broken links (internal and external)
    - Outdated screenshots/examples
    - TODOs without owners
    - Contradictions between docs

**Special Attention:**

- `README.md` (is it accurate and welcoming for public GitHub?)
- `CLAUDE.md` (is it accurate for AI agents?)
- `docs/mcp-servers.md` (does it reflect current 7-server architecture?)

**Output Format:**

```markdown
## Documentation Audit

### Accuracy Issues

1. **docs/mcp-servers.md**
    - Last updated: 2026-02-10
    - Status: ✅ Accurate (reflects current 7-server architecture)

2. **README.md**
    - Last updated: 2025-07-15
    - Status: ⚠️ Partially stale
    - Issues:
        - References Ollama integration (removed in commit 8b3cf83)
        - Missing new terminal features (tmux profiles)
    - Action: Update in Phase 4

### Broken Links

- `docs/deployment.md` → link to `/docs/hardware-setup.md` (404)
- Action: Fix in Phase 4

### Missing Documentation

- **GPS satellite details feature** (added in 80cb875, not documented)
- **7 MCP diagnostic servers** (need user guide)
- **Terminal tmux profiles** (added in a3f1824, not documented)

### TODOs Without Owners

- `docs/architecture.md` line 47: "TODO: Document WebSocket architecture"
- Action: Assign owner or delete in Phase 4
```

**Deliverable:** Doc inventory with accuracy/staleness/broken links flagged

### Task 2.4: Script Audit

**For all scripts in `scripts/`, `build-tools/`, `deployment/`:**

1. **Inventory:**
    - File path
    - Purpose
    - Usage frequency (git log, package.json references)
    - Dependencies (what it requires)
    - Error handling (does it fail gracefully?)
    - Documentation (--help, comments)

2. **Check for:**
    - Dead scripts (not called anywhere)
    - Duplicate functionality
    - Missing error handling
    - Hard-coded paths (portability issue)

**Output Format:**

```markdown
## Script Audit

### Active Scripts

1. **scripts/tmux-zsh-wrapper.sh**
    - Purpose: Wrapper for terminal tmux sessions
    - Usage: ✅ Active (called by terminal store)
    - Error handling: ✅ Good (set -euo pipefail)
    - Documentation: ⚠️ Minimal (no --help)
    - Action: Add usage documentation in Phase 4

### Dead Scripts (Candidates for Deletion)

1. **scripts/coral-setup.sh**
    - Purpose: Coral TPU setup
    - Usage: ❌ Dead (Coral TPU removed)
    - Action: DELETE in Phase 2

### Quality Issues

1. **build-tools/generate-icons.sh**
    - Missing: Error handling (no set -e)
    - Missing: Input validation
    - Hard-coded: Icon sizes
    - Action: Refactor in Phase 4
```

**Deliverable:** Script inventory with dead/quality issues flagged

---

## Architecture Pattern Identification

Based on file organization observed during survey, classify the project's architecture:

**Patterns:**

1. **Feature-based:** Files grouped by domain/feature (e.g., all gsm-evil files together)
2. **Layer-based:** Files grouped by type (e.g., all components together, all services together)
3. **Hybrid:** Mix of both (some features colocated, some by layer)
4. **No clear pattern:** Inconsistent organization

**Analysis:**

- Count files in each pattern
- Identify dominant pattern
- Flag inconsistencies
- Recommend target pattern for Phase 3

**Output Format:**

```markdown
## Architecture Pattern Analysis

### Current State: HYBRID (Inconsistent)

**Feature-based areas:**

- `src/routes/gsm-evil/` (GSM Evil feature)
- `src/routes/dashboard/` (Dashboard feature)

**Layer-based areas:**

- `src/lib/components/` (all components together)
- `src/lib/services/` (all services together)
- `src/lib/stores/` (all stores together)

**Inconsistencies:**

- GSM Evil: route + page colocated, but components/stores/services separated
- Dashboard: same pattern (route + page colocated, dependencies separated)

### Recommendation for Phase 3

**Target:** Feature-based with shared layer
```

src/
features/
gsm-evil/
components/
services/
stores/
+page.svelte
dashboard/
components/
services/
stores/
+page.svelte
shared/
components/
services/
stores/

```

**Justification:** High temporal coupling (files change together) suggests feature colocation

**Alternative:** Keep current hybrid (less disruptive, still consistent if documented)
```

**Deliverable:** Architecture pattern identified with Phase 3 recommendation

---

## Quality Gate

Phase 1 cannot proceed to Phase 1.5 until ALL of the following are complete:

- [ ] **File inventory** complete (all 6,078 files documented)
- [ ] **Function inventory** complete (hotspot files only, ~500-1000 functions)
- [ ] **Dependency graph** complete (circular deps flagged, temporal coupling identified)
- [ ] **Seam map** produced (tightly coupled code has identified testability entry points)
- [ ] **Test assessment** complete (coverage %, brittle tests, gaps documented)
- [ ] **Config audit** complete (stale/duplicate/security issues flagged)
- [ ] **Documentation audit** complete (accuracy/broken links/TODOs flagged)
- [ ] **Script audit** complete (dead scripts flagged)
- [ ] **Architecture pattern** identified (feature-based, layer-based, hybrid, none)

**Proof Artifacts:**

- `plans/issues/phase-1-survey-production-report.md` (Survey-Production)
- `plans/issues/phase-1-survey-infrastructure-report.md` (Survey-Infrastructure)

**Team Lead Review:**

- Spot-check 10 random files from inventory (completeness verification)
- Verify circular dependencies are accurately identified
- Confirm test coverage numbers match baseline
- Approve or request revisions

**No exceptions.** Phase 1.5 (Test Cleanup) is **blocked** until survey is complete. Cannot write characterization tests without knowing what's untested. Cannot refactor tests without knowing what's brittle.

---

## MCP Server Usage

**Survey-Production Agent:**

- `octocode.localSearchCode` — Find all files, search for patterns
- `octocode.localViewStructure` — Understand directory structure
- `octocode.lspGotoDefinition` — Find function definitions
- `octocode.lspFindReferences` — Find all usages
- `octocode.lspCallHierarchy` — Understand call relationships

**Survey-Infrastructure Agent:**

- `argos-test-runner.run_tests` — Run test suite with coverage
- Standard file reading for configs/docs/scripts

**Both Agents:**

- `Read` — Read individual files
- `Grep` — Search for patterns
- `Bash` — Run git log analysis, file statistics

---

## Timeline

**Estimated: 3-4 hours (agents work in parallel)**

- Survey-Production: 3-4 hours (larger scope, 2,860 files)
- Survey-Infrastructure: 2-3 hours (smaller scope, 3,218 files but simpler analysis)

**Both start simultaneously, complete independently, team lead merges results.**

---

## Next Phase

**Phase 1.5: Test Cleanup** (blocked until Phase 1 complete)

Phase 1 deliverables feed directly into Phase 1.5:

- **Test assessment** → Identifies which tests to fix (brittle tests list)
- **Coverage gaps** → Identifies where to write characterization tests
- **Seam map** → Guides how to test tightly coupled code
- **Function inventory** → Provides signatures for characterization tests

**No guessing. Survey first, then test.**

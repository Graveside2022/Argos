# Phase 2: Dead Code Elimination Plan

**Date:** 2026-02-11
**Owners:** DeadCode-Python, DeadCode-TypeScript, DeadCode-Infrastructure
**Estimated Duration:** 2-3 hours
**Dependencies:** Phase 1.5 complete
**Blocks:** Phase 3, 4, 5

---

## Objective

**Remove every piece of code that serves no purpose.**

Dead code is not harmless:

- Confuses readers (increases cognitive load)
- Obscures intent
- Inflates the codebase
- Creates false dependencies
- Wastes time during searches

**Principle:** "Every file, function, variable, import, and line of code must earn its place" (TF-5: Clean Code)

---

## Dead Code Categories

1. **Unreachable Code** — Code after return/break/throw, impossible conditions
2. **Unused Variables** — Declared but never read
3. **Unused Functions/Methods** — Defined but never called
4. **Unused Imports** — Imported but never referenced
5. **Commented-Out Code** — Git history preserves this
6. **Dead Parameters** — Function params never used in body
7. **Orphaned Files** — Not imported by any other file
8. **Leftover Scaffolding** — Boilerplate never customized
9. **Dead Configuration** — Config keys nothing reads
10. **Speculative Generality** — Abstractions for hypothetical future needs (YAGNI)

---

## Team Structure

### DeadCode-Python Agent

**Scope:** `service/`, `hackrf_emitter/` Python code
**Tools:** pylint, vulture, manual analysis
**Output:** Commits to dev_branch (one per category)

### DeadCode-TypeScript Agent

**Scope:** `src/` TypeScript/Svelte code
**Tools:** ESLint, TypeScript compiler, manual analysis
**Output:** Commits to dev_branch (one per category)

### DeadCode-Infrastructure Agent

**Scope:** `config/`, `scripts/`, `docs/`, `deployment/`
**Output:** Commits to dev_branch

---

## Safety Protocol (MANDATORY)

### Rule DC-1: Prove Before Deleting

**Never delete based on a hunch. Prove it's unused:**

```bash
# Search entire codebase for references
grep -r "functionName" . --exclude-dir=node_modules --exclude-dir=.git

# Check for DYNAMIC references (CRITICAL)
grep -r "getattr.*functionName" .  # Python reflection
grep -r "\[.*functionName.*\]" .    # JavaScript property access
grep -r "eval\|Function\(" .        # Eval-based calls
```

**If you cannot prove it's unused → FLAG IT, don't delete it.**

### Rule DC-2: One Category at a Time

Remove in logical groups, separate commits:

1. Dead imports
2. Dead functions
3. Dead files
4. Commented-out code

**Never mix categories.** Makes review and rollback straightforward.

### Rule DC-3: Verify After Each Removal

```bash
# After each category removal:
npm run lint      # No new errors
npm test          # Same pass count
npm run build     # Still builds

# If ANY break → revert and investigate
git revert HEAD
```

### Rule DC-4: Never Comment Out — Delete

Either code is alive (stays) or dead (deleted). Git history is the archive.

---

## DeadCode-Python: Execution Plan

### Step 1: Analyze with Tools

```bash
# Find unused code with vulture
vulture service/ hackrf_emitter/ --exclude=*.venv* --min-confidence 80

# Find unused imports with pylint
pylint service/ hackrf_emitter/ --disable=all --enable=unused-import
```

### Step 2: Manual Verification

For each finding:

1. Search codebase for references
2. Check for string-based lookups: `getattr(module, "function_name")`
3. Check for dynamic imports: `__import__(module_name)`
4. Check for reflection/metaprogramming
5. If truly unused → add to deletion list

### Step 3: Prioritize by Hotspot

**Order:**

1. Dead code in **critical hotspots** (Phase 0 top 10)
2. Dead code in high-churn files
3. Dead code in stable files

**Rationale:** Cleaning hotspots delivers highest ROI.

### Step 4: Remove by Category

**Category 1: Dead Imports**

```bash
# Find and remove
# Commit: "chore(python): remove unused imports"
# Verify: pytest && black --check .
```

**Category 2: Dead Functions**

```bash
# Find and remove
# Commit: "chore(python): remove unused functions"
# Verify: pytest && black --check .
```

**Category 3: Dead Files**

```bash
# Find and remove
# Commit: "chore(python): remove orphaned files"
# Verify: pytest && build
```

**Category 4: Commented-Out Code**

```bash
# Find with: grep -r "^#.*def \|^#.*class " service/
# Remove
# Commit: "chore(python): remove commented-out code"
```

**Category 5: Dead Config**

```bash
# Check config files for unused keys
# Commit: "chore(python): remove unused config keys"
```

### Expected Output

**Before:**

- Unknown number of dead imports, functions, files

**After:**

- 0 unused imports
- 0 unused functions
- 0 orphaned files
- 0 commented-out code
- Tests still passing

**Commits:** 5 commits (one per category)

---

## DeadCode-TypeScript: Execution Plan

### Step 1: Analyze with Tools

```bash
# TypeScript unused exports
npx ts-prune

# ESLint unused vars
npm run lint -- --fix

# Find imports
npx depcheck  # unused dependencies
```

### Step 2: Check for Dynamic References (CRITICAL)

TypeScript/JavaScript dynamic features:

```typescript
// String-based property access
obj['methodName']();
obj[variableName]();

// Eval
eval('functionName()');

// Dynamic imports
import(`./modules/${moduleName}`);

// Reflection
Reflect.get(obj, 'methodName');
```

**Must manually verify** these aren't calling "unused" code.

### Step 3: Check External Callers

**MCP Servers:**

- `src/lib/server/mcp/servers/*.ts` may call functions dynamically
- Check each server for string-based function calls

**API Endpoints:**

- Public API routes may be called externally
- Flag any endpoint deletion as HIGH RISK
- Verify no external clients before deleting

### Step 4: Remove by Category

Same as Python (imports → functions → files → commented code → config)

**Special Attention:**

- Svelte component unused exports (may be used by other components)
- Store subscriptions (unused stores may still be subscribed)
- TypeScript type definitions (used for type-checking only)

### Expected Output

**Before:**

- Unknown unused code in `src/` (~260 files)

**After:**

- 0 unused imports
- 0 unused exports
- 0 orphaned files
- ESLint clean

**Commits:** 5 commits (one per category)

---

## DeadCode-Infrastructure: Execution Plan

### Step 1: Configuration Files

**From Phase 1 survey:** Stale config list

**Example:**

- `config/coral-worker.service` (Coral TPU removed)
- Duplicate OpenWebRX configs (consolidate)

**Process:**

1. Review Phase 1 config audit
2. For each stale config: verify not loaded by code
3. Delete confirmed dead configs
4. Commit: "chore(config): remove stale configuration files"

### Step 2: Scripts

**From Phase 1 survey:** Dead script list

**Example:**

- `scripts/coral-setup.sh` (Coral TPU removed)

**Process:**

1. Review Phase 1 script audit
2. Check each script:
    - Called in package.json? → Keep
    - Called in systemd services? → Keep
    - Called in deployment? → Keep
    - Not called anywhere? → Delete
3. Commit: "chore(scripts): remove unused scripts"

### Step 3: Documentation

**Dead docs (from Phase 1):**

- Docs for removed features
- Broken links (404s)
- Duplicate docs

**Process:**

1. Delete docs for removed features
2. Fix or remove broken links
3. Consolidate duplicates
4. Commit: "docs: remove outdated documentation"

### Expected Output

**Commits:** 3 commits (config, scripts, docs)

---

## Hotspot Priority Strategy

**Apply Tornhill's principle (TF-8):** Clean the 4% that causes 72% of problems first.

**Order:**

1. **Top 3 Critical Hotspots** (gsm-evil/+page.svelte, DashboardMap, TopStatusBar)
    - Remove dead imports FIRST (reduces cognitive load immediately)
    - Remove dead functions
    - Clean up commented-out code

2. **Remaining Top 10 Hotspots**
    - Same process

3. **Rest of Codebase**
    - Lower priority, can defer if time-constrained

**Verification per hotspot:**

```bash
# Before
git show HEAD:src/routes/gsm-evil/+page.svelte | wc -l
# 3096 lines

# After dead code removal
cat src/routes/gsm-evil/+page.svelte | wc -l
# 2847 lines (-249 lines of dead code)
```

---

## Quality Gate

Phase 2 cannot proceed to Phase 3 until:

- [ ] **All dead imports removed** (ESLint/pylint clean)
- [ ] **All dead functions removed** (ts-prune/vulture clean)
- [ ] **All dead files removed** (no orphaned files)
- [ ] **All commented-out code removed**
- [ ] **All dead configuration removed**
- [ ] **Tests pass** (same pass count as Phase 1.5 baseline)
- [ ] **App builds** (npm run build succeeds)
- [ ] **App runs** (npm run dev starts without errors)

**Verification:**

```bash
# Run full verification suite
npm run lint       # 0 warnings
npm test           # ≥380 passed
npm run build      # ✓ built
npm run typecheck  # 0 errors

# Visual check: does app work?
npm run dev
# Navigate to /dashboard, /gsm-evil, /tactical-map
# Verify no console errors, no 500 errors
```

**Team Lead Review:**

- Spot-check 10 deletions (were they truly unused?)
- Verify tests still pass
- Verify build still succeeds
- Check git diff (are only dead code changes present?)

---

## Commit Strategy

**Format:**

```
chore(scope): remove <category>

Removed <N> <category> from <scope>.
All tests pass after removal.

Files changed: <list>

Phase: 2 (Dead Code Elimination)
Agent: DeadCode-<Agent>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Example:**

```
chore(gsm-evil): remove unused imports

Removed 12 unused imports from GSM Evil page and API routes.
All tests pass after removal.

Files changed:
- src/routes/gsm-evil/+page.svelte
- src/routes/api/gsm-evil/control/+server.ts
- src/lib/services/gsm-evil/gsm-service.ts

Phase: 2 (Dead Code Elimination)
Agent: DeadCode-TypeScript
```

---

## Risk Mitigation

### Risk: Deleting code that's actually used (false positive)

**Mitigation:**

- Prove unused before deleting (search entire codebase)
- Check for dynamic references manually
- Verify tests pass after each deletion
- Rollback tag allows instant revert

### Risk: Breaking external API consumers

**Mitigation:**

- Phase 1 survey identified external callers
- Flag all API endpoint changes as HIGH RISK
- Verify no external clients before deleting

### Risk: Deleting code needed for future features

**Mitigation:**

- If code is truly unused NOW, delete it
- Git history preserves all deleted code
- Can resurrect from git history if needed
- YAGNI principle: don't keep code for hypothetical future

---

## Success Metrics

**Before Phase 2:**

- Unknown amount of dead code
- Cluttered hotspot files (3,096+ LOC)

**After Phase 2:**

- 0 unused imports
- 0 unused functions
- 0 orphaned files
- 0 commented-out code
- Hotspot files ~10-15% smaller (estimated 250-400 LOC removed per hotspot)

**Estimated Total Removal:** 1,000-2,000 LOC across entire codebase

---

## Next Phase

**Phase 3: Organization**

With dead code removed, the remaining code is all active and necessary. Now we can organize it properly without wasting time organizing dead weight.

**Principle:** Don't organize what you're going to delete. Delete first, then organize.

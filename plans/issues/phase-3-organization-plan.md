# Phase 3: Organization Plan

**Date:** 2026-02-11
**Owners:** Organize-Services, Organize-Components, Organize-Infrastructure
**Estimated Duration:** 3-4 hours
**Dependencies:** Phase 2 complete
**Blocks:** Phase 4

---

## Objective

**Organize the remaining active code into a logical, maintainable structure.**

Phase 2 removed all dead code. Now every remaining file, function, and line serves a purpose. Phase 3 organizes this active code to maximize clarity and minimize future friction.

**Principle:** "A place for everything, and everything in its place" (TF-6: Structural Integrity)

---

## Organization Categories

1. **File Structure** — Group related files, flatten unnecessary nesting
2. **Function Placement** — Functions near their call sites, cohesive modules
3. **Import Organization** — Consistent import ordering, alias management
4. **Type Definitions** — Centralized vs. colocated type placement
5. **Service Layer** — Business logic extraction from routes
6. **Component Hierarchy** — Shared vs. page-specific components
7. **Configuration Consolidation** — Merge duplicate configs
8. **Script Organization** — Group by lifecycle (dev, build, deploy, ops)
9. **Documentation Structure** — Align docs with code organization
10. **Test Organization** — Mirror source structure

---

## Team Structure

### Organize-Services Agent

**Scope:** `src/routes/api/`, `src/lib/services/`, `src/lib/server/`
**Focus:** Service layer extraction, API organization, business logic placement
**Output:** Commits to dev_branch (one per category)

### Organize-Components Agent

**Scope:** `src/lib/components/`, `src/routes/` (Svelte components)
**Focus:** Component hierarchy, shared vs. page-specific, prop patterns
**Output:** Commits to dev_branch (one per category)

### Organize-Infrastructure Agent

**Scope:** `config/`, `scripts/`, `docs/`, root config files
**Focus:** Configuration consolidation, script grouping, doc alignment
**Output:** Commits to dev_branch (one per category)

---

## Safety Protocol (MANDATORY)

### Rule ORG-1: Never Break Imports

**Every refactor must preserve import paths OR update all references.**

```bash
# Before moving file:
grep -r "from.*oldPath" src/

# After moving:
# Update ALL import statements to new path
# Verify no broken imports with TypeScript
npm run typecheck  # 0 errors expected
```

**If moving files breaks imports → revert and plan differently.**

### Rule ORG-2: One Organizational Change at a Time

Separate commits for:

1. Import ordering cleanup
2. File moves/renames
3. Function relocations
4. Type definition centralization

**Never mix multiple organizational changes.** Makes review and rollback straightforward.

### Rule ORG-3: Verify After Each Change

```bash
# After each organizational change:
npm run lint      # No new errors
npm test          # Same pass count
npm run build     # Still builds

# If ANY break → revert and investigate
git revert HEAD
```

### Rule ORG-4: Document Rationale in Commits

Each organizational change commit must explain **why** in the message:

```
refactor(services): extract business logic from API routes

Moved HackRF control logic from routes to service layer.
Improves testability and separates HTTP concerns from business logic.

Files changed:
- src/routes/api/hackrf/control/+server.ts (simplified)
- src/lib/services/hackrf-service.ts (new business logic home)

Phase: 3 (Organization)
Agent: Organize-Services
```

---

## Organize-Services: Execution Plan

### Step 1: Identify Service Layer Violations

**Pattern to find:**

- Business logic in route handlers (should be in services)
- Database queries in routes (should be in services)
- Complex validation in routes (should be in services)

**Tools:**

```bash
# Find large route handlers (>100 LOC = likely has business logic)
find src/routes/api -name "+server.ts" -exec wc -l {} \; | sort -rn | head -20

# Check for direct DB access in routes
grep -r "db\." src/routes/api/
```

### Step 2: Extract Business Logic (Priority: Top 10 Hotspots)

**Target Pattern:**

**Before (Route has business logic):**

```typescript
// src/routes/api/hackrf/control/+server.ts
export async function POST({ request }) {
	const data = await request.json();

	// ❌ Business logic in route
	if (data.frequency < 800 || data.frequency > 6000) {
		throw error(400, 'Invalid frequency');
	}

	const result = await db.insert('signals', data);
	return json(result);
}
```

**After (Route delegates to service):**

```typescript
// src/routes/api/hackrf/control/+server.ts
import { hackrfService } from '$lib/services/hackrf-service';

export async function POST({ request }) {
	const data = await request.json();
	const result = await hackrfService.startSweep(data);
	return json(result);
}

// src/lib/services/hackrf-service.ts
export const hackrfService = {
	async startSweep(params: SweepParams) {
		// ✅ Business logic in service
		if (params.frequency < 800 || params.frequency > 6000) {
			throw new Error('Invalid frequency');
		}

		const result = await db.insert('signals', params);
		return result;
	}
};
```

### Step 3: Organize Import Statements

**Consistent ordering across all files:**

```typescript
// 1. External dependencies (sorted alphabetically)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// 2. Internal lib imports (sorted by depth)
import { hackrfService } from '$lib/services/hackrf-service';
import { validateFrequency } from '$lib/server/security/input-sanitizer';
import type { SweepParams } from '$lib/types/hackrf';

// 3. Relative imports (if any)
import { localHelper } from './helpers';
```

**Tools:**

```bash
# ESLint can auto-fix import ordering
npm run lint -- --fix
```

### Step 4: Consolidate Type Definitions

**Decision Matrix:**

| Type Scope             | Location             | Example                          |
| ---------------------- | -------------------- | -------------------------------- |
| API request/response   | Colocated with route | `src/routes/api/hackrf/types.ts` |
| Service layer types    | Service directory    | `src/lib/services/types.ts`      |
| Shared across features | Central types        | `src/lib/types/`                 |
| Database schemas       | DB directory         | `src/lib/server/db/schema.ts`    |

**Anti-pattern to fix:**

- Same type defined in multiple files → centralize
- Type imports crossing many boundaries → reconsider placement

### Step 5: API Route Organization

**Current structure:**

```
src/routes/api/
  ├── hackrf/
  ├── kismet/
  ├── gsm-evil/
  └── ...
```

**Verify grouping makes sense:**

- Feature-aligned? ✅
- Consistent depth? ✅
- No orphaned routes? (Check for single-file directories)

**If found:**

- Single route in its own directory → consider flattening
- Routes with 10+ endpoints → consider sub-grouping

### Expected Output

**Before:**

- Business logic scattered across routes and services
- Inconsistent import ordering
- Duplicate type definitions
- Routes mix HTTP and business concerns

**After:**

- Clear service layer separation (routes handle HTTP only)
- Consistent import ordering (ESLint enforced)
- Type definitions in predictable locations
- Business logic testable without HTTP layer

**Commits:** 4-5 commits (service extraction, import ordering, type consolidation, route cleanup)

---

## Organize-Components: Execution Plan

### Step 1: Component Hierarchy Analysis

**Classify components:**

1. **Shared Components** — Used across 3+ pages
2. **Page-Specific Components** — Used by single page
3. **Feature Components** — Used within single feature
4. **Layout Components** — Used for structural layout

**Tools:**

```bash
# Find component usage count
for file in src/lib/components/**/*.svelte; do
  name=$(basename "$file")
  count=$(grep -r "import.*$name" src/routes/ | wc -l)
  echo "$count $file"
done | sort -rn
```

### Step 2: Reorganize Component Directory

**Target structure:**

```
src/lib/components/
  ├── shared/           # 3+ page usage
  │   ├── buttons/
  │   ├── forms/
  │   └── modals/
  ├── layout/           # Structural components
  │   ├── TopStatusBar.svelte
  │   ├── SideNav.svelte
  │   └── Footer.svelte
  └── [feature]/        # Feature-specific
      ├── hackrf/
      ├── kismet/
      └── gsm-evil/
```

**Move criteria:**

- Used 3+ times → `shared/`
- Used for layout → `layout/`
- Used for single feature → `[feature]/`
- Page-specific → keep colocated with page

### Step 3: Component Props Consistency

**Identify inconsistent prop patterns:**

```typescript
// ❌ Inconsistent prop naming
<ComponentA frequency={freq} />
<ComponentB freq={frequency} />

// ✅ Consistent prop naming
<ComponentA frequency={freq} />
<ComponentB frequency={freq} />
```

**Check for:**

- Different names for same concept across components
- Boolean props without `is`/`has`/`should` prefix
- Callback props without `on` prefix

**Fix pattern:**

```typescript
// Before
export let show = false;
export let callback = () => {};

// After
export let isVisible = false;
export let onClose = () => {};
```

### Step 4: Svelte 5 Rune Migration (If Needed)

**Check for legacy patterns:**

```bash
# Find manual subscriptions (should use $effect)
grep -r "\.subscribe\(" src/lib/components/
grep -r "onDestroy.*unsubscribe" src/lib/components/

# Find legacy reactive statements (should use $derived)
grep -r "^\s*\$:" src/lib/components/
```

**Migration pattern:**

```typescript
// ❌ Svelte 4 pattern
let value;
const unsubscribe = store.subscribe((v) => (value = v));
onDestroy(() => unsubscribe());

// ✅ Svelte 5 pattern
$effect(() => {
	const value = $state(store);
	// Auto-cleanup on unmount
});
```

### Step 5: Component Documentation

**Add JSDoc to shared components:**

```typescript
/**
 * Frequency input component with validation
 * @param {number} frequency - Frequency in MHz (800-6000)
 * @param {(freq: number) => void} onFrequencyChange - Callback when frequency changes
 * @param {boolean} disabled - Disable input
 */
export let frequency: number;
export let onFrequencyChange: (freq: number) => void;
export let disabled = false;
```

### Expected Output

**Before:**

- Components scattered across directories
- Inconsistent prop naming
- Legacy Svelte 4 patterns
- No component documentation

**After:**

- Clear component hierarchy (shared, layout, feature-specific)
- Consistent prop naming conventions
- Svelte 5 rune patterns
- JSDoc on all shared components

**Commits:** 4-5 commits (directory reorganization, prop standardization, rune migration, documentation)

---

## Organize-Infrastructure: Execution Plan

### Step 1: Configuration Consolidation

**Audit configuration files:**

```bash
ls -la *.json *.config.* .* | grep -v node_modules
```

**Check for:**

- Duplicate configurations (e.g., multiple ESLint configs)
- Stale configuration (from Phase 2 dead config removal)
- Configuration scattered vs. centralized

**Target consolidation:**

```
Root configs (keep):
- package.json
- tsconfig.json
- svelte.config.js
- vite.config.ts
- tailwind.config.ts
- .env.example
- .gitignore
- .dockerignore

Config directory:
- config/
  ├── eslint.config.js
  ├── playwright.config.ts
  ├── vitest.config.ts
  └── vite-plugin-terminal.ts
```

### Step 2: Script Organization

**Current scripts directory:**

```bash
ls scripts/
```

**Group by lifecycle:**

```
scripts/
  ├── dev/              # Development-time scripts
  │   ├── start-kismet.sh
  │   └── kill-all.sh
  ├── build/            # Build-time scripts
  │   └── validate.sh
  ├── deploy/           # Deployment scripts
  │   └── pre-deploy-check.sh
  └── ops/              # Operations scripts
      ├── backup-db.sh
      └── health-check.sh
```

**Consolidate related scripts:**

- Multiple similar scripts → single script with flags
- Single-use scripts → delete or move to docs as examples

### Step 3: Documentation Alignment

**Ensure docs match code organization:**

```
docs/
  ├── mcp-servers.md          # MCP server documentation
  ├── security-architecture.md # Security patterns
  ├── hardware-patterns.md     # Hardware integration
  ├── websocket-guide.md       # WebSocket usage
  ├── database-guide.md        # Database patterns
  ├── testing-guide.md         # Test strategy
  └── deployment.md            # Deployment guide
```

**Check for:**

- Broken links to moved files
- Documentation referring to deleted features
- Missing documentation for new features

**Fix pattern:**

```bash
# Find broken links
grep -r "\[.*\](.*)" docs/ | while read line; do
  # Extract path, verify file exists
done
```

### Step 4: Root Directory Cleanup

**Root directory should contain ONLY:**

- Essential config files
- README.md
- LICENSE
- package.json / package-lock.json
- Docker files (Dockerfile, docker-compose.yml)
- .gitignore / .dockerignore

**Move to subdirectories:**

- Additional markdown docs → `docs/`
- Scripts → `scripts/`
- Config → `config/` (if possible)

### Step 5: .gitignore Optimization

**Review ignored patterns:**

```bash
cat .gitignore
```

**Ensure ignoring:**

- `node_modules/`
- `.env` (NOT `.env.example`)
- Build artifacts (`build/`, `dist/`, `.svelte-kit/`)
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Logs (`*.log`, `logs/`)
- Database files (`*.db`, `*.sqlite`, `*.db-journal`) if not tracking

**Don't ignore:**

- Configuration examples (`.env.example`)
- Lock files (`package-lock.json`)
- Docker files

### Expected Output

**Before:**

- Configuration files scattered across root
- Scripts grouped by tool, not lifecycle
- Documentation out of sync with code
- Root directory cluttered

**After:**

- Consolidated configuration
- Scripts organized by lifecycle
- Documentation aligned with code structure
- Clean root directory

**Commits:** 3-4 commits (config consolidation, script organization, doc alignment, root cleanup)

---

## Hotspot Organization Strategy

**Apply to Top 10 Hotspots:**

1. **Extract functions** from large files (>200 LOC functions → split)
2. **Colocate helpers** with main logic (move utilities near usage)
3. **Organize imports** (consistent ordering reduces cognitive load)
4. **Add section comments** for files >500 LOC

**Example (gsm-evil/+page.svelte - 3,096 LOC):**

**Before:**

```svelte
<script>
	// 200 imports (unordered)
	import A from 'x';
	import Z from 'y';
	import B from 'z';

	// 1,500 LOC of mixed logic
</script>
```

**After:**

```svelte
<script>
	// External dependencies
	import A from 'x';
	import B from 'z';

	// Internal imports
	import Z from 'y';

	// ========== STATE MANAGEMENT ==========
	// ...

	// ========== EVENT HANDLERS ==========
	// ...

	// ========== EFFECTS ==========
	// ...
</script>
```

**Verification:**

```bash
# Before
cat src/routes/gsm-evil/+page.svelte | wc -l
# 3096 lines

# After organization (no LOC reduction, but structured)
cat src/routes/gsm-evil/+page.svelte | wc -l
# 3096 lines (same, but organized)
```

---

## Quality Gate

Phase 3 cannot proceed to Phase 4 until:

- [ ] **All services extracted** (routes contain only HTTP handling)
- [ ] **All imports consistently ordered** (ESLint clean)
- [ ] **All types logically placed** (no duplicate types)
- [ ] **All components hierarchically organized** (shared, layout, feature-specific)
- [ ] **All props consistently named** (boolean props with is/has/should, callbacks with on)
- [ ] **All scripts grouped by lifecycle** (dev, build, deploy, ops)
- [ ] **All configs consolidated** (no duplicate configs)
- [ ] **All docs aligned with code** (no broken links, features documented)
- [ ] **Tests pass** (same pass count as Phase 2 baseline)
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

- Spot-check 10 organizational changes (do they improve clarity?)
- Verify tests still pass
- Verify build still succeeds
- Check git diff (are only organizational changes present?)
- Read commit messages (is rationale clear?)

---

## Commit Strategy

**Format:**

```
refactor(scope): <organizational change>

<Why this organization improves the codebase>

Files changed: <list>

Phase: 3 (Organization)
Agent: Organize-<Agent>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Example:**

```
refactor(services): extract HackRF business logic from routes

Moved HackRF control logic from API routes to service layer.
Routes now handle only HTTP concerns (request parsing, response formatting).
Business logic is now testable without HTTP layer.

Files changed:
- src/routes/api/hackrf/control/+server.ts (simplified to 25 LOC)
- src/lib/services/hackrf-service.ts (new, 150 LOC business logic)

Phase: 3 (Organization)
Agent: Organize-Services
```

---

## Risk Mitigation

### Risk: Breaking imports during file moves

**Mitigation:**

- Search entire codebase for import statements before moving
- Update all references in single commit with move
- Verify with TypeScript (npm run typecheck)
- Rollback tag allows instant revert

### Risk: Organizing code that's about to be refactored in Phase 4

**Mitigation:**

- Organization is prerequisite for refactoring (can't clean chaos)
- Organized code is easier to refactor (clear structure)
- If organization reveals refactor needs → document for Phase 4

### Risk: Over-organizing (creating unnecessary abstraction)

**Mitigation:**

- Follow established patterns (don't invent new structure)
- YAGNI: organize what exists, don't create structure for hypothetical code
- If uncertain about organization → ask team lead

---

## Success Metrics

**Before Phase 3:**

- Business logic mixed with HTTP handling
- Inconsistent import ordering
- Duplicate type definitions
- Components scattered across directories
- Scripts grouped by tool
- Documentation out of sync

**After Phase 3:**

- Clear service layer separation
- Consistent import ordering (ESLint enforced)
- Type definitions in predictable locations
- Component hierarchy aligned with usage patterns
- Scripts grouped by lifecycle
- Documentation aligned with code structure

**Estimated Time:** 3-4 hours

**Estimated Changes:**

- 50-100 file moves/renames
- 200-400 import statement updates
- 30-60 service layer extractions
- 20-40 component relocations

---

## Next Phase

**Phase 4: Code Cleanup**

With code organized, Phase 4 applies code-level improvements: naming, complexity reduction, pattern consistency, and tactical refactoring of hotspot files.

**Principle:** Organize first, then clean. Can't effectively clean disorganized code.

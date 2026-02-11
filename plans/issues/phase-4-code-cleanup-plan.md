# Phase 4: Code Cleanup Plan

**Date:** 2026-02-11
**Owners:** Cleanup-Naming, Cleanup-Complexity, Cleanup-Patterns
**Estimated Duration:** 4-5 hours
**Dependencies:** Phase 3 complete
**Blocks:** Phase 5

---

## Objective

**Apply code-level improvements to maximize clarity, reduce complexity, and enforce consistency.**

With code organized (Phase 3), Phase 4 tackles code-level quality: naming, complexity, patterns, and tactical refactoring.

**Principle:** "Code should read like well-written prose" (TF-2: Code Clarity)

---

## Cleanup Categories

1. **Naming** — Variable, function, class, file names
2. **Complexity Reduction** — Cyclomatic complexity, nesting depth
3. **Pattern Consistency** — Error handling, async patterns, validation
4. **Magic Numbers** — Extract constants with meaningful names
5. **Comments** — Remove obvious comments, add why-not-what comments
6. **Code Duplication** — Extract shared logic (DRY)
7. **Function Length** — Break up >50 LOC functions
8. **Parameter Count** — Reduce >4 parameter functions
9. **Conditional Simplification** — Reduce nested if/else chains
10. **Type Safety** — Strengthen TypeScript types

---

## Team Structure

### Cleanup-Naming Agent

**Scope:** All TypeScript, JavaScript, Python, Svelte files
**Focus:** Variable/function/class/file naming consistency
**Output:** Commits to dev_branch (one per naming category)

### Cleanup-Complexity Agent

**Scope:** Top 10 hotspot files + high-complexity functions
**Focus:** Cyclomatic complexity reduction, function decomposition
**Output:** Commits to dev_branch (one per complexity reduction)

### Cleanup-Patterns Agent

**Scope:** All source files
**Focus:** Error handling, async patterns, validation consistency
**Output:** Commits to dev_branch (one per pattern category)

---

## Safety Protocol (MANDATORY)

### Rule CLN-1: Preserve Behavior

**Every cleanup must preserve existing behavior.**

```bash
# Before cleanup:
npm test  # Record baseline (e.g., 380 passing)

# After cleanup:
npm test  # Must match baseline (380 passing)

# If test count changes → investigate
# If tests fail → revert and fix
```

**Never break tests during cleanup.**

### Rule CLN-2: One Type of Cleanup at a Time

Separate commits for:

1. Naming changes
2. Complexity reduction
3. Pattern consistency
4. Magic number extraction

**Never mix cleanup types.** Makes review and rollback straightforward.

### Rule CLN-3: Verify After Each Cleanup

```bash
# After each cleanup commit:
npm run lint       # No new errors
npm run typecheck  # No new errors
npm test           # Same pass count
npm run build      # Still builds

# If ANY break → revert and investigate
git revert HEAD
```

### Rule CLN-4: Document Complex Refactorings

If refactoring changes >50 LOC or touches critical path, document in commit message:

```
refactor(gsm-evil): reduce cyclomatic complexity in scan handler

Decomposed 150 LOC scanTowers() function into 5 focused functions:
- validateScanParams()
- initializeHardware()
- performScan()
- processResults()
- cleanupResources()

Cyclomatic complexity: 24 → 6 (threshold: 10)
Tests: All passing, behavior unchanged

Phase: 4 (Code Cleanup)
Agent: Cleanup-Complexity
```

---

## Cleanup-Naming: Execution Plan

### Step 1: Identify Naming Violations

**Tools:**

```bash
# Find single-letter variables (except loop counters)
grep -rn "\b[a-z]\s*=" src/ --include="*.ts" --include="*.js" | grep -v "for.*i\s*="

# Find unclear abbreviations
grep -rn "tmp\|temp\|data\|info\|obj\|val" src/ --include="*.ts" --include="*.js"

# Find inconsistent casing
grep -rn "function [a-z_]" src/  # snake_case functions (should be camelCase)
```

### Step 2: Apply Naming Conventions

**TypeScript/JavaScript:**

```typescript
// ❌ WRONG
let d = new Date();
let tmp = processData(d);
let f = calculateFrequency(tmp);

// ✅ RIGHT
let currentDate = new Date();
let sweepParams = processData(currentDate);
let frequency = calculateFrequency(sweepParams);
```

**Naming Rules:**

- Variables/functions: `camelCase`
- Classes/types: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Private fields: `_camelCase` (if needed, prefer TypeScript `private`)
- Boolean variables: `isActive`, `hasData`, `shouldProcess`
- Callback functions: `onSuccess`, `handleError`, `processResults`

**Python:**

```python
# ❌ WRONG
Var = 123
myFunc = lambda x: x * 2

# ✅ RIGHT
CONSTANT_VALUE = 123
my_func = lambda x: x * 2
```

**Naming Rules:**

- Variables/functions: `snake_case`
- Classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Private methods: `_method_name`

### Step 3: Rename for Clarity (Priority: Top 10 Hotspots)

**Target unclear names:**

```typescript
// ❌ Unclear
let data = fetchSignals();
let result = process(data);
let output = format(result);

// ✅ Clear
let rawSignals = fetchSignals();
let analyzedSignals = process(rawSignals);
let formattedReport = format(analyzedSignals);
```

**Function naming:**

```typescript
// ❌ Unclear verbs
function get() { ... }
function do() { ... }
function handle() { ... }

// ✅ Clear verbs
function fetchSignalData() { ... }
function processFrequencySweep() { ... }
function handleConnectionError() { ... }
```

### Step 4: Consistent File Naming

**Current patterns:**

```bash
# Check for inconsistent file naming
ls src/lib/components/ | grep -E "[A-Z]"  # PascalCase components
ls src/lib/services/ | grep -E "[a-z-]"   # kebab-case services
```

**Enforce consistency:**

- Components: `PascalCase.svelte` (e.g., `TopStatusBar.svelte`)
- Services: `kebab-case.ts` (e.g., `hackrf-service.ts`)
- Utilities: `kebab-case.ts` (e.g., `input-sanitizer.ts`)
- Types: `kebab-case.ts` (e.g., `signal-types.ts`)

### Expected Output

**Before:**

- Single-letter variables
- Unclear abbreviations (tmp, data, info)
- Inconsistent casing
- Unclear function names

**After:**

- Descriptive variable names
- No unclear abbreviations
- Consistent casing (camelCase for TS/JS, snake_case for Python)
- Clear function names with action verbs

**Commits:** 3-4 commits (variable naming, function naming, file naming, constant naming)

---

## Cleanup-Complexity: Execution Plan

### Step 1: Measure Complexity Baseline

**Tools:**

```bash
# Cyclomatic complexity for TypeScript
npx ts-complex src/ --threshold 10

# Function length for TypeScript
find src/ -name "*.ts" -exec wc -l {} \; | sort -rn | head -20

# Python complexity
radon cc service/ hackrf_emitter/ -a -nb
```

**Complexity thresholds:**

- Cyclomatic complexity: ≤10 (target), ≤20 (acceptable), >20 (refactor)
- Function length: ≤50 LOC (target), ≤100 LOC (acceptable), >100 LOC (refactor)
- Nesting depth: ≤3 levels (target), ≤4 levels (acceptable), >4 levels (refactor)
- Parameter count: ≤4 params (target), ≤6 params (acceptable), >6 params (refactor)

### Step 2: Decompose Large Functions (Priority: Top 10 Hotspots)

**Pattern:**

**Before (150 LOC function):**

```typescript
async function scanTowers(params: ScanParams) {
	// Validation (20 LOC)
	if (!params.band) throw new Error('Band required');
	if (params.band !== 'GSM900' && params.band !== 'DCS1800') throw new Error('Invalid band');
	// ... more validation

	// Hardware init (30 LOC)
	const hackrf = await initHackRF();
	hackrf.setGain(params.gain ?? 20);
	hackrf.setFrequency(params.frequency);
	// ... more hardware setup

	// Scanning logic (70 LOC)
	const towers = [];
	for (let freq of frequencies) {
		const signal = await hackrf.sample(freq);
		if (signal.strength > threshold) {
			towers.push({ freq, strength: signal.strength });
		}
		// ... more scanning
	}

	// Cleanup (30 LOC)
	await hackrf.stop();
	await hackrf.close();
	// ... more cleanup

	return towers;
}
```

**After (5 focused functions):**

```typescript
async function scanTowers(params: ScanParams) {
	validateScanParams(params);
	const hardware = await initializeHardware(params);
	const towers = await performScan(hardware, params);
	await cleanupResources(hardware);
	return towers;
}

function validateScanParams(params: ScanParams) {
	if (!params.band) throw new Error('Band required');
	if (!['GSM900', 'DCS1800'].includes(params.band)) {
		throw new Error('Invalid band');
	}
	// ... validation logic (20 LOC)
}

async function initializeHardware(params: ScanParams) {
	const hackrf = await initHackRF();
	hackrf.setGain(params.gain ?? 20);
	hackrf.setFrequency(params.frequency);
	return hackrf;
	// ... hardware setup (30 LOC)
}

async function performScan(hardware: HackRF, params: ScanParams) {
	// ... scanning logic (70 LOC)
}

async function cleanupResources(hardware: HackRF) {
	// ... cleanup logic (30 LOC)
}
```

**Benefits:**

- Cyclomatic complexity: 24 → 6 (per function)
- Function length: 150 LOC → 5-30 LOC
- Testability: Can test each step in isolation
- Readability: Main function shows high-level flow

### Step 3: Reduce Nesting Depth

**Pattern:**

**Before (5 levels of nesting):**

```typescript
async function processSignal(signal: Signal) {
	if (signal.frequency > 800) {
		if (signal.strength > -80) {
			if (signal.type === 'GSM') {
				if (signal.mcc && signal.mnc) {
					if (signal.cellId) {
						// Process valid GSM signal
						await saveSignal(signal);
					}
				}
			}
		}
	}
}
```

**After (guard clauses):**

```typescript
async function processSignal(signal: Signal) {
	// Guard clauses (early returns)
	if (signal.frequency <= 800) return;
	if (signal.strength <= -80) return;
	if (signal.type !== 'GSM') return;
	if (!signal.mcc || !signal.mnc) return;
	if (!signal.cellId) return;

	// Process valid GSM signal (no nesting)
	await saveSignal(signal);
}
```

**Benefits:**

- Nesting depth: 5 → 0
- Cognitive load: Reduced (easier to follow)
- Readability: Clear validation logic

### Step 4: Simplify Complex Conditionals

**Pattern:**

**Before:**

```typescript
if (
	(status === 'active' && (mode === 'sweep' || mode === 'scan')) ||
	(status === 'idle' && canStart) ||
	(status === 'error' && shouldRetry)
) {
	startOperation();
}
```

**After:**

```typescript
const isActiveOperation = status === 'active' && (mode === 'sweep' || mode === 'scan');
const canStartIdle = status === 'idle' && canStart;
const shouldRetryError = status === 'error' && shouldRetry;

if (isActiveOperation || canStartIdle || shouldRetryError) {
	startOperation();
}
```

### Step 5: Reduce Parameter Count

**Pattern:**

**Before (7 parameters):**

```typescript
function createSignal(
	frequency: number,
	strength: number,
	type: string,
	timestamp: number,
	latitude: number,
	longitude: number,
	metadata: unknown
) {
	// ...
}
```

**After (1 parameter object):**

```typescript
interface SignalParams {
	frequency: number;
	strength: number;
	type: string;
	timestamp: number;
	location: { latitude: number; longitude: number };
	metadata?: unknown;
}

function createSignal(params: SignalParams) {
	// ...
}
```

### Expected Output

**Before:**

- Functions >100 LOC
- Cyclomatic complexity >20
- Nesting depth >4
- Parameter count >6

**After:**

- Functions ≤50 LOC (target)
- Cyclomatic complexity ≤10
- Nesting depth ≤3
- Parameter count ≤4

**Commits:** 4-5 commits (function decomposition, nesting reduction, conditional simplification, parameter reduction, complexity verification)

---

## Cleanup-Patterns: Execution Plan

### Step 1: Standardize Error Handling

**Current patterns:**

```bash
# Find inconsistent error handling
grep -rn "throw new Error" src/
grep -rn "throw error" src/
grep -rn "console.error" src/
```

**Target pattern:**

```typescript
// ❌ Inconsistent
throw new Error('Something failed');
throw error(500, 'Something failed');
console.error('Something failed');
return { error: 'Something failed' };

// ✅ Consistent (use errorResponse helper)
import { errorResponse } from '$lib/server/security/error-response';

// In API routes
return errorResponse('Something failed', 500);

// In services
throw new Error('Something failed'); // Caught by route handler

// In validation
if (!valid) throw new Error('Validation failed');
```

### Step 2: Standardize Async Patterns

**Target pattern:**

```typescript
// ❌ Mixed async patterns
someFunc().then(result => process(result));
await otherFunc().then(result => process(result));
callback((err, result) => { ... });

// ✅ Consistent async/await
const result = await someFunc();
process(result);
```

**Convert callbacks to promises:**

```typescript
// Before
function doSomething(callback: (err: Error | null, result: string) => void) {
	// ...
}

// After
async function doSomething(): Promise<string> {
	// ...
}
```

### Step 3: Standardize Validation Patterns

**Current patterns:**

```bash
# Find validation inconsistencies
grep -rn "validateFrequency\|validatePid\|validateNumericRange" src/
```

**Target pattern:**

```typescript
// ✅ Consistent validation (use input-sanitizer)
import { validateFrequency, validatePid } from '$lib/server/security/input-sanitizer';

// Validate inputs BEFORE using
const freq = validateFrequency(userInput.frequency);
const pid = validatePid(userInput.pid);

// Then use validated values
execFile('hackrf_sweep', ['-f', freq.toString()]);
```

### Step 4: Extract Magic Numbers

**Pattern:**

**Before:**

```typescript
if (frequency < 800 || frequency > 6000) {
	throw new Error('Invalid frequency');
}

if (signal.strength < -120) {
	return; // Too weak
}

setTimeout(() => retry(), 5000);
```

**After:**

```typescript
const FREQUENCY_MIN = 800; // MHz
const FREQUENCY_MAX = 6000; // MHz
const SIGNAL_STRENGTH_THRESHOLD = -120; // dBm
const RETRY_DELAY = 5000; // ms

if (frequency < FREQUENCY_MIN || frequency > FREQUENCY_MAX) {
	throw new Error('Invalid frequency');
}

if (signal.strength < SIGNAL_STRENGTH_THRESHOLD) {
	return; // Too weak
}

setTimeout(() => retry(), RETRY_DELAY);
```

### Step 5: Remove Obvious Comments, Add Why Comments

**Pattern:**

**Before:**

```typescript
// Set frequency to 900
const freq = 900;

// Loop through signals
for (const signal of signals) {
	// Process signal
	process(signal);
}
```

**After:**

```typescript
// 900 MHz is center of GSM900 downlink band
const freq = 900;

for (const signal of signals) {
	process(signal);
}
```

**Why-not-what pattern:**

```typescript
// ❌ What comment (obvious from code)
// Create a new array
const result = [];

// ✅ Why comment (explains rationale)
// Pre-allocate array size to avoid reallocation during scan
const result = new Array(expectedCount);
```

### Step 6: Eliminate Code Duplication (DRY)

**Pattern:**

**Before:**

```typescript
// File A
function formatSignalA(signal: Signal) {
	return {
		freq: signal.frequency.toFixed(2),
		strength: signal.strength.toFixed(1),
		timestamp: new Date(signal.timestamp).toISOString()
	};
}

// File B
function formatSignalB(signal: Signal) {
	return {
		freq: signal.frequency.toFixed(2),
		strength: signal.strength.toFixed(1),
		timestamp: new Date(signal.timestamp).toISOString()
	};
}
```

**After:**

```typescript
// shared-utils.ts
export function formatSignal(signal: Signal) {
	return {
		freq: signal.frequency.toFixed(2),
		strength: signal.strength.toFixed(1),
		timestamp: new Date(signal.timestamp).toISOString()
	};
}

// File A and B
import { formatSignal } from './shared-utils';
const formatted = formatSignal(signal);
```

**DRY threshold:** If code appears 3+ times → extract to shared function.

### Step 7: Strengthen TypeScript Types

**Pattern:**

**Before:**

```typescript
function processSignal(signal: any) {
	return signal.frequency * 2;
}

let config: Record<string, unknown> = {};
```

**After:**

```typescript
interface Signal {
	frequency: number;
	strength: number;
	type: 'GSM' | 'LTE' | 'WiFi';
}

function processSignal(signal: Signal): number {
	return signal.frequency * 2;
}

interface Config {
	apiKey: string;
	timeout: number;
	retries?: number;
}

const config: Config = {
	apiKey: process.env.ARGOS_API_KEY ?? '',
	timeout: 5000
};
```

**Avoid:**

- `any` (use specific types)
- `unknown` (use type guards)
- `Record<string, unknown>` (use interfaces)

### Expected Output

**Before:**

- Inconsistent error handling
- Mixed async patterns (callbacks, .then(), async/await)
- Magic numbers scattered
- Obvious comments
- Code duplication
- Weak TypeScript types (`any`, `unknown`)

**After:**

- Consistent error handling (errorResponse helper)
- Async/await everywhere
- Named constants for magic numbers
- Why-not-what comments
- No duplicate code (DRY enforced)
- Strong TypeScript types

**Commits:** 5-6 commits (error handling, async patterns, validation, magic numbers, comments, DRY, type safety)

---

## Hotspot-Specific Cleanup Strategy

**Apply aggressive cleanup to Top 3 Critical Hotspots:**

1. **gsm-evil/+page.svelte (3,096 LOC)**
    - Extract 10-15 functions from 500+ LOC sections
    - Reduce cyclomatic complexity in event handlers
    - Extract magic numbers (frequencies, thresholds)
    - Standardize async patterns

2. **DashboardMap.svelte (1,436 LOC)**
    - Decompose large rendering functions
    - Extract marker/layer logic to utilities
    - Standardize map event handlers
    - Remove duplicate marker formatting code

3. **TopStatusBar.svelte (1,195 LOC)**
    - Extract status polling logic
    - Simplify conditional rendering
    - Standardize error display patterns
    - Remove duplicate formatting functions

**Verification per hotspot:**

```bash
# Before cleanup
npx ts-complex src/routes/gsm-evil/+page.svelte
# Average complexity: 18

# After cleanup
npx ts-complex src/routes/gsm-evil/+page.svelte
# Average complexity: 8 (target: ≤10)
```

---

## Quality Gate

Phase 4 cannot proceed to Phase 5 until:

- [ ] **All naming violations fixed** (no single-letter vars, unclear abbrevs)
- [ ] **All complexity thresholds met** (cyclomatic ≤10, function length ≤50 LOC)
- [ ] **All patterns consistent** (error handling, async, validation)
- [ ] **All magic numbers extracted** (named constants with units)
- [ ] **All comments meaningful** (why-not-what, no obvious comments)
- [ ] **All duplication removed** (DRY enforced, 3+ occurrences extracted)
- [ ] **All TypeScript types strong** (no `any`, minimal `unknown`)
- [ ] **Tests pass** (same pass count as Phase 3 baseline)
- [ ] **App builds** (npm run build succeeds)
- [ ] **App runs** (npm run dev starts without errors)

**Verification:**

```bash
# Run full verification suite
npm run lint       # 0 warnings
npm run typecheck  # 0 errors
npm test           # ≥380 passed
npm run build      # ✓ built

# Complexity check
npx ts-complex src/ --threshold 10  # All files pass

# Visual check: does app work?
npm run dev
# Navigate to /dashboard, /gsm-evil, /tactical-map
# Verify no console errors, no 500 errors
```

**Team Lead Review:**

- Spot-check 10 cleanup changes (do they improve code quality?)
- Verify complexity metrics improved
- Verify tests still pass
- Check git diff (are only cleanup changes present?)
- Read commit messages (is rationale clear?)

---

## Commit Strategy

**Format:**

```
refactor(scope): <cleanup category>

<What was improved and why>

Files changed: <list>
Metrics: <before → after>

Phase: 4 (Code Cleanup)
Agent: Cleanup-<Agent>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Example:**

```
refactor(gsm-evil): reduce cyclomatic complexity in scan handler

Decomposed 150 LOC scanTowers() function into 5 focused functions:
- validateScanParams() (validation logic)
- initializeHardware() (HackRF setup)
- performScan() (scanning logic)
- processResults() (result formatting)
- cleanupResources() (hardware cleanup)

Metrics:
- Cyclomatic complexity: 24 → 6
- Function length: 150 LOC → 25 LOC (avg per function)
- Nesting depth: 5 → 2

Tests: All passing, behavior unchanged

Phase: 4 (Code Cleanup)
Agent: Cleanup-Complexity
```

---

## Risk Mitigation

### Risk: Breaking behavior during refactoring

**Mitigation:**

- Tests MUST pass after every cleanup
- Verify behavior manually for critical paths
- Rollback tag allows instant revert
- Small commits allow granular rollback

### Risk: Over-refactoring (premature abstraction)

**Mitigation:**

- Extract only when duplication appears 3+ times (Rule of Three)
- Don't create abstractions for hypothetical future needs (YAGNI)
- If uncertain → ask team lead before extracting

### Risk: Introducing new bugs during complexity reduction

**Mitigation:**

- Decompose functions using extract method refactoring (safe)
- Verify with tests after each decomposition
- Add characterization tests before refactoring if coverage <60%

---

## Success Metrics

**Before Phase 4:**

- Average cyclomatic complexity: 12-18 (hotspots)
- Functions >100 LOC: 15-25
- Magic numbers: 100-200 across codebase
- Code duplication: 50-100 instances
- Weak types: 30-50 `any` usages

**After Phase 4:**

- Average cyclomatic complexity: ≤10
- Functions >100 LOC: 0-5 (only justifiable cases)
- Magic numbers: 0 (all extracted to named constants)
- Code duplication: 0-10 (only acceptable cases)
- Weak types: 0-5 (only where truly necessary)

**Estimated Time:** 4-5 hours

**Estimated Changes:**

- 200-400 LOC refactored (function decomposition)
- 100-200 variables renamed
- 50-100 magic numbers extracted
- 30-60 duplicate code blocks consolidated
- 20-40 type improvements

---

## Next Phase

**Phase 5: Verification & Documentation**

Final phase validates all changes, updates documentation, and creates deployment checklist.

**Principle:** Measure twice, cut once. Verify everything before declaring victory.

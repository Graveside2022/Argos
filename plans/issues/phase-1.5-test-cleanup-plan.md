# Phase 1.5: Test Cleanup Plan

**Date:** 2026-02-11
**Owners:** Test-Refactor, Test-Characterization
**Estimated Duration:** 2-3 hours
**Dependencies:** Phase 1 complete
**Blocks:** Phase 2, 3, 4, 5 ⚠️ **CRITICAL PATH**

---

## Objective

**Fix the test suite BEFORE touching any production code.**

This phase is **mandatory** and **blocking**. You cannot refactor code safely without a clean, comprehensive test suite. Tests are the safety net. A broken safety net means any refactoring is high-risk.

**Current State (from Phase 0):**

- 58 tests failing
- 242 tests skipped (60.5% skip rate)
- Auth not configured for tests (401 errors)
- Timeout issues (vitest-worker errors)
- Unknown coverage on hotspot files

**Target State:**

- ≥95% tests passing (380/400)
- <10% skip rate (40/400)
- 0 failing tests
- 0 unhandled errors
- ≥60% coverage on hotspot files

**Principle:** "Write characterization tests BEFORE refactoring" (TF-4: Feathers)

---

## Team Structure

### Test-Refactor Agent

**Scope:** Fix existing test suite
**Actions:**

- Fix all brittle tests (tests that fail on unrelated changes)
- Configure auth for tests (eliminate 401 errors)
- Fix timeout issues
- Apply Clean Code principles to test code itself
- Reduce skip rate (un-skip tests that can be fixed)

**Output:** Commits to dev_branch with refactored tests

### Test-Characterization Agent

**Scope:** Write new tests for coverage gaps
**Actions:**

- Write characterization tests for hotspot files (<60% coverage)
- Focus on top 10 hotspots first
- Capture current behavior (including bugs) so refactoring drift is visible
- Use seams from Phase 1 to test tightly coupled code

**Output:** Commits to dev_branch with new characterization tests

---

## Test-Refactor: Detailed Tasks

### Task 1: Fix Auth Configuration for Tests

**Problem:** 58 tests failing with "HTTP 401: Unauthorized"

**Root Cause:** `ARGOS_API_KEY` environment variable required for all `/api/*` routes, but not configured in test environment.

**Solutions (pick one):**

**Option A: Mock Auth (Recommended)**

```typescript
// tests/setup.ts
import { vi } from 'vitest';

// Mock auth middleware to always succeed in tests
vi.mock('$lib/server/auth/auth-middleware', () => ({
	verifyApiKey: vi.fn().mockReturnValue({ valid: true }),
	verifySessionCookie: vi.fn().mockReturnValue({ valid: true })
}));
```

**Option B: Configure Test API Key**

```bash
# tests/.env.test
ARGOS_API_KEY=test-key-32-characters-minimum-required
```

```typescript
// vitest.config.ts
export default defineConfig({
	test: {
		env: {
			ARGOS_API_KEY: process.env.ARGOS_API_KEY || 'test-key-32-characters-minimum-required'
		}
	}
});
```

**Option C: Bypass Auth in Test Mode**

```typescript
// src/hooks.server.ts
if (import.meta.env.TEST) {
	// Skip auth in test mode
} else {
	// Normal auth
}
```

**Recommendation:** **Option A (Mock Auth)** - Cleanest, doesn't require real auth, tests auth layer separately.

**Implementation:**

1. Create `tests/mocks/auth.mock.ts`
2. Import in `tests/setup.ts`
3. Verify all 401 errors resolve
4. Commit: `test(auth): mock auth middleware for unit tests`

**Expected Result:** 58 → 0 auth-related failures

### Task 2: Fix Timeout Issues

**Problem:** 1 unhandled error: `vitest-worker timeout`

**Root Cause:** Long-running tests (>5s default timeout) or infinite loops

**Investigation:**

```bash
# Find slow tests
npm test -- --reporter=verbose 2>&1 | grep -E '\d+ms' | sort -rn | head -20
```

**Solutions:**

1. **Increase timeout for slow tests** (short-term)

    ```typescript
    test('slow operation', async () => {
    	// ...
    }, 10000); // 10 second timeout
    ```

2. **Optimize slow tests** (preferred)
    - Replace `sleep()` with mocks
    - Use smaller test datasets
    - Mock heavy operations (DB, hardware, network)

3. **Fix infinite loops** (if any)
    - Add breakpoint debugging
    - Check for missing mock return values

**Implementation:**

1. Identify slow tests (>2s)
2. Analyze why they're slow
3. Optimize or increase timeout appropriately
4. Commit: `test(perf): fix slow tests and timeout issues`

**Expected Result:** 0 unhandled errors

### Task 3: Fix Brittle Tests

**Problem:** Tests that fail on unrelated changes (from Phase 1 survey)

**Brittle Test Patterns:**

#### Pattern 1: Testing Implementation Details

**BAD:**

```typescript
test('renders with correct internal state', () => {
	const component = render(MyComponent);
	expect(component._internalState.counter).toBe(0); // BRITTLE
});
```

**GOOD:**

```typescript
test('displays initial count of zero', () => {
	const { getByText } = render(MyComponent);
	expect(getByText('Count: 0')).toBeInTheDocument(); // Tests behavior
});
```

#### Pattern 2: Hard-Coded Values

**BAD:**

```typescript
test('displays current date', () => {
	expect(result).toBe('2026-02-11'); // BRITTLE: fails tomorrow
});
```

**GOOD:**

```typescript
test('displays current date', () => {
	const today = new Date().toISOString().split('T')[0];
	expect(result).toBe(today); // Robust
});
```

#### Pattern 3: Tight Coupling to Mocks

**BAD:**

```typescript
vi.mock('$lib/services/api', () => ({
	fetchData: vi.fn().mockReturnValue({ id: 1, name: 'Test' }) // BRITTLE: specific shape
}));
```

**GOOD:**

```typescript
vi.mock('$lib/services/api', () => ({
	fetchData: vi.fn().mockImplementation((id) => ({
		id,
		name: `User ${id}`
	})) // Flexible
}));
```

**Implementation:**

1. Review brittle test list from Phase 1 survey
2. Refactor each to test behavior, not implementation
3. Use public API only (no accessing internal state)
4. Make mocks flexible, not rigid
5. Commit: `test(refactor): fix brittle tests to test behavior not implementation`

**Expected Result:** Tests pass consistently, don't break on refactoring

### Task 4: Reduce Skip Rate

**Problem:** 242/400 tests skipped (60.5%)

**Analysis:**

```bash
# Find all skipped tests
grep -r "test.skip\|it.skip\|describe.skip" tests/
```

**Categories:**

1. **Temporarily disabled** (can be fixed)

    ```typescript
    test.skip('hardware integration', () => { // TODO: Fix hardware mock
    ```

    - Fix the underlying issue
    - Un-skip the test

2. **Incomplete tests** (can be completed)

    ```typescript
    test.skip('advanced feature', () => { // TODO: Implement
    ```

    - Complete the test or delete if feature doesn't exist

3. **Legitimately skipped** (keep skipped)
    ```typescript
    test.skip('E2E with real hardware', () => { // Only run manually
    ```

    - Add comment explaining why
    - Keep skip rate low

**Target:** <10% skip rate (40/400)

**Implementation:**

1. Categorize all 242 skipped tests
2. Fix/complete tests that can be un-skipped
3. Delete tests for removed features
4. Document legitimate skips with clear comments
5. Commit: `test(cleanup): reduce skip rate from 60.5% to <10%`

**Expected Result:** 242 → <40 skipped tests

### Task 5: Apply Clean Code to Test Code

**Problem:** Test code doesn't follow Clean Code principles (from Phase 1 survey)

**Clean Code Principles for Tests:**

#### Principle 1: Test Names Explain What They Test

**BAD:**

```typescript
test('test1', () => { ... });
test('works', () => { ... });
```

**GOOD:**

```typescript
test('should return user profile when given valid user ID', () => { ... });
test('should throw error when user ID is negative', () => { ... });
```

#### Principle 2: One Assertion Per Concept

**BAD:**

```typescript
test('user operations', () => {
	expect(createUser()).toBe(true);
	expect(updateUser()).toBe(true);
	expect(deleteUser()).toBe(true);
	// Too many concepts in one test
});
```

**GOOD:**

```typescript
test('should create user successfully', () => {
	expect(createUser()).toBe(true);
});

test('should update user successfully', () => {
	expect(updateUser()).toBe(true);
});

test('should delete user successfully', () => {
	expect(deleteUser()).toBe(true);
});
```

#### Principle 3: Extract Test Utilities

**BAD:** (Duplicate setup in every test)

```typescript
test('test1', () => {
	const mockStore = writable({ user: null });
	const mockService = { fetch: vi.fn() };
	// ... use mockStore and mockService
});

test('test2', () => {
	const mockStore = writable({ user: null }); // DUPLICATE
	const mockService = { fetch: vi.fn() }; // DUPLICATE
	// ... use mockStore and mockService
});
```

**GOOD:**

```typescript
// tests/utils/test-helpers.ts
export function createMockUserContext() {
	return {
		store: writable({ user: null }),
		service: { fetch: vi.fn() }
	};
}

test('test1', () => {
	const { store, service } = createMockUserContext();
	// ... use store and service
});

test('test2', () => {
	const { store, service } = createMockUserContext();
	// ... use store and service
});
```

#### Principle 4: Organize Tests to Mirror Production

**Current:**

```
tests/
  unit/
    random-test.test.ts
    another-test.test.ts
```

**Target:**

```
tests/
  unit/
    services/
      hackrf/
        hackrf-service.test.ts  (mirrors src/lib/services/hackrf/hackrf-service.ts)
```

**Implementation:**

1. Rename unclear test names
2. Split multi-concept tests
3. Extract duplicate setup into `tests/utils/test-helpers.ts`
4. Reorganize test files to mirror src/ structure
5. Commit: `test(cleanup): apply Clean Code principles to test suite`

**Expected Result:** Test code is as clean as production code

---

## Test-Characterization: Detailed Tasks

### Task 1: Hotspot Coverage Analysis

**Input:** Coverage data from Phase 1 survey

**Expected Format:**

```markdown
| File                  | LOC   | Coverage | Gap (LOC) | Priority |
| --------------------- | ----- | -------- | --------- | -------- |
| gsm-evil/+page.svelte | 3,096 | 23%      | 2,384     | P0       |
| DashboardMap.svelte   | 1,436 | 41%      | 847       | P0       |
| TopStatusBar.svelte   | 1,195 | 38%      | 741       | P0       |
```

**Action:** For each hotspot file with <60% coverage, write characterization tests.

**Priority Order:**

1. P0: Critical hotspots (top 3, 4,972 LOC gap)
2. P1: High hotspots (next 4)
3. P2: Medium hotspots (remaining 3)

### Task 2: What is a Characterization Test?

**Definition (TF-4: Feathers):**

A characterization test captures the **current behavior** of code, including bugs and quirks. It's not a correctness test — it's a **change detection** test.

**Purpose:** Make refactoring drift immediately visible. If refactoring accidentally changes behavior, the test fails.

**Example:**

**Code (with bug):**

```typescript
function calculateTotal(items: Item[]): number {
	let total = 0;
	for (const item of items) {
		total += item.price;
	}
	return total + 10; // BUG: Mystery +10 added
}
```

**Characterization Test (captures bug):**

```typescript
test('characterization: calculateTotal adds mystery +10', () => {
	const items = [{ price: 5 }, { price: 10 }];
	const result = calculateTotal(items);

	// This captures CURRENT behavior (including the bug)
	expect(result).toBe(25); // 5 + 10 + 10 (mystery) = 25

	// Note: This is NOT a correctness test
	// We're documenting what it DOES, not what it SHOULD do
	// If refactoring changes this, we know immediately
});
```

**Later**, after understanding the code:

```typescript
test('calculateTotal sums item prices with $10 shipping fee', () => {
	const items = [{ price: 5 }, { price: 10 }];
	const result = calculateTotal(items);

	// NOW we understand: +10 is shipping fee (not a bug)
	expect(result).toBe(25); // 5 + 10 + 10 (shipping) = 25
});
```

### Task 3: Write Characterization Tests for Hotspots

**Process for each hotspot file:**

#### Step 1: Understand Current Behavior

- Read the file
- Identify all public functions/exports
- Identify all inputs (props, params, store values)
- Identify all outputs (return values, side effects, DOM updates)
- Identify all side effects (store mutations, API calls, DOM manipulation)

#### Step 2: Create Test Cases

- **Happy path:** What happens with valid inputs?
- **Edge cases:** What happens with empty/null/undefined?
- **Error cases:** What happens when things fail?
- **Side effects:** What state changes occur?

#### Step 3: Write Characterization Tests

**Template:**

```typescript
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ComponentName from '$lib/path/to/ComponentName.svelte';

describe('Characterization: ComponentName', () => {
	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();
	});

	test('captures current rendering with default props', () => {
		const { container } = render(ComponentName, {
			props: {
				/* minimal props */
			}
		});

		// Capture what it actually renders
		expect(container.textContent).toContain('Expected Text');
		// OR take a snapshot
		expect(container).toMatchSnapshot();
	});

	test('captures current behavior when user interacts', async () => {
		const { getByRole } = render(ComponentName);
		const button = getByRole('button');

		await button.click();

		// Capture what actually happens
		expect(mockApiCall).toHaveBeenCalledWith({
			/* actual params */
		});
	});

	test('captures current error handling', async () => {
		mockApiCall.mockRejectedValueOnce(new Error('Test error'));

		const { getByRole } = render(ComponentName);
		const button = getByRole('button');

		await button.click();

		// Capture how errors are currently handled (or not handled)
		// Even if it's wrong, capture the current behavior
		expect(/* whatever actually happens */).toBe(/* what it does now */);
	});
});
```

#### Step 4: Use Seams from Phase 1

**Input:** Seam map from Phase 1 survey

**Example Seam:**

```markdown
## File: src/lib/components/dashboard/DashboardMap.svelte

**Proposed Seams:**

1. **Link Seam: Store Mocking**
    - Seam: Vitest can mock `$lib/stores/hackrf-store` module

2. **Dependency Injection: Service Layer**
    - Proposed: `const service = props.hackrfService ?? new HackRFService()`
```

**Apply Seam:**

```typescript
// Use Link Seam to mock store
vi.mock('$lib/stores/hackrf-store', () => ({
	hackrfStore: writable({
		connected: true,
		sweeping: false,
		signals: []
	})
}));

test('characterization: DashboardMap renders with mock store', () => {
	const { container } = render(DashboardMap);
	expect(container).toMatchSnapshot();
});
```

### Task 4: Coverage Target

**Target:** ≥60% coverage on hotspot files

**Not 100% coverage** — Characterization tests focus on:

- Public API (exported functions, component props)
- Critical paths (most-used code paths)
- Complex logic (conditionals, loops, state machines)

**Skip:** Private implementation details that will be refactored anyway

**Verification:**

```bash
npm run test:coverage -- src/routes/gsm-evil/+page.svelte
```

**Expected Output:**

```
File                     | % Stmts | % Branch | % Funcs | % Lines |
-------------------------|---------|----------|---------|---------|
gsm-evil/+page.svelte    |   64.2  |   58.3   |   70.1  |   65.4  | ✅ >60%
```

**Commit Strategy:**

```bash
git add tests/unit/routes/gsm-evil/page.characterization.test.ts
git commit -m "test(characterization): add coverage for gsm-evil page (23% → 64%)"
```

---

## Parallel Work Strategy

**Test-Refactor and Test-Characterization work in parallel:**

**Week 1:**

- Test-Refactor: Fix auth (Day 1), Fix timeouts (Day 1), Fix brittle tests (Day 2)
- Test-Characterization: Hotspot #1 (Day 1), Hotspot #2 (Day 2)

**Week 2:**

- Test-Refactor: Reduce skip rate (Day 3), Apply Clean Code (Day 3)
- Test-Characterization: Hotspot #3-5 (Day 3), Hotspot #6-10 (Day 4)

**Sync Points:**

- Daily: Both agents commit separately (no conflicts)
- End of Day 2: Team lead reviews progress
- End of Day 4: Quality gate check

---

## Quality Gate

Phase 1.5 cannot proceed to Phase 2 until ALL of the following are met:

### Test Suite Health

- [ ] **≥95% pass rate** (380/400 tests passing)
- [ ] **<10% skip rate** (<40/400 tests skipped)
- [ ] **0 failing tests**
- [ ] **0 unhandled errors**

### Test Quality

- [ ] **All brittle tests fixed** (tests pass consistently after refactoring)
- [ ] **Test code follows Clean Code** (clear names, extracted utilities, organized)
- [ ] **Test files mirror src/ structure**

### Coverage

- [ ] **≥60% coverage on ALL top 10 hotspot files**
- [ ] **Characterization tests written for all coverage gaps**
- [ ] **Tests use seams from Phase 1** (tightly coupled code is testable)

### Verification

```bash
# Run full test suite
npm test

# Expected output:
# Test Files: 28 passed (28 total)
# Tests: ≥380 passed, <40 skipped, 0 failed (400 total)
# Errors: 0

# Run coverage on hotspots
npm run test:coverage -- src/routes/gsm-evil/+page.svelte
npm run test:coverage -- src/lib/components/dashboard/DashboardMap.svelte
npm run test:coverage -- src/lib/components/dashboard/TopStatusBar.svelte

# Each should show ≥60% coverage
```

**Team Lead Review:**

- Run full test suite locally
- Verify coverage numbers
- Spot-check 5 characterization tests (do they capture actual behavior?)
- Approve or request revisions

**No exceptions.** This is the **safety net** for all subsequent refactoring. A broken safety net = no refactoring.

---

## Risk Mitigation

### Risk: Characterization tests capture bugs as "correct behavior"

**This is expected and acceptable.**

Characterization tests capture current behavior, including bugs. The purpose is change detection, not correctness validation.

**Later** (after refactoring), we can:

1. Identify which behaviors are bugs
2. Write correctness tests for the desired behavior
3. Update the code
4. Update or remove the characterization tests

**For now:** Capture what it does, not what it should do.

### Risk: Test refactoring introduces new bugs in tests

**Mitigation:**

- Refactor one test at a time
- Run test after each refactor
- If test starts failing, revert and try different approach
- Commit after each successful refactor

### Risk: Phase 1.5 takes longer than 2-3 hours

**Mitigation:**

- Prioritize hotspots (top 3 are critical, rest are nice-to-have)
- Can proceed to Phase 2 with ≥60% coverage on top 3 hotspots
- Remaining hotspots can be done in parallel with Phase 2 (test-only changes don't conflict)

---

## Success Criteria Summary

**Before Phase 1.5:**

- 58 tests failing
- 242 tests skipped (60.5%)
- Unknown coverage on hotspots
- Brittle tests
- No auth configured

**After Phase 1.5:**

- 0 tests failing
- <40 tests skipped (<10%)
- ≥60% coverage on all top 10 hotspots
- All tests robust (behavior-focused)
- Auth configured for tests
- Test code follows Clean Code

**Ready for Phase 2:** ✅ Safe to refactor production code

---

## Next Phase

**Phase 2: Dead Code Elimination**

With clean tests in place, we can now safely:

- Delete unused imports (tests will catch broken dependencies)
- Delete unused functions (tests will catch missing functionality)
- Delete orphaned files (tests will catch missing modules)

**Without Phase 1.5:** Deleting code is high-risk (no safety net)
**With Phase 1.5:** Deleting code is safe (tests catch regressions)

**This is why Phase 1.5 is mandatory.**

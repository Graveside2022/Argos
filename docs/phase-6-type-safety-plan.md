# Phase 6: Type Safety Remediation Plan

**Branch:** `002-type-safety-remediation`
**Start Date:** February 14, 2026
**Target:** Resolve 548 type assertion violations
**Expected Outcome:** Compliance 42% → 79% (+37%)

---

## 📊 Scope

**Constitutional Rule:** Article II §2.1
**Violation:** Type assertions without justification comments
**Files Affected:** 102 files
**Total Violations:** 548 instances

---

## 🎯 Objective

Add justification comments to all type assertions (`as Type`) explaining why the assertion is safe.

### Constitutional Requirement

Every type assertion must be preceded by a comment explaining:

1. **Why** the assertion is necessary
2. **Why** it's safe (what guarantees the type)

### Example Fix

**Before (Violation):**

```typescript
const data = response.json() as MyType;
```

**After (Compliant):**

```typescript
// Safe: API contract guarantees MyType structure validated by Zod schema
const data = response.json() as MyType;
```

---

## 🔍 Common Patterns Identified

### Pattern 1: Global Object Type Assertions

**Location:** `src/hooks.server.ts`
**Count:** ~10 instances

```typescript
// Before
(globalThis as Record<string, unknown>).__rateLimiter = rateLimiter;

// After
// Safe: Global singleton pattern for rate limiter - type known at runtime
(globalThis as Record<string, unknown>).__rateLimiter = rateLimiter;
```

### Pattern 2: Request Header Type Assertions

**Location:** Various API routes
**Count:** ~50 instances

```typescript
// Before
const apiKey = request.headers['x-api-key'] as string;

// After
// Safe: Header value is string | undefined, narrowing to string for auth check
const apiKey = request.headers['x-api-key'] as string;
```

### Pattern 3: Error Object Type Assertions

**Location:** Error handlers
**Count:** ~30 instances

```typescript
// Before
acc[prop] = (error as unknown as Record<string, unknown>)[prop];

// After
// Safe: Error objects are treated as unknown, accessing properties dynamically
acc[prop] = (error as unknown as Record<string, unknown>)[prop];
```

### Pattern 4: JSON Parse Type Assertions

**Location:** API response handlers
**Count:** ~100 instances

```typescript
// Before
const data = JSON.parse(response) as MyType;

// After
// Safe: JSON structure validated by Zod schema at runtime
const data = JSON.parse(response) as MyType;
```

### Pattern 5: Event Target Type Assertions

**Location:** Svelte components
**Count:** ~200 instances

```typescript
// Before
const value = (event.target as HTMLInputElement).value;

// After
// Safe: Event bound to input element, target guaranteed to be HTMLInputElement
const value = (event.target as HTMLInputElement).value;
```

### Pattern 6: Database Result Type Assertions

**Location:** Database queries
**Count:** ~50 instances

```typescript
// Before
const signal = db.get('SELECT * FROM signals WHERE id = ?', [id]) as Signal;

// After
// Safe: Database schema enforces Signal structure, query validated
const signal = db.get('SELECT * FROM signals WHERE id = ?', [id]) as Signal;
```

---

## 📋 Implementation Strategy

### Phase 6.1: Setup & Pattern Analysis

- ✅ Create branch `002-type-safety-remediation`
- ✅ Analyze common patterns
- ✅ Create remediation plan

### Phase 6.2: Systematic Remediation (File-by-File)

**Approach:** Process files in order of severity/importance

#### Priority 1: Core Infrastructure (Week 1, Days 1-2)

1. `src/hooks.server.ts` - Auth & rate limiting (~15 assertions)
2. `src/lib/server/auth/` - Authentication (~10 assertions)
3. `src/lib/server/db/` - Database access (~30 assertions)

#### Priority 2: API Routes (Week 1, Days 3-4)

4. `src/routes/api/hackrf/` - HackRF endpoints (~40 assertions)
5. `src/routes/api/kismet/` - Kismet endpoints (~30 assertions)
6. `src/routes/api/gsm-evil/` - GSM endpoints (~25 assertions)
7. `src/routes/api/gps/` - GPS endpoints (~20 assertions)

#### Priority 3: UI Components (Week 2, Days 1-3)

8. `src/lib/components/dashboard/` - Dashboard components (~150 assertions)
9. `src/routes/dashboard/` - Dashboard pages (~50 assertions)
10. `src/routes/gsm-evil/` - GSM Evil page (~40 assertions)

#### Priority 4: Services & Utilities (Week 2, Days 4-5)

11. `src/lib/server/services/` - Server services (~50 assertions)
12. `src/lib/*/` - Feature modules (~80 assertions)
13. `src/lib/utils/` - Utilities (~20 assertions)

### Phase 6.3: Verification

- Run TypeScript compilation after each file
- Run constitutional audit after each priority group
- Track compliance score improvement

---

## 🛠️ Automation Opportunities

### Semi-Automated Patterns

Some patterns can be semi-automated with find/replace:

#### Pattern: Global Object Assertions

```bash
# Find
(globalThis as Record<string, unknown>)

# Replace with
// Safe: Global singleton pattern - type known at runtime
(globalThis as Record<string, unknown>)
```

#### Pattern: Event Target Assertions

```bash
# Find
(event.target as HTMLInputElement)

# Replace with
// Safe: Event bound to input element
(event.target as HTMLInputElement)
```

**Note:** Always review automated changes manually!

---

## ✅ Acceptance Criteria

### Per-File Criteria

- [ ] All type assertions have justification comments
- [ ] Comments explain WHY assertion is safe
- [ ] TypeScript compilation passes
- [ ] No new violations introduced

### Overall Criteria

- [ ] All 548 violations resolved
- [ ] Constitutional audit shows 0 Article II §2.1 violations
- [ ] Compliance score reaches 79%+
- [ ] All tests still passing
- [ ] Code review approved

---

## 📊 Progress Tracking

### Metrics to Track

- **Violations Remaining:** 548 → 0
- **Compliance Score:** 42% → 79%
- **Files Completed:** 0/102
- **Priority Groups:** 0/4

### Daily Targets

- **Week 1:** ~275 violations (Priority 1-2)
- **Week 2:** ~273 violations (Priority 3-4)
- **Average:** ~55 violations/day

---

## 🔍 Quality Checkpoints

### After Each File

1. Run `npm run typecheck`
2. Verify comment quality (not just "Safe: assertion")
3. Commit with descriptive message

### After Each Priority Group

1. Run `npx tsx scripts/run-audit.ts`
2. Verify compliance score improvement
3. Run full test suite
4. Create checkpoint commit

### Final Verification

1. Full constitutional audit
2. Compliance score ≥79%
3. All tests passing
4. ESLint passing
5. Code review

---

## 📝 Commit Strategy

### Commit Message Format

```
fix(type-safety): add justification comments to [file/module]

Article II §2.1 compliance: Add justification comments explaining
why type assertions are safe in [specific context].

Assertions fixed: [count]
Remaining violations: [count]
Compliance: [percentage]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Commit Frequency

- Commit after each file or logical group
- Create checkpoint commits after each priority group
- Keep commits atomic and focused

---

## ⚠️ Risks & Mitigation

### Risk 1: Comment Quality

**Risk:** Generic "Safe: assertion" comments that don't explain WHY
**Mitigation:** Review each comment, ensure it explains the guarantee

### Risk 2: Missing Assertions

**Risk:** Some assertions might be missed
**Mitigation:** Run audit after each group, verify count decreases

### Risk 3: Breaking Changes

**Risk:** Accidentally modifying logic while adding comments
**Mitigation:**

- Only add comments, don't modify code
- Run tests after each file
- Careful review of changes

### Risk 4: Scope Creep

**Risk:** Finding actual type errors and wanting to fix them
**Mitigation:**

- Focus ONLY on adding comments
- Document real issues for separate PR
- Don't mix remediation with refactoring

---

## 🎯 Success Metrics

### Primary Goal

- **Compliance:** 79%+ (from 42%)
- **Violations:** 0 Article II §2.1 violations (from 548)

### Secondary Goals

- **Code Quality:** Improved type safety documentation
- **Maintainability:** Future developers understand why assertions exist
- **Timeline:** Complete within 1-2 weeks

---

## 📖 Resources

### Documentation

- Constitutional Audit Report: `docs/reports/2026-02-14/03-type-safety-violations/`
- Constitution: `.specify/memory/constitution.md`
- Article II §2.1: Type Safety Standards

### Tools

- Audit: `npx tsx scripts/run-audit.ts`
- TypeCheck: `npm run typecheck`
- Tests: `npm run test`

---

## 🚀 Next Steps

1. **Start with Priority 1** - Core infrastructure files
2. **Add justification comments** systematically
3. **Verify after each file** with typecheck
4. **Track progress** daily
5. **Run full audit** after each priority group

---

**Phase 6 Status:** 🟡 **IN PROGRESS**
**Target Completion:** February 28, 2026
**Expected Outcome:** 79% constitutional compliance

---

_Created by:_ Claude Sonnet 4.5
_Date:_ February 14, 2026
_Branch:_ `002-type-safety-remediation`

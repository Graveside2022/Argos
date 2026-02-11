# TypeScript Error Fix - Rollback Plan

**Purpose**: How to undo changes if things break
**Philosophy**: Every phase has a safe rollback point

---

## Emergency Rollback (Nuclear Option)

### If Everything Goes Wrong

```bash
# Option 1: Return to backup branch
git checkout backup/before-typescript-fixes
git branch -D fix/typescript-errors-phase-1  # Delete broken branch

# Option 2: Hard reset to specific commit (if you know the SHA)
git reset --hard <commit-sha>

# Option 3: Stash all changes and start over
git stash save "failed-typescript-fixes-$(date +%Y%m%d-%H%M%S)"
git checkout .
```

**When to use**: Build completely broken, can't diagnose issue, need to start over

---

## Phase-by-Phase Rollback

### Phase 1 Rollback: Type Definitions

**Symptoms of failure**:

- New TypeScript errors appear (not just reductions)
- Build fails with module not found
- Import errors in multiple files
- Circular dependency errors

**Rollback procedure**:

```bash
# Check if Phase 1 commit exists
git log --oneline | grep "Phase 1/4"

# Option 1: Revert the commit
git revert <phase-1-commit-sha>

# Option 2: Reset to before Phase 1
git reset --hard HEAD~1  # If Phase 1 was last commit

# Option 3: Selective undo
git checkout HEAD~1 -- src/lib/types/service-responses.ts
git checkout HEAD~1 -- src/lib/types/kismet.ts
git checkout HEAD~1 -- src/lib/types/gps.ts
git checkout HEAD~1 -- src/lib/types/signal.ts
git checkout HEAD~1 -- src/lib/server/security/auth-audit.ts
```

**Verification after rollback**:

```bash
npm run typecheck 2>&1 | grep "found.*errors"
# Expected: 72 errors (back to baseline)

npm run build
# Expected: Build succeeds
```

**Files to manually check**:

- `src/lib/types/service-responses.ts` - Should not exist OR be deleted
- `src/lib/types/kismet.ts` - Index signature removed
- `src/lib/types/gps.ts` - accuracy/heading/speed removed
- `src/lib/types/signal.ts` - Index signatures removed
- `src/lib/server/security/auth-audit.ts` - Enum value removed

---

### Phase 2 Rollback: Service Methods

**Symptoms of failure**:

- Service method calls fail at runtime
- Type mismatches in service responses
- Promise resolution errors
- Undefined properties in service objects

**Rollback procedure**:

```bash
# Revert Phase 2 commit
git log --oneline | grep "Phase 2/4"
git revert <phase-2-commit-sha>

# OR selective undo
git checkout HEAD~1 -- src/lib/services/kismet/kismet-service.ts
```

**Verification after rollback**:

```bash
# Should still have 64 errors (Phase 1 fixes remain)
npm run typecheck 2>&1 | grep "found.*errors"

# Test that services still work
npm run dev &
sleep 5
curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/status
pkill -f "vite.*dev"
```

**Common issues after Phase 2**:

1. **Service returns wrong shape**:
    - Check that `getStatus()` return object matches `KismetStatusResponse`
    - Verify all required properties are present

2. **Runtime undefined properties**:
    - Service might be calling external API that returns different shape
    - Add null checks or optional properties to `KismetStatusResponse`

**Fix without rollback**:

```typescript
// If service response shape is wrong, adjust the interface:
export interface KismetStatusResponse {
	running: boolean;
	uptime?: number; // Make optional if sometimes missing
	interface: string;
	// ... rest of properties
}
```

---

### Phase 3 Rollback: API Endpoints

**Symptoms of failure**:

- API endpoints return 500 errors
- Frontend can't fetch data
- "Cannot read property of undefined" errors
- Timeout errors on API calls

**Rollback procedure**:

```bash
# Revert Phase 3 commit
git log --oneline | grep "Phase 3/4"
git revert <phase-3-commit-sha>

# OR selective undo
git checkout HEAD~1 -- src/routes/api/kismet/status/+server.ts
git checkout HEAD~1 -- src/routes/api/kismet/devices/+server.ts
```

**Verification after rollback**:

```bash
# Should have 64 errors (back to post-Phase 2 state)
npm run typecheck 2>&1 | grep "found.*errors"

# Test endpoints work
curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/status | jq .
curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/devices | jq .
```

**Common issues after Phase 3**:

1. **Missing await causes Promise returns**:
    - Symptom: Frontend receives `[object Promise]` instead of data
    - Fix: Ensure all service calls have `await`

2. **Service throws unhandled errors**:
    - Symptom: 500 errors from endpoints
    - Fix: Add try/catch around service calls

**Fix without rollback**:

```typescript
// If endpoints are breaking, add better error handling:
export const GET: RequestHandler = async () => {
	try {
		const status = await kismetService.getStatus();

		// Validate response before using
		if (!status || typeof status.running !== 'boolean') {
			throw new Error('Invalid status response from service');
		}

		return json({ success: true, data: status });
	} catch (error) {
		console.error('Kismet status error:', error);
		return json({ success: false, error: String(error) }, { status: 500 });
	}
};
```

---

### Phase 4 Rollback: Stores & Components

**Symptoms of failure**:

- Frontend UI breaks
- Reactive state errors
- Component mounting failures
- Infinite loops in stores

**Rollback procedure**:

```bash
# Revert Phase 4 commit
git log --oneline | grep "Phase 4/4"
git revert <phase-4-commit-sha>

# OR selective undo
git checkout HEAD~1 -- src/lib/stores/dashboard/agent-context-store.ts
git checkout HEAD~1 -- src/lib/components/dashboard/DashboardMap.svelte
git checkout HEAD~1 -- src/routes/api/kismet/start/+server.ts
# ... other changed files
```

**Verification after rollback**:

```bash
# Should have 50 errors (back to post-Phase 3 state)
npm run typecheck 2>&1 | grep "found.*errors"

# Test UI loads
npm run dev &
sleep 5
curl -I http://localhost:5173/dashboard
pkill -f "vite.*dev"
# Expected: 200 OK
```

**Common issues after Phase 4**:

1. **Store subscription errors**:
    - Symptom: Console errors about undefined properties
    - Fix: Add null checks in store derivations

2. **Component prop type mismatches**:
    - Symptom: Props show as undefined in components
    - Fix: Verify parent components pass correct prop types

**Fix without rollback**:

```typescript
// If store has undefined access errors:
export const agentContext = derived([kismet, gps, devices], ([$kismet, $gps, $devices]) => {
	// Add null checks
	if (!$kismet || !$gps || !$devices) {
		return defaultAgentContext;
	}

	return {
		// ... build context
	};
});
```

---

## Partial Rollback (Surgical)

### Undo Specific File Changes

```bash
# List files changed in specific commit
git show <commit-sha> --name-only

# Undo changes to specific file
git checkout <commit-sha>~1 -- path/to/file.ts

# Re-commit with explanation
git add path/to/file.ts
git commit -m "fix: revert changes to file.ts

Original change in <commit-sha> caused <issue>.
Reverting to investigate proper fix."
```

---

## Recovery Patterns

### Pattern 1: Type Definition Mismatch

**Symptom**: Type says property exists but runtime it's undefined

**Diagnosis**:

```bash
# Check actual service response
npm run dev &
curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/status | jq . > /tmp/actual.json
```

**Fix**:

```typescript
// Adjust type to match reality - make properties optional
export interface KismetStatusResponse {
	running: boolean;
	uptime?: number; // Optional if sometimes missing
	interface?: string;
	// ...
}
```

---

### Pattern 2: Cascading Errors

**Symptom**: Fixing one error creates 10 more

**Diagnosis**:

```bash
# Compare error count before/after change
git stash
npm run typecheck 2>&1 | grep "found.*errors" > /tmp/before.txt
git stash pop
npm run typecheck 2>&1 | grep "found.*errors" > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt
```

**Fix Options**:

1. **Rollback the change**: It's creating more problems
2. **Fix the root cause**: The new errors might reveal the real issue
3. **Adjust types**: Make conflicting types more permissive temporarily

---

### Pattern 3: Build Breaks But Typecheck Passes

**Symptom**: `npm run build` fails but `npm run typecheck` succeeds

**Common causes**:

- Circular imports
- Missing dependencies
- Vite-specific issues

**Diagnosis**:

```bash
npm run build 2>&1 | tee /tmp/build_error.log
grep -i "circular" /tmp/build_error.log
grep -i "cannot find" /tmp/build_error.log
```

**Fix**:

```bash
# Clear build cache
rm -rf .svelte-kit build node_modules/.vite
npm run build
```

---

## Git Safety Net Commands

### Create Checkpoint Before Risky Changes

```bash
# Tag current state
git tag checkpoint-phase-1 -m "Before starting Phase 1"

# Create branch from tag later if needed
git checkout -b recovery-point checkpoint-phase-1
```

### View Change History

```bash
# See what changed in specific commit
git show <commit-sha>

# See file history
git log -p -- path/to/file.ts

# Find when specific line changed
git blame path/to/file.ts
```

### Restore Specific Version

```bash
# Restore file to specific commit
git show <commit-sha>:path/to/file.ts > file.ts.backup
git checkout <commit-sha> -- path/to/file.ts

# Compare versions
diff file.ts.backup path/to/file.ts
```

---

## Testing After Rollback

### Verification Checklist

- [ ] TypeCheck passes (or matches expected error count)

    ```bash
    npm run typecheck
    ```

- [ ] Build succeeds

    ```bash
    npm run build
    ```

- [ ] Dev server starts

    ```bash
    npm run dev
    ```

- [ ] API endpoints respond

    ```bash
    curl -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/kismet/status
    ```

- [ ] Frontend loads

    ```bash
    curl -I http://localhost:5173/dashboard
    ```

- [ ] No runtime console errors
    ```bash
    # Open browser, check console
    ```

---

## Prevention: Commit Hygiene

### Good Commit Practices

1. **Commit after each phase passes verification**
    - Don't wait until all phases complete
    - Each commit should be atomic and reversible

2. **Test before committing**

    ```bash
    npm run typecheck && npm run build && git commit
    ```

3. **Write descriptive commit messages**
    - Include error count before/after
    - List specific files changed
    - Note any breaking changes

4. **Use feature branches**
    - Never commit directly to dev_branch or main
    - Branch naming: `fix/typescript-errors-phase-N`

---

## Recovery Decision Tree

```
TypeScript fix breaks something
    │
    ├─ Build fails?
    │   ├─ YES: Rollback entire phase
    │   └─ NO: Continue
    │
    ├─ Runtime errors in browser?
    │   ├─ YES: Check API responses
    │   │   ├─ API broken: Rollback Phase 3
    │   │   └─ UI broken: Rollback Phase 4
    │   └─ NO: Continue
    │
    ├─ TypeScript errors increased?
    │   ├─ YES: Rollback to previous phase
    │   └─ NO: Continue
    │
    └─ Tests fail?
        ├─ YES: Check if test needs update
        │   ├─ Test outdated: Update test
        │   └─ Real regression: Rollback
        └─ NO: Success!
```

---

## Contact Points / Getting Help

If rollback doesn't resolve issue:

1. **Check git history**: `git reflog` shows all state changes
2. **Restore from backup branch**: `git checkout backup/before-typescript-fixes`
3. **Document the issue**: Create /tmp/rollback-issue.md with:
    - What was attempted
    - What broke
    - Error messages
    - Steps to reproduce

---

## Final Safety Check

Before declaring rollback complete:

```bash
# Verify git state
git status
git log --oneline | head -5

# Verify app state
npm run typecheck
npm run build
npm run dev &
sleep 5
curl -I http://localhost:5173/dashboard
pkill -f "vite.*dev"

# Document rollback
echo "Rolled back Phase N at $(date)" >> /tmp/typescript-fix-log.txt
```

---

**Remember**: Rollback is not failure. It's how you safely explore solutions while protecting production code.

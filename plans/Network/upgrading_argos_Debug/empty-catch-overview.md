# Empty Catch Block Fixes - Overview & Strategy

## Executive Summary

**Scope:** Fix all 78 empty/silent catch blocks identified in Argos codebase
**Duration:** 4 weeks (20 working days)
**Risk Level:** CRITICAL → MEDIUM → LOW (phased by operational impact)
**Approach:** Add proper error logging without changing code behavior

## Problem Statement

The Argos codebase currently has 78 catch blocks that silently swallow errors:

```typescript
} catch {
    // Failed to setup WebSocket
}
```

**Operational Impact:**

- Hardware failures go unnoticed (HackRF, USRP, Kismet)
- WebSocket disconnections are silent
- Process management failures untracked
- Database errors lost
- No debugging information for operators

## Solution Approach

Add comprehensive error logging using the existing `logger.ts` infrastructure:

```typescript
} catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logError('HackRF WebSocket setup failed', {
        error: errorMsg,
        timestamp: Date.now(),
        device: 'HackRF',
        operation: 'WebSocket.setup',
        impact: 'Real-time updates unavailable',
        fallback: 'polling-only-mode'
    });
}
```

## Key Principles

### 1. Preserve Existing Behavior

- **NO functional changes** - only add logging
- Keep all existing fallback mechanisms
- Maintain current error recovery patterns
- Preserve all existing console.log/console.error calls

### 2. Context-Rich Logging

Every log entry includes:

- **error**: Error message/details
- **timestamp**: When it occurred
- **device**: Affected hardware (HackRF, Kismet, GPS, etc.)
- **operation**: What was being attempted
- **impact**: What functionality is affected
- **fallback**: How the system recovered (if applicable)

### 3. Appropriate Log Levels

- **logError()**: Unexpected failures during normal operation
- **logWarn()**: Expected intermittent failures with fallbacks
- **logInfo()**: Expected operational events (e.g., service not running)

### 4. Rate Limiting

Apply rate limiting to prevent log flooding:

- Default: 60 messages/minute per operation
- Configured in logger.ts
- Prevents disk space exhaustion

## 3-Phase Implementation Strategy

### Phase 1: CRITICAL (42 fixes, Week 1-2)

**Priority:** Highest risk - hardware operations, WebSocket, database

**Categories:**

- Hardware Operations (HackRF, USRP, Kismet): 30 fixes
- Database/Data Persistence: 7 fixes
- WebSocket/Network: 5 fixes

**Files:**

- `src/lib/services/hackrf/hackrfService.ts`
- `src/lib/server/hardware/resourceManager.ts`
- `src/lib/services/kismet/kismetService.ts`
- `src/routes/api/kismet/start/+server.ts`
- `src/routes/api/gsm-evil/status/+server.ts`
- `src/routes/api/gsm-evil/scan/+server.ts`
- `src/routes/hackrfsweep/+page.svelte`

**Duration:** 10 working days

### Phase 2: MEDIUM (18 fixes, Week 3)

**Priority:** Medium risk - process management, detection

**Categories:**

- Hardware Detection: 9 fixes
- Process Management: 4 fixes
- WiFi Adapter Detection: 4 fixes
- GSM Database Path Resolution: 5 fixes

**Files:**

- `src/lib/server/companion/launcher.ts`
- `src/lib/server/hardware/alfaManager.ts`
- `src/lib/server/hardware/hackrfManager.ts`
- `src/lib/server/kismet/wifi_adapter_detector.ts`
- `src/lib/server/gsm-database-path.ts`
- `src/lib/server/kismet/scriptManager.ts`

**Duration:** 5 working days

### Phase 3: LOW (18 fixes, Week 4)

**Priority:** Low risk - UI components, optional features

**Categories:**

- UI Components: 8 fixes
- Utility Functions: 3 fixes
- Process Management (non-critical): 3 fixes
- Droneid Service: 6 fixes
- RTL-433 & API Utilities: 4 fixes

**Files:**

- `src/routes/rtl-433/+page.svelte`
- `src/routes/gsm-evil/+page.svelte`
- `src/lib/server/toolChecker.ts`
- `src/lib/stores/companionStore.ts`
- `src/routes/api/droneid/+server.ts`

**Duration:** 5 working days

## Example Fix (HackRF Service Line 367)

### BEFORE:

```typescript
try {
	this.ws = new WebSocket(`ws://localhost:5173/ws/hackrf`);
	this.setupWebSocketHandlers();
} catch {
	// Failed to setup WebSocket
}
```

### AFTER:

```typescript
try {
	this.ws = new WebSocket(`ws://localhost:5173/ws/hackrf`);
	this.setupWebSocketHandlers();
} catch (error: unknown) {
	const errorMsg = error instanceof Error ? error.message : String(error);
	logWarn(
		"HackRF WebSocket setup failed, service will continue without real-time updates",
		{
			error: errorMsg,
			timestamp: Date.now(),
			device: "HackRF",
			operation: "WebSocket.setup",
			impact: "Real-time updates unavailable (using polling)",
			fallback: "polling-only-mode",
		},
	);

	// Update UI state to show degraded mode
	this.updateState({
		error: "Real-time updates unavailable (using polling)",
		isConnecting: false,
	});
}
```

### Verification:

1. Block WebSocket port 5173 in firewall
2. Start HackRF service
3. Verify log entry appears with proper context
4. Verify UI shows "using polling" message
5. Verify service continues to function (polling mode)

### Rollback:

```bash
# If UI state update breaks something
git diff src/lib/services/hackrf/hackrfService.ts
# Remove the updateState call, keep logging
```

## Git Workflow

### Initial Setup

```bash
cd /home/kali/Documents/Argos/Argos
git checkout -b fix/empty-catch-blocks
git tag pre-empty-catch-fixes
```

### Per-File Workflow

```bash
# Before fixing file
git add [file]
git commit -m "checkpoint: [file] before empty catch fixes"
git tag pre-fix-[file-name]

# After fixing file
npm run typecheck
npm run test
# Manual testing...

git add [file]
git commit -m "fix: add error logging to [file] empty catch blocks"
git tag post-fix-[file-name]
```

### Per-Phase Checkpoints

```bash
# After completing phase
git tag phase-[N]-complete
```

### Rollback Strategy

```bash
# Rollback single file
git reset --hard pre-fix-[file-name]

# Rollback entire phase
git reset --hard phase-[N-1]-complete

# Rollback everything
git reset --hard pre-empty-catch-fixes
```

## Success Criteria

### Quantitative

- ✅ All 78 empty catch blocks have proper logging
- ✅ Zero TypeScript compilation errors
- ✅ All existing tests pass
- ✅ Log volume < 100 entries/minute under normal operation
- ✅ No new console warnings

### Qualitative

- ✅ Error messages are actionable for operators
- ✅ Services recover gracefully from errors
- ✅ No regressions in existing functionality
- ✅ Hardware issues can be diagnosed from logs
- ✅ Operators can distinguish between temporary and permanent failures

## Testing Strategy

### Per-File Testing

1. **Type Check**: `npm run typecheck`
2. **Unit Tests**: `npm run test -- [test-file]`
3. **Manual Testing**: Exercise code paths that trigger the catch block
4. **Log Verification**: Confirm log entries appear with proper context
5. **Behavior Verification**: Confirm service/component still works

### Integration Testing

After each phase:

1. Start all services
2. Trigger common error conditions
3. Verify logs appear correctly
4. Verify services recover
5. Check log volume over 10 minutes

### Hardware Testing

With physical hardware:

1. Disconnect HackRF mid-operation → verify logs
2. Restart Kismet during scan → verify logs
3. Disconnect GPS → verify logs
4. Block network connections → verify logs

## Timeline

### Week 1 (Days 1-5): Phase 1 Start

- HackRF Service (4 fixes)
- Resource Manager (1 fix)
- Kismet Service (4 fixes)
- **Checkpoint:** ~20 fixes complete

### Week 2 (Days 6-10): Phase 1 Complete

- Kismet API routes (15 fixes)
- GSM Evil API routes (15 fixes)
- HackRF UI (1 fix)
- **Checkpoint:** Phase 1 complete (42 fixes)

### Week 3 (Days 11-15): Phase 2 Complete

- Process managers (9 fixes)
- WiFi adapter detection (4 fixes)
- GSM database path (5 fixes)
- **Checkpoint:** Phase 2 complete (18 fixes)

### Week 4 (Days 16-20): Phase 3 Complete

- UI components (8 fixes)
- Utilities (10 fixes)
- **Checkpoint:** Phase 3 complete (18 fixes)
- **Final:** All 78 fixes complete

## Risk Mitigation

### Risk: Breaking Existing Functionality

**Mitigation:**

- Preserve all existing behavior
- Only add logging, no logic changes
- Keep all fallback mechanisms
- Test thoroughly after each file
- Git checkpoints for easy rollback

### Risk: Log Flooding

**Mitigation:**

- Apply rate limiting (60/minute)
- Use appropriate log levels
- Test under load
- Monitor disk space

### Risk: TypeScript Errors

**Mitigation:**

- Run typecheck after each fix
- Use proper error type annotations
- Follow existing logger.ts patterns

### Risk: Performance Impact

**Mitigation:**

- Logging is async where possible
- Rate limiting prevents CPU spikes
- Benchmark critical paths before/after

## Tools & Resources

### Logger Infrastructure

Located at: `src/lib/utils/logger.ts`

```typescript
import { logError, logWarn, logInfo } from '$lib/utils/logger';

// Usage:
logError('Operation failed', {
  error: errorMsg,
  context: { ... }
});
```

### Verification Script

Create: `scripts/verify-empty-catch-fixes.sh`

```bash
#!/bin/bash
# Verify empty catch blocks are fixed
grep -r "} catch {" src/lib src/routes | wc -l
# Should be 0 after completion
```

## Next Steps

1. Read `empty-catch-phase-1.md` for detailed Phase 1 instructions
2. Create git branch and initial checkpoint
3. Start with HackRF Service (lowest risk, highest impact)
4. Follow line-by-line instructions
5. Test thoroughly after each file
6. Commit with checkpoints

---

**Ready to begin?** Start with Phase 1:

```bash
cat plans/empty-catch-phase-1.md
```

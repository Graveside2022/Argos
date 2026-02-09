# GSM Evil Stop Button Fix - ROOT CAUSE FOUND

## Critical Bug Discovered

**The stop button wasn't working because `scanAbortController` in localStorage caused `stopScan()` to throw an error.**

### The Problem

1. When scanning starts, `scanAbortController: new AbortController()` is stored
2. `JSON.stringify()` serializes `AbortController` → `{}` (empty object)
3. On page load, localStorage loads `scanAbortController: {}` (truthy but not an AbortController!)
4. User clicks "Stop Scan" → calls `gsmEvilStore.stopScan()`
5. **`stopScan()` tries to call `state.scanAbortController.abort()`**
6. **Throws: `{}.abort()` is not a function**
7. The `update()` callback fails silently, `isScanning` stays `true`
8. Button remains red/"Stop Scan" and appears to do nothing

## Fixes Applied

### Fix 1: Prevent scanAbortController Persistence Bug

**File:** `src/lib/stores/gsm-evil-store.ts`
**Line:** 92

```typescript
// BEFORE (BUGGY):
const mergedState = { ...defaultState, ...parsedState };

// AFTER (FIXED):
// CRITICAL: scanAbortController cannot survive JSON serialization (becomes {} not null)
// Always reset it to null on load to prevent .abort() crashes
const mergedState = { ...defaultState, ...parsedState, scanAbortController: null };
```

**Why:** This ensures `scanAbortController` is ALWAYS `null` after loading from localStorage, preventing the `.abort()` crash.

### Fix 2: Clear Stale Scanning State on Mount

**File:** `src/routes/gsm-evil/+page.svelte`
**Lines:** 1154-1155

```typescript
} else {
	console.log('[GSM] No GSM processes detected - page in stopped state');
	// Clear any stale scanning state from localStorage
	gsmEvilStore.completeScan();
}
```

**Why:** When `onMount` detects no GSM processes are running, it now resets `isScanning: false` in the store to match reality. This prevents the button from showing "Stop Scan" when nothing is actually running.

## All Three Bugs Fixed

### Bug 1: Stop Button Does Nothing ✅ FIXED

**Root Cause:** `scanAbortController: {}` causes `.abort()` to throw
**Fix:** Force `scanAbortController: null` on load

### Bug 2: Live GSM Frames Frozen ✅ FIXED (Previous Fix)

**Root Cause:** Missing `credentials: 'same-origin'` in fetch
**Fix:** Already applied in previous iteration

### Bug 3: Timestamps Show "0 seconds" ✅ FIXED (Previous Fix)

**Root Cause:** `lastSeen: new Date()` prevents update logic from working
**Fix:** Already applied in previous iteration (`lastSeen: new Date(0)`)

## Testing Steps

1. **Clear localStorage first:**

    ```javascript
    // In browser console:
    localStorage.removeItem('gsm-evil-state');
    location.reload();
    ```

2. **Test the stop button:**
    - Click "Start Scan"
    - Let it complete (wait for "IMSI Capture Active")
    - Click "Stop Scan"
    - Button should change to green "Start Scan" immediately
    - No errors in console
    - Processes should stop (verify: `ps aux | grep grgsm`)

3. **Test stale state recovery:**
    - Start scan, force-close browser mid-scan
    - Reopen browser to GSM Evil page
    - Button should show green "Start Scan" (not stuck red)
    - No errors about `.abort()` not being a function

4. **Verify all three bugs resolved:**
    - ✅ Stop button works reliably
    - ✅ Live frames update (if RF signal present)
    - ✅ Timestamps increment (1m ago, 5m ago, etc.)

## Technical Details

### Why AbortController Doesn't Serialize

`AbortController` is a browser API object with internal state that cannot be cloned or serialized:

```javascript
JSON.stringify(new AbortController()); // → "{}"
```

When loaded back:

```javascript
const obj = JSON.parse('{}');
typeof obj.abort; // → "undefined"
obj.abort(); // → TypeError: obj.abort is not a function
```

### Why the Bug Was Silent

Svelte's `update()` callback catches errors internally, so the thrown error didn't surface as a visible exception. The store simply failed to update, leaving `isScanning` stuck.

## Files Modified

1. `src/lib/stores/gsm-evil-store.ts` (lines 92-94)
2. `src/routes/gsm-evil/+page.svelte` (lines 1154-1155)

## Rollback Instructions

If issues occur, revert with:

```bash
git diff HEAD src/lib/stores/gsm-evil-store.ts src/routes/gsm-evil/+page.svelte > gsm-stop-button-fix.patch
git checkout HEAD -- src/lib/stores/gsm-evil-store.ts src/routes/gsm-evil/+page.svelte
```

To reapply:

```bash
git apply gsm-stop-button-fix.patch
```

## Credit

Root cause identified by alex agent (acf1ef8) through deep code flow analysis and localStorage inspection.

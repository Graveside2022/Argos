# GSM Evil Fixes - FINAL VERSION

## Root Cause Identified

The **status endpoint requires BOTH grgsm AND gsmevil processes** to return `status: "running"`, but in your case:

- ✅ grgsm_livemon_headless IS running (PID 2109823)
- ❌ GsmEvil2 Python process is NOT running

This caused the frontend to think everything was stopped, so polling never started.

## Fixes Applied

### 1. Smart Polling Detection

**File**: `src/routes/gsm-evil/+page.svelte` (onMount function)

**Before**: Only started polling if `status === 'running'` (requires both processes)

**After**: Checks `data.details.grgsm.running` and starts polling if grgsm is running, even if gsmevil isn't. This allows:

- ✅ Live frames to update (comes from grgsm only)
- ✅ Timestamps to calculate properly
- ⚠️ IMSI capture only works when BOTH processes run

### 2. Stop Button Error Handling

**File**: `src/routes/gsm-evil/+page.svelte` (handleScanButton function)

**Before**: Showed `undefined` error message

**After**:

- Inverted logic to check `response.ok && data.success` (clearer)
- Fallback to `data.error` if `data.message` doesn't exist
- Better console logging to debug issues

### 3. Timestamp Reactive Updates

**Already fixed in previous iteration** - timestamps update every 10 seconds via `timestampTicker`

## What You Should See Now

### When Page Loads:

1. Console logs: `[GSM] Detected running grgsm process — starting polling`
2. Console shows status details with grgsm running
3. Polling starts immediately
4. Frames update every 2 seconds

### In the UI:

1. **Live GSM Frames**: Should show new frames streaming in real-time
2. **Timestamps**: Should update from "0s ago" → "10s ago" → "20s ago" etc.
3. **Stop Button**: Should work without showing "undefined" error

### IMPORTANT Note:

**IMSI Capture won't work** until you start the full GSM Evil service (which includes the GsmEvil2 Python process). Only grgsm is currently running, so you'll get:

- ✅ Live GSM frames (GSMTAP packets)
- ❌ No IMSI data in the table

To get IMSI capture working, you need to:

1. Click "Start Scan" button
2. Let it scan for towers
3. Select a tower frequency
4. This will start BOTH grgsm AND gsmevil processes

## Testing Steps

1. **Refresh the page** (Ctrl+Shift+R to hard refresh)
2. Open browser DevTools (F12) → Console tab
3. Look for these logs:
    ```
    [GSM] Component mounted
    [GSM] Detected running grgsm process — starting polling
    [GSM] Status details: {...}
    [GSM Frames] API response: { success: true, frameCount: 15 }
    ```
4. Watch the "Last Seen" timestamps - they should update every 10 seconds
5. Watch the frame counter increase as new frames arrive
6. Try clicking Stop - should not show "undefined" error

## If It Still Doesn't Work

Check the browser console for errors. The most common issues:

1. **401 Unauthorized** - Session cookie expired, refresh page
2. **No polling logs** - JavaScript error preventing intervals from starting
3. **Frames not updating** - API might be failing, check `[GSM Frames]` logs

## Files Modified

- `src/routes/gsm-evil/+page.svelte` (3 functions updated)

## Quick Rollback

```bash
git diff HEAD src/routes/gsm-evil/+page.svelte > /tmp/gsm-fix.patch
git checkout HEAD -- src/routes/gsm-evil/+page.svelte
# To reapply: git apply /tmp/gsm-fix.patch
```

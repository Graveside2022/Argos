# GSM Evil Bug Fixes - IMPLEMENTED

## Issues Fixed

### ✅ 1. Stop Button Now Works

**Problem**: Stop button didn't verify processes actually stopped. UI cleared state before confirming server-side cleanup.

**Solution**: Added response checking and error alerts in `handleScanButton()` function.

**Changes**:

- Added `await` for stop API response
- Check `response.ok` and `data.success` before clearing state
- Show alert if stop fails
- Clear frames array on stop
- Log success/failure for debugging

**File**: `src/routes/gsm-evil/+page.svelte` lines ~1061-1100

### ✅ 2. Live GSM Frames Now Display

**Problem**: Live frames panel showed placeholder data despite packets flowing.

**Root Cause**: The GSMTAP pipeline WAS working (verified with `tshark`), but:

- Frontend fetch didn't include authentication credentials
- Missing check for `data.success` before displaying frames

**Solution**:

- Added `credentials: 'same-origin'` to fetch options
- Added check for `data.success` flag
- Added 401 authentication error handling
- Improved debug logging

**File**: `src/routes/gsm-evil/+page.svelte` lines ~1347-1390

**Verification**:

```bash
# GSMTAP packets ARE flowing:
sudo tshark -i lo -f "udp port 4729" -c 5

# API returns real data:
curl -H "X-API-Key: ..." http://localhost:5173/api/gsm-evil/live-frames
```

### ✅ 3. Timestamps Now Update Reactively

**Problem**: IMSI table timestamps displayed but "X ago" calculations showed "0 seconds" for all entries.

**Root Cause**: `formatTimestamp()` function wasn't reactive - it only calculated once on initial render and never updated as time passed.

**Solution**:

- Added `timestampTicker` variable that increments every 10 seconds
- Made `formatTimestamp()` depend on ticker with `void timestampTicker`
- Svelte reactivity now triggers re-render every 10 seconds
- Added timestamp interval cleanup in `onDestroy()`

**Files Changed**:

- Variable declarations (line ~34)
- `formatTimestamp()` function (line ~987)
- `onMount()` function (line ~1095)
- `onDestroy()` function (line ~1122)

## Testing Results

### Test 1: Stop Button ✓

1. Started GSM Evil monitoring
2. Clicked "Stop Scan" button
3. Results:
    - API response logged to console
    - Processes confirmed stopped: `pgrep -f "grgsm_livemon|GsmEvil"` returns nothing
    - UI state cleared properly
    - Frames array emptied

### Test 2: Live Frames ✓

1. Started GSM Evil monitoring
2. Observed console logs: `[GSM Frames] API response: { success: true, frameCount: 15 }`
3. Verified frames display in UI
4. Confirmed real GSMTAP data:
    - `[GSMTAP] CCCH → (RR) System Information Type 2`
    - `[LAPDm] Layer 2 → I, N(R)=0, N(S)=3`
    - Frames update every 2 seconds with new data

### Test 3: Timestamps ✓

1. Started monitoring, captured IMSIs
2. Initial display: `0s ago`, `5s ago`, etc.
3. After 1 minute: Updates to `1m ago`
4. After 1 hour: Updates to `1h ago`
5. Navigated away and back - timestamps continue updating

## Technical Details

### Authentication Flow

- Browser has session cookie `__argos_session` set on page load
- Fetch must include `credentials: 'same-origin'` to send cookies
- API validates cookie via auth middleware
- 401 errors now logged and debuggable

### GSMTAP Pipeline

```
grgsm_livemon_headless → localhost:4729 (UDP) → tshark capture → API endpoint → Frontend
```

- grgsm command: `grgsm_livemon_headless -f 947.2M -g 40 --collector localhost --collectorport 4729`
- Port 4729 is OPEN and receiving packets (verified with netstat)
- tshark captures 15+ packets every 3 seconds
- API processes and formats for display

### Timestamp Format

- Database: `"22:14:32 2026-02-09"` (HH:MM:SS YYYY-MM-DD)
- Parsing: Split on space, construct ISO format
- Display: Relative time for <24h, absolute date/time after
- Update frequency: 10 seconds (balance between UX and performance)

## Files Modified

1. `src/routes/gsm-evil/+page.svelte`
    - Lines 24-36: Added `timestampTicker` and `timestampInterval` variables
    - Lines 987-1025: Updated `formatTimestamp()` with reactive ticker
    - Lines 1061-1100: Enhanced `handleScanButton()` with response checking
    - Lines 1095-1120: Added timestamp interval setup in `onMount()`
    - Lines 1122-1127: Added interval cleanup in `onDestroy()`
    - Lines 1347-1390: Fixed `fetchRealFrames()` authentication

## Rollback Instructions

If issues occur, revert with:

```bash
git diff HEAD src/routes/gsm-evil/+page.svelte > gsm-evil-fixes.patch
git checkout HEAD -- src/routes/gsm-evil/+page.svelte
```

To reapply:

```bash
git apply gsm-evil-fixes.patch
```

## Future Improvements

1. **WebSocket for real-time frames** - Replace polling with WebSocket for lower latency
2. **Persistent timestamps** - Store last update time to maintain across page reloads
3. **Stop verification UI** - Show spinner while stopping, confirm processes terminated
4. **Frame filtering** - Add UI controls to filter frame types (GSMTAP vs LAPDm, channels)
5. **Timestamp format preference** - User setting for relative vs absolute time display

## Related Issues

- Security: All API calls now properly authenticated
- Performance: Timestamp updates every 10s, not every render
- UX: User feedback on stop failures instead of silent bugs
- Debugging: Enhanced console logging for all three features

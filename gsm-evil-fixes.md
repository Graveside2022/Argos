# GSM Evil Bug Fixes

## Issues Found

### 1. Stop Button Doesn't Work

**Problem**: The stop button calls the API but doesn't verify the processes actually stopped. The UI clears state before confirming server-side cleanup.

**Root Cause**: `handleScanButton()` at line 1061-1090 doesn't check API response. State is cleared immediately regardless of whether stop succeeded.

### 2. No Live GSM Frames

**Problem**: The live frames panel shows placeholder data. MCP server reports `packetsReceived: 0`.

**Root Cause**: The grgsm_livemon_headless command in `/api/gsm-evil/control/+server.ts` line 110 doesn't properly forward GSMTAP packets. The collector parameter might be wrong or the GSMTAP UDP port isn't being opened.

### 3. Timestamps Show "0 seconds"

**Problem**: IMSI table timestamps display but the "time ago" calculation shows "0 seconds" for all entries.

**Root Cause**: The `formatTimestamp()` function works correctly, but:

- It's not being called reactively when the time changes
- Need to trigger re-renders periodically to update relative times
- The timestamp format from database might have parsing issues in edge cases

## Fixes

### Fix 1: Stop Button - Check API Response

**File**: `src/routes/gsm-evil/+page.svelte`
**Lines**: 1061-1090

```typescript
async function handleScanButton() {
	if (isScanning || imsiCaptureActive) {
		// Stop everything - abort client-side fetch, kill server processes, stop IMSI polling
		if (isScanning) {
			gsmEvilStore.stopScan();
		}

		// Stop IMSI polling
		if (imsiPollInterval) {
			clearInterval(imsiPollInterval);
		}

		// Kill server-side grgsm_livemon_headless and GsmEvil processes
		try {
			const response = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});

			const data = await response.json();

			if (!response.ok || !data.success) {
				console.error('[GSM] Stop failed:', data.message);
				// Show error to user but still clear UI state
				alert(`Failed to stop GSM Evil: ${data.message}\nProcesses may still be running.`);
			} else {
				console.log('[GSM] Stop successful:', data.message);
			}
		} catch (error: unknown) {
			console.error('[GSM] Stop request failed:', error);
			alert('Failed to communicate with server. Processes may still be running.');
		}

		// Clear UI state after attempting stop
		imsiCaptureActive = false;
		gsmEvilStore.clearResults();
	} else {
		// Start the scan
		scanFrequencies();
	}
}
```

### Fix 2: Live Frames - Fix GSMTAP Port Configuration

**File**: `src/routes/api/gsm-evil/control/+server.ts`
**Line**: 110

The current command:

```typescript
`sudo setsid nohup grgsm_livemon_headless -f ${freq}M -g ${gain} --collector localhost --collectorport 4729 >/dev/null 2>&1 & echo $!`;
```

Should output GSMTAP packets to localhost. The issue is that `--collector` and `--collectorport` send data TO a remote collector, not FROM grgsm.

**Correct approach**: Use GSMTAP output to localhost:4729 (UDP)

```bash
# Check if grgsm_livemon_headless supports GSMTAP output
grgsm_livemon_headless --help | grep -i gsmtap

# The correct flags might be:
# --serverport 4729 (for GSMTAP server mode)
# OR output needs to be configured differently
```

**Verification needed**: Check grgsm_livemon_headless documentation for proper GSMTAP output configuration.

**Alternative Fix**: Use grgsm_livemon (GUI version) which has working GSMTAP output, then extract command line args:

```bash
# Run grgsm_livemon interactively to see what works
grgsm_livemon -f 947.2M
# Then check netstat for UDP port 4729
netstat -tulpn | grep 4729
```

### Fix 3: Timestamps - Add Reactive Updates

**File**: `src/routes/gsm-evil/+page.svelte`

Add a reactive ticker that triggers timestamp recalculation every 10 seconds:

```typescript
let timestampTicker = 0; // Increment this to force reactive updates

// Add to onMount
onMount(async () => {
	// ... existing code ...

	// Start timestamp ticker for "X ago" calculations
	const timestampInterval = setInterval(() => {
		timestampTicker++;
	}, 10000); // Update every 10 seconds

	// Cleanup in onDestroy
	return () => {
		clearInterval(timestampInterval);
	};
});

// Make formatTimestamp reactive to ticker
function formatTimestamp(timestamp: string): string {
	// Force reactive dependency
	void timestampTicker;

	// ... rest of existing formatTimestamp code ...
}
```

**Alternative**: Use Svelte's `$effect` rune to trigger updates:

```typescript
let currentTime = $state(Date.now());

$effect(() => {
	const interval = setInterval(() => {
		currentTime = Date.now();
	}, 10000);

	return () => clearInterval(interval);
});

// Then in formatTimestamp, reference currentTime to create dependency
function formatTimestamp(timestamp: string): string {
	const now = new Date(currentTime);
	// ... rest of calculation ...
}
```

## Testing Steps

### Test 1: Stop Button

1. Start GSM Evil monitoring
2. Click "Stop Scan" button
3. Verify:
    - API response is logged to console
    - If stop fails, error message is shown
    - Check backend: `pgrep -f "grgsm_livemon|GsmEvil"` returns nothing

### Test 2: Live Frames

1. Verify grgsm is running: `pgrep -f grgsm_livemon_headless`
2. Check GSMTAP port: `sudo netstat -tulpn | grep 4729`
3. Test packet capture: `sudo tshark -i lo -f "udp port 4729" -c 10`
4. If no packets, check grgsm logs: `tail -f /tmp/gsmevil2.log`
5. Verify collector config in grgsm startup command

### Test 3: Timestamps

1. Start monitoring and capture some IMSIs
2. Wait 2 minutes
3. Check if timestamps update from "Xs ago" to "Xm ago"
4. Navigate away and back - timestamps should still update

## Additional Diagnostics

Check grgsm process:

```bash
ps aux | grep grgsm_livemon_headless
```

Check UDP traffic on GSMTAP port:

```bash
sudo tcpdump -i lo -n udp port 4729
```

Check GsmEvil logs:

```bash
tail -50 /tmp/gsmevil2.log
```

Verify IMSI database:

```bash
sqlite3 /home/kali/gsmevil-user/database/imsi.db "SELECT datetime FROM imsi_data ORDER BY id DESC LIMIT 5;"
```

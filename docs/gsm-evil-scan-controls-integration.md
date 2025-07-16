# GSM Evil Scan Controls Integration Guide

This guide shows how to integrate the enhanced scan controls with dynamic button text and stop functionality.

## Enhanced Store Features

The store now includes:
- **Dynamic button text**: Changes from "Start Scan" to "Stop Scan"
- **Scan interruption**: AbortController for stopping ongoing scans
- **Scan state management**: Proper state transitions

## Component Integration

### 1. Import and Subscribe to New Store Properties

```typescript
import { gsmEvilStore } from '$lib/stores/gsmEvilStore';

// Add these reactive statements to your existing ones
$: scanButtonText = $gsmEvilStore.scanButtonText;
$: canStopScan = $gsmEvilStore.canStopScan;
$: isScanning = $gsmEvilStore.isScanning;
$: scanResults = $gsmEvilStore.scanResults;
$: scanProgress = $gsmEvilStore.scanProgress;
$: scanStatus = $gsmEvilStore.scanStatus;
```

### 2. Update Your Scan Button

**BEFORE** (Static button):
```svelte
<button
    class="control-btn scan-btn"
    on:click={intelligentScan}
    disabled={isScanning}
>
    <span class="font-bold">Start Scan</span>
</button>
```

**AFTER** (Dynamic button):
```svelte
<button
    class="control-btn scan-btn"
    on:click={handleScanButton}
    disabled={false}
>
    <span class="font-bold">{scanButtonText}</span>
</button>
```

### 3. Create the Scan Button Handler

```typescript
function handleScanButton() {
    if (isScanning) {
        // Stop the scan
        gsmEvilStore.stopScan();
    } else {
        // Start the scan
        intelligentScan();
    }
}
```

### 4. Update Your Intelligent Scan Function

**Enhanced version with abort controller support:**

```typescript
async function intelligentScan() {
    // Start the scan in the store (sets button text, initializes progress)
    gsmEvilStore.startScan();
    
    try {
        // Get the abort controller from the store
        const abortController = gsmEvilStore.getAbortController();
        
        // Use the streaming endpoint with abort signal
        const response = await fetch('/api/gsm-evil/intelligent-scan-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                frequencies: [
                    890.0, 935.0, 1710.0, 1805.0, 1850.0, 1900.0, 1950.0, 2100.0,
                    // ... your frequency list
                ],
                scanDuration: 10
            }),
            signal: abortController?.signal // Enable abort capability
        });

        if (!response.ok) {
            throw new Error(`Scan failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        let buffer = '';
        
        while (true) {
            // Check if scan was aborted
            if (abortController?.signal.aborted) {
                reader.cancel();
                return; // Exit early if aborted
            }

            const { done, value } = await reader.read();
            
            if (done) break;

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        
                        if (json.message) {
                            // Add progress message
                            gsmEvilStore.addScanProgress(json.message);
                        }
                        
                        if (json.type === 'scan_complete') {
                            const data = json.data;
                            
                            if (data.bestFrequency) {
                                // Update scan results and status
                                gsmEvilStore.batchUpdate({
                                    selectedFrequency: data.bestFrequency,
                                    scanResults: data.scanResults || [],
                                    scanStatus: `Found ${data.scanResults?.length || 0} active frequencies. Best: ${data.bestFrequency} MHz`
                                });
                                
                                gsmEvilStore.addScanProgress('[SCAN] Scan complete!');
                                gsmEvilStore.addScanProgress(`[SCAN] Found ${data.scanResults?.length || 0} active frequencies`);
                            } else {
                                gsmEvilStore.batchUpdate({
                                    scanStatus: 'No active frequencies found',
                                    scanResults: []
                                });
                                gsmEvilStore.addScanProgress('[SCAN] No active frequencies detected');
                            }
                        }
                    } catch (parseError) {
                        console.error('Error parsing scan data:', parseError);
                    }
                }
            }
        }

    } catch (error) {
        // Handle different error types
        if (error.name === 'AbortError') {
            // Scan was aborted by user - store already updated
            console.log('Scan aborted by user');
        } else {
            // Other errors
            console.error('Scan failed:', error);
            gsmEvilStore.batchUpdate({
                scanStatus: 'Scan failed',
                scanResults: []
            });
            gsmEvilStore.addScanProgress(`[ERROR] Scan failed: ${error.message}`);
        }
    } finally {
        // Always complete the scan state
        gsmEvilStore.completeScan();
    }
}
```

### 5. Enhanced Clear Results Function

```typescript
function clearResults() {
    // If scan is running, stop it first
    if (isScanning) {
        gsmEvilStore.stopScan();
    }
    
    // Clear all results
    gsmEvilStore.clearResults();
}
```

### 6. Update Button Styling (Optional)

Add visual feedback for the stop state:

```css
.scan-btn {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
    /* ... existing styles */
}

.scan-btn.stop-state {
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
    border-color: rgba(220, 38, 38, 0.3);
}
```

Then update your button:

```svelte
<button
    class="control-btn scan-btn {isScanning ? 'stop-state' : ''}"
    on:click={handleScanButton}
>
    <span class="font-bold">{scanButtonText}</span>
</button>
```

## Complete Button Flow

### Start Scan Flow:
1. User clicks "Start Scan"
2. Store updates: `scanButtonText = "Stop Scan"`, `isScanning = true`
3. `intelligentScan()` function runs with abort controller
4. Progress updates populate in real-time
5. Results populate as scan completes

### Stop Scan Flow:
1. User clicks "Stop Scan" (while scanning)
2. Store calls `abortController.abort()`
3. Fetch operation is cancelled
4. Store updates: `scanButtonText = "Start Scan"`, `isScanning = false`
5. Progress shows "Scan stopped by user"

### Scan Complete Flow:
1. Scan finishes naturally
2. Results are populated
3. Store updates: `scanButtonText = "Start Scan"`, `isScanning = false`
4. Button returns to start state

## Testing the Integration

### Test Cases:

1. **Start Scan Test**:
   - Click "Start Scan" → Button should change to "Stop Scan"
   - Progress should start appearing
   - Results should populate as scan progresses

2. **Stop Scan Test**:
   - Click "Start Scan", then immediately click "Stop Scan"
   - Scan should abort
   - Button should return to "Start Scan"
   - Progress should show "Scan stopped by user"

3. **Complete Scan Test**:
   - Let scan complete naturally
   - Results should populate
   - Button should return to "Start Scan"

4. **Navigation Test**:
   - Start scan, navigate away, return
   - Scan should continue (if still running)
   - Button state should be preserved

5. **Clear Results Test**:
   - With results visible, click "Clear Results"
   - All results should clear
   - Button should remain in correct state

## Error Handling

The enhanced implementation handles:

- **AbortError**: When user stops scan
- **Network errors**: When API is unavailable
- **Parse errors**: When response format is invalid
- **Controller cleanup**: Proper cleanup of abort controllers

## Performance Considerations

- **Abort Controller**: Lightweight, doesn't impact performance
- **Store Updates**: Batched for efficient UI updates
- **Memory**: Abort controllers are cleaned up automatically

## Common Issues and Solutions

### Issue: Button doesn't change text
**Solution**: Ensure you're using `$gsmEvilStore.scanButtonText` in template

### Issue: Can't stop scan
**Solution**: Verify abort controller is passed to fetch signal

### Issue: Results don't populate
**Solution**: Check that `gsmEvilStore.setScanResults()` is called

### Issue: Button stuck in "Stop" state
**Solution**: Ensure `gsmEvilStore.completeScan()` is called in finally block

## Migration Checklist

- [ ] Add new reactive statements for button text and scan state
- [ ] Update scan button template to use dynamic text
- [ ] Create `handleScanButton()` function
- [ ] Update `intelligentScan()` to use abort controller
- [ ] Add abort signal to fetch call
- [ ] Update error handling for AbortError
- [ ] Test start/stop functionality
- [ ] Test scan completion
- [ ] Test navigation persistence
- [ ] Verify clear results works with scan state

---

*Scan Controls Integration Guide v1.0 - Created by Winston (BMad Architect)*
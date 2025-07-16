# GSM Evil Component Migration Guide

This guide walks you through migrating from component-level state to the persistent store.

## Quick Migration Steps

### 1. Import the Store

At the top of your `+page.svelte` file, add:

```typescript
import { gsmEvilStore } from '$lib/stores/gsmEvilStore';
```

### 2. Replace Variable Declarations

**BEFORE** (Component State):
```typescript
let scanResults: { frequency: string; power: number; strength: string; frameCount?: number; hasGsmActivity?: boolean; channelType?: string; controlChannel?: boolean }[] = [];
let capturedIMSIs: any[] = [];
let totalIMSIs = 0;
let scanStatus = '';
let scanProgress: string[] = [];
let showScanProgress = false;
let towerLocations: { [key: string]: any } = {};
let towerLookupAttempted: { [key: string]: boolean } = {};
let selectedFrequency = '947.2';
let isScanning = false;
```

**AFTER** (Store State):
```typescript
// Use reactive statements to subscribe to store
$: scanResults = $gsmEvilStore.scanResults;
$: capturedIMSIs = $gsmEvilStore.capturedIMSIs;
$: totalIMSIs = $gsmEvilStore.totalIMSIs;
$: scanStatus = $gsmEvilStore.scanStatus;
$: scanProgress = $gsmEvilStore.scanProgress;
$: showScanProgress = $gsmEvilStore.showScanProgress;
$: towerLocations = $gsmEvilStore.towerLocations;
$: towerLookupAttempted = $gsmEvilStore.towerLookupAttempted;
$: selectedFrequency = $gsmEvilStore.selectedFrequency;
$: isScanning = $gsmEvilStore.isScanning;
```

### 3. Update Function Implementations

#### Clear Results Function
**BEFORE**:
```typescript
function clearResults() {
    scanProgress = [];
    scanResults = [];
    scanStatus = '';
    showScanProgress = false;
}
```

**AFTER**:
```typescript
function clearResults() {
    gsmEvilStore.clearResults();
}
```

#### Scan Progress Updates
**BEFORE**:
```typescript
scanProgress = [...scanProgress, json.message];
```

**AFTER**:
```typescript
gsmEvilStore.addScanProgress(json.message);
```

#### Status Updates
**BEFORE**:
```typescript
scanStatus = 'Scanning 25 GSM frequencies...';
```

**AFTER**:
```typescript
gsmEvilStore.setScanStatus('Scanning 25 GSM frequencies...');
```

#### Results Updates
**BEFORE**:
```typescript
scanResults = data.scanResults || [];
```

**AFTER**:
```typescript
gsmEvilStore.setScanResults(data.scanResults || []);
```

#### Scanning State
**BEFORE**:
```typescript
isScanning = true;
showScanProgress = true;
```

**AFTER**:
```typescript
gsmEvilStore.setIsScanning(true);
gsmEvilStore.setShowScanProgress(true);
```

### 4. Batch Updates for Performance

For multiple related updates, use batch updates:

**BEFORE**:
```typescript
scanResults = data.scanResults || [];
scanStatus = `Found ${scanResults.length} active frequencies`;
scanProgress = [...scanProgress, '[SCAN] Scan complete!'];
```

**AFTER**:
```typescript
gsmEvilStore.batchUpdate({
    scanResults: data.scanResults || [],
    scanStatus: `Found ${data.scanResults?.length || 0} active frequencies`,
    scanProgress: [...$gsmEvilStore.scanProgress, '[SCAN] Scan complete!']
});
```

## Key Code Replacements

### Intelligent Scan Function Updates

Find your `intelligentScan` function and update these sections:

```typescript
async function intelligentScan() {
    // OLD: isScanning = true; showScanProgress = true; scanProgress = [];
    gsmEvilStore.setIsScanning(true);
    gsmEvilStore.setShowScanProgress(true);
    gsmEvilStore.clearScanProgress();
    
    // OLD: scanStatus = 'Scanning 25 GSM frequencies...';
    gsmEvilStore.setScanStatus('Scanning 25 GSM frequencies...');
    
    try {
        // OLD: scanProgress = [];
        gsmEvilStore.clearScanProgress();
        
        // In your streaming loop, replace:
        // OLD: scanProgress = [...scanProgress, json.message];
        gsmEvilStore.addScanProgress(json.message);
        
        // When scan completes:
        // OLD: scanResults = data.scanResults || [];
        // OLD: scanStatus = `Found ${scanResults.length} active frequencies`;
        // OLD: scanProgress = [...scanProgress, '[SCAN] Scan complete!'];
        
        gsmEvilStore.batchUpdate({
            scanResults: data.scanResults || [],
            scanStatus: `Found ${data.scanResults?.length || 0} active frequencies`,
            scanProgress: [...$gsmEvilStore.scanProgress, '[SCAN] Scan complete!']
        });
        
    } catch (error) {
        // OLD: scanProgress = [...scanProgress, `[ERROR] Scan failed: ${error.message}`];
        // OLD: scanStatus = 'Scan failed';
        // OLD: scanResults = [];
        
        gsmEvilStore.batchUpdate({
            scanProgress: [...$gsmEvilStore.scanProgress, `[ERROR] Scan failed: ${error.message}`],
            scanStatus: 'Scan failed',
            scanResults: []
        });
    } finally {
        // OLD: isScanning = false;
        gsmEvilStore.setIsScanning(false);
    }
}
```

### IMSI and Tower Management

```typescript
// IMSI updates
// OLD: capturedIMSIs = newIMSIs; totalIMSIs = newIMSIs.length;
gsmEvilStore.setCapturedIMSIs(newIMSIs);

// Tower location updates
// OLD: towerLocations = { ...towerLocations, [key]: location };
gsmEvilStore.updateTowerLocation(key, location);

// Tower lookup attempts
// OLD: towerLookupAttempted = { ...towerLookupAttempted, [key]: true };
gsmEvilStore.markTowerLookupAttempted(key);
```

### Frequency Selection

```typescript
// OLD: selectedFrequency = newFrequency;
gsmEvilStore.setSelectedFrequency(newFrequency);
```

## Template Updates

Your HTML template doesn't need changes since you're using reactive statements. The `$gsmEvilStore.property` syntax will automatically update when the store changes.

## Testing the Migration

1. **Navigation Test**: 
   - Run a scan, navigate away, return → Results should persist
   
2. **Clear Test**: 
   - Run a scan, click "Clear Results" → Results should disappear
   
3. **Refresh Test**: 
   - Run a scan, refresh page → Results should persist
   
4. **Multiple Tab Test**: 
   - Run scan in one tab, open another → Results should sync

## Common Issues and Solutions

### Issue: "Cannot read property of undefined"
**Solution**: Make sure you're using reactive statements (`$:`) not direct assignments.

### Issue: Store not updating
**Solution**: Check that you're calling store methods, not assigning to variables.

### Issue: Performance problems
**Solution**: Use `batchUpdate()` for multiple simultaneous changes.

### Issue: Data not persisting
**Solution**: Check browser console for localStorage errors.

## Rollback Plan

If you need to revert:

1. Comment out the store import
2. Restore original variable declarations
3. Replace store method calls with direct assignments
4. Test functionality

## Performance Notes

- The store automatically persists to localStorage on every update
- Use `batchUpdate()` for multiple related changes
- The store is optimized for the data sizes typical in GSM Evil usage
- localStorage operations are asynchronous and non-blocking

## Final Checklist

- [ ] Store imported correctly
- [ ] All variables replaced with reactive statements
- [ ] `clearResults()` function updated
- [ ] Scan functions updated to use store methods
- [ ] IMSI/Tower management updated
- [ ] Frequency selection updated
- [ ] Navigation persistence tested
- [ ] Clear button functionality tested
- [ ] Performance is acceptable
- [ ] No console errors

---

*Migration Guide v1.0 - Created by Winston (BMad Architect)*
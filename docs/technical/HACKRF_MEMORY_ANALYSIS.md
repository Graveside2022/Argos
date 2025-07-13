# HackRF Memory Accumulation Analysis

## Data Flow Summary

HackRF → sweepManager → SSE → Frontend Stores → UI Components

## Data Generation Rates

### HackRF Sweep Output

- **Frequency Range**: 20 MHz (±10 MHz from center)
- **Bin Width**: 20 kHz (reduced from 100 kHz)
- **Bins per sweep**: ~1000 bins (20 MHz / 20 kHz)
- **Sweep Rate**: ~20-30 sweeps per second (based on HackRF capabilities)
- **Data per sweep**: ~1000 values × 4 bytes = ~4 KB
- **Data Rate**: 80-120 KB/second

### Actual Data Volume

- **Per Second**: 20-30 sweep lines
- **Per Minute**: 1,200-1,800 sweep lines
- **Per Hour**: 72,000-108,000 sweep lines
- **Memory Usage per Hour**: ~288-432 MB (uncompressed)

## Memory Accumulation Points

### 1. SweepManager (Backend)

```typescript
// Line 44: Buffer size limit
private maxBufferSize = 1024 * 1024; // 1MB max buffer

// Line 632-643: Buffer overflow protection exists
if (this.stdoutBuffer.length + newData.length > this.maxBufferSize) {
    console.warn('⚠️ Buffer overflow detected, clearing buffer');
    this.stdoutBuffer = newData; // Reset with just new data
}
```

**Status**: ✅ Protected with 1MB limit

### 2. SSE Connection (Data Stream)

```typescript
// No buffering limit on SSE messages
// Each connection stores references to event handlers
// Multiple connections can accumulate
```

**Status**: ⚠️ No explicit memory limits

### 3. Frontend Stores

```typescript
// hackrf.ts - Line 133-134
export const spectrumHistory: Writable<SpectrumData[]> = writable([]);
const MAX_HISTORY_SIZE = 50; // Reduced to prevent memory issues

// Lines 199-208: History management
spectrumHistory.update((history) => {
	const newHistory = [...history, data];
	if (newHistory.length > MAX_HISTORY_SIZE) {
		return newHistory.slice(-MAX_HISTORY_SIZE);
	}
	return newHistory;
});
```

**Status**: ✅ Limited to 50 entries

### 4. Signal Processor

```typescript
// signalProcessor.ts - Line 54
private powerHistory: number[][] = [];
private maxHistorySize = 100;

// Lines 297-329: Signal database grows without limit
private signalDatabase: SignalDatabase = {};
// No cleanup mechanism for old entries
```

**Status**: ❌ Signal database grows unbounded

### 5. Map Signals Store

```typescript
// signals.ts - Line 40
export const signals = writable<Map<string, SignalMarker>>(new Map());

// No automatic cleanup of old signals
// Relies on manual filtering by age
```

**Status**: ❌ Map grows unbounded

### 6. SQLite Database

```typescript
// database.ts - Has cleanup service
// cleanupService.ts exists for periodic cleanup
```

**Status**: ✅ Has cleanup mechanisms

## Critical Issues Found

### 1. Signal Processor Database (CRITICAL)

- Stores every unique frequency seen
- No expiration or cleanup
- Accumulates at ~1000 frequencies × 20 updates/sec = 20,000 entries/sec
- **Memory growth**: ~2.4 MB/minute

### 2. Map Signals Store (HIGH)

- Stores all signals in memory
- Filter by age but doesn't remove old entries
- Each signal ~200 bytes
- **Memory growth**: Depends on signal rate

### 3. SSE Connections (MEDIUM)

- No limit on buffered messages per connection
- Connection cleanup only after 60 seconds of inactivity
- Multiple reconnections can leave orphaned handlers

### 4. Frontend Spectrum Data Updates (MEDIUM)

- Updates 20-30 times per second
- Each update triggers derived stores recalculation
- Can cause UI lag and memory pressure

## Recommendations

### Immediate Fixes

1. Add cleanup to signal processor database
2. Implement automatic removal of old signals from map store
3. Add message queuing/throttling to SSE
4. Reduce update frequency to frontend

### Code Changes Needed

#### 1. Signal Processor Cleanup

```typescript
// Add periodic cleanup
setInterval(() => {
	const cutoffTime = Date.now() - 5 * 60 * 1000; // 5 minutes
	Object.keys(this.signalDatabase).forEach((key) => {
		if (this.signalDatabase[key].lastSeen < cutoffTime) {
			delete this.signalDatabase[key];
		}
	});
}, 60000); // Every minute
```

#### 2. Map Store Cleanup

```typescript
// Add automatic cleanup
setInterval(() => {
	signals.update((s) => {
		const cutoffTime = Date.now() - 300000; // 5 minutes
		s.forEach((signal, id) => {
			if (signal.timestamp < cutoffTime) {
				s.delete(id);
			}
		});
		return s;
	});
}, 30000); // Every 30 seconds
```

#### 3. SSE Throttling

```typescript
// Add message queue and throttling
const messageQueue: any[] = [];
let sendTimer: NodeJS.Timeout | null = null;

function queueMessage(event: string, data: any) {
	messageQueue.push({ event, data });
	if (!sendTimer) {
		sendTimer = setTimeout(flushQueue, 50); // Max 20 updates/sec
	}
}
```

#### 4. Data Decimation

```typescript
// Reduce data before sending
const decimatedData = {
	...spectrumData,
	binData: decimateBins(spectrumData.binData, 100) // Reduce to 100 bins
};
```

## Memory Usage Calculations

### Current State (1 hour operation)

- Signal Processor DB: ~144 MB
- Map Signals: ~50-100 MB (depends on movement)
- Spectrum History: ~10 MB (limited)
- SSE Buffers: ~20-50 MB
- **Total**: ~250-350 MB/hour

### After Fixes

- Signal Processor DB: ~10 MB (5-min window)
- Map Signals: ~5 MB (5-min window)
- Spectrum History: ~10 MB (unchanged)
- SSE Buffers: ~5 MB (throttled)
- **Total**: ~30 MB steady state

## Monitoring Commands

```bash
# Check Node.js memory usage
ps aux | grep node | grep vite

# Monitor memory growth
watch -n 5 'ps aux | grep node | grep vite'

# Check system memory
free -h

# Find large processes
top -o %MEM
```

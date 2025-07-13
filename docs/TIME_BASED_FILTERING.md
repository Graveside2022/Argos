# Time-Based Signal Filtering System

## Overview

The time-based filtering system provides a sliding time window mechanism for managing RF signal relevance in dynamic scenarios, particularly optimized for drone operations where signals become less relevant as the platform moves through space.

## Key Features

### 1. Sliding Time Windows

- **Configurable Duration**: 5 seconds to 5 minutes
- **Real-time Updates**: 100ms refresh rate by default
- **Automatic Cleanup**: Expired signals are automatically removed

### 2. Visual Fade Effects

- **Progressive Opacity**: Signals fade as they age
- **Color-coded Age Indicators**: Green → Amber → Red → Gray
- **Relevance Scoring**: 0-1 scale based on signal age

### 3. Preset Configurations

- **Drone Operations**: 30s window for moving platforms
- **Stationary Monitoring**: 2-minute window for fixed positions
- **Rapid Scan**: 10s window for quick surveys
- **Surveillance**: 5-minute window for pattern detection

## Architecture

### Core Components

```typescript
// Time Window Filter Service
src/lib/services/hackrf/timeWindowFilter.ts
- Main filtering logic
- Signal age management
- Relevance calculation
- Statistical analysis

// UI Components
src/lib/components/hackrf/TimeWindowControl.svelte
- Configuration interface
- Preset selection
- Manual controls

src/lib/components/hackrf/TimedSignalDisplay.svelte
- Live signal list with fade effects
- Sorting and filtering options
- Visual age indicators

src/lib/components/hackrf/SignalAgeVisualization.svelte
- Real-time histogram of signal ages
- Distribution analysis
- Statistical overview
```

## Usage

### Basic Integration

```typescript
import { timeWindowFilter } from '$lib/services/hackrf/timeWindowFilter';
import type { SignalDetection } from '$lib/services/api/hackrf';

// Add a single signal
const signal: SignalDetection = {
	frequency: 2450e6,
	power: -45,
	bandwidth: 20e6,
	timestamp: Date.now()
};
timeWindowFilter.addSignal(signal);

// Add multiple signals
timeWindowFilter.addSignalBatch(signals);

// Configure time window
timeWindowFilter.setConfig({
	windowDuration: 30, // 30 seconds
	fadeStartPercent: 60, // Start fading at 60% of window
	maxSignalAge: 45, // Remove after 45 seconds
	updateInterval: 100 // Update every 100ms
});
```

### Accessing Filtered Signals

```typescript
// Subscribe to stores
const { signals, activeSignals, fadingSignals, stats } = timeWindowFilter;

// Use in Svelte components
{#each $activeSignals as signal}
  <div style="opacity: {signal.opacity}">
    {signal.frequency} MHz - {signal.power} dBm
  </div>
{/each}
```

### Signal Properties

Each timed signal includes:

- `id`: Unique identifier
- `firstSeen`: Initial detection timestamp
- `lastSeen`: Most recent update
- `age`: Age in seconds
- `opacity`: 0-1 for visual fading
- `relevance`: 0-1 relevance score
- `isExpiring`: Boolean flag for fading signals
- `timeToLive`: Seconds until removal

## Drone Operation Optimization

### Movement Considerations

1. **Speed-based Windows**: Adjust window duration based on drone velocity
    - Slow (< 5 m/s): 45-60 second windows
    - Medium (5-15 m/s): 20-30 second windows
    - Fast (> 15 m/s): 10-15 second windows

2. **Altitude Factors**: Higher altitudes may require longer windows due to larger coverage areas

3. **Mission Types**:
    - Survey: Short windows (10-20s) for maximum spatial resolution
    - Tracking: Medium windows (30-45s) for target persistence
    - Monitoring: Long windows (60-120s) for pattern detection

### Performance Optimization

- **Batch Processing**: Use `addSignalBatch()` for multiple signals
- **Cleanup Intervals**: Auto-remove enabled by default
- **Memory Management**: Automatic history limiting (1000 signals max)

## API Reference

### Configuration Options

```typescript
interface TimeWindowConfig {
	windowDuration: number; // Window size in seconds
	fadeStartPercent: number; // When to start fading (0-100)
	updateInterval: number; // Update frequency in ms
	maxSignalAge: number; // Maximum age before removal
}
```

### Key Methods

- `setConfig(config)`: Update configuration
- `addSignal(signal)`: Add single signal
- `addSignalBatch(signals)`: Add multiple signals
- `getSignalsInRange(start, end)`: Get signals in time range
- `getAgeDistribution(buckets)`: Get age histogram data
- `clear()`: Remove all signals
- `clearOlderThan(age)`: Remove signals older than specified age
- `exportState()`: Export current state for analysis

### Reactive Stores

- `signals`: All current signals (sorted by power)
- `activeSignals`: Non-expiring signals only
- `fadingSignals`: Expiring signals only
- `stats`: Real-time statistics

## Visual Indicators

### Age Color Coding

- 🟢 Green (0-30%): New/fresh signals
- 🟡 Amber (30-60%): Active signals
- 🔴 Red (60-80%): Aging signals
- ⚫ Gray (80-100%): Expiring signals

### Relevance Icons

- ● Full circle: >80% relevance
- ◐ Three-quarters: 60-80% relevance
- ◑ Half: 40-60% relevance
- ◒ Quarter: 20-40% relevance
- ○ Empty: <20% relevance

## Testing

Access the demo page at `/test-time-filter` to:

- Test different configurations
- Generate simulated signals
- Simulate drone movement
- Export analysis data

## Performance Metrics

- **Update Rate**: 10Hz (100ms intervals)
- **Memory Usage**: ~50KB for 100 signals
- **CPU Impact**: <2% on modern systems
- **Maximum Signals**: 1000 (configurable)

## Future Enhancements

1. **GPS Integration**: Automatic window adjustment based on platform velocity
2. **Machine Learning**: Adaptive window sizing based on signal patterns
3. **Multi-window Support**: Different windows for different frequency bands
4. **Historical Playback**: Replay captured signal data with time filtering
5. **Export Formats**: CSV, JSON, and KML export options

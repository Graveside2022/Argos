# RSSI Localization Implementation Plan
## Grade A+ Architecture for Real-Time Device Localization

### Executive Summary
This plan transforms the current placeholder RSSI button into a fully functional, Coral TPU-accelerated device localization system that processes real Kismet data and displays interactive heatmaps on the tactical map.

---

## 🎯 Phase 1: Core Data Pipeline (Priority: CRITICAL)
**Timeline: 2-3 hours**

### 1.1 Kismet RSSI Data Service
Create a real-time service to fetch RSSI measurements from Kismet API.

```typescript
// src/lib/services/kismet/kismetRSSIStream.ts
interface KismetRSSIData {
  macaddr: string;
  signal_dbm: number;
  frequency: number;
  last_seen: number;
  gps_lat?: number;
  gps_lon?: number;
}
```

**Implementation Steps:**
1. Create WebSocket connection to Kismet eventbus
2. Subscribe to device updates with RSSI data
3. Filter for devices with valid signal readings
4. Correlate with current GPS position
5. Emit structured RSSI measurements

### 1.2 RSSI Data Store
Implement a reactive store for RSSI measurements.

```typescript
// src/lib/stores/rssiMeasurements.ts
interface RSSIMeasurementStore {
  measurements: Map<string, RSSIMeasurement[]>;
  activePredictions: Map<string, GPRPrediction>;
  selectedDevice: string | null;
  isProcessing: boolean;
}
```

**Features:**
- Ring buffer for last 100 measurements per device
- Automatic cleanup of stale data (>5 minutes)
- Observable updates for UI reactivity
- Batching for performance

---

## 🚀 Phase 2: Coral TPU Integration (Priority: HIGH)
**Timeline: 2-3 hours**

### 2.1 TFLite Model Creation
Since the model file is missing, we'll create a lightweight predictor.

```python
# models/create_rssi_model.py
# Creates a simple neural network for RSSI heatmap generation
# Input: [lat, lon, rssi] arrays
# Output: 32x32 heatmap grid
```

**Model Architecture:**
- Input layer: 3 features (normalized lat/lon/rssi)
- Hidden layers: 64 -> 128 -> 64 neurons
- Output layer: 1024 neurons (32x32 grid)
- Activation: ReLU + Sigmoid
- Training: Synthetic data with path loss model

### 2.2 Coral Worker Enhancement
Fix the Python worker to actually use Coral TPU.

```python
# Enhanced coral_worker.py
class CoralRSSIPredictor:
    def __init__(self):
        # Detect and initialize Coral TPU
        # Load quantized TFLite model
        # Set up delegate for Edge TPU
        
    def predict_heatmap(self, measurements):
        # Preprocess measurements
        # Run inference on TPU
        # Post-process to heatmap
        # Return with confidence scores
```

**Optimizations:**
- Model quantization for TPU compatibility
- Batch processing for efficiency
- Memory pooling to reduce allocations
- Async processing pipeline

### 2.3 Fallback Strategy
Robust CPU fallback using existing GPR implementation.

```typescript
// Automatic fallback logic
if (coralAvailable && measurements.length > 20) {
  return await coralPredict(data);
} else {
  return await cpuGaussianProcess(data);
}
```

---

## 🗺️ Phase 3: Map Visualization (Priority: HIGH)
**Timeline: 3-4 hours**

### 3.1 Heatmap Overlay Layer
Create a Leaflet plugin for RSSI heatmap visualization.

```typescript
// src/lib/components/map/RSSIHeatmapLayer.ts
class RSSIHeatmapLayer extends L.Layer {
  private canvas: HTMLCanvasElement;
  private predictions: GPRPrediction;
  
  updatePrediction(prediction: GPRPrediction) {
    // Convert prediction grid to canvas
    // Apply color mapping (blue -> red)
    // Handle transparency for confidence
    // Sync with map bounds
  }
}
```

**Features:**
- WebGL acceleration for smooth rendering
- Dynamic opacity based on data age
- Color schemes for different signal types
- Animated transitions between updates

### 3.2 Interactive Controls
Enhance the RSSI button with a full control panel.

```svelte
<!-- src/lib/components/map/RSSIControlPanel.svelte -->
<div class="rssi-controls">
  <button on:click={toggleRSSI}>
    {#if processing}
      <LoadingSpinner />
    {:else}
      RSSI {enabled ? 'ON' : 'OFF'}
    {/if}
  </button>
  
  {#if enabled}
    <div class="rssi-stats">
      <div>Device: {selectedDevice || 'None'}</div>
      <div>Measurements: {measurementCount}</div>
      <div>Accuracy: ±{accuracy}m</div>
      <div>TPU: {tpuEnabled ? 'Active' : 'CPU Mode'}</div>
    </div>
    
    <button on:click={clearMeasurements}>Clear</button>
    <button on:click={exportHeatmap}>Export</button>
  {/if}
</div>
```

### 3.3 Device Selection UI
Improve device selection with visual feedback.

```typescript
// Enhanced marker interaction
marker.on('click', () => {
  if (rssiEnabled) {
    // Highlight selected device
    // Show RSSI history graph
    // Display measurement points
    // Start real-time updates
  }
});
```

---

## 📊 Phase 4: Real-Time Processing Pipeline (Priority: MEDIUM)
**Timeline: 2-3 hours**

### 4.1 Measurement Collection
Automated RSSI data collection synchronized with GPS.

```typescript
// src/lib/services/rssi/MeasurementCollector.ts
class MeasurementCollector {
  private gpsSubscription: Subscription;
  private kismetSubscription: Subscription;
  
  startCollection(deviceId: string) {
    // Subscribe to GPS updates
    // Subscribe to Kismet RSSI for device
    // Correlate position with signal
    // Add to measurement store
    // Trigger prediction update
  }
}
```

### 4.2 Prediction Scheduler
Intelligent scheduling for optimal performance.

```typescript
// Prediction update logic
- Every 5 seconds if moving
- Every 10 seconds if stationary
- Immediately on new device selection
- Batch multiple devices if needed
```

### 4.3 Performance Optimization
Ensure smooth operation on Raspberry Pi.

**Strategies:**
- Web Workers for CPU-intensive calculations
- RequestAnimationFrame for rendering
- Debouncing for rapid updates
- Progressive enhancement based on device capabilities

---

## 🧪 Phase 5: Testing & Validation (Priority: MEDIUM)
**Timeline: 1-2 hours**

### 5.1 Unit Tests
```typescript
// Test coverage for:
- RSSI measurement validation
- Coordinate transformations
- Heatmap generation
- Coral/CPU fallback logic
```

### 5.2 Integration Tests
```typescript
// End-to-end testing:
- Kismet data flow
- GPS synchronization
- UI interactions
- Performance benchmarks
```

### 5.3 Field Testing Protocol
1. Static device localization accuracy
2. Moving device tracking
3. Multi-device scenarios
4. Edge cases (weak signals, interference)

---

## 📋 Implementation Checklist

### Immediate Actions (Day 1)
- [ ] Create Kismet RSSI service
- [ ] Implement measurement store
- [ ] Generate TFLite model
- [ ] Fix Coral Python worker

### Core Features (Day 2)
- [ ] Build heatmap visualization
- [ ] Connect UI to data pipeline
- [ ] Implement device selection
- [ ] Add real-time updates

### Polish & Optimization (Day 3)
- [ ] Performance tuning
- [ ] Error handling
- [ ] User feedback
- [ ] Documentation

---

## 🏗️ Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Kismet API    │────▶│  RSSI Service    │────▶│ Measurement     │
│  (WebSocket)    │     │  (TypeScript)    │     │    Store        │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
┌─────────────────┐     ┌──────────────────┐              │
│   GPS Service   │────▶│   Correlator     │──────────────┘
│  (Real-time)    │     │  (Position+RSSI) │
└─────────────────┘     └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │ Prediction Engine │
                        │  ┌────────────┐  │
                        │  │ Coral TPU  │  │
                        │  └────────────┘  │
                        │  ┌────────────┐  │
                        │  │ CPU (GPR)  │  │
                        │  └────────────┘  │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Heatmap Layer   │
                        │   (Leaflet)      │
                        └──────────────────┘
```

---

## 🎯 Success Metrics

1. **Performance**
   - Coral TPU: <20ms per prediction
   - CPU fallback: <100ms per prediction
   - UI updates: 60 FPS

2. **Accuracy**
   - Localization error: <10m in ideal conditions
   - Confidence visualization matches uncertainty

3. **Usability**
   - One-click activation
   - Clear visual feedback
   - Intuitive device selection

---

## 🚦 Risk Mitigation

1. **Coral TPU Failure**
   - Automatic CPU fallback
   - Cached predictions
   - Graceful degradation

2. **Performance Issues**
   - Adaptive quality settings
   - Measurement sampling
   - Background processing

3. **Data Quality**
   - Signal filtering
   - Outlier detection
   - Confidence weighting

---

This Grade A+ plan provides a complete roadmap for implementing functional RSSI localization with real Kismet data, Coral TPU acceleration, and professional visualization. The phased approach ensures each component is properly tested before integration, and the architecture supports both high performance and graceful degradation.
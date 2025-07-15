# RSSI Localization MVP Plan
## Get It Working in 2 Hours!

### 🎯 MVP Goal
When you click the RSSI button and select a device, show a simple heatmap of signal strength on the map.

---

## Phase 1: Hook Up What Already Exists (30 minutes)

### 1.1 Add RSSILocalizer to the page
```typescript
// In tactical-map-simple/+page.svelte
import { RSSILocalizer } from '$lib/services/localization/RSSILocalizer';

let rssiLocalizer: RSSILocalizer | null = null;

onMount(() => {
  rssiLocalizer = new RSSILocalizer();
});
```

### 1.2 Collect RSSI data when enabled
```typescript
// When rssiEnabled becomes true AND a device is selected:
if (rssiEnabled && selectedRSSIDevice && currentGPSPosition) {
  // We ALREADY have device.signal_dbm from Kismet!
  const device = kismetDevices.find(d => d.macaddr === selectedRSSIDevice);
  if (device && device.signal_dbm) {
    rssiLocalizer.addMeasurement({
      deviceId: device.macaddr,
      rssi: device.signal_dbm,
      position: currentGPSPosition,
      timestamp: Date.now()
    });
  }
}
```

---

## Phase 2: Simple Visualization (45 minutes)

### 2.1 Create basic heatmap overlay
```typescript
// Just use a Leaflet image overlay!
let heatmapOverlay: L.ImageOverlay | null = null;

async function updateHeatmap() {
  if (!rssiLocalizer || !selectedRSSIDevice) return;
  
  // Get current map bounds
  const bounds = map.getBounds();
  
  // Generate prediction (this already works!)
  const prediction = await rssiLocalizer.predictForDevice(
    selectedRSSIDevice,
    {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    }
  );
  
  // Convert to simple canvas image
  const canvas = createHeatmapCanvas(prediction);
  
  // Show on map
  if (heatmapOverlay) map.removeLayer(heatmapOverlay);
  heatmapOverlay = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.6 });
  heatmapOverlay.addTo(map);
}
```

### 2.2 Simple canvas rendering
```typescript
function createHeatmapCanvas(prediction: GPRPrediction): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;  // Keep it small for performance
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  
  // Just map signal strength to colors
  const imageData = ctx.createImageData(32, 32);
  for (let i = 0; i < prediction.mean.length; i++) {
    const strength = prediction.mean[i];
    // Simple color mapping: blue (weak) to red (strong)
    const normalized = (strength + 100) / 40; // -100 to -60 dBm range
    imageData.data[i * 4] = normalized * 255;      // R
    imageData.data[i * 4 + 1] = 0;                 // G  
    imageData.data[i * 4 + 2] = (1 - normalized) * 255; // B
    imageData.data[i * 4 + 3] = 200;               // A
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
```

---

## Phase 3: Connect to Real Data (30 minutes)

### 3.1 Poll Kismet for fresh RSSI
```typescript
// Add to existing kismetPoller interval
setInterval(() => {
  if (rssiEnabled && selectedRSSIDevice && currentGPSPosition) {
    // The RSSI value is already in the Kismet device data!
    // Just record it with current position
    recordRSSIMeasurement();
    
    // Update heatmap every 5 seconds
    if (Date.now() - lastHeatmapUpdate > 5000) {
      updateHeatmap();
      lastHeatmapUpdate = Date.now();
    }
  }
}, 1000);
```

### 3.2 Show feedback
```typescript
// Add measurement count to UI
{#if rssiEnabled && selectedRSSIDevice}
  <div class="rssi-info">
    Device: {selectedRSSIDevice}
    Measurements: {rssiLocalizer?.getMeasurementCount(selectedRSSIDevice) || 0}
    {#if rssiLocalizer?.getMeasurementCount(selectedRSSIDevice) >= 5}
      ✅ Generating heatmap...
    {:else}
      📡 Need {5 - (rssiLocalizer?.getMeasurementCount(selectedRSSIDevice) || 0)} more measurements
    {/if}
  </div>
{/if}
```

---

## Phase 4: Make it Work (15 minutes)

### 4.1 Handle edge cases
- Check if GPS has valid position
- Ensure device has RSSI reading
- Clear old measurements after 5 minutes
- Remove heatmap when RSSI disabled

### 4.2 Basic testing
1. Enable RSSI mode
2. Select a device  
3. Move around (or wait if stationary)
4. See heatmap appear after 5 measurements

---

## 🚫 What We're NOT Doing for MVP

1. **NO Coral TPU** - The CPU Gaussian Process is fast enough (9ms!)
2. **NO WebSockets** - Polling is fine for MVP
3. **NO fancy UI** - Just show the data
4. **NO model training** - Use the math that already works
5. **NO complex architecture** - Everything in one file is OK for MVP
6. **NO performance optimization** - Pi 5 can handle it
7. **NO multiple devices** - One at a time is enough

---

## 📊 Success Criteria

**It works if:**
- RSSI button enables/disables the feature ✓
- Clicking a device selects it for tracking ✓  
- After moving to 5+ positions, a heatmap appears ✓
- The heatmap roughly shows stronger signals near the device ✓

**Time to implement: 2 hours MAX**

---

## 🔧 Implementation Order

1. **First 30 min**: Add RSSILocalizer to page, hook up to button
2. **Next 45 min**: Create basic canvas heatmap visualization  
3. **Next 30 min**: Connect real Kismet RSSI values
4. **Last 15 min**: Test and fix edge cases

The beauty is that all the complex math already exists in RSSILocalizer.ts - we just need to wire it up!
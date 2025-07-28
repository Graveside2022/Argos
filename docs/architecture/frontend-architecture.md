# Frontend Architecture

## Component Architecture

### Component Organization

```text
src/lib/components/
├── signals/
│   ├── SignalMap.svelte          # Main map with signal overlay
│   ├── SignalList.svelte         # Filterable signal list
│   ├── SignalDetails.svelte      # Detailed signal view
│   └── SpectrumWaterfall.svelte  # Frequency waterfall
├── missions/
│   ├── MissionPlanner.svelte     # Draw mission areas
│   ├── MissionControl.svelte     # Active mission monitoring
│   ├── MissionList.svelte        # Mission history
│   └── WaypointEditor.svelte     # Edit mission waypoints
├── hardware/
│   ├── DeviceStatus.svelte       # Hardware connection status
│   ├── SweepControl.svelte       # Frequency sweep params
│   ├── GainControl.svelte        # SDR gain settings
│   └── DeviceSelector.svelte     # Switch between devices
├── shared/
│   ├── StatusIndicator.svelte    # Connection/status dots
│   ├── RealtimeChart.svelte      # Live data charts
│   ├── OfflineBanner.svelte      # Offline mode indicator
│   └── ErrorBoundary.svelte      # Error recovery UI
└── layout/
    ├── Navigation.svelte         # App navigation
    ├── NotificationToast.svelte  # User notifications
    └── ConnectionStatus.svelte   # WebSocket status
```

### Component Template

```typescript
<!-- SignalMap.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Signal } from '$lib/types';
  import { signalStore } from '$lib/stores/signalStore';
  import { mapConfig } from '$lib/config/map';
  import L from 'leaflet';
  import 'leaflet.heat';
  
  export let center: [number, number] = [40.7128, -74.0060];
  export let zoom: number = 12;
  export let showHeatmap: boolean = true;
  export let signals: Signal[] = [];
  
  let mapElement: HTMLElement;
  let map: L.Map;
  let heatmapLayer: L.HeatLayer;
  let markerGroup: L.LayerGroup;
  
  $: updateSignals(signals);
  
  onMount(() => {
    initializeMap();
    return () => map?.remove();
  });
  
  function initializeMap() {
    map = L.map(mapElement).setView(center, zoom);
    
    // Add tile layer with offline fallback
    L.tileLayer(mapConfig.tileUrl, {
      attribution: mapConfig.attribution,
      maxZoom: 19
    }).addTo(map);
    
    markerGroup = L.layerGroup().addTo(map);
    
    if (showHeatmap) {
      heatmapLayer = L.heatLayer([], {
        radius: 25,
        blur: 15,
        gradient: mapConfig.heatmapGradient
      }).addTo(map);
    }
  }
  
  function updateSignals(signals: Signal[]) {
    if (!map) return;
    
    // Update heatmap
    if (heatmapLayer) {
      const heatData = signals.map(s => [
        s.latitude, 
        s.longitude, 
        normalizeRSSI(s.rssi)
      ]);
      heatmapLayer.setLatLngs(heatData);
    }
    
    // Update markers for strong signals
    markerGroup.clearLayers();
    signals
      .filter(s => s.rssi > -70)
      .forEach(signal => {
        const marker = L.circleMarker([signal.latitude, signal.longitude], {
          radius: 8,
          color: getSignalColor(signal.rssi),
          fillOpacity: 0.8
        });
        
        marker.bindPopup(`
          <strong>Signal Detected</strong><br>
          Frequency: ${(signal.frequency / 1e6).toFixed(1)} MHz<br>
          Strength: ${signal.rssi} dBm<br>
          Time: ${new Date(signal.timestamp).toLocaleTimeString()}
        `);
        
        markerGroup.addLayer(marker);
      });
  }
  
  function normalizeRSSI(rssi: number): number {
    // Convert RSSI (-100 to -30) to 0-1 scale
    return Math.max(0, Math.min(1, (rssi + 100) / 70));
  }
  
  function getSignalColor(rssi: number): string {
    if (rssi > -50) return '#dc2626'; // Strong - red
    if (rssi > -70) return '#f59e0b'; // Moderate - yellow
    return '#3b82f6'; // Weak - blue
  }
</script>

<div bind:this={mapElement} class="w-full h-full" />

<style>
  :global(.leaflet-container) {
    background: #0a0a0a;
  }
</style>
```

## State Management Architecture

### State Structure

```typescript
// lib/stores/signalStore.ts
import { writable, derived, get } from 'svelte/store';
import type { Signal } from '$lib/types';

interface SignalState {
  signals: Signal[];
  isLoading: boolean;
  error: string | null;
  filters: {
    frequencyRange: [number, number];
    minRSSI: number;
    timeRange: [Date, Date];
  };
}

function createSignalStore() {
  const { subscribe, set, update } = writable<SignalState>({
    signals: [],
    isLoading: false,
    error: null,
    filters: {
      frequencyRange: [0, 6e9],
      minRSSI: -100,
      timeRange: [new Date(Date.now() - 3600000), new Date()]
    }
  });
  
  return {
    subscribe,
    addSignal: (signal: Signal) => update(state => ({
      ...state,
      signals: [...state.signals, signal].slice(-10000) // Keep last 10k
    })),
    addBatch: (signals: Signal[]) => update(state => ({
      ...state,
      signals: [...state.signals, ...signals].slice(-10000)
    })),
    setFilters: (filters: Partial<SignalState['filters']>) => update(state => ({
      ...state,
      filters: { ...state.filters, ...filters }
    })),
    clear: () => set({
      signals: [],
      isLoading: false,
      error: null,
      filters: get(signalStore).filters
    })
  };
}

export const signalStore = createSignalStore();

// Derived store for filtered signals
export const filteredSignals = derived(
  signalStore,
  $signalStore => {
    return $signalStore.signals.filter(signal => {
      const { filters } = $signalStore;
      return signal.frequency >= filters.frequencyRange[0] &&
             signal.frequency <= filters.frequencyRange[1] &&
             signal.rssi >= filters.minRSSI &&
             new Date(signal.timestamp) >= filters.timeRange[0] &&
             new Date(signal.timestamp) <= filters.timeRange[1];
    });
  }
);
```

### State Management Patterns

- Use writable stores for mutable state
- Create derived stores for computed values
- Keep stores focused on single domain
- Implement cleanup in component onDestroy
- Use custom store factories for complex state

## Routing Architecture

### Route Organization

```text
src/routes/
├── +layout.svelte              # Root layout with navigation
├── +page.svelte               # Dashboard/home
├── (app)/                     # Authenticated routes group
│   ├── signals/
│   │   ├── +page.svelte       # Signal list/map view
│   │   └── [id]/+page.svelte  # Signal details
│   ├── missions/
│   │   ├── +page.svelte       # Mission list
│   │   ├── new/+page.svelte   # Create mission
│   │   └── [id]/
│   │       ├── +page.svelte   # Mission details
│   │       └── execute/+page.svelte # Mission control
│   ├── hardware/
│   │   ├── +page.svelte       # Device management
│   │   └── [device]/+page.svelte # Device control
│   └── settings/
│       └── +page.svelte       # App settings
├── auth/
│   ├── login/+page.svelte     # Login page
│   └── logout/+page.server.ts # Logout handler
└── api/                       # API routes
    ├── signals/
    │   └── +server.ts
    ├── missions/
    │   └── +server.ts
    └── ws/
        └── +server.ts         # WebSocket upgrade
```

### Protected Route Pattern

```typescript
// routes/(app)/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { verifyAuth } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ cookies, url }) => {
  const token = cookies.get('auth-token');
  
  if (!token) {
    throw redirect(303, `/auth/login?from=${encodeURIComponent(url.pathname)}`);
  }
  
  try {
    const user = await verifyAuth(token);
    return { user };
  } catch {
    cookies.delete('auth-token');
    throw redirect(303, '/auth/login');
  }
};
```

## Frontend Services Layer

### API Client Setup

```typescript
// lib/services/api.ts
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { Signal, Mission } from '$lib/types';

class ApiClient {
  private baseUrl = '/api';
  
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      if (response.status === 401 && browser) {
        goto('/auth/login');
      }
      
      const error = await response.json();
      throw new ApiError(error);
    }
    
    return response.json();
  }
  
  // Signal operations
  async uploadSignals(signals: Signal[]) {
    return this.request('/signals/batch', {
      method: 'POST',
      body: JSON.stringify({ signals })
    });
  }
  
  async getNearbySignals(lat: number, lon: number, radius = 1000) {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      radius: radius.toString()
    });
    
    return this.request<Signal[]>(`/signals/nearby?${params}`);
  }
  
  // Mission operations
  async createMission(mission: Omit<Mission, 'id'>) {
    return this.request<Mission>('/missions', {
      method: 'POST',
      body: JSON.stringify(mission)
    });
  }
  
  async executeMission(missionId: string) {
    return this.request(`/missions/${missionId}/execute`, {
      method: 'POST'
    });
  }
}

export const api = new ApiClient();
```

### Service Example

```typescript
// lib/services/signalService.ts
import { api } from './api';
import { signalStore } from '$lib/stores/signalStore';
import { webSocketService } from './webSocketService';

export class SignalService {
  private syncInterval: NodeJS.Timer | null = null;
  
  async startRealtimeUpdates() {
    // Subscribe to WebSocket events
    webSocketService.on('signal:detected', (signal: Signal) => {
      signalStore.addSignal(signal);
    });
    
    webSocketService.on('signal:batch', (signals: Signal[]) => {
      signalStore.addBatch(signals);
    });
    
    // Start periodic sync for offline data
    this.syncInterval = setInterval(() => {
      this.syncOfflineData();
    }, 30000);
  }
  
  stopRealtimeUpdates() {
    webSocketService.off('signal:detected');
    webSocketService.off('signal:batch');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  private async syncOfflineData() {
    const offlineSignals = await this.getOfflineSignals();
    if (offlineSignals.length > 0) {
      try {
        await api.uploadSignals(offlineSignals);
        await this.clearOfflineSignals();
      } catch (error) {
        console.error('Failed to sync offline signals:', error);
      }
    }
  }
  
  private async getOfflineSignals(): Promise<Signal[]> {
    // Get from IndexedDB or localStorage
    return [];
  }
  
  private async clearOfflineSignals(): Promise<void> {
    // Clear synced signals from local storage
  }
}

export const signalService = new SignalService();
```

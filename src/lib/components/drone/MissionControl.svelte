<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { 
    activeMission, 
    droneState, 
    missionProgress,
    startMission,
    pauseMission,
    completeMission,
    createMission,
    type DroneMission,
    type Waypoint
  } from '$lib/stores/drone';
  import { slide } from 'svelte/transition';
  interface LeafletLayer {
    options?: {
      className?: string;
      draggable?: boolean;
    };
    getLatLng?(): { lat: number; lng: number };
  }

  interface LeafletLibrary {
    marker(latlng: [number, number], options?: Record<string, unknown>): LeafletMarker;
    divIcon(options: Record<string, unknown>): unknown;
    polyline(latlngs: [number, number][], options?: Record<string, unknown>): LeafletPolyline;
    Marker: new (...args: unknown[]) => LeafletMarker;
  }

  interface LeafletMarker extends LeafletLayer {
    on(event: string, handler: (e: LeafletEvent) => void): void;
    addTo(map: LeafletMap): void;
    getLatLng(): { lat: number; lng: number };
  }

  interface LeafletPolyline extends LeafletLayer {
    addTo(map: LeafletMap): void;
  }

  interface LeafletMap {
    _container: HTMLElement;
    on(event: string, handler: (e: LeafletMouseEvent) => void): void;
    off(event: string, handler: (e: LeafletMouseEvent) => void): void;
    eachLayer(handler: (layer: LeafletLayer) => void): void;
    removeLayer(layer: LeafletLayer): void;
  }

  interface LeafletMouseEvent {
    latlng: {
      lat: number;
      lng: number;
    };
  }

  interface LeafletEvent {
    target: {
      getLatLng(): { lat: number; lng: number };
    };
  }
  
  export let map: LeafletMap;
  
  const dispatch = createEventDispatcher();
  
  function getLeafletLibrary(): LeafletLibrary {
    const windowWithL = window as unknown as { L?: LeafletLibrary };
    if (!windowWithL.L) {
      throw new Error('Leaflet library not found');
    }
    return windowWithL.L;
  }
  
  let showMissionPlanner = false;
  let missionName = '';
  let missionType: DroneMission['type'] = 'survey';
  let defaultAltitude = 50;
  let scanInterval = 1;
  let signalThreshold = -90;
  let plannedWaypoints: Waypoint[] = [];
  let drawingMode = false;
  let selectedWaypoint: Waypoint | null = null;
  
  $: missionActive = $activeMission?.status === 'active';
  $: missionPaused = $activeMission?.status === 'paused';
  
  function toggleMissionPlanner() {
    showMissionPlanner = !showMissionPlanner;
    if (showMissionPlanner && map) {
      enableDrawingMode();
    } else if (map) {
      disableDrawingMode();
    }
  }
  
  function enableDrawingMode() {
    drawingMode = true;
    if (!map) return;
    
    // Change cursor
    map._container.style.cursor = 'crosshair';
    
    // Add click handler
    map.on('click', addWaypoint);
  }
  
  function disableDrawingMode() {
    drawingMode = false;
    if (!map) return;
    
    map._container.style.cursor = '';
    map.off('click', addWaypoint);
  }
  
  function addWaypoint(e: LeafletMouseEvent) {
    const waypoint: Waypoint = {
      id: `wp-${Date.now()}`,
      lat: e.latlng.lat,
      lon: e.latlng.lng,
      altitude: defaultAltitude,
      actions: [{
        type: 'signal_sweep',
        parameters: { duration: scanInterval }
      }]
    };
    
    plannedWaypoints = [...plannedWaypoints, waypoint];
    
    // Add visual marker
    const leaflet = getLeafletLibrary();
    const marker = leaflet.marker([waypoint.lat, waypoint.lon], {
      draggable: true,
      icon: leaflet.divIcon({
        className: 'waypoint-marker',
        html: `
          <div style="
            background: #ff6b00;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">
            ${plannedWaypoints.length}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    });
    
    marker.on('dragend', (event: LeafletEvent) => {
      const newPos = event.target.getLatLng();
      const index = plannedWaypoints.findIndex(wp => wp.id === waypoint.id);
      if (index !== -1) {
        plannedWaypoints[index] = {
          ...plannedWaypoints[index],
          lat: newPos.lat,
          lon: newPos.lng
        };
        plannedWaypoints = [...plannedWaypoints]; // Trigger reactivity
      }
    });
    
    marker.on('click', () => {
      selectedWaypoint = waypoint;
    });
    
    marker.addTo(map);
    
    // Draw path
    updateMissionPath();
  }
  
  function updateMissionPath() {
    if (!map || plannedWaypoints.length < 2) return;
    
    const leaflet = getLeafletLibrary();
    const pathPoints: [number, number][] = plannedWaypoints.map(wp => [wp.lat, wp.lon]);
    
    // Remove old path
    map.eachLayer((layer: LeafletLayer) => {
      if (layer.options?.className === 'mission-path') {
        map.removeLayer(layer);
      }
    });
    
    // Draw new path
    leaflet.polyline(pathPoints, {
      color: '#ff6b00',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 5',
      className: 'mission-path'
    }).addTo(map);
  }
  
  function removeWaypoint(waypoint: Waypoint) {
    plannedWaypoints = plannedWaypoints.filter(wp => wp.id !== waypoint.id);
    
    // Remove marker from map
    if (map) {
      map.eachLayer((layer: LeafletLayer) => {
        // Check if layer is a marker with the correct position
        if (layer.getLatLng) {
          const pos = layer.getLatLng();
          if (pos.lat === waypoint.lat && pos.lng === waypoint.lon) {
            map.removeLayer(layer);
          }
        }
      });
    }
    
    updateMissionPath();
  }
  
  function clearWaypoints() {
    plannedWaypoints = [];
    selectedWaypoint = null;
    
    // Remove all waypoint markers and paths
    if (map) {
      map.eachLayer((layer: LeafletLayer) => {
        if ((layer.options?.className === 'mission-path') ||
            (layer.options?.draggable)) {
          map.removeLayer(layer);
        }
      });
    }
  }
  
  function createAndStartMission() {
    if (!missionName || plannedWaypoints.length === 0) return;
    
    const mission = createMission(
      missionName,
      missionType,
      plannedWaypoints,
      undefined,
      {
        signalThreshold,
        scanInterval,
        altitudeFilter: { min: 0, max: defaultAltitude + 50 }
      }
    );
    
    void startMission(mission);
    showMissionPlanner = false;
    disableDrawingMode();
    clearWaypoints();
    missionName = '';
    
    dispatch('missionStarted', mission);
  }
  
  function handlePauseMission() {
    void pauseMission();
    dispatch('missionPaused');
  }
  
  function handleResumeMission() {
    if ($activeMission) {
      $activeMission.status = 'active';
      activeMission.set($activeMission);
      dispatch('missionResumed');
    }
  }
  
  function handleStopMission() {
    void completeMission();
    dispatch('missionCompleted');
  }
  
  function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
</script>

<div class="mission-control">
  <!-- Active Mission Status -->
  {#if $activeMission}
    <div class="active-mission" transition:slide>
      <div class="mission-header">
        <h3>{$activeMission.name}</h3>
        <span class="mission-type">{$activeMission.type}</span>
        <span class="mission-status" class:active={missionActive} class:paused={missionPaused}>
          {$activeMission.status}
        </span>
      </div>
      
      <div class="mission-stats">
        <div class="stat">
          <span class="label">Progress</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: {$missionProgress}%"></div>
          </div>
          <span class="value">{$missionProgress.toFixed(0)}%</span>
        </div>
        
        <div class="stat">
          <span class="label">Duration</span>
          <span class="value">{formatDuration($activeMission.statistics.totalDuration)}</span>
        </div>
        
        <div class="stat">
          <span class="label">Signals</span>
          <span class="value">{$activeMission.statistics.signalsCaptured}</span>
        </div>
        
        <div class="stat">
          <span class="label">Distance</span>
          <span class="value">{($activeMission.statistics.totalDistance / 1000).toFixed(1)} km</span>
        </div>
      </div>
      
      <div class="mission-controls">
        {#if missionActive}
          <button class="btn-pause" on:click={handlePauseMission}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
            Pause
          </button>
        {:else if missionPaused}
          <button class="btn-resume" on:click={handleResumeMission}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Resume
          </button>
        {/if}
        
        <button class="btn-stop" on:click={handleStopMission}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6z"/>
          </svg>
          Stop
        </button>
      </div>
    </div>
  {:else}
    <!-- Mission Planner -->
    <button class="btn-plan-mission" on:click={toggleMissionPlanner}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2h8zm4 8h-5V5l5 5z"/>
      </svg>
      Plan Mission
    </button>
  {/if}
  
  <!-- Mission Planner Panel -->
  {#if showMissionPlanner}
    <div class="mission-planner" transition:slide>
      <div class="planner-header">
        <h3>Mission Planner</h3>
        <button class="btn-close" on:click={toggleMissionPlanner}>×</button>
      </div>
      
      <div class="planner-content">
        <div class="form-group">
          <label for="mission-name">Mission Name</label>
          <input
            id="mission-name"
            type="text"
            bind:value={missionName}
            placeholder="Enter mission name"
          />
        </div>
        
        <div class="form-group">
          <label for="mission-type">Mission Type</label>
          <select id="mission-type" bind:value={missionType}>
            <option value="survey">Area Survey</option>
            <option value="patrol">Patrol Route</option>
            <option value="monitoring">Signal Monitoring</option>
            <option value="mapping">RF Mapping</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="default-altitude">Default Altitude (m)</label>
          <input
            id="default-altitude"
            type="number"
            bind:value={defaultAltitude}
            min="10"
            max="400"
            step="10"
          />
        </div>
        
        <div class="form-group">
          <label for="scan-interval">Scan Interval (s)</label>
          <input
            id="scan-interval"
            type="number"
            bind:value={scanInterval}
            min="0.5"
            max="10"
            step="0.5"
          />
        </div>
        
        <div class="form-group">
          <label for="signal-threshold">Signal Threshold (dBm)</label>
          <input
            id="signal-threshold"
            type="number"
            bind:value={signalThreshold}
            min="-100"
            max="-30"
            step="5"
          />
        </div>
        
        <div class="waypoints-section">
          <div class="section-header">
            <h4>Waypoints ({plannedWaypoints.length})</h4>
            <button class="btn-clear" on:click={clearWaypoints} disabled={plannedWaypoints.length === 0}>
              Clear All
            </button>
          </div>
          
          {#if drawingMode}
            <div class="drawing-hint">
              Click on the map to add waypoints
            </div>
          {/if}
          
          <div class="waypoints-list">
            {#each plannedWaypoints as waypoint, index}
              <div class="waypoint-item" class:selected={selectedWaypoint?.id === waypoint.id}>
                <span class="waypoint-number">{index + 1}</span>
                <div class="waypoint-info">
                  <div class="coords">
                    {waypoint.lat.toFixed(6)}, {waypoint.lon.toFixed(6)}
                  </div>
                  <div class="altitude">
                    Alt: {waypoint.altitude}m
                  </div>
                </div>
                <button class="btn-remove" on:click={() => removeWaypoint(waypoint)}>
                  ×
                </button>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="planner-actions">
          <button 
            class="btn-start-mission" 
            on:click={createAndStartMission}
            disabled={!missionName || plannedWaypoints.length === 0 || !$droneState.connected}
          >
            Start Mission
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mission-control {
    position: relative;
    background: rgba(17, 24, 39, 0.95);
    border-radius: 8px;
    padding: 16px;
    color: white;
    min-width: 300px;
  }
  
  .active-mission {
    space-y: 12px;
  }
  
  .mission-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .mission-header h3 {
    margin: 0;
    font-size: 18px;
    flex: 1;
  }
  
  .mission-type {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
  }
  
  .mission-status {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    text-transform: uppercase;
    font-weight: 500;
  }
  
  .mission-status.active {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
  }
  
  .mission-status.paused {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }
  
  .mission-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .stat .label {
    font-size: 12px;
    color: #9ca3af;
  }
  
  .stat .value {
    font-size: 16px;
    font-weight: 600;
  }
  
  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: #22c55e;
    transition: width 0.3s ease;
  }
  
  .mission-controls {
    display: flex;
    gap: 8px;
  }
  
  button {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn-pause {
    background: #f59e0b;
    color: white;
  }
  
  .btn-pause:hover {
    background: #d97706;
  }
  
  .btn-resume {
    background: #22c55e;
    color: white;
  }
  
  .btn-resume:hover {
    background: #16a34a;
  }
  
  .btn-stop {
    background: #ef4444;
    color: white;
  }
  
  .btn-stop:hover {
    background: #dc2626;
  }
  
  .btn-plan-mission {
    background: #3b82f6;
    color: white;
    width: 100%;
    justify-content: center;
  }
  
  .btn-plan-mission:hover {
    background: #2563eb;
  }
  
  .mission-planner {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 8px;
    background: rgba(17, 24, 39, 0.98);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 10;
    max-height: 600px;
    overflow-y: auto;
  }
  
  .planner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .planner-header h3 {
    margin: 0;
    font-size: 18px;
  }
  
  .btn-close {
    background: none;
    color: #9ca3af;
    font-size: 24px;
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .btn-close:hover {
    color: white;
  }
  
  .planner-content {
    padding: 16px;
  }
  
  .form-group {
    margin-bottom: 16px;
  }
  
  .form-group label {
    display: block;
    font-size: 14px;
    color: #9ca3af;
    margin-bottom: 4px;
  }
  
  .form-group input,
  .form-group select {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: white;
    font-size: 14px;
  }
  
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(255, 255, 255, 0.08);
  }
  
  .waypoints-section {
    margin-top: 24px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .section-header h4 {
    margin: 0;
    font-size: 16px;
  }
  
  .btn-clear {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    padding: 4px 12px;
    font-size: 12px;
  }
  
  .btn-clear:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
  }
  
  .btn-clear:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .drawing-hint {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    color: #93bbfc;
    margin-bottom: 12px;
    text-align: center;
  }
  
  .waypoints-list {
    max-height: 200px;
    overflow-y: auto;
  }
  
  .waypoint-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    margin-bottom: 4px;
    transition: all 0.2s;
  }
  
  .waypoint-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .waypoint-item.selected {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  
  .waypoint-number {
    background: #ff6b00;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }
  
  .waypoint-info {
    flex: 1;
  }
  
  .coords {
    font-size: 13px;
    font-family: monospace;
  }
  
  .altitude {
    font-size: 12px;
    color: #9ca3af;
  }
  
  .btn-remove {
    background: none;
    color: #ef4444;
    width: 24px;
    height: 24px;
    padding: 0;
    font-size: 20px;
    line-height: 1;
  }
  
  .btn-remove:hover {
    color: #dc2626;
  }
  
  .planner-actions {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .btn-start-mission {
    background: #22c55e;
    color: white;
    width: 100%;
    justify-content: center;
    padding: 12px;
    font-size: 16px;
  }
  
  .btn-start-mission:hover:not(:disabled) {
    background: #16a34a;
  }
  
  .btn-start-mission:disabled {
    background: #4b5563;
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
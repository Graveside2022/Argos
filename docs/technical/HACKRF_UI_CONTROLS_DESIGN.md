# HackRF UI Control Components Design Plan

## Overview

This document provides detailed plans for five essential UI control components for the HackRF Sweep operator interface. Each component is designed to provide intuitive operator interaction with the spectrum analysis system.

## 1. Time Window Slider Component (Enhanced)

### Component: `TimeWindowSlider.svelte`

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { writable, derived } from 'svelte/store';

  export let min = 5;
  export let max = 300;
  export let value = 30;
  export let step = 5;
  export let showTicks = true;
  export let showLabels = true;
  export let unit = 's';

  const dispatch = createEventDispatcher();

  // Visual feedback for dragging
  let isDragging = false;
  let sliderRef: HTMLDivElement;

  // Tick marks for visual reference
  const ticks = Array.from({ length: Math.floor((max - min) / step) + 1 },
    (_, i) => min + i * step
  );

  // Update handler
  function handleChange(newValue: number) {
    value = newValue;
    dispatch('change', { value });
  }

  // Drag handlers
  function startDrag(event: MouseEvent | TouchEvent) {
    isDragging = true;
    updateValue(event);
  }

  function updateValue(event: MouseEvent | TouchEvent) {
    if (!isDragging || !sliderRef) return;

    const rect = sliderRef.getBoundingClientRect();
    const x = event.type.includes('touch')
      ? (event as TouchEvent).touches[0].clientX
      : (event as MouseEvent).clientX;

    const percent = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    const newValue = Math.round((min + percent * (max - min)) / step) * step;

    handleChange(newValue);
  }

  function endDrag() {
    isDragging = false;
  }
</script>

<div class="time-window-slider">
  <div class="slider-header">
    <label class="slider-label">{$$slots.default ? <slot /> : 'Time Window'}</label>
    <span class="slider-value">{value}{unit}</span>
  </div>

  <div
    bind:this={sliderRef}
    class="slider-track"
    on:mousedown={startDrag}
    on:touchstart={startDrag}
    on:mousemove={updateValue}
    on:touchmove={updateValue}
    on:mouseup={endDrag}
    on:touchend={endDrag}
    on:mouseleave={endDrag}
  >
    <div
      class="slider-fill"
      style="width: {((value - min) / (max - min)) * 100}%"
    />

    <div
      class="slider-thumb {isDragging ? 'dragging' : ''}"
      style="left: {((value - min) / (max - min)) * 100}%"
    >
      <div class="thumb-indicator" />
    </div>

    {#if showTicks}
      <div class="slider-ticks">
        {#each ticks as tick}
          <div
            class="tick"
            style="left: {((tick - min) / (max - min)) * 100}%"
          />
        {/each}
      </div>
    {/if}
  </div>

  {#if showLabels}
    <div class="slider-labels">
      <span class="label-min">{min}{unit}</span>
      <span class="label-max">{max}{unit}</span>
    </div>
  {/if}
</div>
```

### Features:

- Smooth drag interaction with visual feedback
- Customizable min/max/step values
- Optional tick marks and labels
- Touch-friendly for mobile devices
- Real-time value updates
- Accessible with keyboard support

### Integration Points:

- Connects to `timeWindowFilter` service
- Emits `change` events for parent components
- Can be bound to stores directly
- Supports custom styling through CSS variables

## 2. Signal Strength Threshold Controls

### Component: `SignalThresholdControl.svelte`

```svelte
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { signalStrength } from '$lib/stores/hackrf';

	export let minThreshold = -90;
	export let maxThreshold = -10;
	export let noiseFloor = -85;
	export let alertThreshold = -50;

	const dispatch = createEventDispatcher();

	// Threshold types
	type ThresholdType = 'noise' | 'alert' | 'record';

	interface Threshold {
		type: ThresholdType;
		value: number;
		color: string;
		label: string;
		enabled: boolean;
	}

	let thresholds: Threshold[] = [
		{ type: 'noise', value: noiseFloor, color: '#60A5FA', label: 'Noise Floor', enabled: true },
		{
			type: 'alert',
			value: alertThreshold,
			color: '#FBBF24',
			label: 'Alert Level',
			enabled: true
		},
		{ type: 'record', value: -30, color: '#EF4444', label: 'Record Trigger', enabled: false }
	];

	// Update threshold
	function updateThreshold(type: ThresholdType, value: number) {
		const threshold = thresholds.find((t) => t.type === type);
		if (threshold) {
			threshold.value = value;
			dispatch('thresholdChange', { type, value });
		}
	}

	// Toggle threshold
	function toggleThreshold(type: ThresholdType) {
		const threshold = thresholds.find((t) => t.type === type);
		if (threshold) {
			threshold.enabled = !threshold.enabled;
			dispatch('thresholdToggle', { type, enabled: threshold.enabled });
		}
	}

	// Visual indicator position
	function getPosition(value: number): number {
		return ((value - minThreshold) / (maxThreshold - minThreshold)) * 100;
	}
</script>

<div class="threshold-control">
	<h4 class="control-title">Signal Thresholds</h4>

	<!-- Visual threshold display -->
	<div class="threshold-display">
		<div class="db-scale">
			{#each thresholds as threshold}
				{#if threshold.enabled}
					<div
						class="threshold-line"
						style="left: {getPosition(
							threshold.value
						)}%; background-color: {threshold.color}"
					>
						<span class="threshold-value">{threshold.value} dB</span>
					</div>
				{/if}
			{/each}

			<!-- Current signal indicator -->
			<div class="current-signal" style="left: {getPosition($signalStrength)}%">
				<span class="signal-value">{$signalStrength.toFixed(1)} dB</span>
			</div>
		</div>
	</div>

	<!-- Threshold controls -->
	<div class="threshold-list">
		{#each thresholds as threshold}
			<div class="threshold-item">
				<label class="threshold-toggle">
					<input
						type="checkbox"
						bind:checked={threshold.enabled}
						on:change={() => toggleThreshold(threshold.type)}
					/>
					<span class="toggle-label" style="color: {threshold.color}"
						>{threshold.label}</span
					>
				</label>

				<div class="threshold-slider">
					<input
						type="range"
						min={minThreshold}
						max={maxThreshold}
						step="1"
						value={threshold.value}
						disabled={!threshold.enabled}
						on:input={(e) => updateThreshold(threshold.type, Number(e.target.value))}
						style="accent-color: {threshold.color}"
					/>
					<span class="value-display">{threshold.value} dB</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Quick actions -->
	<div class="quick-actions">
		<button class="action-btn" on:click={() => dispatch('autoDetectNoise')}>
			Auto-Detect Noise
		</button>
		<button class="action-btn" on:click={() => dispatch('resetThresholds')}>
			Reset to Defaults
		</button>
	</div>
</div>
```

### Features:

- Multiple configurable thresholds (noise floor, alert, record)
- Visual representation with color coding
- Real-time signal strength comparison
- Enable/disable individual thresholds
- Auto-detection capabilities
- Quick reset functionality

### Integration Points:

- Monitors `signalStrength` store
- Emits threshold changes for filtering
- Connects to signal processing pipeline
- Can trigger alerts and recordings

## 3. Frequency Band Filters

### Component: `FrequencyBandFilter.svelte`

```svelte
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Common frequency bands
	interface FrequencyBand {
		id: string;
		name: string;
		startFreq: number;
		endFreq: number;
		color: string;
		enabled: boolean;
		description: string;
	}

	let bands: FrequencyBand[] = [
		{
			id: 'vhf',
			name: 'VHF',
			startFreq: 30e6,
			endFreq: 300e6,
			color: '#60A5FA',
			enabled: true,
			description: 'Very High Frequency (30-300 MHz)'
		},
		{
			id: 'uhf',
			name: 'UHF',
			startFreq: 300e6,
			endFreq: 3000e6,
			color: '#34D399',
			enabled: true,
			description: 'Ultra High Frequency (300 MHz - 3 GHz)'
		},
		{
			id: 'ism_433',
			name: 'ISM 433',
			startFreq: 433.05e6,
			endFreq: 434.79e6,
			color: '#FBBF24',
			enabled: false,
			description: 'Industrial, Scientific, Medical'
		},
		{
			id: 'ism_915',
			name: 'ISM 915',
			startFreq: 902e6,
			endFreq: 928e6,
			color: '#F87171',
			enabled: false,
			description: 'North American ISM band'
		},
		{
			id: 'wifi_2g',
			name: 'WiFi 2.4G',
			startFreq: 2.4e9,
			endFreq: 2.5e9,
			color: '#A78BFA',
			enabled: false,
			description: '2.4 GHz WiFi channels'
		}
	];

	// Custom band input
	let customBandStart = '';
	let customBandEnd = '';
	let customBandName = '';

	// Toggle band
	function toggleBand(bandId: string) {
		const band = bands.find((b) => b.id === bandId);
		if (band) {
			band.enabled = !band.enabled;
			updateFilters();
		}
	}

	// Add custom band
	function addCustomBand() {
		if (customBandStart && customBandEnd && customBandName) {
			const newBand: FrequencyBand = {
				id: `custom_${Date.now()}`,
				name: customBandName,
				startFreq: parseFloat(customBandStart) * 1e6,
				endFreq: parseFloat(customBandEnd) * 1e6,
				color: '#94A3B8',
				enabled: true,
				description: 'Custom frequency band'
			};

			bands = [...bands, newBand];
			customBandStart = '';
			customBandEnd = '';
			customBandName = '';
			updateFilters();
		}
	}

	// Remove band
	function removeBand(bandId: string) {
		bands = bands.filter((b) => b.id !== bandId);
		updateFilters();
	}

	// Update active filters
	function updateFilters() {
		const activeFilters = bands
			.filter((b) => b.enabled)
			.map((b) => ({ start: b.startFreq, end: b.endFreq }));

		dispatch('filtersChanged', { filters: activeFilters });
	}

	// Format frequency for display
	function formatFreq(freq: number): string {
		if (freq >= 1e9) return `${(freq / 1e9).toFixed(2)} GHz`;
		if (freq >= 1e6) return `${(freq / 1e6).toFixed(1)} MHz`;
		return `${(freq / 1e3).toFixed(0)} kHz`;
	}
</script>

<div class="frequency-band-filter">
	<h4 class="filter-title">Frequency Band Filters</h4>

	<!-- Preset bands -->
	<div class="band-list">
		{#each bands as band}
			<div class="band-item {band.enabled ? 'enabled' : 'disabled'}">
				<label class="band-toggle">
					<input
						type="checkbox"
						bind:checked={band.enabled}
						on:change={() => toggleBand(band.id)}
					/>
					<div class="band-info">
						<span class="band-name" style="color: {band.color}">{band.name}</span>
						<span class="band-range">
							{formatFreq(band.startFreq)} - {formatFreq(band.endFreq)}
						</span>
						<span class="band-description">{band.description}</span>
					</div>
				</label>

				{#if band.id.startsWith('custom_')}
					<button class="remove-btn" on:click={() => removeBand(band.id)}> × </button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Add custom band -->
	<div class="custom-band-form">
		<h5>Add Custom Band</h5>
		<div class="form-row">
			<input type="text" placeholder="Name" bind:value={customBandName} class="band-input" />
			<input
				type="number"
				placeholder="Start (MHz)"
				bind:value={customBandStart}
				class="band-input"
			/>
			<input
				type="number"
				placeholder="End (MHz)"
				bind:value={customBandEnd}
				class="band-input"
			/>
			<button
				class="add-btn"
				on:click={addCustomBand}
				disabled={!customBandName || !customBandStart || !customBandEnd}
			>
				Add
			</button>
		</div>
	</div>

	<!-- Quick presets -->
	<div class="quick-presets">
		<button on:click={() => dispatch('loadPreset', { preset: 'amateur' })}>
			Amateur Radio
		</button>
		<button on:click={() => dispatch('loadPreset', { preset: 'commercial' })}>
			Commercial
		</button>
		<button on:click={() => dispatch('loadPreset', { preset: 'aviation' })}> Aviation </button>
	</div>
</div>
```

### Features:

- Preset frequency bands (VHF, UHF, ISM, WiFi)
- Custom band creation
- Visual band representation
- Enable/disable filtering
- Quick preset loading
- Frequency formatting utilities

### Integration Points:

- Filters spectrum data based on frequency ranges
- Updates sweep configuration
- Saves custom bands to local storage
- Integrates with spectrum visualization

## 4. Visualization Mode Selector

### Component: `VisualizationModeSelector.svelte`

```svelte
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	// Visualization modes
	type VisualizationMode = 'spectrum' | 'waterfall' | 'persistence' | '3d' | 'constellation';

	interface ModeOption {
		id: VisualizationMode;
		name: string;
		icon: string;
		description: string;
		settings: Record<string, any>;
	}

	export let currentMode: VisualizationMode = 'spectrum';

	const modes: ModeOption[] = [
		{
			id: 'spectrum',
			name: 'Spectrum',
			icon: '📊',
			description: 'Real-time frequency spectrum',
			settings: {
				averaging: false,
				peakHold: false,
				smoothing: 0.2
			}
		},
		{
			id: 'waterfall',
			name: 'Waterfall',
			icon: '🌊',
			description: 'Time-frequency waterfall display',
			settings: {
				timeScale: 60,
				colorMap: 'viridis',
				intensity: 0.8
			}
		},
		{
			id: 'persistence',
			name: 'Persistence',
			icon: '👁️',
			description: 'Signal persistence view',
			settings: {
				decayRate: 0.95,
				threshold: -80,
				colorGradient: true
			}
		},
		{
			id: '3d',
			name: '3D Spectrum',
			icon: '🎮',
			description: '3D frequency visualization',
			settings: {
				rotation: true,
				perspective: 45,
				elevation: 30
			}
		},
		{
			id: 'constellation',
			name: 'Constellation',
			icon: '✨',
			description: 'IQ constellation diagram',
			settings: {
				gridLines: true,
				traceLength: 100,
				autoScale: true
			}
		}
	];

	let selectedMode = modes.find((m) => m.id === currentMode) || modes[0];
	let showSettings = false;

	// Mode selection
	function selectMode(mode: ModeOption) {
		selectedMode = mode;
		currentMode = mode.id;
		dispatch('modeChange', { mode: mode.id, settings: mode.settings });
	}

	// Update mode settings
	function updateSetting(key: string, value: any) {
		selectedMode.settings[key] = value;
		dispatch('settingsChange', { mode: selectedMode.id, settings: selectedMode.settings });
	}

	// Render mode-specific settings
	function getSettingComponent(key: string, value: any) {
		if (typeof value === 'boolean') {
			return 'toggle';
		} else if (typeof value === 'number') {
			return 'slider';
		} else if (typeof value === 'string') {
			return 'select';
		}
		return 'text';
	}
</script>

<div class="visualization-mode-selector">
	<div class="mode-header">
		<h4 class="selector-title">Visualization Mode</h4>
		<button class="settings-toggle" on:click={() => (showSettings = !showSettings)}>
			⚙️
		</button>
	</div>

	<!-- Mode grid -->
	<div class="mode-grid">
		{#each modes as mode}
			<button
				class="mode-button {currentMode === mode.id ? 'active' : ''}"
				on:click={() => selectMode(mode)}
				title={mode.description}
			>
				<span class="mode-icon">{mode.icon}</span>
				<span class="mode-name">{mode.name}</span>
			</button>
		{/each}
	</div>

	<!-- Mode description -->
	<div class="mode-description">
		<p>{selectedMode.description}</p>
	</div>

	<!-- Mode-specific settings -->
	{#if showSettings}
		<div class="mode-settings">
			<h5>Settings for {selectedMode.name}</h5>

			{#each Object.entries(selectedMode.settings) as [key, value]}
				<div class="setting-item">
					<label class="setting-label">{key}</label>

					{#if typeof value === 'boolean'}
						<input
							type="checkbox"
							checked={value}
							on:change={(e) => updateSetting(key, e.target.checked)}
						/>
					{:else if typeof value === 'number'}
						<input
							type="range"
							{value}
							min="0"
							max="1"
							step="0.01"
							on:input={(e) => updateSetting(key, Number(e.target.value))}
						/>
					{:else if key === 'colorMap'}
						<select {value} on:change={(e) => updateSetting(key, e.target.value)}>
							<option value="viridis">Viridis</option>
							<option value="plasma">Plasma</option>
							<option value="inferno">Inferno</option>
							<option value="magma">Magma</option>
							<option value="cividis">Cividis</option>
						</select>
					{:else}
						<input
							type="text"
							{value}
							on:input={(e) => updateSetting(key, e.target.value)}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Quick actions -->
	<div class="mode-actions">
		<button on:click={() => dispatch('screenshot')}> 📸 Screenshot </button>
		<button on:click={() => dispatch('fullscreen')}> 🔳 Fullscreen </button>
	</div>
</div>
```

### Features:

- Multiple visualization modes (spectrum, waterfall, persistence, 3D, constellation)
- Mode-specific settings
- Quick mode switching with visual feedback
- Screenshot and fullscreen capabilities
- Customizable per-mode parameters

### Integration Points:

- Controls visualization component rendering
- Manages mode-specific settings
- Triggers visualization updates
- Handles display preferences

## 5. Export Functionality

### Component: `ExportControl.svelte`

```svelte
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { spectrumHistory, signalHistory } from '$lib/stores/hackrf';

	const dispatch = createEventDispatcher();

	// Export formats
	type ExportFormat = 'csv' | 'json' | 'sdrsharp' | 'binary' | 'pdf';

	interface ExportOptions {
		format: ExportFormat;
		includeMetadata: boolean;
		timeRange: 'all' | 'window' | 'custom';
		startTime?: Date;
		endTime?: Date;
		dataTypes: {
			spectrum: boolean;
			signals: boolean;
			settings: boolean;
			annotations: boolean;
		};
	}

	let exportOptions: ExportOptions = {
		format: 'csv',
		includeMetadata: true,
		timeRange: 'window',
		dataTypes: {
			spectrum: true,
			signals: true,
			settings: false,
			annotations: false
		}
	};

	let isExporting = false;
	let exportProgress = 0;

	// Format descriptions
	const formatInfo = {
		csv: 'Comma-separated values for spreadsheet analysis',
		json: 'JSON format for programmatic processing',
		sdrsharp: 'SDR# compatible format',
		binary: 'Compact binary format for large datasets',
		pdf: 'PDF report with visualizations'
	};

	// Export data
	async function exportData() {
		isExporting = true;
		exportProgress = 0;

		try {
			// Gather data based on options
			const exportData = await gatherExportData();

			// Format data
			const formatted = await formatData(exportData);

			// Download file
			downloadFile(formatted);

			dispatch('exportComplete', {
				format: exportOptions.format,
				recordCount: exportData.length
			});
		} catch (error) {
			dispatch('exportError', { error });
		} finally {
			isExporting = false;
			exportProgress = 0;
		}
	}

	// Gather data for export
	async function gatherExportData() {
		const data = [];

		// Get spectrum history based on time range
		const history = $spectrumHistory;
		let filtered = history;

		if (exportOptions.timeRange === 'window') {
			const windowStart = Date.now() - 30000; // Last 30 seconds
			filtered = history.filter((d) => d.timestamp >= windowStart);
		} else if (
			exportOptions.timeRange === 'custom' &&
			exportOptions.startTime &&
			exportOptions.endTime
		) {
			const start = exportOptions.startTime.getTime();
			const end = exportOptions.endTime.getTime();
			filtered = history.filter((d) => d.timestamp >= start && d.timestamp <= end);
		}

		// Add spectrum data
		if (exportOptions.dataTypes.spectrum) {
			data.push(
				...filtered.map((d) => ({
					type: 'spectrum',
					timestamp: d.timestamp,
					data: d
				}))
			);
		}

		// Add signal history
		if (exportOptions.dataTypes.signals) {
			data.push(
				...$signalHistory.map((s) => ({
					type: 'signal',
					timestamp: s.timestamp,
					data: s
				}))
			);
		}

		exportProgress = 50;
		return data;
	}

	// Format data based on selected format
	async function formatData(data: any[]) {
		switch (exportOptions.format) {
			case 'csv':
				return formatCSV(data);
			case 'json':
				return formatJSON(data);
			case 'sdrsharp':
				return formatSDRSharp(data);
			case 'binary':
				return formatBinary(data);
			case 'pdf':
				return await formatPDF(data);
			default:
				return formatJSON(data);
		}
	}

	// CSV formatter
	function formatCSV(data: any[]): string {
		const headers = ['Timestamp', 'Type', 'Frequency', 'Power', 'Additional'];
		const rows = data.map((item) => {
			if (item.type === 'spectrum') {
				return item.data.frequencies
					.map(
						(freq: number, i: number) =>
							`${item.timestamp},spectrum,${freq},${item.data.power[i]},`
					)
					.join('\n');
			} else if (item.type === 'signal') {
				return `${item.timestamp},signal,${item.data.frequency},${item.data.power},`;
			}
			return '';
		});

		return [headers.join(','), ...rows].join('\n');
	}

	// JSON formatter
	function formatJSON(data: any[]): string {
		const output = {
			exportDate: new Date().toISOString(),
			format: 'hackrf-sweep-export',
			version: '1.0',
			metadata: exportOptions.includeMetadata
				? {
						device: 'HackRF One',
						sampleRate: 20e6,
						centerFreq: 915e6
					}
				: undefined,
			data: data
		};

		return JSON.stringify(output, null, 2);
	}

	// SDR# formatter
	function formatSDRSharp(data: any[]): string {
		// Implement SDR# XML format
		return '<?xml version="1.0"?>\n<!-- SDR# export format -->';
	}

	// Binary formatter
	function formatBinary(data: any[]): ArrayBuffer {
		// Implement efficient binary format
		return new ArrayBuffer(0);
	}

	// PDF formatter (async for rendering)
	async function formatPDF(data: any[]): Promise<Blob> {
		// Would integrate with PDF library like jsPDF
		return new Blob(['PDF export not implemented'], { type: 'application/pdf' });
	}

	// Download file
	function downloadFile(content: string | ArrayBuffer | Blob) {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filename = `hackrf-export-${timestamp}.${exportOptions.format}`;

		let blob: Blob;
		if (content instanceof Blob) {
			blob = content;
		} else if (content instanceof ArrayBuffer) {
			blob = new Blob([content], { type: 'application/octet-stream' });
		} else {
			blob = new Blob([content], { type: 'text/plain' });
		}

		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Quick export presets
	function quickExport(format: ExportFormat) {
		exportOptions.format = format;
		exportOptions.timeRange = 'window';
		exportData();
	}
</script>

<div class="export-control">
	<h4 class="export-title">Export Data</h4>

	<!-- Quick export buttons -->
	<div class="quick-export">
		<button on:click={() => quickExport('csv')} disabled={isExporting} class="quick-btn csv">
			📊 Quick CSV
		</button>
		<button on:click={() => quickExport('json')} disabled={isExporting} class="quick-btn json">
			📋 Quick JSON
		</button>
	</div>

	<!-- Advanced options -->
	<details class="advanced-options">
		<summary>Advanced Export Options</summary>

		<!-- Format selection -->
		<div class="option-group">
			<label>Export Format</label>
			<select bind:value={exportOptions.format}>
				{#each Object.entries(formatInfo) as [format, description]}
					<option value={format}>{format.toUpperCase()} - {description}</option>
				{/each}
			</select>
		</div>

		<!-- Time range -->
		<div class="option-group">
			<label>Time Range</label>
			<div class="radio-group">
				<label>
					<input type="radio" bind:group={exportOptions.timeRange} value="all" />
					All Data
				</label>
				<label>
					<input type="radio" bind:group={exportOptions.timeRange} value="window" />
					Current Window
				</label>
				<label>
					<input type="radio" bind:group={exportOptions.timeRange} value="custom" />
					Custom Range
				</label>
			</div>

			{#if exportOptions.timeRange === 'custom'}
				<div class="date-range">
					<input type="datetime-local" bind:value={exportOptions.startTime} />
					<span>to</span>
					<input type="datetime-local" bind:value={exportOptions.endTime} />
				</div>
			{/if}
		</div>

		<!-- Data types -->
		<div class="option-group">
			<label>Include Data Types</label>
			<div class="checkbox-group">
				<label>
					<input type="checkbox" bind:checked={exportOptions.dataTypes.spectrum} />
					Spectrum Data
				</label>
				<label>
					<input type="checkbox" bind:checked={exportOptions.dataTypes.signals} />
					Signal History
				</label>
				<label>
					<input type="checkbox" bind:checked={exportOptions.dataTypes.settings} />
					Device Settings
				</label>
				<label>
					<input type="checkbox" bind:checked={exportOptions.dataTypes.annotations} />
					Annotations
				</label>
			</div>
		</div>

		<!-- Metadata option -->
		<label class="metadata-option">
			<input type="checkbox" bind:checked={exportOptions.includeMetadata} />
			Include metadata
		</label>
	</details>

	<!-- Export button -->
	<button class="export-btn" on:click={exportData} disabled={isExporting}>
		{#if isExporting}
			<span class="spinner"></span>
			Exporting... {exportProgress}%
		{:else}
			🚀 Export Data
		{/if}
	</button>

	<!-- Recent exports -->
	<div class="recent-exports">
		<h5>Recent Exports</h5>
		<div class="export-list">
			<!-- Would be populated from localStorage or session -->
			<div class="export-item">
				<span class="export-name">hackrf-export-2024-01-15.csv</span>
				<span class="export-size">2.3 MB</span>
			</div>
		</div>
	</div>
</div>
```

### Features:

- Multiple export formats (CSV, JSON, SDR#, Binary, PDF)
- Quick export buttons for common formats
- Advanced options for customization
- Time range selection
- Data type filtering
- Progress indication
- Recent export history

### Integration Points:

- Accesses spectrum and signal history stores
- Triggers file downloads
- Supports various data formats
- Integrates with visualization for PDF export
- Saves export preferences

## Integration Strategy

### 1. Store Integration

All components will integrate with the existing Svelte stores:

- `spectrumData` - Real-time spectrum information
- `signalHistory` - Historical signal data
- `sweepStatus` - Current sweep state
- `config` - Device configuration

### 2. Event System

Components use consistent event patterns:

- `dispatch('change', { value })` - Value changes
- `dispatch('toggle', { enabled })` - Toggle states
- `dispatch('action', { type })` - User actions

### 3. Styling Approach

- CSS variables for theming
- Consistent with existing glass-panel aesthetic
- Responsive design for mobile support
- Smooth animations and transitions

### 4. Component Composition

```svelte
<!-- Example usage in main page -->
<div class="control-panel">
	<TimeWindowSlider bind:value={timeWindow} on:change={handleTimeWindowChange} />

	<SignalThresholdControl
		on:thresholdChange={handleThresholdChange}
		on:autoDetectNoise={autoDetectNoiseFloor}
	/>

	<FrequencyBandFilter
		on:filtersChanged={handleFilterChange}
		on:loadPreset={loadFrequencyPreset}
	/>

	<VisualizationModeSelector
		bind:currentMode={visualizationMode}
		on:modeChange={handleModeChange}
		on:screenshot={takeScreenshot}
	/>

	<ExportControl on:exportComplete={handleExportComplete} on:exportError={handleExportError} />
</div>
```

### 5. Performance Considerations

- Debounced updates for sliders
- Efficient data filtering
- Lazy loading for large datasets
- Web Workers for heavy processing
- Virtual scrolling for long lists

## Next Steps

1. Implement base components with core functionality
2. Add comprehensive styling matching existing UI
3. Integrate with WebSocket data streams
4. Add keyboard shortcuts and accessibility
5. Implement local storage for preferences
6. Add comprehensive error handling
7. Create unit tests for each component
8. Document component APIs

Each component is designed to be:

- Self-contained and reusable
- Fully typed with TypeScript
- Accessible (ARIA labels, keyboard nav)
- Performant with large datasets
- Consistent with existing UI patterns

# HackRF Page Conversion Guide: HTML to Proper SvelteKit

## Overview

This guide shows how to convert the 954-line hackrfsweep page to proper SvelteKit components while preserving EXACT styling and functionality.

## Step 1: Extract and Organize Styles

### 1.1 Create Global Styles File

Create `/src/app.css` with all the Tailwind configuration:

```css
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

/* Move all custom CSS from external files here */
@layer components {
	/* Glass effects */
	.glass-panel {
		@apply bg-bg-card/80 backdrop-blur-xl border border-border-primary/40;
	}

	.glass-button {
		@apply bg-bg-button/20 backdrop-blur-sm border border-border-primary/40 
           hover:bg-bg-button/40 hover:border-border-hover/60 transition-all duration-200;
	}

	/* Add all other custom classes here */
}
```

### 1.2 Move Tailwind Config

Create `/tailwind.config.js` with the EXACT configuration from the inline script:

```js
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace']
				// ... rest of font config
			},
			colors: {
				// Copy EXACT color definitions
				'bg-primary': '#0a0a0a',
				'bg-secondary': '#141414'
				// ... all other colors
			}
			// ... rest of theme extensions
		}
	}
};
```

## Step 2: Create Component Structure

### 2.1 Main Layout Components

```
src/lib/components/hackrf/
├── HackRFLayout.svelte          # Main container
├── HackRFHeader.svelte          # Navigation header
├── GeometricBackground.svelte   # Background effects
├── MobileMenu.svelte            # Mobile navigation
└── StatusIndicator.svelte       # Connection status
```

### 2.2 Feature Components

```
src/lib/components/hackrf/
├── FrequencyConfig/
│   ├── FrequencyConfig.svelte
│   ├── FrequencyInput.svelte
│   └── FrequencyList.svelte
├── SweepControl/
│   ├── SweepControl.svelte
│   ├── SweepParameters.svelte
│   └── SweepStatus.svelte
├── SpectrumAnalysis/
│   ├── SpectrumDisplay.svelte
│   ├── SignalStrength.svelte
│   └── WaterfallDisplay.svelte
└── ConnectionStatus/
    ├── ConnectionPanel.svelte
    └── ErrorRecovery.svelte
```

## Step 3: Create Stores

### 3.1 HackRF Stores

Create `/src/lib/stores/hackrf.ts`:

```typescript
import { writable, derived } from 'svelte/store';
import type { Writable, Readable } from 'svelte/store';

// Connection state
export interface ConnectionState {
	status: 'disconnected' | 'connecting' | 'connected' | 'error';
	lastError: string | null;
	retryCount: number;
}

export const connectionState = writable<ConnectionState>({
	status: 'disconnected',
	lastError: null,
	retryCount: 0
});

// Frequency configuration
export interface FrequencyConfig {
	frequencies: number[];
	startFreq: number;
	stopFreq: number;
	stepSize: number;
	cycleTime: number;
}

export const frequencyConfig = writable<FrequencyConfig>({
	frequencies: [],
	startFreq: 88,
	stopFreq: 108,
	stepSize: 0.1,
	cycleTime: 10
});

// Sweep state
export interface SweepState {
	isRunning: boolean;
	currentFrequency: number | null;
	progress: number;
	startTime: Date | null;
}

export const sweepState = writable<SweepState>({
	isRunning: false,
	currentFrequency: null,
	progress: 0,
	startTime: null
});

// Spectrum data
export interface SpectrumData {
	frequency: number;
	power: number[];
	timestamp: Date;
}

export const spectrumData = writable<SpectrumData[]>([]);

// Derived stores
export const isConnected = derived(connectionState, ($state) => $state.status === 'connected');

export const canStartSweep = derived(
	[connectionState, frequencyConfig, sweepState],
	([$conn, $freq, $sweep]) =>
		$conn.status === 'connected' && $freq.frequencies.length > 0 && !$sweep.isRunning
);
```

## Step 4: Convert Components

### 4.1 Example: FrequencyConfig Component

```svelte
<!-- src/lib/components/hackrf/FrequencyConfig/FrequencyConfig.svelte -->
<script lang="ts">
	import { frequencyConfig } from '$lib/stores/hackrf';
	import FrequencyInput from './FrequencyInput.svelte';
	import FrequencyList from './FrequencyList.svelte';

	function addFrequency() {
		const { startFreq, stopFreq, stepSize } = $frequencyConfig;
		const newFreq = { start: startFreq, stop: stopFreq, step: stepSize };

		frequencyConfig.update((config) => ({
			...config,
			frequencies: [...config.frequencies, newFreq]
		}));
	}

	function removeFrequency(index: number) {
		frequencyConfig.update((config) => ({
			...config,
			frequencies: config.frequencies.filter((_, i) => i !== index)
		}));
	}
</script>

<!-- EXACT HTML structure from original -->
<div
	class="saasfly-feature-card group rounded-2xl p-8 bg-gradient-to-br from-bg-card/80 via-bg-card/60 to-bg-card/40 border border-border-primary/40 backdrop-blur-xl shadow-lg hover:shadow-xl hover:border-neon-cyan/30 hover:bg-gradient-to-br hover:from-bg-card/90 hover:via-bg-card/70 hover:to-bg-card/50 transition-all duration-300"
>
	<div class="flex items-center mb-6">
		<div
			class="p-3 bg-gradient-to-br from-neon-cyan/20 to-neon-cyan/10 rounded-xl mr-4 border border-neon-cyan/20 group-hover:border-neon-cyan/40 group-hover:shadow-neon-cyan-sm transition-all duration-300"
		>
			<svg
				class="w-6 h-6 frequency-config-icon group-hover:scale-110 transition-transform duration-300"
				fill="currentColor"
				viewBox="0 0 24 24"
			>
				<path d="M3 12h4l3-9 4 18 3-9h4M3 3v18M21 3v18" />
			</svg>
		</div>
		<div>
			<h3
				class="font-heading text-xl font-semibold frequency-config-header mb-1 transition-colors duration-300"
			>
				Frequency Configuration
			</h3>
			<p
				class="text-sm text-text-muted group-hover:text-text-secondary transition-colors duration-300"
			>
				Manage target frequencies
			</p>
		</div>
	</div>

	<div class="space-y-6">
		<FrequencyInput bind:config={$frequencyConfig} />
		<FrequencyList
			frequencies={$frequencyConfig.frequencies}
			on:remove={(e) => removeFrequency(e.detail)}
		/>
		<button on:click={addFrequency} class="saasfly-button-secondary w-full justify-center">
			Add Frequency
		</button>
	</div>
</div>
```

## Step 5: API Integration

### 5.1 Create API Service

Create `/src/lib/services/hackrf/api.ts`:

```typescript
import { connectionState, sweepState, spectrumData } from '$lib/stores/hackrf';

export class HackRFAPI {
	private eventSource: EventSource | null = null;

	async startSweep(frequencies: number[], cycleTime: number) {
		const response = await fetch('/api/hackrf/start-sweep', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ frequencies, cycleTime })
		});

		if (!response.ok) throw new Error('Failed to start sweep');

		// Connect to SSE for real-time data
		this.connectToDataStream();

		return response.json();
	}

	async stopSweep() {
		this.disconnectDataStream();

		const response = await fetch('/api/hackrf/stop-sweep', {
			method: 'POST'
		});

		if (!response.ok) throw new Error('Failed to stop sweep');

		return response.json();
	}

	private connectToDataStream() {
		this.eventSource = new EventSource('/api/hackrf/data-stream');

		this.eventSource.addEventListener('sweep_data', (event) => {
			const data = JSON.parse(event.data);
			spectrumData.update((current) => [...current, data]);
		});

		this.eventSource.addEventListener('status', (event) => {
			const status = JSON.parse(event.data);
			sweepState.update((state) => ({ ...state, ...status }));
		});

		this.eventSource.addEventListener('error', () => {
			connectionState.update((state) => ({
				...state,
				status: 'error',
				lastError: 'Connection lost'
			}));
		});
	}

	private disconnectDataStream() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
	}
}

export const hackrfAPI = new HackRFAPI();
```

## Step 6: Main Page Integration

### 6.1 Convert +page.svelte

```svelte
<!-- src/routes/hackrfsweep/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import GeometricBackground from '$lib/components/hackrf/GeometricBackground.svelte';
	import HackRFHeader from '$lib/components/hackrf/HackRFHeader.svelte';
	import FrequencyConfig from '$lib/components/hackrf/FrequencyConfig/FrequencyConfig.svelte';
	import SweepControl from '$lib/components/hackrf/SweepControl/SweepControl.svelte';
	import SpectrumAnalysis from '$lib/components/hackrf/SpectrumAnalysis/SpectrumDisplay.svelte';
	import ConnectionStatus from '$lib/components/hackrf/ConnectionStatus/ConnectionPanel.svelte';

	import { hackrfAPI } from '$lib/services/hackrf/api';
	import { connectionState } from '$lib/stores/hackrf';

	onMount(() => {
		// Initialize connection
		connectionState.set({ status: 'connecting', lastError: null, retryCount: 0 });

		// Check connection status
		checkConnection();
	});

	onDestroy(() => {
		// Cleanup
		hackrfAPI.disconnect();
	});

	async function checkConnection() {
		try {
			const status = await hackrfAPI.getStatus();
			connectionState.update((state) => ({ ...state, status: 'connected' }));
		} catch (error) {
			connectionState.update((state) => ({
				...state,
				status: 'error',
				lastError: error.message
			}));
		}
	}
</script>

<svelte:head>
	<title>HackRF Sweep Monitor</title>
</svelte:head>

<!-- EXACT structure from original -->
<div class="font-body text-white flex flex-col min-h-screen leading-body">
	<GeometricBackground />

	<HackRFHeader />

	<div class="min-h-screen bg-black relative">
		<section class="py-16 lg:py-24">
			<div class="container mx-auto px-4 lg:px-8 max-w-7xl">
				<div class="grid grid-cols-1 xl:grid-cols-3 gap-8 lg:gap-12">
					<!-- Control Panel -->
					<div class="xl:col-span-1">
						<div class="sticky top-24 space-y-8">
							<FrequencyConfig />
							<SweepControl />
							<ConnectionStatus />
						</div>
					</div>

					<!-- Analysis Panel -->
					<div class="xl:col-span-2">
						<SpectrumAnalysis />
					</div>
				</div>
			</div>
		</section>
	</div>
</div>
```

## Step 7: Preserve External Scripts

### 7.1 Move to TypeScript Modules

Convert `/static/api-config.js` and `/static/script.js` to TypeScript:

```typescript
// src/lib/services/hackrf/config.ts
export const API_CONFIG = {
	baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:5173',
	endpoints: {
		startSweep: '/api/hackrf/start-sweep',
		stopSweep: '/api/hackrf/stop-sweep',
		dataStream: '/api/hackrf/data-stream'
	}
};

// Import in components as needed
import { API_CONFIG } from '$lib/services/hackrf/config';
```

## Step 8: Testing & Validation

### 8.1 Visual Regression Testing

1. Take screenshots of original page at different viewports
2. Take screenshots after conversion
3. Use pixelmatch to compare

### 8.2 Functionality Testing

```typescript
// tests/hackrf-conversion.test.ts
import { render, fireEvent } from '@testing-library/svelte';
import HackRFPage from '../src/routes/hackrfsweep/+page.svelte';

test('preserves exact button styling', async () => {
	const { getByText } = render(HackRFPage);
	const button = getByText('Add Frequency');

	// Check exact classes
	expect(button).toHaveClass('saasfly-button-secondary', 'w-full', 'justify-center');
});
```

## Key Preservation Rules

1. **Never change class names** - Keep all original classes
2. **Preserve all inline styles** - Convert to class-based gradually
3. **Keep exact HTML structure** - Don't "optimize" the DOM
4. **Maintain all IDs** - JavaScript might depend on them
5. **Keep all data attributes** - They might be used by scripts
6. **Preserve all animations** - Including keyframes and transitions

## Migration Checklist

- [ ] Create component file structure
- [ ] Extract Tailwind config to tailwind.config.js
- [ ] Move custom CSS to app.css
- [ ] Create TypeScript stores
- [ ] Create API service layer
- [ ] Split into components (preserve exact HTML)
- [ ] Convert external scripts to modules
- [ ] Add TypeScript types
- [ ] Test visual appearance
- [ ] Test all functionality
- [ ] Remove external script tags
- [ ] Update imports in +page.svelte

## Common Pitfalls to Avoid

1. **Don't change any styling** - Not even "improvements"
2. **Don't reorganize HTML** - Keep exact structure
3. **Don't rename classes** - Even if they seem wrong
4. **Don't remove "redundant" divs** - They might affect layout
5. **Don't change color values** - Use exact hex codes
6. **Don't update deprecated syntax** - If it works, keep it

This approach ensures pixel-perfect preservation while gaining all benefits of proper SvelteKit architecture.

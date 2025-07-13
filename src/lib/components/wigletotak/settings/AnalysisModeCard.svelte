<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Services and stores - loaded dynamically to prevent SSR issues
	let wigleStore: any;
	let _wigleActions: any;
	let wigleService: any;
	let logInfo: any;
	let logError: any;

	// Reactive state from store with safe defaults
	let analysisSettings = {
		mode: 'realtime'
	};

	// Local input binding
	let analysisMode = analysisSettings.mode;

	// Initialize in browser only
	onMount(async () => {
		if (browser) {
			// Dynamic imports to prevent SSR issues
			const { wigleStore: ws, wigleActions: wa } = await import('$lib/stores/wigletotak/wigleStore');
			const { wigleService: wserv } = await import('$lib/services/wigletotak/wigleService');
			const { logInfo: li, logError: le } = await import('$lib/utils/logger');
			
			wigleStore = ws;
			_wigleActions = wa;
			wigleService = wserv;
			logInfo = li;
			logError = le;

			// Subscribe to store updates
			wigleStore.subscribe((state: any) => {
				analysisSettings = state.analysisSettings;
				analysisMode = analysisSettings.mode;
			});
		}
	});

	// Update local value when store changes
	$: {
		analysisMode = analysisSettings.mode;
	}

	// Update analysis mode
	async function updateAnalysisMode() {
		try {
			await wigleService.updateAnalysisMode(analysisMode);
			logInfo('Analysis mode updated successfully');
		} catch (error) {
			logError('Failed to update analysis mode:', error);
		}
	}
</script>

<div class="settings-card">
	<h3 class="card-title">Analysis Mode</h3>
	<div class="radio-group">
		<label>
			<input 
				type="radio" 
				bind:group={analysisMode} 
				value="realtime" 
				on:change={() => void updateAnalysisMode()} 
			/>
			<span>Real-time Analysis</span>
		</label>
		<label>
			<input 
				type="radio" 
				bind:group={analysisMode} 
				value="postcollection" 
				on:change={() => void updateAnalysisMode()} 
			/>
			<span>Post-collection Analysis</span>
		</label>
	</div>
	<p class="help-text">
		Real-time: Continuously monitors and broadcasts new devices<br>
		Post-collection: Processes entire file in chunks
	</p>
</div>

<style>
	.settings-card {
		background: #141414;
		border: 1px solid #262626;
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.card-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #fb923c;
	}

	.radio-group {
		margin-bottom: 1rem;
	}

	.radio-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #a3a3a3;
		cursor: pointer;
		margin-bottom: 0.5rem;
	}

	.help-text {
		font-size: 0.875rem;
		color: #737373;
		line-height: 1.5;
	}
</style>
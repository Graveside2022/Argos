<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	// Services and stores - loaded dynamically to prevent SSR issues
	let wigleStore: any;
	let wigleService: any;
	
	// Import modular wigletotak components
	import TAKSettingsCard from '$lib/components/wigletotak/settings/TAKSettingsCard.svelte';
	import AnalysisModeCard from '$lib/components/wigletotak/settings/AnalysisModeCard.svelte';
	import AntennaSettingsCard from '$lib/components/wigletotak/settings/AntennaSettingsCard.svelte';
	import DirectoryCard from '$lib/components/wigletotak/directory/DirectoryCard.svelte';
	import WhitelistCard from '$lib/components/wigletotak/filter/WhitelistCard.svelte';
	import BlacklistCard from '$lib/components/wigletotak/filter/BlacklistCard.svelte';

	// Reactive state from store with safe defaults
	let wigleState = {
		broadcastState: { isBroadcasting: false },
		analysisSettings: { mode: 'realtime' }
	};
	$: isConnected = false; // TODO: Implement connection status logic
	$: isBroadcasting = wigleState.broadcastState.isBroadcasting;
	$: analysisMode = wigleState.analysisSettings.mode;

	let activeTab = 'settings';

	onMount(async () => {
		if (browser) {
			// Dynamic imports to prevent SSR issues
			const { wigleStore: ws } = await import('$lib/stores/wigletotak/wigleStore');
			const { wigleService: wserv } = await import('$lib/services/wigletotak/wigleService');
			
			wigleStore = ws;
			wigleService = wserv;

			// Subscribe to store updates
			wigleStore.subscribe((state: any) => {
				wigleState = state;
			});

			// Initialize component - load antenna settings
			void wigleService.loadAntennaSettings();
		}
	});
</script>

<div class="wigletotak-container">
	<!-- Header -->
	<div class="wigletotak-header">
		<div class="flex items-center justify-between mb-6">
			<a href="/" class="text-gray-400 hover:text-white transition-colors">
				← Back to Console
			</a>
			<div class="flex items-center gap-3">
				<span class="text-sm {isConnected ? 'text-green-500' : 'text-red-500'}">
					● {isConnected ? 'Connected' : 'Disconnected'}
				</span>
			</div>
		</div>
		
		<h1 class="page-title">
			<span class="highlight">Wigle</span>ToTAK
		</h1>
		<p class="page-subtitle">WiFi Device Tracker & TAK Broadcaster</p>
		
		<!-- Status Row -->
		<div class="flex justify-center gap-6 mt-6">
			<div class="status-item">
				<span class="status-label">TAK:</span>
				<span class="{isBroadcasting ? 'text-green-500' : 'text-gray-500'}">
					{isBroadcasting ? 'Broadcasting' : 'Inactive'}
				</span>
			</div>
			<div class="status-item">
				<span class="status-label">Mode:</span>
				<span class="text-blue-500">{analysisMode === 'realtime' ? 'Real-time' : 'Post-collection'}</span>
			</div>
		</div>
	</div>
	
	<!-- Main Content -->
	<div class="main-content">
		<!-- Tab Navigation -->
		<div class="tab-navigation">
			<button 
				class="tab-button {activeTab === 'settings' ? 'active' : ''}"
				on:click={() => activeTab = 'settings'}
			>
				⚙️ Settings
			</button>
			<button 
				class="tab-button {activeTab === 'devices' ? 'active' : ''}"
				on:click={() => activeTab = 'devices'}
			>
				📱 Devices
			</button>
			<button 
				class="tab-button {activeTab === 'filters' ? 'active' : ''}"
				on:click={() => activeTab = 'filters'}
			>
				🔧 Filters
			</button>
			<button 
				class="tab-button {activeTab === 'messages' ? 'active' : ''}"
				on:click={() => activeTab = 'messages'}
			>
				💬 Messages
			</button>
		</div>
		
		<!-- Tab Content -->
		<div class="tab-content">
			{#if activeTab === 'settings'}
				<div class="settings-grid">
					<!-- Modular Settings Components -->
					<TAKSettingsCard />
					<AnalysisModeCard />
					<AntennaSettingsCard />
					<DirectoryCard />
				</div>
			{:else if activeTab === 'devices'}
				<div class="empty-state">
					<p>Device listing not yet implemented</p>
				</div>
			{:else if activeTab === 'filters'}
				<div class="filters-grid">
					<!-- Modular Filter Components -->
					<WhitelistCard />
					<BlacklistCard />
				</div>
			{:else if activeTab === 'messages'}
				<div class="empty-state">
					<p>Message history not yet implemented</p>
				</div>
			{/if}
		</div>
		
		<!-- Instructions Panel -->
		<div class="instructions-panel">
			<h4>Configuration Instructions</h4>
			<ul>
				<li>• TAK Server: Set to 0.0.0.0 for all interfaces or specific IP</li>
				<li>• Multicast: Sends to standard TAK multicast address</li>
				<li>• Antenna sensitivity adjusts signal strength calculations</li>
				<li>• Select .wiglecsv files from Kismet output directory</li>
			</ul>
		</div>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
	
	.wigletotak-container {
		min-height: 100vh;
		background: #0a0a0a;
		color: #fff;
		font-family: Inter, system-ui, -apple-system, sans-serif;
	}
	
	.wigletotak-header {
		background: rgba(20, 20, 20, 0.8);
		backdrop-filter: blur(20px);
		border-bottom: 1px solid #262626;
		padding: 2rem;
		position: relative;
		text-align: center;
	}
	
	.page-title {
		font-size: 2.5rem;
		font-weight: 800;
		text-align: center;
		margin-bottom: 0.5rem;
	}
	
	.highlight {
		color: #fb923c;
	}
	
	.page-subtitle {
		text-align: center;
		color: #a3a3a3;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}
	
	.status-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
	}
	
	.status-label {
		color: #737373;
	}
	
	.main-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}
	
	.tab-navigation {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		border-bottom: 1px solid #262626;
		padding-bottom: 1rem;
	}
	
	.tab-button {
		background: none;
		border: none;
		color: #737373;
		font-size: 1rem;
		font-weight: 500;
		padding: 0.5rem 1rem;
		cursor: pointer;
		transition: color 0.2s;
		font-family: inherit;
	}
	
	.tab-button:hover {
		color: #a3a3a3;
	}
	
	.tab-button.active {
		color: #fb923c;
		border-bottom: 2px solid #fb923c;
	}
	
	.tab-content {
		margin-bottom: 2rem;
	}
	
	.settings-grid, .filters-grid {
		display: grid;
		gap: 2rem;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	}
	
	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #737373;
	}
	
	.instructions-panel {
		background: #141414;
		border: 1px solid #262626;
		border-radius: 0.5rem;
		padding: 1.5rem;
		margin-top: 2rem;
	}
	
	.instructions-panel h4 {
		color: #fb923c;
		margin-bottom: 1rem;
	}
	
	.instructions-panel ul {
		list-style: none;
		padding: 0;
		margin: 0;
		color: #a3a3a3;
		font-size: 0.875rem;
		line-height: 1.75;
	}
</style>
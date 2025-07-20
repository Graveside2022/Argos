<script lang="ts">
	import { writable } from 'svelte/store';
	
	export let onFilterChange: (filters: PacketFilters) => void;
	
	interface PacketFilters {
		protocol: string;
		sourceIp: string;
		destIp: string;
		category: string;
		minSeverity: number;
		showFlagged: boolean;
		timeRange: string;
	}
	
	let filters: PacketFilters = {
		protocol: '',
		sourceIp: '',
		destIp: '',
		category: '',
		minSeverity: 0,
		showFlagged: false,
		timeRange: 'all'
	};
	
	const protocols = ['', 'TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'ICMP', 'ARP'];
	const categories = ['', 'normal', 'suspicious', 'malicious', 'unknown'];
	const timeRanges = [
		{ value: 'all', label: 'All time' },
		{ value: '1m', label: 'Last minute' },
		{ value: '5m', label: 'Last 5 minutes' },
		{ value: '15m', label: 'Last 15 minutes' },
		{ value: '1h', label: 'Last hour' }
	];
	
	function applyFilters() {
		onFilterChange(filters);
	}
	
	function resetFilters() {
		filters = {
			protocol: '',
			sourceIp: '',
			destIp: '',
			category: '',
			minSeverity: 0,
			showFlagged: false,
			timeRange: 'all'
		};
		onFilterChange(filters);
	}
	
	$: {
		// Auto-apply filters when changed
		applyFilters();
	}
</script>

<div class="glass-panel rounded-lg p-4">
	<div class="flex items-center justify-between mb-4">
		<h3 class="text-sm font-semibold text-text-primary">Filters</h3>
		<button
			on:click={resetFilters}
			class="text-xs text-accent-primary hover:text-accent-hover"
		>
			Reset all
		</button>
	</div>
	
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
		<!-- Protocol Filter -->
		<div>
			<label for="protocol" class="block text-xs font-medium text-text-secondary mb-1">
				Protocol
			</label>
			<select
				id="protocol"
				bind:value={filters.protocol}
				class="block w-full px-3 py-1.5 text-sm glass-input rounded-md"
			>
				{#each protocols as protocol}
					<option value={protocol}>{protocol || 'All protocols'}</option>
				{/each}
			</select>
		</div>
		
		<!-- Source IP Filter -->
		<div>
			<label for="sourceIp" class="block text-xs font-medium text-text-secondary mb-1">
				Source IP
			</label>
			<input
				id="sourceIp"
				type="text"
				bind:value={filters.sourceIp}
				placeholder="e.g., 192.168.1.1"
				class="block w-full px-3 py-1.5 text-sm glass-input rounded-md"
			/>
		</div>
		
		<!-- Destination IP Filter -->
		<div>
			<label for="destIp" class="block text-xs font-medium text-text-secondary mb-1">
				Destination IP
			</label>
			<input
				id="destIp"
				type="text"
				bind:value={filters.destIp}
				placeholder="e.g., 10.0.0.1"
				class="block w-full px-3 py-1.5 text-sm glass-input rounded-md"
			/>
		</div>
		
		<!-- Category Filter -->
		<div>
			<label for="category" class="block text-xs font-medium text-text-secondary mb-1">
				Category
			</label>
			<select
				id="category"
				bind:value={filters.category}
				class="block w-full px-3 py-1.5 text-sm glass-input rounded-md"
			>
				{#each categories as category}
					<option value={category}>{category || 'All categories'}</option>
				{/each}
			</select>
		</div>
		
		<!-- Severity Filter -->
		<div>
			<label for="severity" class="block text-xs font-medium text-text-secondary mb-1">
				Min Severity: {filters.minSeverity}
			</label>
			<input
				id="severity"
				type="range"
				min="0"
				max="10"
				bind:value={filters.minSeverity}
				class="block w-full"
			/>
			<div class="flex justify-between text-xs text-text-muted mt-1">
				<span>0</span>
				<span>5</span>
				<span>10</span>
			</div>
		</div>
		
		<!-- Time Range Filter -->
		<div>
			<label for="timeRange" class="block text-xs font-medium text-text-secondary mb-1">
				Time Range
			</label>
			<select
				id="timeRange"
				bind:value={filters.timeRange}
				class="block w-full px-3 py-1.5 text-sm glass-input rounded-md"
			>
				{#each timeRanges as range}
					<option value={range.value}>{range.label}</option>
				{/each}
			</select>
		</div>
	</div>
	
	<!-- Additional Options -->
	<div class="mt-4 flex items-center space-x-4">
		<label class="flex items-center">
			<input
				type="checkbox"
				bind:checked={filters.showFlagged}
				class="h-4 w-4 text-accent-primary focus:ring-accent-primary border-border-primary rounded"
			/>
			<span class="ml-2 text-sm text-text-primary">Show only flagged packets</span>
		</label>
	</div>
</div>
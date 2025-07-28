<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	
	export let isVisible = false;
	
	interface IMSIRecord {
		id: number;
		imsi: string;
		tmsi: string;
		mcc: number;
		mnc: number;
		lac: number;
		ci: number;
		timestamp: string;
		lat?: number;
		lon?: number;
	}
	
	let imsiRecords: IMSIRecord[] = [];
	let loading = false;
	let error = '';
	let total = 0;
	let refreshInterval: ReturnType<typeof setInterval> | null = null;
	
	async function fetchIMSIData() {
		if (!isVisible) return;
		
		loading = true;
		error = '';
		
		try {
			const response = await fetch('/api/gsm-evil/imsi');
			const data = await response.json();
			
			if (data.success) {
				imsiRecords = data.imsis;
				total = data.total;
				console.log(`[LOCAL-IMSI] Loaded ${data.imsis.length} records`);
			} else {
				error = data.message || 'Failed to fetch IMSI data';
			}
		} catch (e) {
			error = 'Failed to connect to IMSI API';
			console.error('IMSI fetch error:', e);
		} finally {
			loading = false;
		}
	}
	
	onMount(() => {
		if (isVisible) {
			fetchIMSIData();
			// Refresh every 2 seconds when visible
			refreshInterval = setInterval(fetchIMSIData, 2000);
		}
	});
	
	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});
	
	// Watch for visibility changes
	$: if (isVisible && !refreshInterval) {
		fetchIMSIData();
		refreshInterval = setInterval(fetchIMSIData, 2000);
	} else if (!isVisible && refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = null;
	}
	
	function formatTimestamp(timestamp: string) {
		try {
			return new Date(timestamp).toLocaleString();
		} catch {
			return timestamp;
		}
	}
	
	function getCountryName(mcc: number) {
		const countries: { [key: number]: string } = {
			262: '🇩🇪 Germany',
			302: '🇨🇦 Canada', 
			310: '🇺🇸 USA',
			232: '🇦🇹 Austria',
			260: '🇵🇱 Poland',
			219: '🇭🇷 Croatia',
			432: '🇮🇷 Iran'
		};
		return countries[mcc] || `${mcc}`;
	}
</script>

{#if isVisible}
	<div class="local-imsi-display">
		<!-- Header -->
		<div class="header">
			<div class="title">
				<h2>📱 IMSI Capture Monitor</h2>
				<div class="stats">
					<span class="stat-item">Total: <strong>{total}</strong></span>
					<span class="stat-item">Loaded: <strong>{imsiRecords.length}</strong></span>
					{#if loading}
						<span class="stat-item loading">🔄 Refreshing...</span>
					{:else}
						<span class="stat-item success">✅ Live</span>
					{/if}
				</div>
			</div>
		</div>

		{#if error}
			<div class="error">
				<p>❌ Error: {error}</p>
				<button on:click={fetchIMSIData} class="retry-btn">Retry</button>
			</div>
		{:else if imsiRecords.length === 0 && !loading}
			<div class="empty">
				<p>📭 No IMSI records captured yet</p>
				<p class="hint">Start GSM Evil to begin capturing IMSI numbers from nearby devices</p>
			</div>
		{:else}
			<!-- IMSI Table -->
			<div class="table-container">
				<table class="imsi-table">
					<thead>
						<tr>
							<th>ID</th>
							<th>IMSI</th>
							<th>TMSI</th>
							<th>Country</th>
							<th>MNC</th>
							<th>LAC</th>
							<th>CI</th>
							<th>Time</th>
							<th>Location</th>
						</tr>
					</thead>
					<tbody>
						{#each imsiRecords.slice(0, 50) as record (record.id)}
							<tr class="record-row">
								<td class="id">{record.id}</td>
								<td class="imsi">{record.imsi}</td>
								<td class="tmsi">{record.tmsi}</td>
								<td class="country">{getCountryName(record.mcc)}</td>
								<td class="mnc">{record.mnc}</td>
								<td class="lac">{record.lac}</td>
								<td class="ci">{record.ci}</td>
								<td class="timestamp">{formatTimestamp(record.timestamp)}</td>
								<td class="location">
									{#if record.lat && record.lon}
										<span class="coords">📍 {record.lat.toFixed(4)}, {record.lon.toFixed(4)}</span>
									{:else}
										<span class="no-location">❓ Unknown</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				
				{#if imsiRecords.length > 50}
					<div class="pagination-info">
						Showing first 50 of {imsiRecords.length} records
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.local-imsi-display {
		height: 100%;
		background: #0a0a0a;
		color: #fff;
		font-family: 'Courier New', monospace;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.header {
		background: linear-gradient(135deg, #1a1a2e, #16213e);
		padding: 1rem;
		border-bottom: 2px solid #ff0000;
	}

	.title h2 {
		margin: 0 0 0.5rem 0;
		color: #ff0000;
		font-size: 1.5rem;
		text-shadow: 0 0 10px #ff0000;
	}

	.stats {
		display: flex;
		gap: 1rem;
		font-size: 0.9rem;
	}

	.stat-item {
		background: rgba(255, 0, 0, 0.1);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		border: 1px solid rgba(255, 0, 0, 0.3);
	}

	.stat-item.loading {
		background: rgba(255, 165, 0, 0.1);
		border-color: rgba(255, 165, 0, 0.3);
		color: #ffa500;
	}

	.stat-item.success {
		background: rgba(0, 255, 0, 0.1);
		border-color: rgba(0, 255, 0, 0.3);
		color: #00ff00;
	}

	.error {
		padding: 2rem;
		text-align: center;
		color: #ff4444;
	}

	.retry-btn {
		background: #ff0000;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		margin-top: 1rem;
	}

	.retry-btn:hover {
		background: #cc0000;
	}

	.empty {
		padding: 4rem 2rem;
		text-align: center;
		color: #888;
	}

	.empty .hint {
		font-size: 0.9rem;
		color: #666;
		margin-top: 1rem;
	}

	.table-container {
		flex: 1;
		overflow: auto;
		padding: 1rem;
	}

	.imsi-table {
		width: 100%;
		border-collapse: collapse;
		background: rgba(0, 0, 0, 0.5);
	}

	.imsi-table th {
		background: linear-gradient(135deg, #2d1b69, #1e3c72);
		color: #fff;
		padding: 0.75rem 0.5rem;
		text-align: left;
		border-bottom: 2px solid #ff0000;
		position: sticky;
		top: 0;
		font-weight: bold;
		font-size: 0.8rem;
	}

	.imsi-table td {
		padding: 0.5rem 0.5rem;
		border-bottom: 1px solid rgba(255, 0, 0, 0.1);
		font-size: 0.8rem;
		vertical-align: middle;
	}

	.record-row:hover {
		background: rgba(255, 0, 0, 0.05);
	}

	.record-row:nth-child(even) {
		background: rgba(255, 255, 255, 0.02);
	}

	.id {
		color: #ffa500;
		font-weight: bold;
		text-align: right;
		min-width: 60px;
	}

	.imsi {
		color: #00ff00;
		font-family: 'Courier New', monospace;
		font-weight: bold;
		letter-spacing: 1px;
	}

	.tmsi {
		color: #888;
		font-style: italic;
	}

	.country {
		color: #87ceeb;
		min-width: 100px;
	}

	.mnc, .lac, .ci {
		color: #ddd;
		text-align: center;
		font-family: monospace;
	}

	.timestamp {
		color: #ffa500;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.location .coords {
		color: #00ff7f;
		font-size: 0.7rem;
	}

	.location .no-location {
		color: #666;
		font-size: 0.7rem;
	}

	.pagination-info {
		text-align: center;
		padding: 1rem;
		color: #888;
		font-size: 0.9rem;
		background: rgba(0, 0, 0, 0.3);
	}
</style>
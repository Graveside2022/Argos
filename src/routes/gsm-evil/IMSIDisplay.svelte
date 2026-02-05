<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface IMSIRecord {
		id: number;
		imsi: string;
		tmsi: string;
		mcc: string;
		mnc: string;
		lac: string;
		ci: string;
		datetime: string;
	}

	let imsiRecords: IMSIRecord[] = [];
	let loading = true;
	let error = '';
	let refreshInterval: ReturnType<typeof setInterval>;

	async function fetchIMSIData() {
		try {
			const response = await fetch('/api/gsm-evil/imsi-data');
			if (response.ok) {
				const data = await response.json();
				if (data.success) {
					imsiRecords = data.data;
					error = '';
				} else {
					error = data.message || 'Failed to fetch IMSI data';
				}
			} else {
				error = 'Failed to fetch IMSI data';
			}
		} catch (_err: unknown) {
			error = 'Error connecting to server';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchIMSIData();
		// Refresh every 5 seconds
		refreshInterval = setInterval(fetchIMSIData, 5000);
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});
</script>

<div class="imsi-display">
	<div class="header">
		<h3>IMSI Records</h3>
		<div class="status">
			{#if loading}
				<span class="loading">Loading...</span>
			{:else}
				<span class="count">{imsiRecords.length} records</span>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="table-container">
		<table>
			<thead>
				<tr>
					<th>ID</th>
					<th>IMSI</th>
					<th>TMSI</th>
					<th>MCC</th>
					<th>MNC</th>
					<th>LAC</th>
					<th>CI</th>
					<th>Time</th>
				</tr>
			</thead>
			<tbody>
				{#each imsiRecords as record}
					<tr>
						<td>{record.id}</td>
						<td class="imsi">{record.imsi || '-'}</td>
						<td>{record.tmsi || '-'}</td>
						<td>{record.mcc || '-'}</td>
						<td>{record.mnc || '-'}</td>
						<td>{record.lac || '-'}</td>
						<td>{record.ci || '-'}</td>
						<td class="time">{record.datetime || '-'}</td>
					</tr>
				{/each}
				{#if !loading && imsiRecords.length === 0}
					<tr>
						<td colspan="8" class="empty">No IMSI records found</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<style>
	.imsi-display {
		background: #0f0f0f;
		border: 1px solid #333;
		border-radius: 8px;
		padding: 1rem;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #333;
	}

	h3 {
		margin: 0;
		color: #dc2626;
		font-size: 1.25rem;
	}

	.status {
		color: #888;
		font-size: 0.875rem;
	}

	.loading {
		color: #fbbf24;
	}

	.count {
		color: #4ade80;
	}

	.error {
		background: rgba(255, 0, 0, 0.1);
		border: 1px solid rgba(255, 0, 0, 0.3);
		color: #ff6666;
		padding: 0.5rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.table-container {
		flex: 1;
		overflow-y: auto;
		background: #0e1116;
		border: 1px solid #dc2626;
		border-radius: 4px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	th {
		background: #2a0000;
		color: #dc2626;
		padding: 0.5rem;
		text-align: left;
		position: sticky;
		top: 0;
		z-index: 10;
		border-bottom: 1px solid #dc2626;
	}

	td {
		padding: 0.5rem;
		color: #ccc;
		border-bottom: 1px solid #330000;
	}

	tr:hover {
		background: rgba(255, 0, 0, 0.05);
	}

	.imsi {
		color: #fbbf24;
		font-family: monospace;
	}

	.time {
		color: #ff6666;
		font-size: 0.75rem;
	}

	.empty {
		text-align: center;
		color: #666;
		padding: 2rem;
	}

	/* Scrollbar */
	.table-container::-webkit-scrollbar {
		width: 8px;
	}

	.table-container::-webkit-scrollbar-track {
		background: #1a1d23;
	}

	.table-container::-webkit-scrollbar-thumb {
		background: #dc2626;
		border-radius: 4px;
	}

	.table-container::-webkit-scrollbar-thumb:hover {
		background: #ff3333;
	}
</style>

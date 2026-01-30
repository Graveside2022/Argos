<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import HardwareConflictModal from '$lib/components/hardware/HardwareConflictModal.svelte';
	import {
		wifiteState,
		startWifitePolling,
		stopWifitePolling,
		selectTarget,
		selectAllTargets,
		deselectAllTargets,
		setAttackMode,
		clearError,
		dismissLastRun,
		startAttack,
		stopAttack
	} from '$lib/stores/wifiteStore';
	import type { AttackMode } from '$lib/server/wifite/types';

	let state: any;
	let loading = false;
	let showConflict = false;
	let conflictOwner = '';
	let startError: string | null = null;
	let showConfirm = false;

	const unsub = wifiteState.subscribe((s) => {
		state = s;
	});
	onMount(() => {
		startWifitePolling();
	});
	onDestroy(() => {
		stopWifitePolling();
		unsub();
	});

	function handleStartClick() {
		startError = null;
		clearError();
		showConfirm = true;
	}

	async function confirmStart() {
		showConfirm = false;
		loading = true;
		try {
			// Resolve channels for selected targets
			const selectedChannels: number[] = (state.targets || [])
				.filter((t: any) => state.selectedTargets.includes(t.bssid))
				.map((t: any) => t.channel)
				.filter((ch: number) => ch > 0);
			const result = await startAttack(
				state.selectedTargets,
				selectedChannels,
				state.attackMode
			);
			if (!result.success) {
				if (result.error?.includes('in use')) {
					conflictOwner = result.error;
					showConflict = true;
				} else {
					startError = result.error || 'Failed to start wifite';
				}
			}
		} finally {
			loading = false;
		}
	}

	async function handleStop() {
		loading = true;
		try {
			await stopAttack();
		} finally {
			loading = false;
		}
	}

	function handleModeChange(mode: AttackMode) {
		setAttackMode(mode);
	}

	function signalColor(power: number): string {
		if (power >= -50) return 'text-green-400';
		if (power >= -65) return 'text-yellow-400';
		if (power >= -75) return 'text-orange-400';
		return 'text-red-400';
	}

	function encColor(enc: string): string {
		if (enc.includes('WPA3')) return 'text-green-400';
		if (enc.includes('WPA2')) return 'text-cyan-400';
		if (enc.includes('WPA')) return 'text-yellow-400';
		if (enc.includes('WEP')) return 'text-red-400';
		if (enc === 'Open') return 'text-red-500';
		return 'text-gray-400';
	}

	interface ModeInfo {
		value: AttackMode;
		label: string;
		summary: string;
		details: string[];
		impact: string;
	}

	const attackModes: ModeInfo[] = [
		{
			value: 'auto',
			label: 'Auto',
			summary:
				'Tries all available attacks in sequence for the best chance of capturing credentials.',
			details: [
				'Attempts PMKID hash capture (sends association request to the AP)',
				'If PMKID fails, sends deauthentication frames to connected clients',
				'Captures the WPA 4-way handshake when clients reconnect',
				'May also attempt WPS PIN attacks if applicable'
			],
			impact: 'Connected devices will be temporarily disconnected. The target AP receives active probe and deauth frames.'
		},
		{
			value: 'handshake',
			label: 'Handshake only',
			summary: 'Captures the WPA 4-way handshake by forcing clients to reconnect.',
			details: [
				'Sends deauthentication frames to all clients on the target network',
				'Clients are forcibly disconnected from the access point',
				'Listens for the 4-way WPA handshake when clients automatically reconnect',
				'Saves the captured handshake to a .cap file for offline analysis'
			],
			impact: 'All devices connected to the target will lose their connection momentarily. Requires at least one active client.'
		},
		{
			value: 'pmkid',
			label: 'PMKID only',
			summary:
				'Captures PMKID hashes directly from the AP without affecting connected clients.',
			details: [
				'Sends an association request directly to the access point',
				'Extracts the PMKID hash from the first EAPOL message in the AP response',
				'Does not require any clients to be connected to the target',
				'Saves the PMKID hash for offline analysis'
			],
			impact: 'Least disruptive method. No clients are disconnected. However, not all access points are vulnerable to PMKID extraction.'
		}
	];

	$: selectedMode =
		attackModes.find((m) => m.value === (state?.attackMode || 'auto')) || attackModes[0];
	$: targetCount = state?.selectedTargets?.length || 0;

	// Column sorting
	type SortKey = 'essid' | 'bssid' | 'channel' | 'encryption' | 'power' | 'clients';
	let sortKey: SortKey = 'power';
	let sortAsc = false;

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = key === 'essid' || key === 'bssid' || key === 'encryption'; // alpha default asc
		}
	}

	function sortIndicator(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortAsc ? ' \u25B2' : ' \u25BC';
	}

	$: sortedTargets = [...(state?.targets || [])].sort((a: any, b: any) => {
		let cmp = 0;
		if (sortKey === 'essid') cmp = (a.essid || '').localeCompare(b.essid || '');
		else if (sortKey === 'bssid') cmp = a.bssid.localeCompare(b.bssid);
		else if (sortKey === 'channel') cmp = a.channel - b.channel;
		else if (sortKey === 'encryption') cmp = a.encryption.localeCompare(b.encryption);
		else if (sortKey === 'power') cmp = a.power - b.power;
		else if (sortKey === 'clients') cmp = a.clients - b.clients;
		return sortAsc ? cmp : -cmp;
	});
</script>

<svelte:head>
	<title>Wifite2 - WiFi Security Auditor | Argos</title>
</svelte:head>

<div class="min-h-screen bg-gray-950 text-white">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center gap-4">
			<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">&larr; Back</a>
			<h1 class="text-xl font-bold">
				<span class="text-cyan-400">Wifite2</span> - WiFi Security Auditor
			</h1>
		</div>
	</header>

	<main class="container mx-auto p-6 max-w-5xl space-y-6">
		<!-- Info Banner -->
		<div class="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
			<h3 class="text-sm font-bold text-cyan-400 mb-2">How this works</h3>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-400">
				<div>
					<span class="text-gray-500">1.</span> Targets are loaded from Kismet scans
				</div>
				<div><span class="text-gray-500">2.</span> Select networks to audit</div>
				<div>
					<span class="text-gray-500">3.</span> Wifite actively attacks the target to capture
					credentials
				</div>
				<div><span class="text-gray-500">4.</span> Kismet auto-restarts when done</div>
			</div>
			<div class="mt-3 pt-3 border-t border-gray-800">
				<p class="text-xs text-red-400/90 font-medium">
					This is an active attack tool, not a passive scanner. Launching a capture will
					send deauthentication and association frames to the selected targets. Connected
					clients may be forcibly disconnected. Only use against networks you own or have
					explicit authorization to test.
				</p>
			</div>
		</div>

		<!-- Error Display -->
		{#if startError || state?.lastError}
			<div class="bg-red-900/30 border border-red-700 rounded-lg p-4">
				<div class="flex items-start justify-between">
					<div>
						<h3 class="text-sm font-bold text-red-400">Error</h3>
						<p class="text-sm text-red-300 mt-1">{startError || state.lastError}</p>
					</div>
					<button
						on:click={() => {
							startError = null;
							clearError();
						}}
						class="text-gray-500 hover:text-gray-300 text-lg leading-none"
						>&times;</button
					>
				</div>
				{#if state?.output?.length > 0 && !state?.running}
					<div
						class="mt-3 bg-black/40 rounded p-2 max-h-32 overflow-y-auto font-mono text-xs"
					>
						{#each state.output as line}
							<div class="text-red-300/70">{line}</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Last Run Summary (shown after a run completes) -->
		{#if !state?.running && state?.lastRun}
			{@const run = state.lastRun}
			<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
				<div
					class="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between"
				>
					<h3
						class="text-sm font-bold {run.results.length > 0
							? 'text-green-400'
							: 'text-amber-400'}"
					>
						{run.results.length > 0
							? 'Last Run — Captures Obtained'
							: 'Last Run — No Captures'}
					</h3>
					<button
						on:click={dismissLastRun}
						class="text-gray-500 hover:text-gray-300 text-lg leading-none"
						>&times;</button
					>
				</div>
				<div class="p-4 space-y-3">
					<!-- Run metadata -->
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
						<div>
							<span class="text-gray-500 block text-xs">Mode</span>
							<span class="text-white capitalize">{run.attackMode}</span>
						</div>
						<div>
							<span class="text-gray-500 block text-xs">Targets</span>
							<span class="text-white">{run.targets.length}</span>
						</div>
						<div>
							<span class="text-gray-500 block text-xs">Exit Code</span>
							<span class={run.exitCode === 0 ? 'text-green-400' : 'text-amber-400'}
								>{run.exitCode ?? 'N/A'}</span
							>
						</div>
						<div>
							<span class="text-gray-500 block text-xs">Finished</span>
							<span class="text-white text-xs"
								>{new Date(run.finishedAt).toLocaleTimeString()}</span
							>
						</div>
					</div>

					<!-- Results if any -->
					{#if run.results.length > 0}
						<div class="border-t border-gray-700 pt-3">
							<h4
								class="text-xs font-bold text-green-400 uppercase tracking-wider mb-2"
							>
								Captures
							</h4>
							{#each run.results as result}
								<div class="flex items-center justify-between py-1.5 text-sm">
									<div>
										<span class="font-mono text-white">{result.target}</span>
										<span class="text-gray-500 ml-2">{result.attackType}</span>
										{#if result.handshakePath}
											<span class="text-gray-600 ml-2 font-mono text-xs"
												>{result.handshakePath}</span
											>
										{/if}
									</div>
									<span
										class="text-xs px-2 py-1 rounded bg-green-900/50 text-green-400"
										>Captured</span
									>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Output log -->
					{#if run.output.length > 0}
						<details class="border-t border-gray-700 pt-3">
							<summary
								class="text-xs text-gray-500 hover:text-gray-300 cursor-pointer select-none"
							>
								Show terminal output ({run.output.length} lines)
							</summary>
							<div
								class="mt-2 bg-black/60 rounded p-3 max-h-56 overflow-y-auto font-mono text-xs border border-gray-800"
							>
								{#each run.output as line}
									<div class="text-green-300/70">{line}</div>
								{/each}
							</div>
						</details>
					{:else}
						<p class="text-xs text-gray-600 border-t border-gray-700 pt-3">
							No output was captured from wifite. The process may have exited
							immediately.
						</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Targets Table + Config (when not running) -->
		{#if !state?.running}
			<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
				<div
					class="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between"
				>
					<h3 class="text-sm font-bold text-gray-300">
						Targets
						{#if state?.targets?.length > 0}
							<span class="text-gray-500 font-normal ml-1"
								>({state.targets.length} APs from Kismet)</span
							>
						{/if}
					</h3>
					<div class="flex gap-3">
						<button
							on:click={selectAllTargets}
							class="text-xs text-cyan-400 hover:text-cyan-300">Select All</button
						>
						<button
							on:click={deselectAllTargets}
							class="text-xs text-gray-400 hover:text-gray-300">Deselect</button
						>
					</div>
				</div>
				<div class="overflow-x-auto max-h-80 overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-gray-800">
							<tr class="text-left text-gray-500 border-b border-gray-700">
								<th class="px-4 py-2 w-8"></th>
								<th
									class="px-4 py-2 cursor-pointer hover:text-gray-300 select-none"
									on:click={() => toggleSort('essid')}
									>ESSID{sortIndicator('essid')}</th
								>
								<th
									class="px-4 py-2 cursor-pointer hover:text-gray-300 select-none"
									on:click={() => toggleSort('bssid')}
									>BSSID{sortIndicator('bssid')}</th
								>
								<th
									class="px-4 py-2 text-center cursor-pointer hover:text-gray-300 select-none"
									on:click={() => toggleSort('channel')}
									>CH{sortIndicator('channel')}</th
								>
								<th
									class="px-4 py-2 cursor-pointer hover:text-gray-300 select-none"
									on:click={() => toggleSort('encryption')}
									>Enc{sortIndicator('encryption')}</th
								>
								<th
									class="px-4 py-2 text-right cursor-pointer hover:text-gray-300 select-none"
									on:click={() => toggleSort('power')}
									>Signal{sortIndicator('power')}</th
								>
								<th
									class="px-4 py-2 text-right cursor-pointer hover:text-gray-300 select-none"
									on:click={() => toggleSort('clients')}
									>Clients{sortIndicator('clients')}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each sortedTargets as target}
								<tr
									class="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
									on:click={() => selectTarget(target.bssid)}
								>
									<td class="px-4 py-2">
										<input
											type="checkbox"
											checked={state?.selectedTargets?.includes(target.bssid)}
											class="accent-cyan-500"
											tabindex="-1"
										/>
									</td>
									<td class="px-4 py-2 text-white"
										>{target.essid || '<hidden>'}</td
									>
									<td class="px-4 py-2 font-mono text-gray-300 text-xs"
										>{target.bssid}</td
									>
									<td class="px-4 py-2 text-gray-400 text-center"
										>{target.channel}</td
									>
									<td class="px-4 py-2 {encColor(target.encryption)} text-xs"
										>{target.encryption}</td
									>
									<td
										class="px-4 py-2 {signalColor(
											target.power
										)} text-right font-mono">{target.power} dBm</td
									>
									<td class="px-4 py-2 text-gray-400 text-right"
										>{target.clients || 0}</td
									>
								</tr>
							{:else}
								<tr>
									<td colspan="7" class="px-4 py-8 text-center text-gray-600">
										No targets found. Start Kismet to scan for networks.
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Attack Mode Selection -->
			<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
				<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
					<h3 class="text-sm font-bold text-gray-300">Attack Mode</h3>
				</div>
				<div class="p-4 space-y-4">
					<!-- Mode Radio Buttons -->
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						{#each attackModes as mode}
							<button
								on:click={() => handleModeChange(mode.value)}
								class="text-left p-3 rounded-lg border transition-all
									{state?.attackMode === mode.value
									? 'border-cyan-500/50 bg-cyan-950/30'
									: 'border-gray-700 bg-gray-900/30 hover:border-gray-600'}"
							>
								<div class="flex items-center gap-2 mb-1">
									<div
										class="w-3 h-3 rounded-full border-2 flex items-center justify-center
										{state?.attackMode === mode.value ? 'border-cyan-400' : 'border-gray-600'}"
									>
										{#if state?.attackMode === mode.value}
											<div class="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
										{/if}
									</div>
									<span
										class="text-sm font-medium {state?.attackMode === mode.value
											? 'text-cyan-300'
											: 'text-gray-300'}">{mode.label}</span
									>
								</div>
								<p class="text-xs text-gray-500 ml-5">{mode.summary}</p>
							</button>
						{/each}
					</div>

					<!-- Detailed Description for Selected Mode -->
					<div class="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
						<h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
							{selectedMode.label} &mdash; What this does
						</h4>
						<ul class="space-y-1.5 mb-3">
							{#each selectedMode.details as detail}
								<li class="text-sm text-gray-400 flex items-start gap-2">
									<span class="text-gray-600 mt-0.5 shrink-0">&rsaquo;</span>
									{detail}
								</li>
							{/each}
						</ul>
						<div class="pt-2 border-t border-gray-800">
							<p class="text-xs text-amber-400/80">
								<span class="font-medium">Impact:</span>
								{selectedMode.impact}
							</p>
						</div>
					</div>

					<!-- Launch Button -->
					<div class="pt-2 border-t border-gray-700">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<button
									on:click={handleStartClick}
									disabled={loading || !targetCount}
									class="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500
										text-white font-medium rounded transition-colors"
								>
									{loading ? 'Starting...' : 'Launch Attack'}
								</button>
								<span class="text-sm text-gray-500">
									{targetCount} target{targetCount === 1 ? '' : 's'} selected
								</span>
							</div>
						</div>
						<p class="text-xs text-gray-600 mt-3">
							Captures authentication material for offline analysis. No password
							cracking is performed on this device. Kismet will be stopped
							automatically and restarted when the attack completes.
						</p>
					</div>
				</div>
			</div>
		{:else}
			<!-- Live Progress (when running) -->
			<div class="bg-gray-800/50 border border-cyan-800/50 rounded-lg p-4 space-y-4">
				<div class="flex items-center justify-between">
					<div>
						<div class="flex items-center gap-2">
							<span class="relative flex h-2.5 w-2.5">
								<span
									class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"
								></span>
								<span
									class="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"
								></span>
							</span>
							<span class="text-sm font-medium text-cyan-400">Attack in progress</span
							>
						</div>
						{#if state.currentTarget}
							<p class="text-sm text-gray-400 mt-1">
								Target: <span class="font-mono text-white"
									>{state.currentTarget}</span
								>
							</p>
						{:else}
							<p class="text-sm text-gray-500 mt-1">Scanning for targets...</p>
						{/if}
					</div>
					<button
						on:click={handleStop}
						disabled={loading}
						class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-sm rounded transition-colors"
					>
						{loading ? 'Stopping...' : 'Abort & Restart Kismet'}
					</button>
				</div>

				{#if state.progress}
					<p class="text-sm text-yellow-400 font-mono">{state.progress}</p>
				{/if}

				<!-- Terminal Output -->
				<div
					class="bg-black/60 rounded p-3 max-h-56 overflow-y-auto font-mono text-xs border border-gray-800"
				>
					{#each state.output || [] as line}
						<div class="text-green-300/80">{line}</div>
					{:else}
						<div class="text-gray-600">Waiting for output...</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Live Results (during active run) -->
		{#if state?.running && state?.results?.length > 0}
			<div class="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
				<div class="px-4 py-2 bg-gray-800 border-b border-gray-700">
					<h3 class="text-sm font-bold text-green-400">
						Results ({state.results.length})
					</h3>
				</div>
				{#each state.results as result}
					<div
						class="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between"
					>
						<div>
							<span class="font-mono text-white text-sm">{result.target}</span>
							<span class="text-xs text-gray-500 ml-2">{result.attackType}</span>
							{#if result.handshakePath}
								<span class="text-xs text-gray-600 ml-2 font-mono"
									>{result.handshakePath}</span
								>
							{/if}
						</div>
						<span
							class="text-xs px-2 py-1 rounded {result.success
								? 'bg-green-900/50 text-green-400'
								: 'bg-red-900/50 text-red-400'}"
						>
							{result.success ? 'Captured' : 'Failed'}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<!-- Confirmation Modal -->
{#if showConfirm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div
			class="bg-gray-900 border border-red-800/50 rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl"
		>
			<div class="flex items-center gap-3 mb-4">
				<div
					class="w-10 h-10 rounded-full bg-red-900/50 border border-red-700 flex items-center justify-center shrink-0"
				>
					<span class="text-red-400 text-lg">!</span>
				</div>
				<div>
					<h3 class="text-lg font-bold text-red-400">Confirm Active Attack</h3>
					<p class="text-sm text-gray-400">This action cannot be undone once started</p>
				</div>
			</div>

			<div class="bg-gray-950/50 rounded-lg p-4 mb-4 space-y-2 text-sm">
				<div class="flex justify-between">
					<span class="text-gray-500">Targets:</span>
					<span class="text-white"
						>{targetCount} network{targetCount === 1 ? '' : 's'}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Attack mode:</span>
					<span class="text-white">{selectedMode.label}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-gray-500">Kismet:</span>
					<span class="text-amber-400">Will be stopped</span>
				</div>
			</div>

			<div class="bg-red-950/30 border border-red-900/50 rounded-lg p-3 mb-5">
				<p class="text-xs text-red-300/90 leading-relaxed">
					<span class="font-medium">Warning:</span> This will actively transmit
					deauthentication and association frames against the selected target{targetCount ===
					1
						? ''
						: 's'}. Devices connected to
					{targetCount === 1 ? 'this network' : 'these networks'} may lose connectivity. Network
					services on this device will be interrupted while the attack runs. Kismet will restart
					automatically when complete.
				</p>
			</div>

			<div class="flex gap-3 justify-end">
				<button
					on:click={() => (showConfirm = false)}
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
					>Cancel</button
				>
				<button
					on:click={confirmStart}
					class="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded transition-colors"
					>Confirm &amp; Launch</button
				>
			</div>
		</div>
	</div>
{/if}

<HardwareConflictModal bind:show={showConflict} currentOwner={conflictOwner} device="alfa" />

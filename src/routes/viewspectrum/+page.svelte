<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HardwareStatusBar from '$lib/components/hardware/HardwareStatusBar.svelte';
	import HardwareConflictModal from '$lib/components/hardware/HardwareConflictModal.svelte';

	let iframeUrl = '';
	let isLoading = true;
	let hasError = false;
	let openwebrxRunning = false;
	let startingOpenWebRX = false;
	let stoppingOpenWebRX = false;
	let hackrfOwner: string | null = null;
	let showConflict = false;
	let conflictOwner = '';
	let errorMessage = '';
	let statusInterval: ReturnType<typeof setInterval>;

	onMount(async () => {
		const host = window.location.hostname;
		iframeUrl = `http://${host}:8073`;
		await checkOpenWebRXStatus();
		statusInterval = setInterval(checkOpenWebRXStatus, 10000);
		setTimeout(() => {
			isLoading = false;
		}, 3000);
	});

	onDestroy(() => {
		if (statusInterval) clearInterval(statusInterval);
	});

	async function checkOpenWebRXStatus() {
		try {
			const response = await fetch('/api/openwebrx/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'status' })
			});
			const result = await response.json();
			openwebrxRunning = result.running;
			hackrfOwner = result.hackrfOwner ?? null;
		} catch (error) {
			console.error('Failed to check OpenWebRX status:', error);
		}
	}

	async function startOpenWebRX() {
		startingOpenWebRX = true;
		try {
			const response = await fetch('/api/openwebrx/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start' })
			});
			const result = await response.json();

			if (result.success) {
				openwebrxRunning = true;
				hackrfOwner = 'openwebrx';
			} else if (response.status === 409) {
				conflictOwner = result.owner || hackrfOwner || 'unknown';
				showConflict = true;
			} else {
				const msg = result.message || 'Unknown error';
				if (msg.includes('timeout')) {
					errorMessage =
						'OpenWebRX failed to start. The Docker image may still be downloading. Try again shortly.';
				} else {
					errorMessage = `Failed to start OpenWebRX: ${msg}`;
				}
			}
		} catch (error) {
			errorMessage = `Error starting OpenWebRX: ${error}`;
		} finally {
			startingOpenWebRX = false;
		}
	}

	async function stopOpenWebRX() {
		stoppingOpenWebRX = true;
		try {
			const response = await fetch('/api/openwebrx/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});
			const result = await response.json();

			if (result.success) {
				openwebrxRunning = false;
				hackrfOwner = null;
			} else {
				alert(`Failed to stop OpenWebRX: ${result.message}`);
			}
		} catch (error) {
			alert(`Error stopping OpenWebRX: ${error}`);
		} finally {
			stoppingOpenWebRX = false;
		}
	}

	function handleIframeLoad() {
		isLoading = false;
		hasError = false;
	}

	function handleIframeError() {
		isLoading = false;
		hasError = true;
	}

	function openInNewTab() {
		window.open(iframeUrl, '_blank');
	}

	function handleConflictTakeOver() {
		showConflict = false;
		startOpenWebRX();
	}
</script>

<div class="min-h-screen bg-black">
	<HardwareStatusBar />

	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">
					&larr; Back to Console
				</a>
				<h1 class="text-xl font-bold text-white">OpenWebRX Spectrum Viewer</h1>
			</div>
			<div class="flex items-center gap-3">
				{#if hackrfOwner && hackrfOwner !== 'openwebrx'}
					<span class="text-xs text-amber-400 font-mono">HackRF: {hackrfOwner}</span>
				{/if}

				{#if openwebrxRunning}
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<span class="text-sm text-green-400">OpenWebRX Running</span>
					</div>
					<button
						on:click={stopOpenWebRX}
						disabled={stoppingOpenWebRX}
						class="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white px-4 py-2 rounded transition-colors"
					>
						{stoppingOpenWebRX ? 'Stopping...' : 'Stop OpenWebRX'}
					</button>
				{:else}
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 bg-red-500 rounded-full"></div>
						<span class="text-sm text-red-400">OpenWebRX Stopped</span>
					</div>
					<button
						on:click={startOpenWebRX}
						disabled={startingOpenWebRX}
						class="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded transition-colors"
					>
						{startingOpenWebRX ? 'Starting...' : 'Start OpenWebRX'}
					</button>
				{/if}

				{#if iframeUrl}
					<button
						on:click={openInNewTab}
						class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition-colors"
					>
						Open in New Tab
					</button>
				{/if}
			</div>
		</div>
	</header>

	<div class="relative h-[calc(100vh-100px)]">
		{#if !openwebrxRunning}
			<div class="absolute inset-0 flex items-center justify-center bg-black">
				<div class="text-center max-w-md">
					<svg
						class="w-16 h-16 mx-auto text-gray-600 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						></path>
					</svg>
					<h2 class="text-xl font-bold text-white mb-2">OpenWebRX is Stopped</h2>
					<p class="text-gray-400 mb-4">
						Click Start to launch the spectrum viewer. This will acquire the HackRF
						device.
					</p>
					{#if errorMessage}
						<div class="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4">
							<p class="text-red-300 text-sm">{errorMessage}</p>
						</div>
					{/if}
					<button
						on:click={() => {
							errorMessage = '';
							startOpenWebRX();
						}}
						disabled={startingOpenWebRX}
						class="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-3 rounded-lg text-lg transition-colors"
					>
						{startingOpenWebRX ? 'Starting...' : 'Start OpenWebRX'}
					</button>
				</div>
			</div>
		{:else}
			{#if isLoading}
				<div class="absolute inset-0 flex items-center justify-center bg-black z-10">
					<div class="text-center">
						<div
							class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"
						></div>
						<p class="mt-4 text-gray-400">Loading OpenWebRX...</p>
					</div>
				</div>
			{/if}

			{#if hasError}
				<div class="absolute inset-0 flex items-center justify-center bg-black z-10">
					<div class="text-center max-w-md">
						<h2 class="text-xl font-bold text-white mb-2">Connection Error</h2>
						<p class="text-gray-400 mb-4">
							Unable to connect to OpenWebRX at port 8073
						</p>
						<button
							on:click={openInNewTab}
							class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition-colors"
						>
							Try Opening Directly
						</button>
					</div>
				</div>
			{/if}

			{#if iframeUrl}
				<iframe
					src={iframeUrl}
					class="w-full h-full border-0"
					title="OpenWebRX Spectrum Viewer"
					on:load={handleIframeLoad}
					on:error={handleIframeError}
					style="display: {hasError ? 'none' : 'block'}"
					allow="autoplay; microphone"
				></iframe>
			{/if}
		{/if}
	</div>

	<div class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-2 text-sm">
		<div class="container mx-auto flex items-center justify-between text-gray-400">
			<span>OpenWebRX Interface: {iframeUrl}</span>
			<span>Default credentials: admin/hackrf</span>
		</div>
	</div>
</div>

<HardwareConflictModal
	bind:show={showConflict}
	currentOwner={conflictOwner}
	device="hackrf"
	onTakeOver={handleConflictTakeOver}
/>

<style>
	:global(body) {
		overflow: hidden;
	}
</style>

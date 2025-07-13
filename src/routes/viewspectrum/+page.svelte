<script lang="ts">
	import { onMount } from 'svelte';

	let iframeUrl = '';
	let isLoading = true;
	let hasError = false;

	onMount(() => {
		// Use window.location to get the correct host
		const host = window.location.hostname;
		iframeUrl = `http://${host}:8073`;

		// Set a timeout to hide loading after a reasonable time
		setTimeout(() => {
			isLoading = false;
		}, 3000);
	});

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
</script>

<div class="min-h-screen bg-black">
	<!-- Header -->
	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">
					← Back to Console
				</a>
				<h1 class="text-xl font-bold text-white">OpenWebRX Spectrum Viewer</h1>
			</div>
			{#if iframeUrl}
				<button
					on:click={openInNewTab}
					class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition-colors"
				>
					Open in New Tab ↗
				</button>
			{/if}
		</div>
	</header>

	<!-- Content -->
	<div class="relative h-[calc(100vh-64px)]">
		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center bg-black">
				<div class="text-center">
					<div
						class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"
					></div>
					<p class="mt-4 text-gray-400">Loading OpenWebRX...</p>
				</div>
			</div>
		{/if}

		{#if hasError}
			<div class="absolute inset-0 flex items-center justify-center bg-black">
				<div class="text-center max-w-md">
					<svg
						class="w-16 h-16 mx-auto text-red-500 mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path>
					</svg>
					<h2 class="text-xl font-bold text-white mb-2">Connection Error</h2>
					<p class="text-gray-400 mb-4">Unable to connect to OpenWebRX at port 8073</p>
					<button
						on:click={openInNewTab}
						class="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded transition-colors"
					>
						Try Opening Directly ↗
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
	</div>

	<!-- Info Bar -->
	<div class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-2 text-sm">
		<div class="container mx-auto flex items-center justify-between text-gray-400">
			<span>OpenWebRX Interface: {iframeUrl}</span>
			<span>Default credentials: admin/hackrf</span>
		</div>
	</div>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}
</style>

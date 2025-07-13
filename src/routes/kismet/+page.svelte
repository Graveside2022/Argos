<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let iframeUrl = '';
	let isLoading = true;
	let hasError = false;
	let errorMessage = '';
	let kismetStatus: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
	let statusCheckInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		// Use window.location to get the correct host
		const host = window.location.hostname;
		iframeUrl = `http://${host}:2501`;

		// Check initial Kismet status
		checkKismetStatus().catch((error) => {
			console.error('Initial Kismet status check failed:', error);
		});

		// Set up periodic status checks
		statusCheckInterval = setInterval(() => {
			checkKismetStatus().catch((error) => {
				console.error('Periodic Kismet status check failed:', error);
			});
		}, 5000);

		// Set a timeout to hide loading after a reasonable time
		setTimeout(() => {
			isLoading = false;
		}, 3000);

		// Suppress postMessage errors in console for iframe
		window.addEventListener('error', (event) => {
			if (event.message && event.message.includes('unable to post message')) {
				event.preventDefault();
				// Note: Expected postMessage warning suppressed for iframe
			}
		});
	});

	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
	});

	async function checkKismetStatus() {
		try {
			// Use our API to check status
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'status' })
			});

			if (response.ok) {
				const data = (await response.json()) as { running: boolean };
				if (data.running && kismetStatus === 'stopped') {
					kismetStatus = 'running';
					hasError = false;
					errorMessage = '';
				} else if (!data.running && kismetStatus === 'running') {
					kismetStatus = 'stopped';
				}
			}
		} catch (error) {
			console.error('Error checking Kismet status:', error);
		}
	}

	async function startKismet() {
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') return;

		kismetStatus = 'starting';

		try {
			// Use our own API to control Kismet
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'start' })
			});

			if (response.ok) {
				// Start checking for Kismet to come online
				let checkCount = 0;
				const maxChecks = 60; // 60 seconds max

				const startupInterval = setInterval(() => {
					(async () => {
						checkCount++;

						try {
							await fetch(
								`http://${window.location.hostname}:2501/system/status.json`,
								{
									mode: 'no-cors'
								}
							);

							// If we get here, Kismet is responding
							clearInterval(startupInterval);
							kismetStatus = 'running';

							// Reload iframe to show Kismet UI
							const iframe = document.querySelector('iframe');
							if (iframe) {
								iframe.src = iframe.src + '?t=' + Date.now();
							}
						} catch {
							if (checkCount >= maxChecks) {
								clearInterval(startupInterval);
								kismetStatus = 'stopped';
								hasError = true;
							}
						}
					})().catch((error) => {
						console.error('Error in startup check:', error);
						if (checkCount >= maxChecks) {
							clearInterval(startupInterval);
							kismetStatus = 'stopped';
							hasError = true;
						}
					});
				}, 1000);
			} else {
				const errorText = await response.text();
				throw new Error(`Failed to start Kismet: ${errorText}`);
			}
		} catch (error: unknown) {
			console.error('Error starting Kismet:', error);
			kismetStatus = 'stopped';
			hasError = true;
			errorMessage =
				error instanceof Error ? error.message : 'Failed to start Kismet service';
		}
	}

	async function stopKismet() {
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') return;

		kismetStatus = 'stopping';

		try {
			// Use our own API to control Kismet
			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ action: 'stop' })
			});

			if (response.ok) {
				setTimeout(() => {
					kismetStatus = 'stopped';
					// Clear iframe to show stopped state
					const iframe = document.querySelector('iframe');
					if (iframe) {
						iframe.src = 'about:blank';
						setTimeout(() => {
							if (iframe) {
								iframe.src = iframeUrl;
							}
						}, 100);
					}
				}, 2000);
			} else {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message || 'Failed to stop Kismet');
			}
		} catch (error: unknown) {
			console.error('Error stopping Kismet:', error);
			kismetStatus = 'running';
			hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to stop Kismet';
		}
	}

	function toggleKismet() {
		if (kismetStatus === 'running') {
			stopKismet().catch((error) => {
				console.error('Error stopping Kismet:', error);
			});
		} else if (kismetStatus === 'stopped') {
			startKismet().catch((error) => {
				console.error('Error starting Kismet:', error);
			});
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
</script>

<div class="min-h-screen bg-black">
	<!-- Header -->
	<header class="bg-gray-900 border-b border-gray-800 p-4">
		<div class="container mx-auto flex items-center justify-between">
			<div class="flex items-center gap-4">
				<a href="/" class="text-cyan-500 hover:text-cyan-400 transition-colors">
					← Back to Console
				</a>
				<h1 class="text-xl font-bold text-white">Kismet Interface</h1>
				<a
					href="/tactical-map-simple"
					class="ml-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l3.707 3.707A1 1 0 0018 17.414V6a1 1 0 00-.293-.707z"
							clip-rule="evenodd"
						/>
					</svg>
					View Tactical Map
				</a>
			</div>

			<button
				on:click={toggleKismet}
				disabled={kismetStatus === 'starting' || kismetStatus === 'stopping'}
				class="px-6 py-2 rounded font-medium transition-all duration-200 flex items-center gap-2
          {kismetStatus === 'stopped' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
          {kismetStatus === 'running' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          {kismetStatus === 'starting' || kismetStatus === 'stopping'
					? 'bg-gray-600 text-gray-300 cursor-not-allowed'
					: ''}"
			>
				{#if kismetStatus === 'stopped'}
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
							clip-rule="evenodd"
						/>
					</svg>
					Start Kismet
				{:else if kismetStatus === 'running'}
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
							clip-rule="evenodd"
						/>
					</svg>
					Stop Kismet
				{:else if kismetStatus === 'starting'}
					<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z"
							clip-rule="evenodd"
						/>
					</svg>
					Starting...
				{:else}
					<svg class="w-4 h-4 animate-spin" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z"
							clip-rule="evenodd"
						/>
					</svg>
					Stopping...
				{/if}
			</button>
		</div>
	</header>

	<!-- Main Content -->
	<div class="relative" style="height: calc(100vh - 64px);">
		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center bg-gray-900">
				<div class="text-center">
					<div
						class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"
					></div>
					<p class="text-gray-400">Loading Kismet interface...</p>
				</div>
			</div>
		{/if}

		{#if kismetStatus === 'stopped'}
			<div
				class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800"
			>
				<div class="text-center max-w-2xl mx-auto p-8">
					<!-- Network Icon -->
					<div class="relative mb-8">
						<svg
							class="w-32 h-32 text-cyan-500 mx-auto opacity-80"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
							/>
						</svg>
					</div>

					<!-- Main Content -->
					<div class="space-y-6">
						<div>
							<h1 class="text-4xl font-bold text-white mb-2">
								<span class="text-cyan-400">KISMET</span> Network Detection
							</h1>
							<div
								class="h-1 w-32 bg-gradient-to-r from-cyan-500 to-blue-500 mx-auto rounded-full"
							></div>
						</div>

						<p class="text-xl text-gray-300 leading-relaxed">
							Advanced wireless network discovery and analysis platform
						</p>

						<!-- Feature Grid -->
						<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg
									class="w-8 h-8 text-cyan-400 mb-3"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<h3 class="text-white font-semibold mb-2">Real-time Detection</h3>
								<p class="text-gray-400 text-sm">
									Monitor wireless networks and devices in real-time
								</p>
							</div>

							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg
									class="w-8 h-8 text-cyan-400 mb-3"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
									/>
								</svg>
								<h3 class="text-white font-semibold mb-2">Signal Analysis</h3>
								<p class="text-gray-400 text-sm">
									Analyze signal strength and device behavior
								</p>
							</div>

							<div class="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
								<svg
									class="w-8 h-8 text-cyan-400 mb-3"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fill-rule="evenodd"
										d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l3.707 3.707A1 1 0 0018 17.414V6a1 1 0 00-.293-.707z"
									/>
								</svg>
								<h3 class="text-white font-semibold mb-2">Tactical Mapping</h3>
								<p class="text-gray-400 text-sm">
									Visualize device locations on interactive maps
								</p>
							</div>
						</div>

						<!-- Status Info -->
						<div class="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
							<div class="flex items-center justify-center space-x-4">
								<div class="flex items-center space-x-2">
									<div
										class="w-3 h-3 bg-red-500 rounded-full animate-pulse"
									></div>
									<span class="text-gray-300">Service Offline</span>
								</div>
								<div class="w-px h-6 bg-gray-600"></div>
								<span class="text-gray-400">Ready to Deploy</span>
							</div>
						</div>

						<!-- Call to Action -->
						<div class="pt-4">
							<p class="text-gray-400 mb-4">
								Launch Kismet to begin wireless network discovery and monitoring
							</p>
							<div
								class="flex items-center justify-center space-x-4 text-sm text-gray-500"
							>
								<span>↑ Click "Start Kismet" above to begin</span>
							</div>
						</div>
					</div>

					{#if errorMessage}
						<div class="mt-8 p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
							<p class="text-red-400 text-sm">⚠️ {errorMessage}</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if iframeUrl}
			<iframe
				src={iframeUrl}
				on:load={handleIframeLoad}
				on:error={handleIframeError}
				class="w-full h-full border-0"
				title="Kismet Interface"
				style="display: {hasError && kismetStatus === 'stopped' ? 'none' : 'block'}"
				sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
			></iframe>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}
</style>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import GPSStatusButton from '$lib/components/kismet/GPSStatusButton.svelte';

	let iframeUrl = '';
	let isLoading = true;
	let _hasError = false;
	let errorMessage = '';
	let kismetStatus: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
	let statusCheckInterval: ReturnType<typeof setInterval>;
	let iframeElement: HTMLIFrameElement;
	let startIframeMonitor: (() => void) | undefined;
	let iframeKey = 0; // Used to force iframe recreation
	let lastStartTime = 0; // Track when we last started Kismet
	onMount(() => {
		// Use window.location to get the correct host
		const host = window.location.hostname;
		// Add trailing slash to match what Kismet redirects to
		iframeUrl = `http://${host}:2501/`;

		// Check initial Kismet status
		checkKismetStatus().catch((error) => {
			console.error('Initial Kismet status check failed:', error);
		});

		// Set up periodic status checks
		statusCheckInterval = setInterval(() => {
			// Don't check status while starting or stopping
			if (kismetStatus !== 'starting' && kismetStatus !== 'stopping') {
				checkKismetStatus().catch((error) => {
					console.error('Periodic Kismet status check failed:', error);
				});
			}
		}, 10000); // Check every 10 seconds instead of 5

		// Set a timeout to hide loading after a reasonable time
		setTimeout(() => {
			isLoading = false;
		}, 3000);

		// Handle iframe postMessage errors gracefully
		window.addEventListener('error', (event) => {
			if (
				event.message &&
				(event.message.includes('unable to post message') ||
					event.message.includes('postMessage'))
			) {
				event.preventDefault();
				// Suppress expected cross-origin postMessage warnings
			}
		});

		// Add basic navigation protection
		window.addEventListener('beforeunload', (event) => {
			if (event.target === window && kismetStatus === 'running') {
				event.preventDefault();
				event.returnValue = 'Kismet is currently running. Are you sure you want to leave?';
				return 'Kismet is currently running. Are you sure you want to leave?';
			}
		});

		// Basic location.href protection (only if not already defined)
		try {
			const originalHref = window.location.href;
			Object.defineProperty(window.location, 'href', {
				get() {
					return originalHref;
				},
				set(_value) {
					console.warn('Navigation attempt blocked:', _value);
					// Intentionally prevent navigation by not setting anything
				},
				configurable: true
			});
		} catch {
			// Property already defined, skip
			console.warn('Location.href already defined, navigation protection may be limited');
		}

		// Monitor iframe src changes (simplified)
		let _iframeMonitor: ReturnType<typeof setInterval>;
		startIframeMonitor = () => {
			_iframeMonitor = setInterval(() => {
				if (iframeElement && kismetStatus === 'running') {
					const currentSrc = iframeElement.src;
					const normalizedCurrent = currentSrc.replace(/\/$/, '');
					const normalizedExpected = iframeUrl.replace(/\/$/, '');

					if (normalizedCurrent !== normalizedExpected) {
						// Check if it's navigating to error pages and redirect back
						if (
							currentSrc.includes('login') ||
							currentSrc.includes('error') ||
							currentSrc === 'about:blank'
						) {
							iframeElement.src = iframeUrl;
						}
					}
				}
			}, 2000); // Check less frequently
		};
	});

	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
	});

	// Start iframe monitoring when Kismet is running
	$: if (kismetStatus === 'running' && startIframeMonitor) {
		console.warn('Starting iframe monitor for running Kismet');
		startIframeMonitor();
	}

	async function checkKismetStatus() {
		try {
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
					_hasError = false;
					errorMessage = '';
				} else if (!data.running && kismetStatus === 'running') {
					// Don't immediately stop if we just started Kismet (within 60 seconds)
					const timeSinceStart = Date.now() - lastStartTime;
					if (timeSinceStart > 60000) {
						kismetStatus = 'stopped';
					}
				}
			}
		} catch (error) {
			console.warn('Kismet status check failed:', error);
		}
	}

	async function startKismet(interfaceName?: string) {
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') {
			return;
		}

		kismetStatus = 'starting';
		lastStartTime = Date.now(); // Record when we started

		try {
			// Use our own API to control Kismet
			const requestBody: Record<string, unknown> = { action: 'start' };
			if (interfaceName) {
				requestBody.interface = interfaceName;
			}

			const response = await fetch('/api/kismet/control', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (response.ok) {
				// Wait briefly then check actual status instead of assuming it's running
				setTimeout(async () => {
					await checkKismetStatus();
				}, 2000);
			} else {
				let errorText = '';
				try {
					const errorData = await response.json();
					errorText = errorData.error || errorData.message || 'Unknown error';
					if (errorData.details) {
						errorText += '\n' + errorData.details;
					}
				} catch {
					errorText = await response.text();
				}
				throw new Error(`Failed to start Kismet: ${errorText}`);
			}
		} catch (error: unknown) {
			console.error('Error starting Kismet:', error);
			kismetStatus = 'stopped';
			_hasError = true;
			errorMessage =
				error instanceof Error ? error.message : 'Failed to start Kismet service';
		}
	}

	async function stopKismet() {
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') return;

		kismetStatus = 'stopping';

		try {
			// Use the dedicated stop endpoint with comprehensive stop functionality
			const response = await fetch('/api/kismet/stop', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				console.warn('Stop response:', data);
				setTimeout(() => {
					kismetStatus = 'stopped';
				}, 2000);
			} else {
				const data = (await response.json()) as { message?: string };
				throw new Error(data.message || 'Failed to stop Kismet');
			}
		} catch (error: unknown) {
			console.error('Error stopping Kismet:', error);
			kismetStatus = 'running';
			_hasError = true;
			errorMessage = error instanceof Error ? error.message : 'Failed to stop Kismet';
		}
	}

	function toggleKismet() {
		if (kismetStatus === 'running') {
			stopKismet();
		} else if (kismetStatus === 'stopped') {
			startKismet();
		}
	}

	function handleIframeLoad() {
		isLoading = false;
		_hasError = false;
		console.warn('Kismet interface loaded successfully');
	}

	function handleIframeError() {
		isLoading = false;
		_hasError = true;
	}
</script>

<div class="min-h-screen bg-black">
	<!-- Professional Header with Glass Effect -->
	<header
		class="sticky top-0 z-50 backdrop-blur-2xl bg-bg-primary/80 border-b border-border-primary/50 shadow-xl"
	>
		<div class="w-full">
			<div class="flex items-center justify-between h-16 pl-2 pr-2">
				<!-- Left Section -->
				<div class="flex items-center gap-6">
					<!-- Back to Console Button -->
					<a
						href="/"
						class="flex items-center space-x-2 px-4 py-2 rounded-lg glass-button hover:bg-bg-hover/20 transition-all duration-200"
					>
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
								clip-rule="evenodd"
							/>
						</svg>
						Back to Console
					</a>

					<!-- Title with Icon -->
					<div class="flex items-center space-x-3">
						<!-- WiFi Icon -->
						<div
							class="p-3 rounded-xl transition-all duration-300"
							style="background: linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(0, 212, 255, 0.1) 100%) !important; border: 1px solid rgba(0, 212, 255, 0.2) !important; box-shadow: 0 8px 25px rgba(0, 212, 255, 0.2), 0 0 15px rgba(0, 212, 255, 0.15) !important;"
						>
							<svg
								class="w-6 h-6"
								fill="currentColor"
								viewBox="0 0 24 24"
								style="color: #00d4ff !important;"
							>
								<path
									d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
								></path>
							</svg>
						</div>
						<div class="flex flex-col">
							<h1
								class="font-heading text-h4 font-semibold tracking-tight leading-tight"
							>
								<span class="kismet-brand">Kismet</span>
								<span class="text-white font-bold">Network Monitor</span>
							</h1>
							<span
								class="font-mono text-caption uppercase tracking-widest"
								style="color: #9CA3AF !important;"
							>
								Wireless Network Detection
							</span>
						</div>
					</div>
				</div>

				<!-- Right Section - Buttons -->
				<div class="flex items-center gap-3">
					<!-- GPS Status Button -->
					<GPSStatusButton />

					<!-- Start/Stop Kismet Button -->
					<button
						type="button"
						on:click={() => toggleKismet()}
						disabled={kismetStatus === 'starting' || kismetStatus === 'stopping'}
						class="saasfly-btn
						{kismetStatus === 'stopped' ? 'saasfly-btn-start' : ''}
						{kismetStatus === 'running' ? 'saasfly-btn-stop' : ''}
						{kismetStatus === 'starting' || kismetStatus === 'stopping' ? 'saasfly-btn-loading' : ''}"
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
							<svg
								class="w-4 h-4 animate-spin"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z"
									clip-rule="evenodd"
								/>
							</svg>
							Starting...
						{:else}
							<svg
								class="w-4 h-4 animate-spin"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 10.586V7z"
									clip-rule="evenodd"
								/>
							</svg>
							Stopping...
						{/if}
					</button>

					<!-- View Tactical Map Button -->
					<a href="/tactical-map-simple" class="saasfly-btn saasfly-btn-spectrum">
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
			</div>
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

		{#if kismetStatus === 'starting'}
			<div class="absolute inset-0 flex items-center justify-center bg-gray-900">
				<div class="text-center">
					<div
						class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"
					></div>
					<p class="text-gray-400">Starting Kismet...</p>
				</div>
			</div>
		{/if}

		{#if iframeUrl && kismetStatus === 'running'}
			<!-- Add a key to force recreation if needed -->
			{#key iframeKey}
				<!-- Wrapper to isolate iframe -->
				<div class="w-full h-full" style="position: relative; overflow: hidden;">
					<iframe
						bind:this={iframeElement}
						src={iframeUrl}
						on:load={(_e) => {
							console.warn('Kismet iframe loaded successfully');
							handleIframeLoad();

							// Check if iframe src changed unexpectedly (normalize for trailing slash)
							const iframe = _e.target as HTMLIFrameElement;
							const normalizedIframeSrc = iframe.src.replace(/\/$/, '');
							const normalizedExpectedSrc = iframeUrl.replace(/\/$/, '');

							if (normalizedIframeSrc !== normalizedExpectedSrc) {
								console.warn('Iframe URL normalized:', {
									expected: iframeUrl,
									actual: iframe.src
								});
							}
						}}
						on:error={(_e) => {
							console.warn(
								'Kismet iframe connection failed - service may not be running'
							);
							handleIframeError();
						}}
						class="w-full h-full border-0"
						title="Kismet Network Interface"
						referrerpolicy="no-referrer"
						sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
						loading="lazy"
					></iframe>
				</div>
			{/key}
		{/if}
	</div>
</div>

<style>
	:global(body) {
		overflow: hidden;
	}

	/* Saasfly button styles */
	:global(.saasfly-btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 500;
		transition-property: all;
		transition-duration: 200ms;
	}

	:global(.saasfly-btn:focus) {
		outline: none;
		box-shadow:
			0 0 0 2px var(--bg-primary),
			0 0 0 4px currentColor;
	}

	/* Start button - Cyan gradient */
	:global(.saasfly-btn-start) {
		background: linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(14, 165, 233, 0.3),
			0 0 20px rgba(14, 165, 233, 0.1) !important;
	}

	:global(.saasfly-btn-start:hover:not(:disabled)) {
		background: linear-gradient(135deg, #0284c7 0%, #0e7490 100%) !important;
		box-shadow:
			0 4px 12px rgba(14, 165, 233, 0.4),
			0 0 30px rgba(14, 165, 233, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Stop button - Red gradient */
	:global(.saasfly-btn-stop) {
		background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(239, 68, 68, 0.3),
			0 0 20px rgba(239, 68, 68, 0.1) !important;
	}

	:global(.saasfly-btn-stop:hover:not(:disabled)) {
		background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%) !important;
		box-shadow:
			0 4px 12px rgba(239, 68, 68, 0.4),
			0 0 30px rgba(239, 68, 68, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Spectrum analyzer button - Blue gradient */
	:global(.saasfly-btn-spectrum) {
		background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
		color: white !important;
		border: none !important;
		box-shadow:
			0 2px 8px rgba(59, 130, 246, 0.3),
			0 0 20px rgba(59, 130, 246, 0.1) !important;
	}

	:global(.saasfly-btn-spectrum:hover) {
		background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
		box-shadow:
			0 4px 12px rgba(59, 130, 246, 0.4),
			0 0 30px rgba(59, 130, 246, 0.2) !important;
		transform: translateY(-1px);
	}

	/* Loading state */
	:global(.saasfly-btn-loading) {
		background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important;
		color: white !important;
		border: none !important;
		opacity: 0.7;
		cursor: not-allowed;
	}

	:global(.saasfly-btn:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none !important;
	}

	/* Glass button styles */
	:global(.glass-button) {
		background: rgba(20, 20, 20, 0.6);
		border: 1px solid rgba(38, 38, 38, 0.6);
		color: #a3a3a3;
		transition: all 0.2s ease;
	}

	:global(.glass-button:hover) {
		background: rgba(26, 26, 26, 0.8);
		border-color: rgba(64, 64, 64, 0.8);
		color: #ffffff;
	}

	/* Kismet brand styles */
	:global(.kismet-brand) {
		color: #00d4ff;
		text-shadow: none;
	}
</style>

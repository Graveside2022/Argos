<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import GPSStatusButton from '$lib/components/kismet/GPSStatusButton.svelte';

	let iframeUrl = '';
	let isLoading = true;
	let hasError = false;
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

		// Suppress postMessage errors in console for iframe
		window.addEventListener('error', (event) => {
			if (event.message && event.message.includes('unable to post message')) {
				event.preventDefault();
				// Note: Expected postMessage warning suppressed for iframe
			}
		});

		// Prevent navigation from iframe
		window.addEventListener('beforeunload', (event) => {
			// Check if the navigation is coming from our page (not the iframe)
			if (event.target === window && kismetStatus === 'running') {
				console.error('BLOCKING NAVIGATION while Kismet is running');
				event.preventDefault();
				event.returnValue = 'Are you sure you want to leave?';
				return 'Are you sure you want to leave?';
			}
		});

		// Debug any unexpected navigation
		window.addEventListener('popstate', (event) => {
			console.warn('Popstate event detected:', event);
		});
		
		// More aggressive debugging
		const originalLocationHref = window.location.href;
		let checkInterval = setInterval(() => {
			if (window.location.href !== originalLocationHref) {
				console.error('LOCATION CHANGED!', {
					from: originalLocationHref,
					to: window.location.href,
					kismetStatus
				});
			}
		}, 100);
		
		// Prevent any form submissions on this page
		document.addEventListener('submit', (e) => {
			console.error('Form submission detected!', e);
			e.preventDefault();
			return false;
		}, true);
		
		// Also check for any click events that might cause navigation
		document.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (target.tagName === 'A' || target.closest('a')) {
				console.warn('Link click detected', target);
			}
		}, true);
		
		// Add message listener to catch any iframe messages
		window.addEventListener('message', (e) => {
			console.log('Message received from iframe:', e.data, 'origin:', e.origin);
			// Block any navigation requests from iframe
			if (e.data && (e.data.type === 'navigate' || e.data.action === 'navigate')) {
				console.error('Iframe trying to navigate parent!', e.data);
				e.preventDefault();
				e.stopPropagation();
				return false;
			}
		});
		
		// Override window.location setters to prevent navigation
		const originalLocationObj = window.location;
		const originalHref = window.location.href;
		
		// Monitor location.href specifically
		Object.defineProperty(window.location, 'href', {
			get() {
				return originalHref;
			},
			set(value) {
				console.error('BLOCKED: Attempt to set window.location.href to:', value);
				console.trace('Location.href change stack trace');
				// Don't actually change it
				return originalHref;
			}
		});
		
		// Also monitor location.replace and location.assign
		const originalReplace = window.location.replace;
		const originalAssign = window.location.assign;
		
		window.location.replace = function(url) {
			console.error('BLOCKED: location.replace() called with:', url);
			console.trace('Replace stack trace');
			// Don't actually navigate
		};
		
		window.location.assign = function(url) {
			console.error('BLOCKED: location.assign() called with:', url);
			console.trace('Assign stack trace');
			// Don't actually navigate
		};
		
		// Monitor iframe src changes
		let iframeMonitor: ReturnType<typeof setInterval>;
		startIframeMonitor = () => {
			iframeMonitor = setInterval(() => {
				if (iframeElement && kismetStatus === 'running') {
					const currentSrc = iframeElement.src;
					// Normalize URLs by removing trailing slashes for comparison
					const normalizedCurrent = currentSrc.replace(/\/$/, '');
					const normalizedExpected = iframeUrl.replace(/\/$/, '');
					
					if (normalizedCurrent !== normalizedExpected) {
						console.error('IFRAME SRC CHANGED DETECTED!', {
							expected: iframeUrl,
							actual: currentSrc,
							timestamp: new Date().toISOString()
						});
						
						// Check if it's trying to navigate to login or error page
						if (currentSrc.includes('login') || currentSrc.includes('error') || currentSrc === 'about:blank') {
							console.log('Iframe navigated to:', currentSrc, '- forcing back to original');
							iframeElement.src = iframeUrl;
						} else if (!currentSrc.startsWith(normalizedExpected)) {
							// Only log if it's actually a different URL, not just trailing slash difference
							console.log('Iframe URL changed to:', currentSrc);
						}
					}
				}
			}, 1000);
		};
		
		// Clean up on unmount
		return () => {
			clearInterval(checkInterval);
			if (iframeMonitor) clearInterval(iframeMonitor);
		};
	});

	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
	});
	
	// Start iframe monitoring when Kismet is running
	$: if (kismetStatus === 'running' && startIframeMonitor) {
		console.log('Starting iframe monitor for running Kismet');
		startIframeMonitor();
	}

	async function checkKismetStatus() {
		// Add debugging
		console.log('Checking Kismet status, current status:', kismetStatus);
		
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
				console.log('Status check response:', data);
				
				// Store old status for debugging
				const oldStatus = kismetStatus;
				
				if (data.running && kismetStatus === 'stopped') {
					kismetStatus = 'running';
					hasError = false;
					errorMessage = '';
				} else if (!data.running && kismetStatus === 'running') {
					// Don't immediately stop if we just started Kismet (within 60 seconds)
					const timeSinceStart = Date.now() - lastStartTime;
					if (timeSinceStart > 60000) {
						console.log('Kismet appears to have stopped (was running for', timeSinceStart / 1000, 'seconds)');
						kismetStatus = 'stopped';
					} else {
						console.log('Kismet status check shows inactive but was just started', timeSinceStart / 1000, 'seconds ago - ignoring');
					}
				}
				
				if (oldStatus !== kismetStatus) {
					console.log('Status changed from', oldStatus, 'to', kismetStatus);
				}
			}
		} catch (error) {
			console.error('Error checking Kismet status:', error);
		}
	}

	async function startKismet(interfaceName?: string) {
		console.log('startKismet called, current status:', kismetStatus);
		if (kismetStatus === 'starting' || kismetStatus === 'stopping') {
			console.log('Returning early because status is:', kismetStatus);
			return;
		}

		kismetStatus = 'starting';
		lastStartTime = Date.now(); // Record when we started

		try {
			// Use our own API to control Kismet
			const requestBody: any = { action: 'start' };
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
				// Wait a bit for Kismet to start and stabilize
				setTimeout(() => {
					kismetStatus = 'running';
					// Add a small delay before showing iframe to ensure Kismet is fully ready
					setTimeout(() => {
						console.log('Kismet should be fully ready now');
					}, 1000);
				}, 3000);
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
		console.log('toggleKismet called, current status:', kismetStatus);
		
		if (kismetStatus === 'running') {
			console.log('Kismet is running, calling stopKismet');
			stopKismet();
		} else if (kismetStatus === 'stopped') {
			console.log('Kismet is stopped, calling startKismet');
			startKismet();
		} else {
			console.log('Kismet is in state:', kismetStatus, '- not starting or stopping');
		}
	}
	

	function handleIframeLoad() {
		console.log('handleIframeLoad called');
		isLoading = false;
		hasError = false;
		
		// Monitor for any navigation attempts after iframe loads
		setTimeout(() => {
			console.log('Checking 5 seconds after iframe load - still on same page');
		}, 5000);
		
		setTimeout(() => {
			console.log('Checking 10 seconds after iframe load - still on same page');
		}, 10000);
		
		setTimeout(() => {
			console.log('Checking 30 seconds after iframe load - still on same page');
		}, 30000);
	}

	function handleIframeError() {
		isLoading = false;
		hasError = true;
	}
</script>

<div class="min-h-screen bg-black">
	<!-- Professional Header with Glass Effect -->
	<header class="sticky top-0 z-50 backdrop-blur-2xl bg-bg-primary/80 border-b border-border-primary/50 shadow-xl">
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
							<path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
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
							<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" style="color: #00d4ff !important;">
								<path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"></path>
							</svg>
						</div>
						<div class="flex flex-col">
							<h1 class="font-heading text-h4 font-semibold tracking-tight leading-tight">
								<span class="kismet-brand">Kismet</span>
								<span class="text-white font-bold">Network Monitor</span>
							</h1>
							<span class="font-mono text-caption uppercase tracking-widest" style="color: #9CA3AF !important;">
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
						{kismetStatus === 'starting' || kismetStatus === 'stopping'
							? 'saasfly-btn-loading'
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
			
			<!-- View Tactical Map Button -->
			<a
				href="/tactical-map-simple"
				class="saasfly-btn saasfly-btn-spectrum"
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
					<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
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
					on:load|preventDefault={(e) => {
						console.log('Kismet iframe loaded', e);
						handleIframeLoad();
						
						// Check if this is causing navigation
						const iframe = e.target as HTMLIFrameElement;
						console.log('Iframe current src:', iframe.src);
						console.log('Expected src:', iframeUrl);
						
						// Check if iframe src changed unexpectedly (normalize for trailing slash)
						const normalizedIframeSrc = iframe.src.replace(/\/$/, '');
						const normalizedExpectedSrc = iframeUrl.replace(/\/$/, '');
						
						if (normalizedIframeSrc !== normalizedExpectedSrc) {
							console.error('IFRAME SRC ACTUALLY CHANGED ON LOAD!', {
								expected: iframeUrl,
								actual: iframe.src
							});
							// This is a real change, not just trailing slash
							iframe.src = iframeUrl;
						}
						
						// Try to prevent navigation from iframe
						try {
							if (iframeElement && iframeElement.contentWindow) {
								// Override navigation methods in iframe
								iframeElement.contentWindow.addEventListener('beforeunload', (e) => {
									console.warn('Iframe attempting navigation');
									e.preventDefault();
									e.returnValue = '';
								});
								
								// Also try to override location
								Object.defineProperty(iframeElement.contentWindow, 'location', {
									get() {
										console.warn('Iframe trying to access location');
										return iframeElement.contentWindow?.location;
									},
									set(value) {
										console.error('Iframe trying to set location to:', value);
										// Block it
										return false;
									}
								});
							}
						} catch (e) {
							// Cross-origin restriction, expected
							console.log('Cannot access iframe content (cross-origin)');
						}
					}}
					on:error|preventDefault={(e) => {
						console.error('Kismet iframe error:', e);
						handleIframeError();
					}}
					class="w-full h-full border-0"
					title="Kismet Interface"
					referrerpolicy="no-referrer"
					sandbox="allow-same-origin allow-scripts allow-forms"
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

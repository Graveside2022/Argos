<script lang="ts">
	import { connectionStatus } from '$lib/stores/hackrf';
	import MobileMenu from './MobileMenu.svelte';
	
	let mobileMenuOpen = false;
	
	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	
	function openSpectrumAnalyzer() {
		window.open('/spectrum-viewer', '_blank');
	}
</script>

<!-- Professional Header with Smart Glass Effect (EXACT from port 3002) -->
<header class="sticky top-0 z-50 header-gradient-sweep border-b border-border-primary bg-black/10 backdrop-blur-xl relative overflow-hidden">
	<div class="container mx-auto">
		<div class="px-4 lg:px-8">
			<div class="flex items-center justify-between h-20">
				<div class="flex items-center space-x-8">
					<!-- Logo and Title -->
					<div class="flex items-center space-x-4">
						<a href="/" class="flex items-center space-x-3 group">
							<div class="w-10 h-10 bg-gradient-to-br from-accent-primary to-accent-muted rounded-xl p-2 group-hover:shadow-mono-glow transition-all duration-300">
								<svg class="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
									<path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
								</svg>
							</div>
							<div>
								<h1 class="font-heading text-xl font-bold text-text-primary tracking-tight group-hover:text-accent-primary transition-colors duration-300">HackRF Monitor</h1>
								<p class="font-mono text-xs text-text-muted">Spectrum Analysis Suite</p>
							</div>
						</a>
					</div>
					
					<!-- Desktop Navigation -->
					<nav class="hidden lg:flex items-center space-x-8">
						<a href="#dashboard" class="nav-link active font-medium text-body">Dashboard</a>
						<a href="#scanner" class="nav-link font-medium text-body">Frequency Scanner</a>
						<a href="#analysis" class="nav-link font-medium text-body">Signal Analysis</a>
						<a href="#settings" class="nav-link font-medium text-body">Settings</a>
						<a href="#help" class="nav-link font-medium text-body">Help</a>
					</nav>
				</div>
				
				<div class="flex items-center space-x-4">
					<!-- Connection Status (Desktop) -->
					<div class="hidden lg:flex items-center space-x-4">
						<div class="flex items-center space-x-2 px-4 py-2 glass-panel-light rounded-lg">
							<span class="font-mono text-xs text-text-muted uppercase tracking-wider">Status:</span>
							<div class="flex items-center space-x-2">
								<div class="status-indicator {$connectionStatus.connected ? 'status-connected' : $connectionStatus.connecting ? 'status-connecting' : 'status-disconnected'}"></div>
								<span class="font-mono text-xs text-text-secondary">
									{$connectionStatus.connected ? 'Connected' : $connectionStatus.connecting ? 'Connecting' : 'Disconnected'}
								</span>
							</div>
						</div>
						<button on:click={openSpectrumAnalyzer} class="saasfly-button-primary flex items-center space-x-2">
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
								<path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"/>
								<path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"/>
							</svg>
							<span>Spectrum Viewer</span>
						</button>
					</div>

					<!-- Mobile Menu Button -->
					<button on:click={toggleMobileMenu} class="lg:hidden p-2 glass-button rounded-lg">
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Mobile Navigation Menu -->
			{#if mobileMenuOpen}
				<MobileMenu on:close={() => mobileMenuOpen = false} />
			{/if}
		</div>
	</div>
	<!-- Scanning line effect -->
	<div class="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-[scan_3s_ease-in-out_infinite]"></div>
</header>
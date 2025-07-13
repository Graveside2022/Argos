<script lang="ts">
	import { goto } from '$app/navigation';

	function navigateToViewSpectrum() {
		void goto('/viewspectrum');
	}

	function navigateToHackRFSweep() {
		void goto('/hackrfsweep');
	}

	function navigateToWigleToTAK() {
		void goto('/wigletotak');
	}

	function navigateToKismet() {
		void goto('/kismet');
	}

	function navigateToTacticalMap() {
		void goto('/tactical-map-simple');
	}
</script>

<svelte:head>
	<meta name="description" content="Tactical Intelligence Platform - Mission Selection Console" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
		rel="stylesheet"
	/>
	<title>Argos Console - Mission Select</title>
</svelte:head>

<div class="app-container">
	<div class="console-background"></div>
	<div class="grid-overlay"></div>

	<header class="console-header">
		<h1 class="console-title">
			<span style="color: #fb923c;">Argos</span>
			<span style="color: var(--text-primary);">Console</span>
		</h1>
		<p class="console-subtitle">Tactical Intelligence Platform</p>
	</header>

	<div class="mission-grid">
		<div
			class="mission-card mission-wifi"
			on:click={navigateToKismet}
			role="button"
			tabindex="0"
			on:keydown={(e) => e.key === 'Enter' && navigateToKismet()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.07 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
				></path>
			</svg>
			<h2 class="mission-title">Kismet</h2>
			<p class="mission-desc">Wireless Network Discovery</p>
		</div>

		<div
			class="mission-card mission-location"
			on:click={navigateToTacticalMap}
			role="button"
			tabindex="0"
			on:keydown={(e) => e.key === 'Enter' && navigateToTacticalMap()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
				></path>
			</svg>
			<h2 class="mission-title">Tactical Map</h2>
			<p class="mission-desc">Signal Visualization</p>
		</div>

		<div
			class="mission-card mission-spectrum"
			on:click={navigateToHackRFSweep}
			role="button"
			tabindex="0"
			on:keydown={(e) => e.key === 'Enter' && navigateToHackRFSweep()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path d="M4 20v-2h2v2H4zm4 0v-5h2v5H8zm4 0V10h2v10h-2zm4 0V4h2v16h-2z"></path>
			</svg>
			<h2 class="mission-title">
				<span style="color: #fb923c;">HackRF</span>
				<span>Sweep</span>
			</h2>
			<p class="mission-desc">Spectrum Analysis</p>
		</div>

		<div
			class="mission-card mission-analyze"
			on:click={navigateToViewSpectrum}
			role="button"
			tabindex="0"
			on:keydown={(e) => e.key === 'Enter' && navigateToViewSpectrum()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
			</svg>
			<h2 class="mission-title">View Spectrum</h2>
			<p class="mission-desc">OpenWebRX Analysis Tool</p>
		</div>

		<div
			class="mission-card mission-broadcast"
			on:click={navigateToWigleToTAK}
			role="button"
			tabindex="0"
			on:keydown={(e) => e.key === 'Enter' && navigateToWigleToTAK()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path d="M5 3l3.057 3L12 9l3.943-3L19 3v18l-3.943-3L12 15l-3.057 3L5 21V3z"></path>
			</svg>
			<h2 class="mission-title">WigletoTAK</h2>
			<p class="mission-desc">Data Broadcasting</p>
		</div>

		<div class="mission-card mission-docs">
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"
				></path>
			</svg>
			<h2 class="mission-title">Documentation</h2>
			<p class="mission-desc">Coming Soon</p>
		</div>
	</div>

	<footer class="console-footer">
		<p class="footer-text">◆ Argos Console v1.0 - Tactical Intelligence Operations ◆</p>
	</footer>
</div>

<style>
	:root {
		/* Backgrounds */
		--bg-primary: #0a0a0a;
		--bg-secondary: #141414;
		--bg-card: #141414;
		--bg-hover: #2d2d2d;

		/* Mission Colors */
		--mission-wifi: #00d2ff;
		--mission-spectrum: #fb923c;
		--mission-location: #10b981;
		--mission-broadcast: #8b5cf6;

		/* Text Colors */
		--text-primary: #ffffff;
		--text-secondary: #a3a3a3;
		--text-tertiary: #737373;

		/* Borders */
		--border-primary: #262626;
		--border-hover: #404040;

		/* Typography */
		--font-heading: Inter, system-ui, -apple-system, sans-serif;
		--font-body: Inter, system-ui, -apple-system, sans-serif;
		--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', monospace;
	}

	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: var(--font-body);
		background: var(--bg-primary);
		color: var(--text-primary);
		min-height: 100vh;
		line-height: 1.6;
		overflow-x: hidden;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	:global(#svelte) {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.app-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* Animated Background */
	.console-background {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
		background:
			radial-gradient(circle at 20% 80%, rgba(0, 210, 255, 0.05) 0%, transparent 50%),
			radial-gradient(circle at 80% 20%, rgba(251, 146, 60, 0.05) 0%, transparent 50%),
			radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.03) 0%, transparent 50%),
			linear-gradient(135deg, rgba(10, 10, 10, 0.95) 0%, rgba(20, 20, 20, 0.98) 100%);
		animation: background-pulse 8s ease-in-out infinite;
	}

	.grid-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
		opacity: 0.02;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
		background-size: 40px 40px;
		animation: grid-drift 60s linear infinite;
	}

	@keyframes background-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}

	@keyframes grid-drift {
		0% {
			transform: translate(0, 0);
		}
		100% {
			transform: translate(40px, 40px);
		}
	}

	/* Header */
	.console-header {
		text-align: center;
		padding: 3rem 2rem 2rem;
		background: rgba(20, 20, 20, 0.6);
		backdrop-filter: blur(20px);
		border-bottom: 1px solid var(--border-primary);
	}

	.console-title {
		font-size: 3rem;
		font-weight: 800;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
	}

	.console-subtitle {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--text-secondary);
		margin-bottom: 1rem;
	}

	@keyframes status-blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0.5;
		}
	}

	/* Mission Grid */
	.mission-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3rem;
		max-width: 1000px;
		margin: 4rem auto;
		padding: 0 2rem;
	}

	/* Mission Cards */
	.mission-card {
		position: relative;
		background: rgba(20, 20, 20, 0.8);
		backdrop-filter: blur(12px);
		border: 2px solid var(--border-primary);
		border-radius: 16px;
		padding: 3rem 2rem;
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;
		overflow: hidden;
		min-height: 220px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.mission-card::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--mission-color), transparent);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.mission-card:hover {
		transform: translateY(-8px) scale(1.02);
		border-color: var(--mission-color);
		box-shadow:
			0 20px 40px rgba(0, 0, 0, 0.4),
			0 0 30px var(--mission-glow);
	}

	.mission-card:hover::before {
		opacity: 1;
	}

	/* Mission Card Variants */
	.mission-wifi {
		--mission-color: var(--mission-wifi);
		--mission-glow: rgba(0, 210, 255, 0.3);
	}

	.mission-spectrum {
		--mission-color: var(--mission-spectrum);
		--mission-glow: rgba(251, 146, 60, 0.3);
	}

	.mission-location {
		--mission-color: var(--mission-location);
		--mission-glow: rgba(16, 185, 129, 0.3);
	}

	.mission-broadcast {
		--mission-color: var(--mission-broadcast);
		--mission-glow: rgba(139, 92, 246, 0.3);
	}

	.mission-docs {
		--mission-color: #fbbf24;
		--mission-glow: rgba(251, 191, 36, 0.3);
	}

	.mission-analyze {
		--mission-color: #06b6d4;
		--mission-glow: rgba(6, 182, 212, 0.3);
	}

	/* Mission Icons */
	.mission-icon {
		width: 64px;
		height: 64px;
		margin-bottom: 1.5rem;
		color: var(--mission-color);
		filter: drop-shadow(0 0 10px var(--mission-glow));
		transition: all 0.3s ease;
	}

	.mission-card:hover .mission-icon {
		transform: scale(1.1);
		filter: drop-shadow(0 0 20px var(--mission-glow));
	}

	/* Mission Text */
	.mission-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin-bottom: 0.5rem;
		transition: color 0.3s ease;
	}

	.mission-card:hover .mission-title {
		color: var(--mission-color);
	}

	.mission-desc {
		font-size: 0.875rem;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mission-status-badge {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--mission-color);
		box-shadow: 0 0 10px var(--mission-glow);
		animation: status-pulse 2s ease-in-out infinite;
	}

	@keyframes status-pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(1.2);
		}
	}

	/* Footer */
	.console-footer {
		padding: 1.5rem;
		text-align: center;
		background: rgba(10, 10, 10, 0.8);
		backdrop-filter: blur(10px);
		border-top: 1px solid var(--border-primary);
		margin-top: auto;
		position: relative;
		z-index: 10;
	}

	.footer-text {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		.mission-grid {
			grid-template-columns: repeat(2, 1fr);
			gap: 2.5rem;
		}
	}

	@media (max-width: 768px) {
		.mission-grid {
			grid-template-columns: 1fr;
			gap: 2rem;
			margin: 2rem auto;
		}

		.console-title {
			font-size: 2rem;
		}

		.mission-card {
			min-height: 180px;
			padding: 2rem 1.5rem;
		}

		.mission-icon {
			width: 48px;
			height: 48px;
		}
	}

	/* Click effect */
	.mission-card:active {
		transform: translateY(-4px) scale(0.98);
	}
</style>

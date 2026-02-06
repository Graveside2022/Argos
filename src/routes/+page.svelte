<script lang="ts">
	import { goto } from '$app/navigation';

	function navigateToViewSpectrum() {
		void goto('/viewspectrum');
	}

	function navigateToRFSweep() {
		void goto('/rfsweep');
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

	function navigateToGSMEvil() {
		void goto('/gsm-evil');
	}

	function navigateToRFEmitter() {
		window.open('http://100.76.103.118:3000', '_blank');
	}

	function navigateToRTL433() {
		void goto('/rtl-433');
	}

	function navigateToDroneID() {
		void goto('/droneid');
	}

	function navigateToBettercap() {
		void goto('/bettercap');
	}

	function navigateToPagermon() {
		void goto('/pagermon');
	}

	function navigateToBTLE() {
		void goto('/btle');
	}

	function navigateToWifite() {
		void goto('/wifite');
	}

	function navigateToURH() {
		void goto('/urh');
	}

	function navigateToTempestSDR() {
		void goto('/tempestsdr');
	}
</script>

<svelte:head>
	<meta name="description" content="Tactical Intelligence Platform - Mission Selection Console" />
	<title>Argos Console - Mission Select</title>
</svelte:head>

<div class="app-container">
	<div class="console-background"></div>
	<div class="grid-overlay"></div>

	<header class="console-header">
		<h1 class="console-title">
			<span class="text-brand">Argos</span>
			<span class="text-primary">Console</span>
		</h1>
		<p class="console-subtitle">Tactical Intelligence Platform</p>
	</header>

	<div class="mission-grid">
		<div
			class="mission-card mission-wifi"
			onclick={navigateToKismet}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToKismet()}
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
			onclick={navigateToTacticalMap}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToTacticalMap()}
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
			onclick={navigateToRFSweep}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToRFSweep()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path d="M4 20v-2h2v2H4zm4 0v-5h2v5H8zm4 0V10h2v10h-2zm4 0V4h2v16h-2z"></path>
			</svg>
			<h2 class="mission-title">
				<span class="text-feature-rf">RF</span>
				<span>Sweep</span>
			</h2>
			<p class="mission-desc">Spectrum Analysis</p>
		</div>

		<div
			class="mission-card mission-analyze"
			onclick={navigateToViewSpectrum}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToViewSpectrum()}
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
			onclick={navigateToWigleToTAK}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToWigleToTAK()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path d="M5 3l3.057 3L12 9l3.943-3L19 3v18l-3.943-3L12 15l-3.057 3L5 21V3z"></path>
			</svg>
			<h2 class="mission-title">WigletoTAK</h2>
			<p class="mission-desc">Data Broadcasting</p>
		</div>

		<div
			class="mission-card mission-gsm"
			onclick={navigateToGSMEvil}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToGSMEvil()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1M12,18A1,1 0 0,0 13,17A1,1 0 0,0 12,16A1,1 0 0,0 11,17A1,1 0 0,0 12,18M8,8H16V10H8V8M8,11H13V13H8V11Z"
				></path>
			</svg>
			<h2 class="mission-title">GSM Evil</h2>
			<p class="mission-desc">Cellular Analysis</p>
		</div>
		<div
			class="mission-card mission-rtl433"
			onclick={navigateToRTL433}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToRTL433()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,12L11,7.5V16.5Z"
				></path>
			</svg>
			<h2 class="mission-title">RTL_433</h2>
			<p class="mission-desc">Signal Decoder</p>
		</div>

		<div
			class="mission-card mission-emitter"
			onclick={navigateToRFEmitter}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToRFEmitter()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path d="M13 2L8.5 13H12L11 22L15.5 11H12L13 2Z" />
			</svg>
			<h2 class="mission-title">
				<span class="text-feature-rf">RF</span>
				<span>Emitter</span>
			</h2>
			<p class="mission-desc">Signal Generation</p>
		</div>

		<div
			class="mission-card mission-droneid"
			onclick={navigateToDroneID}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToDroneID()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M21 16V14L13 9V3.5A1.5 1.5 0 0 0 11.5 2A1.5 1.5 0 0 0 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"
				></path>
			</svg>
			<h2 class="mission-title">
				<span class="text-feature-drone">Drone</span>
				<span>ID</span>
			</h2>
			<p class="mission-desc">Remote ID Detection</p>
		</div>

		<div
			class="mission-card mission-bettercap"
			onclick={navigateToBettercap}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToBettercap()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M12,1C7,1 3,5 3,10V17A3,3 0 0,0 6,20H9V12H5V10A7,7 0 0,1 12,3A7,7 0 0,1 19,10V12H15V20H18A3,3 0 0,0 21,17V10C21,5 16.97,1 12,1Z"
				></path>
			</svg>
			<h2 class="mission-title">Bettercap</h2>
			<p class="mission-desc">WiFi/BLE Recon</p>
		</div>

		<div
			class="mission-card mission-pagermon"
			onclick={navigateToPagermon}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToPagermon()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M20,2H4A2,2 0 0,0 2,4V22L6,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H5.17L4,17.17V4H20V16M11,12H13V14H11V12M11,6H13V10H11V6Z"
				></path>
			</svg>
			<h2 class="mission-title">Pagermon</h2>
			<p class="mission-desc">Pager Decoder</p>
		</div>

		<div
			class="mission-card mission-btle"
			onclick={navigateToBTLE}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToBTLE()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M14.88,16.29L13,18.17V14.41M13,5.83L14.88,7.71L13,9.58M17.71,7.71L12,2H11V9.58L6.41,5L5,6.41L10.59,12L5,17.58L6.41,19L11,14.41V22H12L17.71,16.29L13.41,12L17.71,7.71Z"
				></path>
			</svg>
			<h2 class="mission-title">BTLE</h2>
			<p class="mission-desc">BLE Sniffer</p>
		</div>

		<div
			class="mission-card mission-wifite"
			onclick={navigateToWifite}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToWifite()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M12,3C7.46,3 3.34,4.78 0.29,7.67C0.11,7.85 0,8.1 0,8.37C0,8.64 0.11,8.9 0.29,9.08L1.77,10.56C1.95,10.74 2.2,10.86 2.48,10.86C2.76,10.86 3,10.75 3.18,10.57C5.56,8.35 8.64,7 12,7C15.36,7 18.44,8.35 20.82,10.57C21,10.75 21.24,10.86 21.52,10.86C21.8,10.86 22.05,10.74 22.23,10.56L23.71,9.08C23.89,8.9 24,8.64 24,8.37C24,8.1 23.89,7.85 23.71,7.67C20.66,4.78 16.54,3 12,3M12,11C9.58,11 7.34,11.89 5.61,13.34L8.59,16.32C9.53,15.5 10.71,15 12,15C13.29,15 14.47,15.5 15.41,16.32L18.39,13.34C16.66,11.89 14.42,11 12,11M12,19A2,2 0 0,0 10,21A2,2 0 0,0 12,23A2,2 0 0,0 14,21A2,2 0 0,0 12,19"
				></path>
			</svg>
			<h2 class="mission-title">Wifite2</h2>
			<p class="mission-desc">WiFi Attacks</p>
		</div>

		<div
			class="mission-card mission-urh"
			onclick={navigateToURH}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToURH()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M7,2V4H8V18A4,4 0 0,0 12,22A4,4 0 0,0 16,18V4H17V2H7M11,16C10.4,16 10,15.6 10,15C10,14.4 10.4,14 11,14C11.6,14 12,14.4 12,15C12,15.6 11.6,16 11,16M13,12C12.4,12 12,11.6 12,11C12,10.4 12.4,10 13,10C13.6,10 14,10.4 14,11C14,11.6 13.6,12 13,12M14,7H10V4H14V7Z"
				></path>
			</svg>
			<h2 class="mission-title">
				<span class="text-feature-radio">Radio</span>
				<span>Hacker</span>
			</h2>
			<p class="mission-desc">URH Signal Analysis</p>
		</div>

		<div
			class="mission-card mission-tempestsdr"
			onclick={navigateToTempestSDR}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && navigateToTempestSDR()}
		>
			<div class="mission-status-badge"></div>
			<svg class="mission-icon" fill="currentColor" viewBox="0 0 24 24">
				<path
					d="M21,16V4H3V16H21M21,2A2,2 0 0,1 23,4V16A2,2 0 0,1 21,18H14V20H16V22H8V20H10V18H3C1.89,18 1,17.1 1,16V4C1,2.89 1.89,2 3,2H21M5,6H14V11H5V6M15,6H19V8H15V6M19,9V14H15V9H19M5,12H9V14H5V12M10,12H14V14H10V12Z"
				></path>
			</svg>
			<h2 class="mission-title">TempestSDR</h2>
			<p class="mission-desc">RF Eavesdropping</p>
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
		/* Backgrounds - Palantir */
		--bg-primary: #0e1116;
		--bg-secondary: #16181d;
		--bg-card: #1c1f26;
		--bg-hover: #25282f;

		/* Mission Colors - Palantir */
		--mission-wifi: #4a9eff;
		--mission-spectrum: #f97316;
		--mission-location: #4ade80;
		--mission-broadcast: #8b5cf6;
		--mission-gsm: #dc2626;
		--mission-rtl433: #8b5cf6;

		/* Text Colors - Palantir */
		--text-primary: #e8eaed;
		--text-secondary: #9aa0a6;
		--text-tertiary: #5f6368;

		/* Borders - Palantir */
		--border-primary: rgba(255, 255, 255, 0.1);
		--border-hover: rgba(255, 255, 255, 0.15);

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
			radial-gradient(circle at 20% 80%, rgba(74, 158, 255, 0.05) 0%, transparent 50%),
			radial-gradient(circle at 80% 20%, rgba(251, 146, 60, 0.05) 0%, transparent 50%),
			radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.03) 0%, transparent 50%),
			linear-gradient(135deg, rgba(14, 17, 22, 0.95) 0%, rgba(28, 31, 38, 0.98) 100%);
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
		background: rgba(28, 31, 38, 0.6);
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
		background: rgba(28, 31, 38, 0.8);
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
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
	}

	.mission-card:hover::before {
		opacity: 1;
	}

	/* Mission Card Variants */
	.mission-wifi {
		--mission-color: var(--mission-wifi);
		--mission-glow: rgba(74, 158, 255, 0.3);
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

	.mission-gsm {
		--mission-color: var(--mission-gsm);
		--mission-glow: rgba(255, 0, 0, 0.3);
	}

	.mission-rtl433 {
		--mission-color: var(--mission-rtl433);
		--mission-glow: rgba(139, 92, 246, 0.3);
	}

	.mission-emitter {
		--mission-color: var(--mission-spectrum);
		--mission-glow: rgba(251, 146, 60, 0.3);
	}
	.mission-droneid {
		--mission-color: #06b6d4;
		--mission-glow: rgba(6, 182, 212, 0.3);
	}

	.mission-bettercap {
		--mission-color: #10b981;
		--mission-glow: rgba(16, 185, 129, 0.3);
	}

	.mission-pagermon {
		--mission-color: #fbbf24;
		--mission-glow: rgba(251, 191, 36, 0.3);
	}

	.mission-btle {
		--mission-color: #3b82f6;
		--mission-glow: rgba(59, 130, 246, 0.3);
	}

	.mission-wifite {
		--mission-color: #ef4444;
		--mission-glow: rgba(239, 68, 68, 0.3);
	}

	.mission-urh {
		--mission-color: #a855f7;
		--mission-glow: rgba(139, 92, 246, 0.3);
	}

	.mission-tempestsdr {
		--mission-color: #f97316;
		--mission-glow: rgba(249, 115, 22, 0.3);
	}

	/* Mission Icons */
	.mission-icon {
		width: 64px;
		height: 64px;
		margin-bottom: 1.5rem;
		color: var(--mission-color);
		/* filter: drop-shadow(0 0 10px var(--mission-glow)); */
		transition: all 0.3s ease;
	}

	.mission-card:hover .mission-icon {
		transform: scale(1.1);
		/* filter: drop-shadow(0 0 20px var(--mission-glow)); */
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
		/* box-shadow: 0 0 10px var(--mission-glow); */
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
		background: rgba(14, 17, 22, 0.8);
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

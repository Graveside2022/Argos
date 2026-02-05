<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboardStore';
	import { kismetStore } from '$lib/stores/tactical-map/kismetStore';
	import { KismetService } from '$lib/services/tactical-map/kismetService';
	import ToolCard from '../shared/ToolCard.svelte';

	// Used only for start/stop actions - periodic fetching is managed at page level
	const kismetService = new KismetService();
	let kismetStatus = $derived($kismetStore.status);
	let kismetDeviceCount = $derived($kismetStore.deviceCount);

	// Tool icon SVGs (inline, 20x20, currentColor)
	const icons = {
		kismet: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>`,
		bettercap: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
		wifite: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
		wigletotak: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
		btle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>`,
		droneid: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
		gsm: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.93 4.93a10 10 0 0 1 14.14 0"/><path d="M7.76 7.76a6 6 0 0 1 8.49 0"/><line x1="12" y1="12" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`,
		hackrf: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
		pagermon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
		rfemitter: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/></svg>`,
		rtl433: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
		usrpsweep: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
		viewspectrum: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
		external: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
	};

	function openTool(viewName: string) {
		activeView.set(viewName);
	}

	// GSM Evil control
	let gsmStatus: 'stopped' | 'starting' | 'running' | 'stopping' = $state('stopped');

	async function startGSMEvil() {
		if (gsmStatus === 'starting' || gsmStatus === 'stopping') return;
		gsmStatus = 'starting';
		try {
			const res = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'start' })
			});
			if (res.ok) {
				gsmStatus = 'running';
			} else {
				gsmStatus = 'stopped';
			}
		} catch (_error: unknown) {
			gsmStatus = 'stopped';
		}
	}

	async function stopGSMEvil() {
		if (gsmStatus === 'starting' || gsmStatus === 'stopping') return;
		gsmStatus = 'stopping';
		try {
			const res = await fetch('/api/gsm-evil/control', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'stop' })
			});
			if (res.ok) {
				gsmStatus = 'stopped';
			} else {
				gsmStatus = 'running';
			}
		} catch (_error: unknown) {
			gsmStatus = 'running';
		}
	}
</script>

<div class="tools-panel">
	<header class="panel-header">
		<span class="panel-title">TOOLS</span>
	</header>

	<div class="tools-list">
		<!-- Section: WiFi & Network (alphabetized) -->
		<div class="tools-section">
			<span class="tools-section-label">WIFI & NETWORK</span>

			<ToolCard
				name="Bettercap"
				description="Network attack and monitoring framework"
				icon={icons.bettercap}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('bettercap')}
			/>

			<ToolCard
				name="Kismet WiFi"
				description="WiFi scanning, device tracking, and network intelligence"
				icon={icons.kismet}
				status={kismetStatus}
				count={kismetDeviceCount}
				onstart={() => kismetService.startKismet()}
				onstop={() => kismetService.stopKismet()}
				onopen={() => openTool('kismet')}
			/>

			<ToolCard
				name="Wifite2"
				description="Automated wireless network attack tool"
				icon={icons.wifite}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('wifite')}
			/>

			<ToolCard
				name="WigleToTAK"
				description="WiGLE data integration for TAK systems"
				icon={icons.wigletotak}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('wigletotak')}
			/>
		</div>

		<!-- Section: RF & Spectrum (alphabetized) -->
		<div class="tools-section">
			<span class="tools-section-label">RF & SPECTRUM</span>

			<ToolCard
				name="BTLE"
				description="Bluetooth Low Energy scanner and analyzer"
				icon={icons.btle}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('btle')}
			/>

			<ToolCard
				name="Drone ID"
				description="Remote drone identification and tracking"
				icon={icons.droneid}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('droneid')}
			/>

			<ToolCard
				name="GSM Evil"
				description="GSM signal monitoring and IMSI detection"
				icon={icons.gsm}
				status={gsmStatus}
				onstart={startGSMEvil}
				onstop={stopGSMEvil}
				onopen={() => openTool('gsm-evil')}
			/>

			<ToolCard
				name="HackRF Spectrum"
				description="Wideband spectrum analysis and signal hunting"
				icon={icons.hackrf}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('hackrf')}
			/>

			<ToolCard
				name="Pagermon"
				description="Pager signal monitoring and decoding"
				icon={icons.pagermon}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('pagermon')}
			/>

			<ToolCard
				name="RF Emitter"
				description="HackRF signal transmission and RF testing"
				icon={icons.rfemitter}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('rf-emitter')}
			/>

			<ToolCard
				name="RTL-433"
				description="ISM band device decoder (433 MHz)"
				icon={icons.rtl433}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('rtl-433')}
			/>

			<ToolCard
				name="USRP Sweep"
				description="USRP wideband spectrum sweep analyzer"
				icon={icons.usrpsweep}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('usrpsweep')}
			/>
		</div>

		<!-- Section: External Tools (alphabetized) -->
		<div class="tools-section">
			<span class="tools-section-label">EXTERNAL</span>

			<ToolCard
				name="OpenWebRX"
				description="SDR web interface for HackRF spectrum analysis"
				icon={icons.external}
				status="stopped"
				canOpen={true}
				showControls={false}
				onopen={() => openTool('openwebrx')}
			/>

			<ToolCard
				name="TempestSDR"
				description="TEMPEST electromagnetic eavesdropping"
				icon={icons.external}
				status="stopped"
				canOpen={true}
				showControls={false}
				externalUrl="http://localhost:8081"
			/>

			<ToolCard
				name="Universal Radio Hacker"
				description="Wireless protocol analysis"
				icon={icons.external}
				status="stopped"
				canOpen={true}
				showControls={false}
				externalUrl="http://localhost:8080"
			/>
		</div>
	</div>
</div>

<style>
	.tools-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.panel-header {
		padding: var(--space-4);
		border-bottom: 1px solid var(--palantir-border-subtle);
	}

	.panel-title {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-secondary);
	}

	.tools-list {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.tools-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.tools-section-label {
		font-size: var(--text-xs);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-widest);
		color: var(--palantir-text-tertiary);
		padding-left: var(--space-1);
	}
</style>

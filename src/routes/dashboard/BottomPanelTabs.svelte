<!--
  Bottom panel tab bar for the dashboard.
  Extracted from +page.svelte to comply with Article 2.2 (max 300 lines/file).
-->
<script lang="ts">
	import { activeBottomTab, closeBottomPanel } from '$lib/stores/dashboard/dashboard-store';

	interface Props {
		activeTab: string | null;
	}

	let { activeTab }: Props = $props();
</script>

<!-- @constitutional-exemption Article-IV-4.2 issue:#12 — Tab buttons use custom styling tightly coupled to panel layout; shadcn Tabs component incompatible with split tab-bar/panel-content architecture -->
<div class="bottom-panel-tabs">
	<div class="tab-list">
		<!-- Terminal Tab -->
		<button
			class="panel-tab"
			class:active={activeTab === 'terminal'}
			onclick={() => activeBottomTab.set('terminal')}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
			</svg>
			Terminal
		</button>

		<!-- Logs Tab -->
		<button
			class="panel-tab"
			class:active={activeTab === 'logs'}
			onclick={() => activeBottomTab.set('logs')}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path
					d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
				/>
				<line x1="12" y1="8" x2="20" y2="8" />
				<line x1="8" y1="12" x2="20" y2="12" />
				<line x1="16" y1="16" x2="20" y2="16" />
			</svg>
			Logs
		</button>

		<!-- GSM Evil Tab -->
		<button
			class="panel-tab"
			class:active={activeTab === 'gsm-evil'}
			onclick={() => activeBottomTab.set('gsm-evil')}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline
					points="17 2 12 7 7 2"
				></polyline>
			</svg>
			GSM Evil
		</button>

		<!-- Kismet Tab (Internal: devices) -->
		<button
			class="panel-tab"
			class:active={activeTab === 'devices'}
			onclick={() => activeBottomTab.set('devices')}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line
					x1="8"
					y1="18"
					x2="21"
					y2="18"
				/>
				<circle cx="4" cy="6" r="1" fill="currentColor" /><circle
					cx="4"
					cy="12"
					r="1"
					fill="currentColor"
				/><circle cx="4" cy="18" r="1" fill="currentColor" />
			</svg>
			Kismet
		</button>

		<!-- Chat Tab (Hidden unless active) -->
		{#if activeTab === 'chat'}
			<button class="panel-tab active" onclick={() => activeBottomTab.set('chat')}>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
				Agent Chat
			</button>
		{/if}
	</div>
	<button class="tab-close-btn" title="Close panel" onclick={closeBottomPanel}>
		<svg
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg
		>
	</button>
</div>

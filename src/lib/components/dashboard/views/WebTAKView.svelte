<script lang="ts">
	import { activeView } from '$lib/stores/dashboard/dashboard-store';

	import ToolViewWrapper from './ToolViewWrapper.svelte';

	const saved = typeof window !== 'undefined' ? localStorage.getItem('argos-webtak-url') : null;
	let inputUrl = $state(saved || '');
	let iframeSrc = $state('');
	let loadFailed = $state(false);

	function goBack() {
		activeView.set('map');
	}

	function loadPage() {
		const trimmed = inputUrl.trim().replace(/\/+$/, '');
		if (!trimmed) return;
		localStorage.setItem('argos-webtak-url', trimmed);
		loadFailed = false;
		iframeSrc = trimmed;
	}

	function changeUrl() {
		inputUrl = iframeSrc;
		iframeSrc = '';
		loadFailed = false;
	}

	function openInNewTab() {
		window.open(iframeSrc, '_blank');
	}

	function refreshIframe() {
		const current = iframeSrc;
		iframeSrc = '';
		requestAnimationFrame(() => {
			iframeSrc = current;
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') loadPage();
	}

	function handleIframeError() {
		loadFailed = true;
	}
</script>

<ToolViewWrapper title="WebTAK — Team Awareness Kit" onBack={goBack}>
	{#snippet actions()}
		{#if iframeSrc}
			<button class="action-btn" onclick={refreshIframe}>Refresh</button>
			<button class="action-btn" onclick={openInNewTab}>Open in Tab</button>
			<button class="action-btn" onclick={changeUrl}>Change URL</button>
		{/if}
	{/snippet}

	{#if !iframeSrc}
		<div class="url-form">
			<div class="url-form-card">
				<h3 class="url-form-title">TAK Server Connection</h3>
				<p class="url-form-desc">
					Enter the URL of your TAK Server (e.g. https://10.3.1.5:8446)
				</p>
				<div class="url-input-row">
					<input
						type="text"
						class="url-input"
						bind:value={inputUrl}
						onkeydown={handleKeydown}
						placeholder="https://10.3.1.5:8446"
					/>
					<button class="go-btn" onclick={loadPage} disabled={!inputUrl.trim()}>Go</button
					>
				</div>
			</div>
		</div>
	{:else}
		<div class="iframe-container">
			<iframe
				src={iframeSrc}
				title="WebTAK Team Awareness Kit"
				class="webtak-iframe"
				allow="cross-origin-isolated"
				onerror={handleIframeError}
			></iframe>
			{#if loadFailed}
				<div class="cert-overlay">
					<div class="cert-card">
						<h3 class="cert-title">Page Failed to Load</h3>
						<p class="cert-desc">
							HTTPS sites with self-signed certificates cannot load inside an embedded
							frame. Open the page in a new tab first to accept the certificate, then
							return here.
						</p>
						<button class="go-btn" onclick={openInNewTab}>Open in New Tab</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</ToolViewWrapper>

<style>
	.iframe-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.webtak-iframe {
		width: 100%;
		height: 100%;
		border: none;
		background: var(--background);
	}

	.cert-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--background);
	}

	.cert-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		max-width: 480px;
		width: 100%;
	}

	.cert-title {
		font-family: 'Fira Code', monospace;
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}

	.cert-desc {
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		color: var(--muted-foreground);
		text-align: center;
		margin: 0;
		line-height: 1.6;
	}

	.url-form {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--background);
	}

	.url-form-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 32px;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 8px;
		max-width: 480px;
		width: 100%;
	}

	.url-form-title {
		font-family: 'Fira Code', monospace;
		font-size: 13px;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 1.2px;
	}

	.url-form-desc {
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		color: var(--muted-foreground);
		text-align: center;
		margin: 0;
	}

	.url-input-row {
		display: flex;
		gap: 8px;
		width: 100%;
	}

	.url-input {
		flex: 1;
		padding: 8px 12px;
		font-family: 'Fira Code', monospace;
		font-size: 12px;
		color: var(--foreground);
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 4px;
		outline: none;
	}

	.url-input:focus {
		border-color: var(--primary);
	}

	.url-input::placeholder {
		color: var(--muted-foreground);
	}

	.go-btn {
		padding: 8px 16px;
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--primary-foreground);
		background: var(--primary);
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.go-btn:hover {
		opacity: 0.9;
	}

	.go-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.action-btn {
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--muted-foreground);
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 4px 10px;
		cursor: pointer;
	}

	.action-btn:hover {
		color: var(--foreground);
		border-color: var(--foreground);
	}
</style>

<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	import { takStatus } from '$lib/stores/tak-store';

	// Types
	interface TakConfig {
		id?: string;
		name: string;
		hostname: string;
		port: number;
		protocol: 'tcp' | 'tls';
		certPath?: string;
		keyPath?: string;
		caPath?: string;
		connectOnStartup: boolean;
	}

	let config: TakConfig = $state({
		name: 'TAK Server',
		hostname: '127.0.0.1',
		port: 8087,
		protocol: 'tcp',
		connectOnStartup: true
	});

	let isLoading = $state(false);
	let message = $state('');
	let p12File: FileList | undefined = $state();
	let p12Password = $state('');
	let uploadStatus = $state('');
	let ws: WebSocket;

	onMount(async () => {
		// Load config
		try {
			const res = await fetch('/api/tak/config');
			const data = await res.json();
			if (data && data.id) {
				config = data;
			}

			// Connect to WebSocket for status updates if not already handled globally
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			ws = new WebSocket(`${protocol}//${window.location.host}/api/kismet/ws?token=ignored`);
			ws.onmessage = (event) => {
				const msg = JSON.parse(event.data);
				if (msg.type === 'tak_status') {
					takStatus.set(msg.data);
				}
			};
		} catch (err) {
			console.error(err);
		}
	});

	onDestroy(() => {
		if (ws) ws.close();
	});

	async function save() {
		isLoading = true;
		try {
			const res = await fetch('/api/tak/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			});
			const data = await res.json();
			if (data.config) {
				config = data.config;
				message = 'Saved successfully';
			}
		} catch (err) {
			console.error(err);
			message = 'Error saving';
		} finally {
			isLoading = false;
		}
	}

	async function uploadCert() {
		if (!p12File || p12File.length === 0 || !p12Password) {
			uploadStatus = 'Select file and enter password';
			return;
		}

		const formData = new FormData();
		formData.append('p12File', p12File[0]);
		formData.append('password', p12Password);
		if (config.id) {
			formData.append('id', config.id);
		}

		uploadStatus = 'Uploading...';
		try {
			const res = await fetch('/api/tak/certs', {
				method: 'POST',
				body: formData
			});
			const data = await res.json();
			if (data.success) {
				uploadStatus = 'Upload successful';
				// Update config paths
				config.id = data.id;
				config.certPath = data.paths.certPath;
				config.keyPath = data.paths.keyPath;
				config.caPath = data.paths.caPath;
				config.protocol = 'tls';
				save();
			} else {
				uploadStatus = 'Upload failed: ' + data.error;
			}
		} catch (err) {
			console.error(err);
			uploadStatus = 'Error uploading';
		}
	}
</script>

<div class="page-container">
	<header class="page-header">
		<h1>TAK Integration</h1>
		<p>Configure connection to Tactical Assault Kit (TAK) Server</p>
	</header>

	<div class="settings-grid">
		<section class="card config-card">
			<h2>Server Configuration</h2>

			<div class="field-group">
				<label>Server Name</label>
				<input type="text" bind:value={config.name} placeholder="My TAK Server" />
			</div>

			<div class="row">
				<div class="field-group">
					<label>Hostname / IP</label>
					<input type="text" bind:value={config.hostname} placeholder="192.168.1.10" />
				</div>
				<div class="field-group port">
					<label>Port</label>
					<input type="number" bind:value={config.port} placeholder="8087" />
				</div>
			</div>

			<div class="field-group">
				<label>Protocol</label>
				<select bind:value={config.protocol}>
					<option value="tcp">TCP (Unencrypted)</option>
					<option value="tls">TLS (Mutual Auth)</option>
				</select>
			</div>

			<div class="field-group checkbox">
				<label>
					<input type="checkbox" bind:checked={config.connectOnStartup} />
					Connect on Startup
				</label>
			</div>

			<div class="actions">
				<button class="primary" onclick={save} disabled={isLoading}>
					{isLoading ? 'Saving...' : 'Save Configuration'}
				</button>
				<span class="message">{message}</span>
			</div>
		</section>

		<section class="card cert-card">
			<h2>Certificates (.p12)</h2>
			<p class="hint">
				Upload a .p12 file containing client certificate and key for mutual TLS.
			</p>

			<div class="field-group">
				<label>P12 File</label>
				<input type="file" accept=".p12" bind:files={p12File} />
			</div>

			<div class="field-group">
				<label>Password</label>
				<input type="password" bind:value={p12Password} placeholder="P12 Password" />
			</div>

			<button class="secondary" onclick={uploadCert}>Upload & Extract</button>
			<span class="status">{uploadStatus}</span>

			{#if config.certPath}
				<div class="cert-status success">
					<span>✓ Certificates Installed</span>
					<small>ID: {config.id}</small>
				</div>
			{/if}
		</section>

		<section class="card status-card">
			<h2>Connection Status</h2>
			<div class="status-indicator {$takStatus.status}">
				<span class="dot"></span>
				<span class="text">{$takStatus.status.toUpperCase()}</span>
			</div>
		</section>
	</div>
</div>

<style>
	.page-container {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
		color: var(--palantir-text-primary);
	}

	.page-header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.page-header p {
		color: var(--palantir-text-secondary);
		margin-bottom: 2rem;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.card {
		background: var(--palantir-bg-elevated);
		border: 1px solid var(--palantir-border-default);
		border-radius: 6px;
		padding: 1.5rem;
	}

	h2 {
		font-size: 1.1rem;
		font-weight: 500;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--palantir-border-subtle);
		padding-bottom: 0.5rem;
	}

	.field-group {
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	label {
		font-size: 0.85rem;
		color: var(--palantir-text-secondary);
	}

	input[type='text'],
	input[type='number'],
	input[type='password'],
	select {
		background: var(--palantir-bg-default);
		border: 1px solid var(--palantir-border-default);
		padding: 0.5rem;
		border-radius: 4px;
		color: var(--palantir-text-primary);
	}

	.row {
		display: flex;
		gap: 1rem;
	}

	.port {
		flex: 0 0 100px;
	}

	.checkbox {
		flex-direction: row;
		align-items: center;
	}

	button {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	button.primary {
		background: var(--palantir-accent);
		color: var(--palantir-text-on-accent);
	}

	button.secondary {
		background: var(--palantir-bg-subtle);
		color: var(--palantir-text-primary);
		border: 1px solid var(--palantir-border-default);
	}

	button:hover {
		opacity: 0.9;
	}

	.hint {
		font-size: 0.8rem;
		color: var(--palantir-text-tertiary);
		margin-bottom: 1rem;
	}

	.cert-status {
		margin-top: 1rem;
		padding: 0.5rem;
		background: rgba(16, 185, 129, 0.1);
		border: 1px solid rgba(16, 185, 129, 0.2);
		color: #10b981;
		border-radius: 4px;
		display: flex;
		flex-direction: column;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--palantir-error);
	}

	.status-indicator.connected .dot {
		background: var(--palantir-success);
		box-shadow: 0 0 8px var(--palantir-success);
	}
	/* Palantir Theme Colors - fallback if variables missing */
	:root {
		--palantir-bg-default: #1c2128;
		--palantir-bg-elevated: #2d333b;
		--palantir-border-default: #444c56;
		--palantir-border-subtle: #373e47;
		--palantir-text-primary: #adbac7;
		--palantir-text-secondary: #768390;
		--palantir-accent: #238636;
		--palantir-text-on-accent: #ffffff;
	}
</style>

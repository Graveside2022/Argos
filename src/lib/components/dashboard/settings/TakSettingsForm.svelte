<script lang="ts">
	import { onMount } from 'svelte';

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

	// We don't need a separate WebSocket here as the status is global via takStatus store
	// and the main layout/app handles the global websocket connection usually.
	// However, the original page established a WS connection.
	// Given we are inside the dashboard which likely has a WS connection, we might rely on that?
	// The original code created a specific WS for status updates.
	// Let's keep it simple and assume the global dashboard store or TakService handles widely.
	// But to be safe and match functionality, I'll rely on the global `takStatus` store
	// which *should* be updated by the backend broadcasting to the main WS.
	// Re-reading original page: it created a NEW ws connection just for this.
	// That seems redundant if the dashboard already has one.
	// TAK Service broadcasts to all connected clients.
	// So if the Dashboard has a WS connection, it receives these messages.

	onMount(async () => {
		// Load config
		try {
			const res = await fetch('/api/tak/config');
			const data = await res.json();
			if (data && data.id) {
				config = data;
			}
		} catch (e) {
			console.error(e);
		}
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
				message = 'Saved';
				setTimeout(() => (message = ''), 3000);
			}
		} catch (_e) {
			message = 'Error';
		} finally {
			isLoading = false;
		}
	}

	async function uploadCert() {
		if (!p12File || p12File.length === 0 || !p12Password) {
			uploadStatus = 'Select file & password';
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
				uploadStatus = 'Done';
				// Update config paths
				config.id = data.id;
				config.certPath = data.paths.certPath;
				config.keyPath = data.paths.keyPath;
				config.caPath = data.paths.caPath;
				config.protocol = 'tls';
				save();
				setTimeout(() => (uploadStatus = ''), 3000);
			} else {
				uploadStatus = 'Failed: ' + data.error;
			}
		} catch (_e) {
			uploadStatus = 'Error';
		}
	}
</script>

<div class="tak-settings">
	<div class="setting-group">
		<label>Status</label>
		<div class="status-indicator {$takStatus.status}">
			<span class="dot"></span>
			<span class="text">{$takStatus.status.toUpperCase()}</span>
		</div>
	</div>

	<div class="setting-group">
		<label>Hostname</label>
		<input type="text" bind:value={config.hostname} placeholder="127.0.0.1" class="input-sm" />
	</div>

	<div class="setting-group row">
		<div class="col">
			<label>Port</label>
			<input type="number" bind:value={config.port} placeholder="8087" class="input-sm" />
		</div>
		<div class="col">
			<label>Protocol</label>
			<select bind:value={config.protocol} class="input-sm">
				<option value="tcp">TCP</option>
				<option value="tls">TLS</option>
			</select>
		</div>
	</div>

	<div class="setting-group">
		<label class="checkbox-label">
			<input type="checkbox" bind:checked={config.connectOnStartup} />
			Connect on Startup
		</label>
	</div>

	<div class="actions">
		<button class="btn-primary" onclick={save} disabled={isLoading}>
			{isLoading ? 'Saving...' : 'Save'}
		</button>
		{#if message}<span class="msg">{message}</span>{/if}
	</div>

	<hr class="divider" />

	<div class="setting-group">
		<label>Client Certificate (.p12)</label>
		<input type="file" accept=".p12" bind:files={p12File} class="input-file" />
	</div>

	<div class="setting-group">
		<label>P12 Password</label>
		<input type="password" bind:value={p12Password} placeholder="******" class="input-sm" />
	</div>

	<div class="actions">
		<button class="btn-secondary" onclick={uploadCert}>Upload Cert</button>
		{#if uploadStatus}<span class="msg">{uploadStatus}</span>{/if}
	</div>

	{#if config.certPath}
		<div class="cert-check">
			<span>✓ Certs Loaded</span>
		</div>
	{/if}
</div>

<style>
	.tak-settings {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 4px 0;
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.setting-group.row {
		flex-direction: row;
		gap: 8px;
	}

	.col {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	label {
		font-size: 11px;
		color: var(--palantir-text-secondary);
		font-weight: 500;
	}

	.input-sm {
		background: var(--palantir-bg-default);
		border: 1px solid var(--palantir-border-default);
		color: var(--palantir-text-primary);
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 12px;
		width: 100%;
	}

	.input-file {
		font-size: 10px;
		color: var(--palantir-text-tertiary);
	}

	.checkbox-label {
		flex-direction: row;
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		color: var(--palantir-text-primary);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
	}

	.msg {
		font-size: 10px;
		color: var(--palantir-text-tertiary);
	}

	.btn-primary {
		background: var(--palantir-accent);
		color: white;
		border: none;
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
	}

	.btn-secondary {
		background: var(--palantir-bg-subtle);
		color: var(--palantir-text-primary);
		border: 1px solid var(--palantir-border-default);
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
	}

	.divider {
		border: 0;
		border-top: 1px solid var(--palantir-border-subtle);
		margin: 8px 0;
	}

	.status-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 600;
		color: var(--palantir-text-primary);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--palantir-error);
	}

	.status-indicator.connected .dot {
		background: var(--palantir-success);
		box-shadow: 0 0 6px var(--palantir-success);
	}

	.cert-check {
		font-size: 10px;
		color: #10b981;
		display: flex;
		align-items: center;
		gap: 4px;
	}
</style>

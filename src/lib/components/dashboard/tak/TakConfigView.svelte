<script lang="ts">
	import { untrack } from 'svelte';

	import ToolViewWrapper from '$lib/components/dashboard/views/ToolViewWrapper.svelte';
	import { activeView } from '$lib/stores/dashboard/dashboard-store';
	import { takStatus } from '$lib/stores/tak-store';
	import type { TakServerConfig } from '$lib/types/tak';

	const DEFAULT_CONFIG: TakServerConfig = {
		id: '',
		name: 'TAK Server',
		hostname: '',
		port: 8089,
		protocol: 'tls',
		connectOnStartup: false,
		authMethod: 'import',
		truststorePass: 'atakatak',
		certPass: 'atakatak',
		enrollmentPort: 8446
	};

	let config: TakServerConfig = $state({ ...DEFAULT_CONFIG });
	let isLoading = $state(false);
	let isSaving = $state(false);
	let message = $state('');
	let messageType: 'success' | 'error' = $state('success');

	// Certificate upload state
	let p12File: FileList | undefined = $state();
	let p12Password = $state('');
	let uploadStatus = $state('');

	// Truststore upload state
	let truststoreFile: FileList | undefined = $state();
	let truststoreStatus = $state('');

	// Enrollment state
	let enrollStatus = $state('');
	let isEnrolling = $state(false);

	// Data package state
	let packageFile: FileList | undefined = $state();
	let packageStatus = $state('');

	// Load config once on mount (untrack prevents re-runs when state changes)
	$effect(() => {
		untrack(() => loadConfig());
	});

	async function loadConfig() {
		isLoading = true;
		try {
			const res = await fetch('/api/tak/config');
			const data = await res.json();
			if (data && data.id) {
				config = data;
			}
		} catch (e) {
			console.error('[TakConfigView] Failed to load config:', e);
		} finally {
			isLoading = false;
		}
	}

	async function saveConfig() {
		isSaving = true;
		try {
			if (!config.id) config.id = crypto.randomUUID();
			const res = await fetch('/api/tak/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config)
			});
			const data = await res.json();
			if (data.success && data.config) {
				config = data.config;
				showMessage('Configuration saved', 'success');
			} else {
				showMessage(data.error ?? 'Save failed', 'error');
			}
		} catch {
			showMessage('Failed to save configuration', 'error');
		} finally {
			isSaving = false;
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
		if (config.id) formData.append('id', config.id);

		uploadStatus = 'Uploading...';
		try {
			const res = await fetch('/api/tak/certs', { method: 'POST', body: formData });
			const data = await res.json();
			if (data.success) {
				config.id = data.id;
				config.certPath = data.paths.certPath;
				config.keyPath = data.paths.keyPath;
				config.caPath = data.paths.caPath;
				uploadStatus = 'Certificate uploaded';
				await saveConfig();
			} else {
				uploadStatus = 'Failed: ' + (data.error ?? 'Unknown error');
			}
		} catch {
			uploadStatus = 'Upload error';
		}
	}

	async function uploadTruststore() {
		if (!truststoreFile || truststoreFile.length === 0) {
			truststoreStatus = 'Select a .p12 file';
			return;
		}
		const formData = new FormData();
		formData.append('p12File', truststoreFile[0]);
		formData.append('password', config.truststorePass);
		if (config.id) formData.append('id', config.id);

		truststoreStatus = 'Validating...';
		try {
			const res = await fetch('/api/tak/truststore', { method: 'POST', body: formData });
			const data = await res.json();
			if (data.success) {
				config.truststorePath = data.paths.truststorePath;
				if (data.paths.caPath) config.caPath = data.paths.caPath;
				if (data.id) config.id = data.id;
				truststoreStatus = 'Truststore validated';
				await saveConfig();
			} else {
				truststoreStatus = data.error ?? 'Invalid truststore file';
			}
		} catch {
			truststoreStatus = 'Upload error';
		}
	}

	async function enrollCertificate() {
		if (!config.hostname || !config.enrollmentUser || !config.enrollmentPass) {
			enrollStatus = 'Fill hostname, username, and password';
			return;
		}
		isEnrolling = true;
		enrollStatus = 'Enrolling...';
		try {
			const res = await fetch('/api/tak/enroll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hostname: config.hostname,
					port: config.enrollmentPort,
					username: config.enrollmentUser,
					password: config.enrollmentPass,
					id: config.id || crypto.randomUUID()
				})
			});
			const data = await res.json();
			if (data.success) {
				config.id = data.id;
				config.certPath = data.paths.certPath;
				config.keyPath = data.paths.keyPath;
				if (data.paths.caPath) config.caPath = data.paths.caPath;
				enrollStatus = 'Enrollment successful';
				await saveConfig();
			} else {
				enrollStatus = data.error ?? 'Enrollment failed';
			}
		} catch {
			enrollStatus = 'Enrollment error';
		} finally {
			isEnrolling = false;
		}
	}

	async function importDataPackage() {
		if (!packageFile || packageFile.length === 0) {
			packageStatus = 'Select a .zip file';
			return;
		}
		const formData = new FormData();
		formData.append('packageFile', packageFile[0]);
		if (config.id) formData.append('id', config.id);

		packageStatus = 'Importing...';
		try {
			const res = await fetch('/api/tak/import-package', { method: 'POST', body: formData });
			const data = await res.json();
			if (data.success) {
				if (data.config.hostname) config.hostname = data.config.hostname;
				if (data.config.port) config.port = data.config.port;
				if (data.config.description) config.name = data.config.description;
				if (data.config.truststorePath) config.truststorePath = data.config.truststorePath;
				if (data.id) config.id = data.id;
				packageStatus = data.warning ?? 'Package imported';
				await saveConfig();
			} else {
				packageStatus = data.error ?? 'Import failed';
			}
		} catch {
			packageStatus = 'Import error';
		}
	}

	function showMessage(text: string, type: 'success' | 'error') {
		message = text;
		messageType = type;
		setTimeout(() => (message = ''), 4000);
	}

	function goBack() {
		activeView.set('map');
	}
</script>

<ToolViewWrapper
	title="TAK Server Configuration"
	status={$takStatus.status === 'connected' ? 'Connected' : ''}
	onBack={goBack}
>
	<div class="tak-config-scroll">
		{#if isLoading}
			<div class="loading">Loading configuration...</div>
		{:else}
			<!-- Status -->
			<div class="field-group">
				<span class="section-label">STATUS</span>
				<div class="status-row">
					<span class="dot {$takStatus.status}"></span>
					<span class="status-text">{$takStatus.status.toUpperCase()}</span>
					{#if $takStatus.serverHost}
						<span class="status-host">{$takStatus.serverHost}:{config.port}</span>
					{/if}
				</div>
			</div>

			<!-- Server Info -->
			<div class="field-group">
				<span class="section-label">SERVER</span>
				<label>
					Description
					<input type="text" bind:value={config.name} placeholder="Unit TAK Server" />
				</label>
				<div class="row">
					<label class="flex-2">
						Hostname / IP
						<input
							type="text"
							bind:value={config.hostname}
							placeholder="192.168.1.100"
						/>
					</label>
					<label class="flex-1">
						Port
						<input type="number" bind:value={config.port} placeholder="8089" />
					</label>
				</div>
				<label class="checkbox-row">
					<input type="checkbox" bind:checked={config.connectOnStartup} />
					Connect on startup
				</label>
			</div>

			<!-- Authentication Method -->
			<div class="field-group">
				<span class="section-label">AUTHENTICATION</span>
				<div class="radio-group">
					<label class="radio-row">
						<input type="radio" bind:group={config.authMethod} value="import" />
						Import Certificate (.p12)
					</label>
					<label class="radio-row">
						<input type="radio" bind:group={config.authMethod} value="enroll" />
						Enroll for Certificate
					</label>
				</div>
			</div>

			<!-- Import Section (shown when authMethod === 'import') -->
			{#if config.authMethod === 'import'}
				<div class="field-group">
					<span class="section-label">CLIENT CERTIFICATE</span>
					<label>
						Certificate File (.p12)
						<input type="file" accept=".p12" bind:files={p12File} class="file-input" />
					</label>
					<label>
						Certificate Password
						<input type="password" bind:value={p12Password} placeholder="atakatak" />
					</label>
					<div class="actions-row">
						<button class="btn btn-secondary" onclick={uploadCert}
							>Upload Certificate</button
						>
						{#if uploadStatus}<span class="msg">{uploadStatus}</span>{/if}
					</div>
					{#if config.certPath}
						<div class="cert-status">Certificates loaded</div>
					{/if}
				</div>
			{/if}

			<!-- Enrollment Section (shown when authMethod === 'enroll') -->
			{#if config.authMethod === 'enroll'}
				<div class="field-group">
					<span class="section-label">ENROLLMENT</span>
					<label>
						Username
						<input
							type="text"
							bind:value={config.enrollmentUser}
							placeholder="tak-user"
						/>
					</label>
					<label>
						Password
						<input
							type="password"
							bind:value={config.enrollmentPass}
							placeholder="Enrollment password"
						/>
					</label>
					<label>
						Enrollment Port
						<input
							type="number"
							bind:value={config.enrollmentPort}
							placeholder="8446"
						/>
					</label>
				</div>
			{/if}

			<!-- Enrollment trigger -->
			{#if config.authMethod === 'enroll'}
				<div class="actions-row">
					<button
						class="btn btn-secondary"
						onclick={enrollCertificate}
						disabled={isEnrolling}
					>
						{isEnrolling ? 'Enrolling...' : 'Enroll Now'}
					</button>
					{#if enrollStatus}<span class="msg">{enrollStatus}</span>{/if}
				</div>
			{/if}

			<!-- Truststore (always visible for TLS) -->
			<div class="field-group">
				<span class="section-label">TRUST STORE</span>
				<label>
					Truststore File (.p12)
					<input
						type="file"
						accept=".p12"
						bind:files={truststoreFile}
						class="file-input"
					/>
				</label>
				<label>
					Truststore Password
					<input
						type="password"
						bind:value={config.truststorePass}
						placeholder="atakatak"
					/>
				</label>
				<div class="actions-row">
					<button class="btn btn-secondary" onclick={uploadTruststore}
						>Upload Truststore</button
					>
					{#if truststoreStatus}<span class="msg">{truststoreStatus}</span>{/if}
				</div>
				{#if config.truststorePath}
					<div class="cert-status">Truststore loaded</div>
				{/if}
			</div>

			<!-- Data Package Import -->
			<div class="field-group">
				<span class="section-label">DATA PACKAGE</span>
				<label>
					TAK Data Package (.zip)
					<input type="file" accept=".zip" bind:files={packageFile} class="file-input" />
				</label>
				<div class="actions-row">
					<button class="btn btn-secondary" onclick={importDataPackage}
						>Import Package</button
					>
					{#if packageStatus}<span class="msg">{packageStatus}</span>{/if}
				</div>
			</div>

			<!-- Save -->
			<div class="actions-row primary-actions">
				<button class="btn btn-primary" onclick={saveConfig} disabled={isSaving}>
					{isSaving ? 'Saving...' : 'Save Configuration'}
				</button>
				{#if message}
					<span class="msg {messageType}">{message}</span>
				{/if}
			</div>
		{/if}
	</div>
</ToolViewWrapper>

<style>
	.tak-config-scroll {
		padding: var(--space-4);
		overflow-y: auto;
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.loading {
		color: var(--palantir-text-tertiary);
		font-size: 12px;
		padding: 20px 0;
	}
	.field-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.section-label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		color: var(--palantir-text-tertiary);
	}
	.status-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--palantir-text-tertiary);
		flex-shrink: 0;
	}
	.dot.connected {
		background: var(--palantir-success, #10b981);
		box-shadow: 0 0 6px var(--palantir-success, #10b981);
	}
	.dot.error {
		background: var(--palantir-error, #ef4444);
	}
	.status-text {
		font-weight: 600;
		color: var(--palantir-text-primary);
	}
	.status-host {
		color: var(--palantir-text-secondary);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
		font-size: 11px;
		color: var(--palantir-text-secondary);
		font-weight: 500;
	}
	input[type='text'],
	input[type='number'],
	input[type='password'] {
		background: var(--palantir-bg-default);
		border: 1px solid var(--palantir-border-default);
		color: var(--palantir-text-primary);
		padding: 5px 8px;
		border-radius: 4px;
		font-size: 12px;
		width: 100%;
	}
	.file-input {
		font-size: 10px;
		color: var(--palantir-text-tertiary);
	}
	.row {
		display: flex;
		gap: 8px;
	}
	.flex-1 {
		flex: 1;
	}
	.flex-2 {
		flex: 2;
	}
	.checkbox-row {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		color: var(--palantir-text-primary);
	}
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.radio-row {
		flex-direction: row;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		color: var(--palantir-text-primary);
		font-size: 12px;
	}
	.actions-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.primary-actions {
		padding-top: 8px;
		border-top: 1px solid var(--palantir-border-subtle);
	}
	.btn {
		border: none;
		padding: 5px 14px;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		font-weight: 500;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-primary {
		background: var(--palantir-accent, #4a9eff);
		color: white;
	}
	.btn-secondary {
		background: var(--palantir-bg-subtle);
		color: var(--palantir-text-primary);
		border: 1px solid var(--palantir-border-default);
	}
	.msg {
		font-size: 10px;
		color: var(--palantir-text-tertiary);
	}
	.msg.success {
		color: var(--palantir-success, #10b981);
	}
	.msg.error {
		color: var(--palantir-error, #ef4444);
	}
	.cert-status {
		font-size: 10px;
		color: var(--palantir-success, #10b981);
		display: flex;
		align-items: center;
		gap: 4px;
	}
</style>

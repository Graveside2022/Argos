<script lang="ts">
	/**
	 * URL input form for the WebTAK panel.
	 *
	 * Preserves the `argos-webtak-url` localStorage key so operators don't need
	 * to retype the TAK server address between sessions. Calls `onConnect` with
	 * the trimmed, trailing-slash-stripped URL.
	 */

	interface Props {
		/** Initial value for the input; usually the saved localStorage URL. */
		initialUrl?: string;
		/** Fired when the operator clicks Connect with a non-empty URL. */
		onConnect: (url: string) => void;
		/** Disables the form while a start request is in-flight. */
		busy?: boolean;
		/** Optional error message from the last failed start attempt. */
		errorMessage?: string;
	}

	let { initialUrl = '', onConnect, busy = false, errorMessage = '' }: Props = $props();

	let inputUrl = $state(initialUrl);

	function submit() {
		const trimmed = inputUrl.trim().replace(/\/+$/, '');
		if (!trimmed) return;
		if (typeof window !== 'undefined') {
			localStorage.setItem('argos-webtak-url', trimmed);
		}
		onConnect(trimmed);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') submit();
	}
</script>

<div class="url-form">
	<div class="url-form-card">
		<h3 class="url-form-title">TAK SERVER CONNECTION</h3>
		<p class="url-form-desc">
			Enter the URL of your TAK Server. The Argos host will open a real Chromium session
			pointed at this address and stream it back via noVNC, so self-signed certificates and
			iframe restrictions do not matter.
		</p>
		<div class="url-input-row">
			<input
				type="text"
				class="url-input"
				bind:value={inputUrl}
				onkeydown={handleKeydown}
				placeholder="https://10.3.1.5:8446"
				disabled={busy}
				spellcheck="false"
				autocomplete="off"
			/>
			<button class="go-btn" onclick={submit} disabled={busy || !inputUrl.trim()}>
				{busy ? 'Starting…' : 'Connect'}
			</button>
		</div>
		{#if errorMessage}
			<p class="url-error">{errorMessage}</p>
		{/if}
	</div>
</div>

<style>
	.url-form {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 24px;
		background: var(--background);
	}

	.url-form-card {
		background: var(--card);
		border: 1px solid var(--border);
		padding: 28px 32px;
		max-width: 520px;
		width: 100%;
		font-family: 'Fira Code', monospace;
	}

	.url-form-title {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 1.2px;
		color: var(--primary);
		margin: 0 0 12px;
		text-transform: uppercase;
	}

	.url-form-desc {
		font-size: 10px;
		line-height: 1.6;
		color: var(--text-secondary);
		margin: 0 0 16px;
	}

	.url-input-row {
		display: flex;
		gap: 8px;
	}

	.url-input {
		flex: 1;
		height: 32px;
		padding: 0 10px;
		background: var(--background);
		border: 1px solid var(--border);
		color: var(--foreground);
		font-family: 'Fira Code', monospace;
		font-size: 11px;
		outline: none;
	}

	.url-input:focus {
		border-color: var(--primary);
	}

	.url-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.go-btn {
		height: 32px;
		padding: 0 16px;
		background: var(--primary);
		color: var(--background);
		border: none;
		font-family: 'Fira Code', monospace;
		font-size: 10px;
		letter-spacing: 0.8px;
		font-weight: 600;
		text-transform: uppercase;
		cursor: pointer;
	}

	.go-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.url-error {
		margin: 12px 0 0;
		padding: 8px 12px;
		background: var(--error-bg, rgba(196, 91, 74, 0.1));
		border: 1px solid var(--destructive, #c45b4a);
		color: var(--destructive, #c45b4a);
		font-size: 10px;
		line-height: 1.5;
	}
</style>

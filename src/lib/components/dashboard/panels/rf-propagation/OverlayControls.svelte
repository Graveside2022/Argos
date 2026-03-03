<!-- RF overlay display controls — mode toggle, opacity slider, clear action -->
<script lang="ts">
	import {
		clearOverlays,
		globalOpacity,
		overlayMode,
		rfOverlayCount
	} from '$lib/stores/dashboard/rf-overlay-store';

	function handleOpacity(e: Event) {
		const val = parseFloat((e.target as HTMLInputElement).value);
		if (!Number.isNaN(val)) globalOpacity.set(val);
	}
</script>

<section class="overlay-controls">
	<h3 class="section-label">OVERLAY</h3>

	<div class="mode-row">
		<button
			class="mode-btn"
			class:active={$overlayMode === 'single'}
			onclick={() => overlayMode.set('single')}
		>
			Single
		</button>
		<button
			class="mode-btn"
			class:active={$overlayMode === 'multi'}
			onclick={() => overlayMode.set('multi')}
		>
			Multi
		</button>
	</div>

	<label class="field">
		<span class="field-label">OPACITY</span>
		<div class="slider-row">
			<input
				type="range"
				class="opacity-slider"
				min="0.1"
				max="1"
				step="0.05"
				value={$globalOpacity}
				oninput={handleOpacity}
			/>
			<span class="opacity-value">{Math.round($globalOpacity * 100)}%</span>
		</div>
	</label>

	<div class="footer-row">
		<span class="overlay-count"
			>{$rfOverlayCount} overlay{$rfOverlayCount !== 1 ? 's' : ''}</span
		>
		<button class="clear-btn" disabled={$rfOverlayCount === 0} onclick={clearOverlays}>
			Clear All
		</button>
	</div>
</section>

<style>
	.overlay-controls {
		padding: 10px 14px;
		border-bottom: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
		margin: 0;
	}

	.mode-row {
		display: flex;
		gap: 4px;
	}

	.mode-btn {
		flex: 1;
		padding: 4px 8px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
		background: var(--surface-elevated, #151515);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		transition:
			background 0.15s,
			color 0.15s;
	}

	.mode-btn:hover {
		color: var(--foreground);
	}

	.mode-btn.active {
		background: var(--primary);
		color: var(--primary-foreground, #ffffff);
		border-color: var(--primary);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.field-label {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--foreground-secondary, #888888);
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.opacity-slider {
		flex: 1;
		height: 4px;
		appearance: none;
		background: var(--border);
		border-radius: 2px;
		cursor: pointer;
	}

	.opacity-slider::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--primary);
		cursor: pointer;
	}

	.opacity-value {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground);
		min-width: 32px;
		text-align: right;
	}

	.footer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.overlay-count {
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
	}

	.clear-btn {
		padding: 3px 8px;
		font-family: var(--font-mono, 'Fira Code', monospace);
		font-size: 10px;
		color: var(--foreground-secondary, #888888);
		background: var(--surface-elevated, #151515);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}

	.clear-btn:hover:not(:disabled) {
		color: var(--error, #ff5c33);
		border-color: var(--error, #ff5c33);
	}

	.clear-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>

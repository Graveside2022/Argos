<script lang="ts">
	interface Props {
		onClick?: () => void;
		deviceCount?: number;
	}

	let { onClick = () => {}, deviceCount = 0 }: Props = $props();
</script>

<button class="kismet-dashboard-button" onclick={onClick} title="Open Kismet Dashboard">
	<span class="label">Dashboard</span>
	{#if deviceCount > 0}
		<span class="device-count">{deviceCount}</span>
	{/if}
</button>

<style>
	.kismet-dashboard-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.375rem 0.75rem;
		background: #2563eb;
		border: 1px solid #3b82f6;
		border-radius: 4px;
		color: #ffffff;
		cursor: pointer;
		transition: all 0.2s;
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	.kismet-dashboard-button:hover {
		background: #3b82f6;
		border-color: #60a5fa;
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
	}

	.kismet-dashboard-button:active {
		transform: translateY(0);
	}

	.label {
		font-weight: inherit;
	}

	.device-count {
		background: #3b82f6;
		color: white;
		padding: 0.125rem 0.375rem;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 700;
		min-width: 18px;
		text-align: center;
		margin-left: 0.25rem;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.kismet-dashboard-button {
			padding: 0.25rem 0.5rem;
			font-size: 11px;
		}

		.device-count {
			font-size: 10px;
			padding: 0.125rem 0.25rem;
		}
	}
</style>

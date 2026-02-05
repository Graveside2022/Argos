<script lang="ts">
	interface Props {
		onClick?: () => void;
	}

	let { onClick = () => {} }: Props = $props();
</script>

<button
	class="airsignal-rf-btn"
	onclick={onClick}
	title="Configure frequency filters and start RF detection"
>
	AirSignal RF
</button>

<style>
	.airsignal-rf-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease-in-out;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.airsignal-rf-btn:hover {
		background: linear-gradient(135deg, #7c3aed 0%, #6b21a8 100%);
		box-shadow:
			0 4px 12px rgba(147, 51, 234, 0.4),
			0 0 30px rgba(147, 51, 234, 0.2);
		transform: translateY(-1px);
	}

	.airsignal-rf-btn:active {
		transform: translateY(0);
	}

	.airsignal-rf-btn svg {
		width: 16px;
		height: 16px;
	}

	/* Responsive styles */
	@media (max-width: 768px) {
		.airsignal-rf-btn {
			font-size: 12px;
			padding: 6px 12px;
		}
	}

	@media (max-width: 480px) {
		.airsignal-rf-btn {
			font-size: 11px;
			padding: 2px 8px;
			white-space: nowrap;
			height: 24px;
		}

		.airsignal-rf-btn svg {
			width: 12px;
			height: 12px;
		}
	}
</style>

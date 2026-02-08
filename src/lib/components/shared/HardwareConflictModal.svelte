<script lang="ts">
	import { forceReleaseDevice } from '$lib/stores/hardware-store';

	interface Props {
		show?: boolean;
		currentOwner: string;
		device: string;
		onTakeOver?: () => void;
		onCancel?: () => void;
	}

	let { show = false, currentOwner, device, onTakeOver, onCancel }: Props = $props();

	let forcing = $state(false);

	async function handleTakeOver() {
		forcing = true;
		try {
			await forceReleaseDevice(device);
			if (onTakeOver) onTakeOver();
		} finally {
			forcing = false;
			show = false;
		}
	}

	function handleCancel() {
		show = false;
		if (onCancel) onCancel();
	}
</script>

{#if show}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div
			class="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
		>
			<h3 class="text-lg font-bold text-white mb-2">Hardware Conflict</h3>
			<p class="text-gray-300 mb-4">
				<span class="font-mono text-amber-400">{device.toUpperCase()}</span> is currently in
				use by
				<span class="font-mono text-cyan-400">{currentOwner}</span>.
			</p>
			<div class="flex gap-3 justify-end">
				<button
					onclick={handleCancel}
					class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleTakeOver}
					disabled={forcing}
					class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded transition-colors"
				>
					{forcing ? 'Stopping...' : `Stop ${currentOwner} & Take Over`}
				</button>
			</div>
		</div>
	</div>
{/if}

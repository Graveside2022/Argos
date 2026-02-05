<script lang="ts">
	import { hardwareStatus, acquireDevice, releaseDevice } from '$lib/stores/hardwareStore';

	interface Props {
		toolName: string;
		deviceType: 'hackrf' | 'alfa' | 'bluetooth';
		onConflict?: (owner: string) => void;
	}

	let { toolName, deviceType, onConflict }: Props = $props();

	let loading = $state(false);

	let isOwner = $derived($hardwareStatus[deviceType].owner === toolName);
	let available = $derived($hardwareStatus[deviceType].available);
	let currentOwner = $derived($hardwareStatus[deviceType].owner);

	async function handleClick() {
		loading = true;
		try {
			if (isOwner) {
				await releaseDevice(toolName, deviceType);
			} else if (available) {
				const result = await acquireDevice(toolName, deviceType);
				if (!result.success && result.owner && onConflict) {
					onConflict(result.owner);
				}
			} else if (onConflict && currentOwner) {
				onConflict(currentOwner);
			}
		} finally {
			loading = false;
		}
	}
</script>

<button
	onclick={handleClick}
	disabled={loading || (!available && !isOwner)}
	class="px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50
		{isOwner
		? 'bg-red-600 hover:bg-red-700 text-white'
		: available
			? 'bg-green-600 hover:bg-green-700 text-white'
			: 'bg-gray-700 text-gray-400 cursor-not-allowed'}"
>
	{#if loading}
		...
	{:else if isOwner}
		Release {deviceType.toUpperCase()}
	{:else if available}
		Acquire {deviceType.toUpperCase()}
	{:else}
		{deviceType.toUpperCase()}: {currentOwner}
	{/if}
</button>

<script lang="ts">
	import { hardwareStatus, acquireDevice, releaseDevice } from '$lib/stores/hardwareStore';

	export let toolName: string;
	export let deviceType: 'hackrf' | 'alfa' | 'bluetooth';
	export let onConflict: ((owner: string) => void) | undefined = undefined;

	let isOwner = false;
	let available = true;
	let currentOwner: string | null = null;
	let loading = false;

	hardwareStatus.subscribe((s) => {
		const device = s[deviceType];
		available = device.available;
		currentOwner = device.owner;
		isOwner = device.owner === toolName;
	});

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
	on:click={handleClick}
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

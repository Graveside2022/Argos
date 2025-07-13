<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { GPSService } from '$lib/services/tactical-map/gpsService';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	export let onGPSFix: ((hasGPSFix: boolean) => void) | undefined = undefined;

	const gpsService = new GPSService();
	let previousHasFix = false;

	$: {
		const { status } = $gpsStore;
		if (status.hasGPSFix !== previousHasFix) {
			previousHasFix = status.hasGPSFix;
			if (onGPSFix) {
				onGPSFix(status.hasGPSFix);
			}
		}
	}

	onMount(() => {
		gpsService.startPositionUpdates();
	});

	onDestroy(() => {
		gpsService.stopPositionUpdates();
	});
</script>

<!-- This component handles GPS position management in the background -->
<!-- It has no visual representation but manages GPS data updates -->
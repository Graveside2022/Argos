<script lang="ts">
	import { onMount } from 'svelte';
	import { GPSService } from '$lib/services/tactical-map/gpsService';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	interface Props {
		onGPSFix?: (hasGPSFix: boolean) => void;
	}

	let { onGPSFix }: Props = $props();

	const gpsService = new GPSService();
	let previousHasFix = false;

	$effect(() => {
		const { status } = $gpsStore;
		if (status.hasGPSFix !== previousHasFix) {
			previousHasFix = status.hasGPSFix;
			if (onGPSFix) {
				onGPSFix(status.hasGPSFix);
			}
		}
	});

	onMount(() => {
		gpsService.startPositionUpdates();
		return () => {
			gpsService.stopPositionUpdates();
		};
	});
</script>

<!-- This component handles GPS position management in the background -->
<!-- It has no visual representation but manages GPS data updates -->

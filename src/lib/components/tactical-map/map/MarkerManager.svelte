<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { MapService } from '$lib/services/tactical-map/mapService';
	import { mapStore } from '$lib/stores/tactical-map/mapStore';
	import { gpsStore } from '$lib/stores/tactical-map/gpsStore';

	export let onUserMarkerClick: (() => void) | undefined = undefined;

	const mapService = new MapService();
	let unsubscribeGPS: (() => void) | undefined;
	let unsubscribeMap: (() => void) | undefined;
	
	let currentPosition: { lat: number; lon: number } | null = null;
	let hasMarker = false;

	onMount(() => {
		// Subscribe to GPS position changes
		unsubscribeGPS = gpsStore.subscribe(async (gpsState) => {
			if (gpsState.status.hasGPSFix) {
				const newPosition = { lat: gpsState.position.lat, lon: gpsState.position.lon };
				
				// Create or update user marker
				if (!hasMarker) {
					await createUserMarker(newPosition);
				} else if (currentPosition && 
						(currentPosition.lat !== newPosition.lat || currentPosition.lon !== newPosition.lon)) {
					updateUserMarker(newPosition);
				}
				
				// Create or update accuracy circle if accuracy data is available
				if (gpsState.status.accuracy > 0) {
					await createAccuracyCircle(newPosition, gpsState.status.accuracy);
				}
				
				currentPosition = newPosition;
			}
		});

		// Subscribe to map initialization
		unsubscribeMap = mapStore.subscribe((mapState) => {
			if (mapState.isInitialized && currentPosition && !hasMarker) {
				void createUserMarker(currentPosition);
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeGPS) unsubscribeGPS();
		if (unsubscribeMap) unsubscribeMap();
	});

	async function createUserMarker(position: { lat: number; lon: number }) {
		try {
			const marker = await mapService.createUserMarker(position, onUserMarkerClick);
			if (marker) {
				hasMarker = true;
			}
		} catch (error) {
			console.error('Failed to create user marker:', error);
		}
	}

	function updateUserMarker(position: { lat: number; lon: number }) {
		try {
			mapService.updateUserMarker(position);
		} catch (error) {
			console.error('Failed to update user marker:', error);
		}
	}

	async function createAccuracyCircle(position: { lat: number; lon: number }, accuracy: number) {
		try {
			await mapService.createAccuracyCircle(position, accuracy);
		} catch (error) {
			console.error('Failed to create accuracy circle:', error);
		}
	}

	// Export function to update map view
	export function setMapView(position: { lat: number; lon: number }, zoom: number = 15) {
		mapService.setMapView(position, zoom);
	}
</script>

<!-- This component manages map markers and has no visual representation -->
<!-- It handles user position marker, accuracy circle, and map view updates -->
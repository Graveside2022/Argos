<script lang="ts">
	import { onMount } from 'svelte';
	import { markCSSLoaded } from '$lib/utils/cssLoader';
	import '../app.css';
	import '../lib/styles/hackrf/custom-components-exact.css';

	// CSS loading detection to prevent FOUC
	onMount(() => {
		// Use the CSS loader utility for better loading detection
		markCSSLoaded();
	});
</script>

<div class="page-loading">
	<slot />
</div>
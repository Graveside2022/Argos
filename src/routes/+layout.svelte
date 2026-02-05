<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { markCSSLoaded } from '$lib/utils/cssLoader';
	import '../app.css';
	import '../lib/styles/hackrf/custom-components-exact.css';

	interface Props {
		children: Snippet;
	}
	let { children }: Props = $props();

	// CSS loading detection to prevent FOUC
	onMount(() => {
		// Use the CSS loader utility for better loading detection
		markCSSLoaded();
	});
</script>

<div class="page-loading">
	{@render children()}
</div>

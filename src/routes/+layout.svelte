<script lang="ts">
	import '../app.css';

	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	import { markCSSLoaded } from '$lib/utils/css-loader';

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

<script lang="ts">
	import '../app.css';

	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';

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

<Toaster
	theme="dark"
	position="bottom-right"
	toastOptions={{
		style: 'background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); font-family: "Fira Code", monospace; font-size: 11px;'
	}}
/>

<div class="page-loading">
	{@render children()}
</div>

<script lang="ts">
	// Valid Svelte component with proper TypeScript types
	interface Props {
		title: string;
		count: number;
	}

	let { title, count = 0 }: Props = $props();

	function increment() {
		count++;
	}
</script>

<div class="container">
	<h1>{title}</h1>
	<p>Count: {count}</p>
	<button onclick={increment}>Increment</button>
</div>

<style>
	.container {
		padding: 1rem;
	}
</style>

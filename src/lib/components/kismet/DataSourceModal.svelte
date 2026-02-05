<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		isOpen?: boolean;
		availableSources?: { interface: string; name: string; hasMonitorMode: boolean }[];
		selectedSource?: string;
		onselect?: (data: { interface: string }) => void;
		onclose?: () => void;
	}

	let {
		isOpen = $bindable(false),
		availableSources = $bindable([]),
		selectedSource = $bindable(''),
		onselect,
		onclose
	}: Props = $props();

	// Debug logging
	$effect(() => {
		console.log('DataSourceModal isOpen:', isOpen);
	});

	function selectSource(source: string) {
		selectedSource = source;
	}

	function confirmSelection() {
		if (selectedSource) {
			onselect?.({ interface: selectedSource });
			close();
		}
	}

	function close() {
		onclose?.();
		isOpen = false;
	}

	onMount(async () => {
		try {
			const response = await fetch('/api/kismet/interfaces');
			if (response.ok) {
				const data = await response.json();
				availableSources = data.interfaces || [];
				// Pre-select first monitor-capable interface
				const monitorCapable = availableSources.find((s) => s.hasMonitorMode);
				if (monitorCapable) {
					selectedSource = monitorCapable.interface;
				}
			}
		} catch (error) {
			console.error('Failed to fetch interfaces:', error);
		}
	});
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onclick={close}></div>

		<!-- Modal -->
		<div
			class="relative z-10 bg-bg-primary border border-border-primary rounded-lg p-6 max-w-md w-full mx-4"
		>
			<h2 class="text-xl font-bold text-text-primary mb-4">Select WiFi Data Source</h2>

			<div class="space-y-3 mb-6">
				{#if availableSources.length === 0}
					<div class="text-text-secondary text-center py-8">
						<svg
							class="w-12 h-12 mx-auto mb-4 opacity-50"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								d="M23 11l-2.5-2.5-1.42 1.42L20.17 11H16c-.55 0-1 .45-1 1s.45 1 1 1h4.17l-1.09 1.08 1.42 1.42L23 13v-2m-10-2V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5v-2l-8-5z"
							/>
						</svg>
						<p>Scanning for WiFi interfaces...</p>
					</div>
				{:else}
					{#each availableSources as source}
						<label
							class="flex items-center p-3 rounded-lg border cursor-pointer transition-all
							{selectedSource === source.interface
								? 'border-accent-primary bg-accent-primary/10'
								: 'border-border-primary hover:border-accent-primary/50'}"
						>
							<input
								type="radio"
								name="datasource"
								value={source.interface}
								checked={selectedSource === source.interface}
								onchange={() => selectSource(source.interface)}
								class="mr-3"
							/>
							<div class="flex-1">
								<div class="font-medium text-text-primary">
									{source.interface}
								</div>
								<div class="text-sm text-text-secondary">
									{source.name || 'Unknown adapter'}
									{#if source.hasMonitorMode}
										<span class="text-green-400 ml-2">✓ Monitor mode</span>
									{:else}
										<span class="text-yellow-400 ml-2">⚠ No monitor mode</span>
									{/if}
								</div>
							</div>
						</label>
					{/each}
				{/if}
			</div>

			<div class="flex justify-end space-x-3">
				<button
					class="px-4 py-2 rounded-md text-text-secondary hover:text-text-primary transition-colors"
					onclick={close}
				>
					Cancel
				</button>
				<button
					class="px-4 py-2 rounded-md bg-accent-primary text-black font-medium
						hover:bg-accent-primary/90 transition-colors disabled:opacity-50"
					onclick={confirmSelection}
					disabled={!selectedSource}
				>
					Start Kismet
				</button>
			</div>
		</div>
	</div>
{/if}

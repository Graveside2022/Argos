<script lang="ts">
	import { toast } from 'svelte-sonner';

	import Input from '$lib/components/ui/input/input.svelte';
	import type { TakServerConfig } from '$lib/types/tak';

	interface Props {
		config: TakServerConfig;
		onEnrolled: (data: {
			id: string;
			paths: { certPath: string; keyPath: string; caPath?: string };
		}) => void;
	}

	let { config, onEnrolled }: Props = $props();

	let enrollStatus = $state('');
	let isEnrolling = $state(false);

	/** Validate that required enrollment fields are present. */
	function hasEnrollmentFields(): boolean {
		return !!(config.hostname && config.enrollmentUser && config.enrollmentPass);
	}

	/** Handle the enrollment API response. */
	function handleEnrollResponse(data: Record<string, unknown>): void {
		if (data.success) {
			onEnrolled({
				id: data.id as string,
				paths: data.paths as { certPath: string; keyPath: string; caPath?: string }
			});
			enrollStatus = 'Enrollment successful';
			toast.success('TAK certificate enrolled');
		} else {
			enrollStatus = (data.error as string) ?? 'Enrollment failed';
			toast.error(`Enrollment failed: ${enrollStatus}`);
		}
	}

	async function enrollCertificate() {
		if (!hasEnrollmentFields()) {
			enrollStatus = 'Fill hostname, username, and password';
			return;
		}
		isEnrolling = true;
		enrollStatus = 'Enrolling...';
		try {
			const res = await fetch('/api/tak/enroll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					hostname: config.hostname,
					port: config.enrollmentPort,
					username: config.enrollmentUser,
					password: config.enrollmentPass,
					id: config.id || crypto.randomUUID()
				})
			});
			handleEnrollResponse(await res.json());
		} catch {
			enrollStatus = 'Enrollment error';
			toast.error('Enrollment failed: server communication error');
		} finally {
			isEnrolling = false;
		}
	}
</script>

<div class="flex flex-col gap-2.5">
	<span class="text-xs font-semibold tracking-widest text-muted-foreground">ENROLLMENT</span>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Username
		<Input
			type="text"
			bind:value={config.enrollmentUser}
			placeholder="tak-user"
			class="h-8 text-xs"
		/>
	</label>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Password
		<Input
			type="password"
			bind:value={config.enrollmentPass}
			placeholder="Enrollment password"
			class="h-8 text-xs"
		/>
	</label>
	<label class="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
		Enrollment Port
		<Input
			type="number"
			bind:value={config.enrollmentPort}
			placeholder="8446"
			class="h-8 text-xs"
		/>
	</label>
	<div class="flex items-center gap-2">
		<button
			onclick={enrollCertificate}
			disabled={isEnrolling}
			class="inline-flex items-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/30 disabled:opacity-50"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline
					points="22 4 12 14.01 9 11.01"
				/></svg
			>
			{isEnrolling ? 'Enrolling...' : 'Enroll Now'}
		</button>
		{#if enrollStatus}
			<span class="text-[10px] text-muted-foreground">{enrollStatus}</span>
		{/if}
	</div>
</div>

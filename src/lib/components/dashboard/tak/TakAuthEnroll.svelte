<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
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

	async function enrollCertificate() {
		if (!config.hostname || !config.enrollmentUser || !config.enrollmentPass) {
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
			const data = await res.json();
			if (data.success) {
				onEnrolled({ id: data.id, paths: data.paths });
				enrollStatus = 'Enrollment successful';
			} else {
				enrollStatus = data.error ?? 'Enrollment failed';
			}
		} catch {
			enrollStatus = 'Enrollment error';
		} finally {
			isEnrolling = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-[10px] font-semibold tracking-widest text-muted-foreground">ENROLLMENT</span>
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
		<Button variant="secondary" size="sm" onclick={enrollCertificate} disabled={isEnrolling}>
			{isEnrolling ? 'Enrolling...' : 'Enroll Now'}
		</Button>
		{#if enrollStatus}
			<span class="text-[10px] text-muted-foreground">{enrollStatus}</span>
		{/if}
	</div>
</div>

import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateArticleIV } from '../../../src/lib/constitution/validators/article-iv-ux.js';

describe('validateArticleIV - UX Consistency', () => {
	const fixtureRoot = join(process.cwd(), 'tests/constitution/fixtures/temp-ux');
	const srcDir = join(fixtureRoot, 'src/components');

	beforeEach(() => {
		mkdirSync(srcDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it('should return array of violations', async () => {
		const violations = await validateArticleIV(process.cwd());

		expect(Array.isArray(violations)).toBe(true);
		violations.forEach((v) => {
			expect(v).toHaveProperty('severity');
			expect(v).toHaveProperty('articleReference');
			expect(v).toHaveProperty('filePath');
			expect(v).toHaveProperty('lineNumber');
			expect(v.articleReference).toContain('Article IV');
		});
	});

	it('should detect missing loading state in async component', async () => {
		const component = `<script lang="ts">
	let data = $state(null);
	$effect(() => {
		fetch('/api/data').then(r => r.json()).then(d => data = d);
	});
</script>

<div class="container">
	{#if error}
		<p>Error occurred</p>
	{/if}
	{#if isEmpty}
		<p>No data found</p>
	{/if}
	<div class="content">
		<p>Some long content that makes this component larger than 500 characters.</p>
		<p>More content to pad the component.</p>
		<p>Even more padding content so it exceeds the threshold.</p>
		<p>And yet more content to be safe about the length check.</p>
		<p>Final padding to ensure we are well over 500 characters in total.</p>
	</div>
</div>`;

		writeFileSync(join(srcDir, 'AsyncNoLoading.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		const loadingViolations = violations.filter(
			(v) => v.violationType === 'missing-loading-state'
		);
		expect(loadingViolations.length).toBeGreaterThanOrEqual(1);
		expect(loadingViolations[0].articleReference).toBe('Article IV §4.3');
		expect(loadingViolations[0].severity).toBe('MEDIUM');
	});

	it('should detect missing error state in data component', async () => {
		const component = `<script lang="ts">
	let { data }: { data: string } = $props();
	let loading = $state(true);
</script>

<div class="container">
	{#if loading}
		<p>Loading...</p>
	{/if}
	{#if !data || data.length === 0}
		<p>No items found</p>
	{/if}
	<div class="content">
		<p>Some long content that makes this component larger than 500 characters.</p>
		<p>More content to pad the component with additional text for length.</p>
		<p>Even more padding content so it exceeds the threshold checking logic.</p>
		<p>And yet more content to be safe about the character length check.</p>
		<p>Final padding to ensure we are well over 500 characters total.</p>
	</div>
</div>`;

		writeFileSync(join(srcDir, 'DataNoError.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		const errorViolations = violations.filter((v) => v.violationType === 'missing-error-state');
		expect(errorViolations.length).toBeGreaterThanOrEqual(1);
		expect(errorViolations[0].suggestedFix).toContain('error');
	});

	it('should detect missing empty state in async component', async () => {
		const component = `<script lang="ts">
	let data = $state(null);
	let loading = $state(true);
	let error = $state(null);
	$effect(() => {
		fetch('/api/data').then(r => r.json()).then(d => { data = d; loading = false; }).catch(e => { error = e; });
	});
</script>

<div class="container">
	{#if loading}
		<p>Loading...</p>
	{/if}
	{#if error}
		<p>Something went wrong: {error}</p>
	{/if}
	<div class="content">
		<p>Some long content that makes this component larger than 500 characters threshold.</p>
		<p>More content to pad the component with additional text for length check.</p>
		<p>Even more padding content so it exceeds the threshold checking logic here.</p>
		<p>And yet more content to be safe about the length of the component text.</p>
	</div>
</div>`;

		writeFileSync(join(srcDir, 'AsyncNoEmpty.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		const emptyViolations = violations.filter((v) => v.violationType === 'missing-empty-state');
		expect(emptyViolations.length).toBeGreaterThanOrEqual(1);
	});

	it('should not flag small presentational components', async () => {
		const component = `<script lang="ts">
	let { label }: { label: string } = $props();
</script>
<span>{label}</span>`;

		writeFileSync(join(srcDir, 'SmallComponent.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		// Small component (< 500 chars) should not have state violations
		const stateViolations = violations.filter(
			(v) =>
				v.filePath.includes('SmallComponent') &&
				(v.violationType === 'missing-loading-state' ||
					v.violationType === 'missing-error-state' ||
					v.violationType === 'missing-empty-state')
		);
		expect(stateViolations).toHaveLength(0);
	});

	it('should not flag component with all required states', async () => {
		const component = `<script lang="ts">
	let data = $state(null);
	let isLoading = $state(true);
	let hasError = $state(false);
	let isEmpty = $state(false);
	$effect(() => {
		fetch('/api/data')
			.then(r => r.json())
			.then(d => {
				data = d;
				isLoading = false;
				isEmpty = !d || d.length === 0;
			})
			.catch(() => { hasError = true; isLoading = false; });
	});
</script>

<div class="container">
	{#if isLoading}
		<p>Loading data...</p>
	{:else if hasError}
		<p>Error occurred while loading data</p>
	{:else if isEmpty}
		<p>No data found in the system</p>
	{:else}
		<pre>{JSON.stringify(data)}</pre>
	{/if}
	<div class="padding-content">
		<p>This is extra content to ensure the component exceeds the 500 character limit.</p>
		<p>More padding text to make the component large enough for analysis checks.</p>
	</div>
</div>`;

		writeFileSync(join(srcDir, 'CompleteStates.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		const stateViolations = violations.filter(
			(v) =>
				v.filePath.includes('CompleteStates') &&
				(v.violationType === 'missing-loading-state' ||
					v.violationType === 'missing-error-state' ||
					v.violationType === 'missing-empty-state')
		);
		expect(stateViolations).toHaveLength(0);
	});

	it('should detect duplicate pattern implementations (§4.2)', async () => {
		const component = `<script lang="ts">
	let { items }: { items: string[] } = $props();
</script>

<div class="container">
	<div class="btn btn-primary">Button 1</div>
	<div class="btn btn-secondary">Button 2</div>
	<div class="btn btn-danger">Button 3</div>
	<div class="btn btn-warning">Button 4</div>
	<div class="extra-padding-content">
		<p>Extra content to make the component larger for testing purposes.</p>
		<p>More padding to ensure the component is large enough.</p>
		<p>And even more content for good measure here.</p>
		<p>One more line of content to be safe about the size check.</p>
	</div>
</div>`;

		writeFileSync(join(srcDir, 'DuplicateButtons.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		const duplicateViolations = violations.filter(
			(v) =>
				v.filePath.includes('DuplicateButtons') &&
				v.violationType === 'potential-duplicate-implementation'
		);
		expect(duplicateViolations.length).toBeGreaterThanOrEqual(1);
		expect(duplicateViolations[0].articleReference).toBe('Article IV §4.2');
		expect(duplicateViolations[0].severity).toBe('LOW');
	});

	it('should return violations with proper structure', async () => {
		const component = `<script lang="ts">
	let data = $state(null);
	$effect(() => {
		fetch('/api/data').then(r => r.json()).then(d => data = d);
	});
</script>

<div class="container">
	<div class="content">
		<p>Some content that makes this component larger than 500 characters for testing.</p>
		<p>More content to pad the component to exceed the minimum length threshold.</p>
		<p>Even more padding content so it exceeds the threshold checking logic here.</p>
		<p>And yet more content to be safe about the length of the component file.</p>
		<p>Final line of padding content to ensure we exceed 500 character threshold.</p>
	</div>
</div>`;

		writeFileSync(join(srcDir, 'MissingStates.svelte'), component);

		const violations = await validateArticleIV(fixtureRoot);

		violations.forEach((v) => {
			expect(v.id).toBeDefined();
			expect(v.severity).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW)$/);
			expect(v.articleReference).toMatch(/^Article IV §4\.\d+$/);
			expect(v.filePath).toBeDefined();
			expect(v.lineNumber).toBeGreaterThan(0);
			expect(v.violationType).toBeDefined();
			expect(v.isPreExisting).toBe(false);
			expect(v.exemptionStatus).toBe('none');
		});
	});

	it('should handle empty project with no Svelte files', async () => {
		const emptyRoot = join(fixtureRoot, 'empty-project');
		mkdirSync(join(emptyRoot, 'src'), { recursive: true });

		const violations = await validateArticleIV(emptyRoot);

		expect(violations).toEqual([]);
	});
});

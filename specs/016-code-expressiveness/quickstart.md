# Quickstart: Code Expressiveness Improvement

**Date**: 2026-02-23 | **Branch**: `016-code-expressiveness`

## Overview

This feature has two independent parts:

- **Part A**: Server-side abstractions (route handler factory, DRY utilities, error cleanup)
- **Part B**: Client-side tooling (data tables, virtual scroll, forms, toasts)

## Part A: Using the New Server Abstractions

### 1. Route Handler Factory

**Before** (today's pattern — 20+ lines per route):

```typescript
import { error, json } from '@sveltejs/kit';
import { logger } from '$lib/utils/logger';
import type { RequestHandler } from './$types';

function errMsg(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const db = getRFDatabase();
		const signals = db.findSignals();
		return json({ signals });
	} catch (err: unknown) {
		logger.error('Error querying signals', { error: errMsg(err) });
		return error(500, 'Failed to query signals');
	}
};
```

**After** (with factory — 5 lines):

```typescript
import { createHandler } from '$lib/server/api/create-handler';
import { getRFDatabase } from '$lib/server/db/database';

export const GET = createHandler(async ({ url }) => {
	const db = getRFDatabase();
	return { signals: db.findSignals() };
});
```

The factory handles: imports, try-catch, errMsg, logging, JSON wrapping, error response.

### 2. Result Tuples

**Before**:

```typescript
try {
	const data = await riskyOperation();
	// use data
} catch (err) {
	logger.error('Failed', { error: (err as Error).message });
	return json({ error: 'Operation failed' }, { status: 500 });
}
```

**After**:

```typescript
import { safe } from '$lib/server/result';

const [data, err] = await safe(() => riskyOperation());
if (err) {
	logger.error('Failed', { error: err.message });
	return json({ error: 'Operation failed' }, { status: 500 });
}
// use data — TypeScript knows it's non-null
```

### 3. Shared Utilities

```typescript
// Error message extraction (replaces 19 local copies)
import { errMsg } from '$lib/server/api/error-utils';

// Async exec (replaces 36 local declarations)
import { execFileAsync } from '$lib/server/exec';

// Higher-order wrappers
import { withRetry } from '$lib/server/retry';
import { withTimeout } from '$lib/server/timeout';

const fetchWithRetry = withRetry(() => fetchExternalData(), { attempts: 3, delayMs: 1000 });
const result = await fetchWithRetry();

const slowOpWithTimeout = withTimeout(() => slowOperation(), 5000);
const data = await slowOpWithTimeout();
```

## Part B: Using Client-Side Libraries

### 1. Toast Notifications (svelte-sonner)

```svelte
<!-- In any component -->
<script>
	import { toast } from 'svelte-sonner';

	async function saveSettings() {
		const response = await fetch('/api/settings', {
			method: 'POST',
			body: JSON.stringify(data)
		});
		if (response.ok) toast.success('Settings saved');
		else toast.error('Failed to save settings');
	}
</script>
```

The `<Toaster />` component is added once in `+layout.svelte`.

### 2. Data Tables (@tanstack/table-core + shadcn)

```svelte
<script>
	import DataTable from '$lib/components/data-table/data-table.svelte';
	import { columns } from './columns';

	let { data } = $props();
</script>

<DataTable {data} {columns} />
```

### 3. Virtual Scrolling (Virtua)

```svelte
<script>
	import { VList } from 'virtua/svelte';
</script>

<VList data={signals}>
	{#snippet children(signal)}
		<div class="signal-row">{signal.frequency} MHz — {signal.strength} dBm</div>
	{/snippet}
</VList>
```

### 4. Form Validation (Superforms + Formsnap)

```svelte
<script>
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { Field, Control } from 'formsnap';
	import { settingsSchema } from './schema';

	const form = superForm(data.form, { validators: zodClient(settingsSchema) });
</script>

<form method="POST" use:form.enhance>
	<Field name="frequency">
		<Control>
			{#snippet children({ props })}
				<input type="number" {...props} />
			{/snippet}
		</Control>
	</Field>
</form>
```

## Verification

```bash
# After any changes
npm run build              # Must succeed
npm run test:unit          # Must pass
npx madge --circular src/  # Must report 0 cycles (after Phase 4)
```

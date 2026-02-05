# Svelte 5 Migration Patterns Reference Guide

Complete pattern reference for migrating from Svelte 4 to Svelte 5 runes.

## Table of Contents

1. [Props](#1-props)
2. [Reactive Statements](#2-reactive-statements)
3. [Store Subscriptions](#3-store-subscriptions)
4. [Side Effects](#4-side-effects)
5. [Lifecycle Hooks](#5-lifecycle-hooks)
6. [Event Handlers](#6-event-handlers)
7. [Complex Patterns](#7-complex-patterns)
8. [Common Pitfalls](#8-common-pitfalls)

---

## 1. Props

### Simple Props

**Before (Svelte 4):**

```typescript
export let name: string;
export let count: number = 0;
export let enabled = true;
```

**After (Svelte 5):**

```typescript
let {
	name,
	count = 0,
	enabled = true
}: {
	name: string;
	count?: number;
	enabled?: boolean;
} = $props();
```

**Rules:**

- Props with defaults become optional in TypeScript type
- Props without defaults are required
- Type annotation is optional but recommended

---

### Props with Complex Types

**Before (Svelte 4):**

```typescript
export let device: Device | null = null;
export let onSelect: ((device: Device) => void) | undefined = undefined;
```

**After (Svelte 5):**

```typescript
let {
	device = null,
	onSelect = undefined
}: {
	device?: Device | null;
	onSelect?: ((device: Device) => void) | undefined;
} = $props();
```

---

## 2. Reactive Statements

### Simple Reactive Statement

**Before (Svelte 4):**

```typescript
export let count: number;
$: doubled = count * 2;
```

**After (Svelte 5):**

```typescript
let { count }: { count: number } = $props();
let doubled = $derived(count * 2);
```

**When to use:**

- Simple expressions (one-liners)
- No side effects
- Depends on props or other state

---

### Complex Reactive Statement (with `$derived.by()`)

**Before (Svelte 4):**

```typescript
export let devices: Map<string, Device>;
export let filter: string;

$: filteredDevices = (() => {
	const result = [];
	for (const [id, device] of devices.entries()) {
		if (device.name.includes(filter)) {
			result.push(device);
		}
	}
	return result.sort((a, b) => a.name.localeCompare(b.name));
})();
```

**After (Svelte 5):**

```typescript
let {
	devices,
	filter
}: {
	devices: Map<string, Device>;
	filter: string;
} = $props();

let filteredDevices = $derived.by(() => {
	const result = [];
	for (const [id, device] of devices.entries()) {
		if (device.name.includes(filter)) {
			result.push(device);
		}
	}
	return result.sort((a, b) => a.name.localeCompare(b.name));
});
```

**When to use:**

- Multi-line logic
- Loops or complex transformations
- Need explicit `return` statement

**Note:** Don't forget the `return`!

---

### Multiple Reactive Dependencies

**Before (Svelte 4):**

```typescript
export let lat: number;
export let lon: number;
export let zoom: number;

$: mapCenter = [lon, lat];
$: mapOptions = { center: mapCenter, zoom };
```

**After (Svelte 5):**

```typescript
let {
	lat,
	lon,
	zoom
}: {
	lat: number;
	lon: number;
	zoom: number;
} = $props();

let mapCenter = $derived([lon, lat]);
let mapOptions = $derived({ center: mapCenter, zoom });
```

**Note:** `$derived` automatically tracks dependencies (mapCenter)

---

## 3. Store Subscriptions

### Read-Only Store Access

**Before (Svelte 4):**

```typescript
import { myStore } from '$lib/stores/myStore';
import { onDestroy } from 'svelte';

let data = null;
const unsub = myStore.subscribe((value) => {
	data = value;
});

onDestroy(unsub);
```

**After (Svelte 5) - Option A: Auto-subscription**

```typescript
import { myStore } from '$lib/stores/myStore';

let data = $derived($myStore);
```

**When to use:**

- Simple read-only access
- No transformation needed
- Single store dependency

---

### Store with Transformation

**Before (Svelte 4):**

```typescript
import { myStore } from '$lib/stores/myStore';
import { onDestroy } from 'svelte';

let processedData = null;
const unsub = myStore.subscribe((raw) => {
	processedData = raw.map((item) => ({
		...item,
		processed: true
	}));
});

onDestroy(unsub);
```

**After (Svelte 5):**

```typescript
import { myStore } from '$lib/stores/myStore';

let processedData = $derived.by(() => {
	const raw = $myStore;
	return raw.map((item) => ({
		...item,
		processed: true
	}));
});
```

**When to use:**

- Need to transform store data
- Combine multiple stores
- Complex computations based on store

---

### Store with Side Effects

**Before (Svelte 4):**

```typescript
import { gpsStore } from '$lib/stores/gpsStore';
import { onDestroy } from 'svelte';

let position = null;
const unsub = gpsStore.subscribe((gps) => {
	position = gps.position;
	if (gps.position.lat !== 0) {
		// Side effect: update map
		updateMap(gps.position);
	}
});

onDestroy(unsub);
```

**After (Svelte 5):**

```typescript
import { gpsStore } from '$lib/stores/gpsStore';

let gps = $derived($gpsStore);
let position = $derived(gps.position);

$effect(() => {
	if (position.lat !== 0) {
		updateMap(position);
	}
});
```

**When to use:**

- Store value triggers side effects
- Need to call functions, update DOM, etc.
- Imperativeupdates required

---

### Multiple Store Subscriptions

**Before (Svelte 4):**

```typescript
import { store1, store2 } from '$lib/stores';
import { onDestroy } from 'svelte';

let data1 = null;
let data2 = null;
const unsub1 = store1.subscribe((v) => {
	data1 = v;
});
const unsub2 = store2.subscribe((v) => {
	data2 = v;
});

$: combined = data1 && data2 ? { data1, data2 } : null;

onDestroy(() => {
	unsub1();
	unsub2();
});
```

**After (Svelte 5):**

```typescript
import { store1, store2 } from '$lib/stores';

let data1 = $derived($store1);
let data2 = $derived($store2);
let combined = $derived(data1 && data2 ? { data1, data2 } : null);
```

**Note:** Much cleaner! No manual cleanup needed.

---

## 4. Side Effects

### Reactive Statement with Side Effects

**Before (Svelte 4):**

```typescript
export let isRunning: boolean;

$: if (isRunning) {
	console.log('Service started');
	startPolling();
} else {
	console.log('Service stopped');
	stopPolling();
}
```

**After (Svelte 5):**

```typescript
let { isRunning }: { isRunning: boolean } = $props();

$effect(() => {
	if (isRunning) {
		console.log('Service started');
		startPolling();
	} else {
		console.log('Service stopped');
		stopPolling();
	}
});
```

**When to use:**

- Conditional side effects
- Need to react to prop/state changes
- External API calls

---

### Effect with Cleanup

**Before (Svelte 4):**

```typescript
export let autoRefresh: boolean;

let interval: NodeJS.Timeout | null = null;

$: if (autoRefresh) {
	if (interval) clearInterval(interval);
	interval = setInterval(() => {
		refresh();
	}, 5000);
} else if (interval) {
	clearInterval(interval);
	interval = null;
}

onDestroy(() => {
	if (interval) clearInterval(interval);
});
```

**After (Svelte 5):**

```typescript
let { autoRefresh }: { autoRefresh: boolean } = $props();

$effect(() => {
	if (!autoRefresh) return;

	const interval = setInterval(() => {
		refresh();
	}, 5000);

	// Cleanup function - runs before next effect or on component unmount
	return () => clearInterval(interval);
});
```

**When to use:**

- Need to clean up resources (intervals, subscriptions, listeners)
- Effect should run conditionally
- Automatic cleanup on re-run or unmount

---

## 5. Lifecycle Hooks

### onMount (No Changes)

**Before & After (Same):**

```typescript
import { onMount } from 'svelte';

onMount(() => {
	console.log('Component mounted');
	initializeMap();

	return () => {
		console.log('Component unmounting');
		destroyMap();
	};
});
```

**Note:** `onMount` stays the same! No migration needed.

---

### onMount with Props (Consider $effect)

**Before (Svelte 4):**

```typescript
export let mapConfig: MapConfig;

onMount(() => {
	initializeMap(mapConfig);
});
```

**After (Svelte 5) - Option A: Keep onMount**

```typescript
let { mapConfig }: { mapConfig: MapConfig } = $props();

onMount(() => {
	initializeMap(mapConfig);
});
```

**After (Svelte 5) - Option B: Use $effect if reactivity needed**

```typescript
let { mapConfig }: { mapConfig: MapConfig } = $props();

$effect(() => {
	console.log('Map config changed');
	initializeMap(mapConfig);

	return () => {
		destroyMap();
	};
});
```

**When to use $effect instead of onMount:**

- Need to react to prop changes (not just mount)
- Need cleanup when props change
- Initialization depends on reactive values

---

## 6. Event Handlers

### Event Handlers (No Changes)

**Before & After (Same):**

```typescript
function handleClick() {
  console.log('Clicked');
}

<button on:click={handleClick}>Click Me</button>
// or
<button onclick={handleClick}>Click Me</button>
```

**Note:** Event handlers don't change in Svelte 5

---

### Event Dispatchers (No Changes)

**Before & After (Same):**

```typescript
import { createEventDispatcher } from 'svelte';

const dispatch = createEventDispatcher<{
	select: { id: string };
	close: void;
}>();

function handleSelect(id: string) {
	dispatch('select', { id });
}
```

**Note:** Event dispatchers unchanged in Svelte 5

---

## 7. Complex Patterns

### Pattern: Local Mutable State

**Before (Svelte 4):**

```typescript
let searchQuery = '';
let sortColumn = 'name';
let sortDirection: 'asc' | 'desc' = 'asc';
```

**After (Svelte 5):**

```typescript
let searchQuery = $state('');
let sortColumn = $state<'name' | 'rssi' | 'type'>('name');
let sortDirection = $state<'asc' | 'desc'>('asc');
```

**When to use:**

- Local component state that changes
- Form inputs
- UI state (open/closed, selected, etc.)

---

### Pattern: Computed from Local State

**Before (Svelte 4):**

```typescript
let searchQuery = '';
let items = [...];

$: filteredItems = items.filter(item =>
  item.name.toLowerCase().includes(searchQuery.toLowerCase())
);
```

**After (Svelte 5):**

```typescript
let searchQuery = $state('');
let items = $state([...]);

let filteredItems = $derived(
  items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )
);
```

---

### Pattern: Canvas Rendering

**Before (Svelte 4):**

```typescript
export let spectrumData: Float32Array;
let canvas: HTMLCanvasElement;

$: if (canvas && spectrumData) {
	renderSpectrum(canvas, spectrumData);
}
```

**After (Svelte 5):**

```typescript
let { spectrumData }: { spectrumData: Float32Array } = $props();
let canvas = $state<HTMLCanvasElement | undefined>();

$effect(() => {
	if (!canvas || !spectrumData) return;

	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const animationFrame = requestAnimationFrame(() => {
		renderSpectrum(ctx, spectrumData);
	});

	return () => cancelAnimationFrame(animationFrame);
});
```

---

### Pattern: Debounced Input

**Before (Svelte 4):**

```typescript
let searchQuery = '';
let debouncedQuery = '';
let debounceTimer: NodeJS.Timeout;

$: {
	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debouncedQuery = searchQuery;
	}, 300);
}
```

**After (Svelte 5):**

```typescript
let searchQuery = $state('');
let debouncedQuery = $state('');

$effect(() => {
	const timer = setTimeout(() => {
		debouncedQuery = searchQuery;
	}, 300);

	return () => clearTimeout(timer);
});
```

---

## 8. Common Pitfalls

### Pitfall 1: Using $effect for Derived Values

```typescript
// ❌ WRONG - Don't use $effect to compute values
let count = $state(0);
let doubled = $state(0);
$effect(() => {
	doubled = count * 2; // Wrong approach!
});

// ✅ CORRECT - Use $derived for computed values
let count = $state(0);
let doubled = $derived(count * 2);
```

**Why wrong:** $effect is for side effects, not computed values. Use $derived instead.

---

### Pitfall 2: Forgetting `return` in `$derived.by()`

```typescript
// ❌ WRONG - Missing return statement
let result = $derived.by(() => {
	const x = compute();
	x; // No return!
});

// ✅ CORRECT - Explicit return
let result = $derived.by(() => {
	const x = compute();
	return x;
});
```

**Why wrong:** `$derived.by()` requires explicit return. The function won't work without it.

---

### Pitfall 3: Mutating Derived Values

```typescript
// ❌ WRONG - Can't mutate derived values
let list = $derived([...items]);
list.push(newItem); // Error! Derived values are read-only

// ✅ CORRECT - Create new derived value
let list = $derived([...items]);
let extendedList = $derived([...list, newItem]);
```

**Why wrong:** Derived values are immutable. Create new derived values instead.

---

### Pitfall 4: Not Cleaning Up Effects

```typescript
// ❌ WRONG - No cleanup (memory leak!)
$effect(() => {
	const interval = setInterval(() => {
		doSomething();
	}, 1000);
	// No cleanup!
});

// ✅ CORRECT - Return cleanup function
$effect(() => {
	const interval = setInterval(() => {
		doSomething();
	}, 1000);

	return () => clearInterval(interval);
});
```

**Why wrong:** Without cleanup, intervals/listeners/subscriptions leak memory.

---

### Pitfall 5: Over-Destructuring Props

```typescript
// ❌ WRONG - Loses reactivity
let { items } = $props();
let first = items[0]; // Not reactive to items changes!

// ✅ CORRECT - Use $derived
let { items } = $props();
let first = $derived(items[0]); // Reactive!
```

**Why wrong:** Direct assignment doesn't track reactivity. Use $derived for computed values.

---

### Pitfall 6: Unnecessary $state

```typescript
// ❌ WRONG - Unnecessary $state for computed value
let { count } = $props();
let doubled = $state(count * 2); // Wrong!

// ✅ CORRECT - Use $derived for computed values
let { count } = $props();
let doubled = $derived(count * 2);
```

**Why wrong:** Computed values should use $derived, not $state. $state is for mutable local state.

---

### Pitfall 7: $effect Dependency Confusion

```typescript
// ❌ WRONG - $effect runs on every reactive change
let count = $state(0);
let name = $state('');

$effect(() => {
	console.log('Effect ran');
	if (count > 5) {
		doSomething(count);
	}
	// This runs even when name changes!
});

// ✅ CORRECT - Only track count
$effect(() => {
	if (count > 5) {
		doSomething(count);
	}
	// Don't reference name here
});
```

**Why wrong:** $effect tracks ALL reactive values referenced inside. Be intentional about dependencies.

---

## Performance Tips

### Tip 1: Use $derived for Computed Values

- $derived is optimized for computed values
- Only re-computes when dependencies change
- More efficient than $effect with state updates

### Tip 2: Use $derived.by() for Expensive Computations

- Explicit function scope
- Better for complex logic
- Easier to read and maintain

### Tip 3: Avoid Nested $effect

- Flatten if possible
- Use $derived to compute intermediate values
- Only use $effect for actual side effects

### Tip 4: Clean Up Resources

- Always return cleanup function from $effect
- Clear intervals, timeouts, listeners
- Cancel API requests if needed

### Tip 5: Minimize $effect Usage

- Prefer $derived when possible
- $effect is for side effects, not computations
- Overuse can harm performance

---

## Migration Checklist

When migrating a component, check:

- [ ] Convert `export let` → `let { ... } = $props()`
- [ ] Convert `$: computed = ...` → `let computed = $derived(...)`
- [ ] Convert `$: { side effect }` → `$effect(() => { side effect })`
- [ ] Convert store subscriptions → `$derived($store)` or `$effect`
- [ ] Remove `onDestroy` cleanup for subscriptions (auto-handled)
- [ ] Add cleanup returns to `$effect` for resources
- [ ] Update imports (remove `onDestroy` if unused)
- [ ] Run `npm run typecheck`
- [ ] Test all interactions
- [ ] Verify no performance regressions

---

## Quick Reference Table

| Pattern          | Svelte 4                        | Svelte 5                                       |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| Props            | `export let name`               | `let { name } = $props()`                      |
| Simple Reactive  | `$: doubled = count * 2`        | `let doubled = $derived(count * 2)`            |
| Complex Reactive | `$: result = (() => { ... })()` | `let result = $derived.by(() => { ... })`      |
| Store Read       | `$myStore` or `subscribe()`     | `$derived($myStore)`                           |
| Side Effect      | `$: if (x) { ... }`             | `$effect(() => { if (x) { ... } })`            |
| Local State      | `let state = value`             | `let state = $state(value)`                    |
| Lifecycle        | `onMount(() => { ... })`        | `onMount(() => { ... })` (same)                |
| Cleanup          | `onDestroy(() => { ... })`      | `$effect(() => { ...; return () => { ... } })` |

---

**Ready to migrate?** Use this guide as reference throughout the migration process.

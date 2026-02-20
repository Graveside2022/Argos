# Research: Constitutional Audit Remediation

**Feature**: Constitutional Audit Remediation
**Branch**: `001-audit-remediation`
**Date**: February 13, 2026

## Phase 0 Research Summary

This document captures research decisions for dependency selection, migration strategies, and performance validation approaches for the three-phase constitutional compliance remediation.

---

## 1. Dependency Selection

### 1.1 Zod (Runtime Validation Library)

**Decision**: Use Zod v3.x for runtime validation to replace type assertions

**Rationale**:

- **TypeScript-first**: Designed specifically for TypeScript with full type inference
- **Schema-based**: Declarative validation schemas that are readable and maintainable
- **Performance**: Lightweight (~8KB gzipped), negligible overhead for validation
- **Error messages**: Descriptive validation errors with field paths and readable messages
- **Ecosystem**: Wide adoption in SvelteKit community, well-documented patterns

**Alternatives Considered**:

- **Yup**: More generic, heavier bundle size (~30KB), less TypeScript-native
- **io-ts**: Strong TypeScript integration but steeper learning curve, less readable schemas
- **Joi**: Browser-unfriendly (designed for Node.js), larger bundle size
- **Custom validators**: Would require ~1-2 weeks to build comparable functionality

**Best Practices** (from Zod documentation and community):

```typescript
// Co-locate schemas with types
import { z } from 'zod';

export const SignalReadingSchema = z.object({
	frequency: z.number().min(0).max(6000), // MHz
	power: z.number(), // dBm
	timestamp: z.number().int().positive(),
	source: z.enum(['hackrf', 'usrp', 'kismet']),
	metadata: z.record(z.unknown()).optional()
});

export type SignalReading = z.infer<typeof SignalReadingSchema>;

// Use .parse() to throw on invalid data (API boundaries)
const signal = SignalReadingSchema.parse(response);

// Use .safeParse() for graceful error handling (user input)
const result = SignalReadingSchema.safeParse(userInput);
if (!result.success) {
	console.error('Validation failed:', result.error.format());
	// Handle error gracefully
}
```

**Performance Validation**:

- Create benchmark script: `scripts/benchmark-zod-validation.ts`
- Measure validation time for common data structures (API responses, WebSocket messages)
- Target: < 5ms per validation (NFR-001)

---

### 1.2 Shadcn-Svelte (UI Component Library)

**Decision**: Use shadcn-svelte for accessible, customizable UI components

**Rationale**:

- **Svelte 5 compatible**: Designed for modern Svelte with runes support
- **Tailwind-based**: Uses Tailwind utility classes, no CSS conflicts
- **Accessible by default**: WCAG 2.1 AA compliance built-in (focus rings, keyboard nav, ARIA labels)
- **Radix UI primitives**: Battle-tested component logic from Radix UI (React), ported to Svelte
- **Customizable**: Components are copied into project, not npm dependency (full control)
- **Zero runtime JS**: Most components compile to static HTML + CSS

**Alternatives Considered**:

- **Flowbite Svelte**: Less accessible, opinionated styling, harder to customize
- **Carbon Components Svelte**: IBM design system, too enterprise-heavy for Argos
- **Skeleton UI**: Good DX but less mature accessibility support
- **Custom components**: Would require 2-3 weeks to build accessible primitives

**Installation Process**:

```bash
# Install shadcn-svelte CLI
npx shadcn-svelte@latest init

# Add individual components as needed
npx shadcn-svelte@latest add button
npx shadcn-svelte@latest add input
npx shadcn-svelte@latest add card
npx shadcn-svelte@latest add dialog
```

**Best Practices**:

- Install only components actually needed (tree-shaking optimization)
- Customize theme in `tailwind.config.js` for Argos cyberpunk aesthetic
- Use `clsx` for conditional className logic
- Use `tailwind-merge` to resolve class conflicts

**Performance Validation**:

- Measure component render time on Raspberry Pi 5 ARM CPU
- Target: < 16ms per render (60 FPS, NFR-002)
- Use Playwright performance tracing: `await page.tracing.start({ screenshots: true })`

---

### 1.3 clsx + tailwind-merge

**Decision**: Use `clsx` for conditional classes, `tailwind-merge` for conflict resolution

**Rationale**:

- **clsx** (~1KB): Lightweight utility for building className strings conditionally
- **tailwind-merge** (~10KB): Resolves conflicting Tailwind classes intelligently
- Both are **required dependencies for shadcn-svelte**

**Usage Pattern**:

```typescript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combine both for optimal className handling
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// In components
<button class={cn('px-4 py-2 bg-blue-500', isActive && 'bg-blue-700', className)} />
```

---

## 2. Migration Strategies

### 2.1 P1: Type Safety Migration (1-2 weeks)

**Approach**: File-by-file incremental migration with validation after each file

**Strategy**:

1. **Audit type assertions**: Run `grep -r "as " src/ --include="*.ts" | wc -l` to count assertions
2. **Categorize by type**:
    - API responses (highest priority - external data)
    - Database query results (medium priority - trusted but unvalidated)
    - WebSocket messages (high priority - real-time data)
    - Internal type narrowing (low priority - can keep with justification)
3. **Create common schemas first**: `SignalReading`, `WifiNetwork`, `GpsPosition`, `ApiResponse<T>`
4. **Migrate file-by-file**:
    - Read file → identify type assertions
    - Create/reuse Zod schema
    - Replace `as Type` with `TypeSchema.parse()`
    - Run `npm run typecheck` → fix errors
    - Run `npm run test:unit` → verify tests pass
    - Commit with `refactor(types): T### — add Zod validation to [filename]`

**Rollback Strategy**: Each file is its own commit - revert individual commits if issues arise

**Error Handling Pattern**:

```typescript
// Console logging (Docker logs)
try {
	const data = ApiResponseSchema.parse(response);
	return data;
} catch (error) {
	if (error instanceof z.ZodError) {
		console.error('[API] Validation failed:', {
			endpoint: '/api/hackrf/sweep',
			errors: error.format(),
			input: response,
			stack: error.stack
		});
	}
	throw error; // Re-throw for caller to handle
}

// UI notifications (user-initiated actions only)
async function handleFormSubmit() {
	const result = FormDataSchema.safeParse(formData);
	if (!result.success) {
		// Show toast notification
		toastError('Invalid form data. Please check your inputs.');
		// Log detailed error for debugging
		console.error('[Form] Validation failed:', result.error.format());
		return;
	}
	// Proceed with valid data
}
```

---

### 2.2 P2: UI Migration (1-2 weeks)

**Approach**: Component-by-component replacement with visual regression testing

**Strategy**:

1. **Capture visual baseline** (BEFORE migration):

    ```bash
    npx playwright test --project=chromium --grep="visual" --update-snapshots
    ```

    Scenarios to capture:
    - Default/idle dashboard state
    - HackRF panel active with FFT stream
    - Kismet panel active with WiFi networks
    - GPS panel active with positioning
    - Tactical Map panel active
    - Multiple panels active simultaneously
    - Error state (simulated hardware disconnect)
    - Responsive view (if applicable)

2. **Install Shadcn**:

    ```bash
    npx shadcn-svelte@latest init
    npx shadcn-svelte@latest add button input card dialog badge
    ```

3. **Update Tailwind config** for Argos cyberpunk theme:

    ```javascript
    // tailwind.config.js
    module.exports = {
    	theme: {
    		extend: {
    			colors: {
    				// Preserve Argos cyberpunk palette
    				primary: { ... },
    				secondary: { ... }
    			},
    			borderRadius: {
    				// Shadcn defaults with adjustments
    				lg: '0.5rem',
    				md: '0.375rem'
    			}
    		}
    	}
    };
    ```

4. **Migrate components one-by-one**:
    - Identify custom Button/Input/Card in `src/lib/components/`
    - Replace with Shadcn component
    - Verify functionality identical (same click handlers, same data flow)
    - Run visual regression: `npx playwright test --grep="visual"`
    - Commit with `refactor(ui): T### — replace [ComponentName] with Shadcn primitive`

**Accessibility Verification**:

```bash
# Install axe-core for automated accessibility testing
npm install --save-dev @axe-core/playwright

# Run accessibility audit
npx playwright test --grep="a11y"
```

**Rollback Strategy**: Each component replacement is its own commit - revert if visual regression fails

---

### 2.3 P3: Service Layer Refactor (1-2 weeks)

**Approach**: Seven-phase sequential migration with full test suite after each phase

**7-Phase Plan** (from audit report `02-service-layer-violations/remediation-plan.md`):

1. **Phase 1: Kismet**
    - Move `src/lib/services/websocket/kismet.ts` → `src/lib/kismet/websocket.ts`
    - Move related types, stores, API calls to `src/lib/kismet/`
    - Update all import paths
    - Run full test suite → verify WebSocket connection works
2. **Phase 2: HackRF**
    - Move `src/lib/services/websocket/hackrf.ts` → `src/lib/hackrf/websocket.ts`
    - Move spectrum analysis, sweep logic to `src/lib/hackrf/`
    - Update imports → test suite → verify FFT stream works
3. **Phase 3: GPS**
    - Move GPS API/positioning to `src/lib/gps/`
    - Update imports → test suite
4. **Phase 4: USRP**
    - Move `src/lib/services/usrp/` → `src/lib/usrp/`
    - Update imports → test suite
5. **Phase 5: Tactical Map**
    - Move `src/lib/services/tactical-map/` → `src/lib/tactical-map/`
    - Update imports → test suite
6. **Phase 6: WebSocket Base**
    - Extract shared WebSocket base code to `src/lib/server/websocket-base.ts`
    - Update feature modules to import base
    - Test suite
7. **Phase 7: Cleanup**
    - Delete empty `src/lib/services/` directory
    - Verify no broken imports: `npm run typecheck`
    - Final test suite run

**Import Path Update Strategy**:

- Use TypeScript compiler to catch broken imports (`npm run typecheck`)
- Use ESLint to catch unused imports (`npm run lint`)
- Manual grep for lingering references: `grep -r "from.*services" src/`

**Rollback Strategy**: Each phase is its own commit - revert to last working phase if issues arise

---

## 3. Performance Benchmarking

### 3.1 Zod Validation Overhead

**Benchmark Script**: `scripts/benchmark-zod-validation.ts`

```typescript
import { z } from 'zod';

const SignalSchema = z.object({
	frequency: z.number(),
	power: z.number(),
	timestamp: z.number(),
	source: z.enum(['hackrf', 'usrp'])
});

const iterations = 10000;
const testData = { frequency: 915.5, power: -45.2, timestamp: Date.now(), source: 'hackrf' };

console.time('Zod validation');
for (let i = 0; i < iterations; i++) {
	SignalSchema.parse(testData);
}
console.timeEnd('Zod validation');
// Expected: < 50ms for 10k validations = < 0.005ms per validation (well under 5ms budget)
```

**Target**: < 5ms per API response validation (NFR-001)

---

### 3.2 Shadcn Component Render Time

**Benchmark Script**: Playwright performance tracing

```typescript
// tests/performance/shadcn-render.spec.ts
import { test, expect } from '@playwright/test';

test('Shadcn Button renders within 16ms budget', async ({ page }) => {
	await page.tracing.start({ screenshots: true, snapshots: true });

	await page.goto('/');
	const startTime = Date.now();

	// Click button to trigger render
	await page.click('button:has-text("Start Scan")');

	const renderTime = Date.now() - startTime;
	await page.tracing.stop({ path: 'trace.zip' });

	expect(renderTime).toBeLessThan(16); // 60 FPS budget
});
```

**Target**: < 16ms per component render on RPi5 ARM (NFR-002)

---

### 3.3 Bundle Size Impact

**Measurement**:

```bash
# Before P2 migration
npm run build
ls -lh .svelte-kit/output/client/_app/immutable/chunks/*.js | awk '{sum+=$5} END {print sum}'

# After P2 migration
npm run build
# Compare bundle size

# Calculate percentage increase
# Target: < 5% increase (NFR-003)
```

**Expected Bundle Impact**:

- Zod: +8KB gzipped
- Shadcn components (Button, Input, Card, Dialog): +15-20KB gzipped
- clsx + tailwind-merge: +11KB gzipped
- **Total**: ~34-39KB increase (estimated 3-4% of current bundle)

---

## 4. Testing Strategy

### 4.1 P1 Testing (Type Safety)

**Unit Tests**: Add Zod validation tests alongside existing tests

```typescript
// src/lib/types/signal.test.ts
import { describe, it, expect } from 'vitest';
import { SignalReadingSchema } from './signal';

describe('SignalReadingSchema', () => {
	it('validates correct signal data', () => {
		const valid = { frequency: 915.5, power: -45.2, timestamp: 1234567890, source: 'hackrf' };
		expect(() => SignalReadingSchema.parse(valid)).not.toThrow();
	});

	it('rejects invalid frequency', () => {
		const invalid = { frequency: -100, power: -45.2, timestamp: 1234567890, source: 'hackrf' };
		expect(() => SignalReadingSchema.parse(invalid)).toThrow();
	});
});
```

**Integration Tests**: Verify API endpoints reject invalid data

```typescript
// tests/integration/api/hackrf.test.ts
import { describe, it, expect } from 'vitest';

describe('POST /api/hackrf/sweep', () => {
	it('returns 400 for invalid frequency range', async () => {
		const response = await fetch('/api/hackrf/sweep', {
			method: 'POST',
			body: JSON.stringify({ startFreq: -100, endFreq: 6000 })
		});
		expect(response.status).toBe(400);
		const error = await response.json();
		expect(error.message).toContain('frequency');
	});
});
```

---

### 4.2 P2 Testing (UI Migration)

**Visual Regression**: Playwright screenshot comparison

```typescript
// tests/e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test('Dashboard default state matches baseline', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveScreenshot('dashboard-default.png');
});

test('HackRF panel matches baseline', async ({ page }) => {
	await page.goto('/');
	await page.click('button:has-text("HackRF")');
	await expect(page).toHaveScreenshot('dashboard-hackrf-active.png');
});
```

**Accessibility Testing**: Automated axe-core audit

```typescript
// tests/e2e/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test('Dashboard passes WCAG 2.1 AA', async ({ page }) => {
	await page.goto('/');
	await injectAxe(page);
	await checkA11y(page, null, {
		detailedReport: true,
		detailedReportOptions: { html: true }
	});
});
```

---

### 4.3 P3 Testing (Service Layer Refactor)

**Integration Tests**: Verify WebSocket connections work after migration

```typescript
// tests/integration/websocket/kismet.test.ts
import { describe, it, expect } from 'vitest';
import { connectKismet } from '$lib/kismet/websocket';

describe('Kismet WebSocket', () => {
	it('connects and receives WiFi data', async () => {
		const connection = await connectKismet();
		const data = await new Promise((resolve) => {
			connection.on('wifi-network', resolve);
		});
		expect(data).toHaveProperty('ssid');
		connection.close();
	});
});
```

**End-to-End Tests**: Full user workflows

```typescript
// tests/e2e/hackrf-scan.spec.ts
import { test, expect } from '@playwright/test';

test('Complete HackRF scan workflow', async ({ page }) => {
	await page.goto('/');
	await page.click('button:has-text("HackRF")');
	await page.fill('input[name="startFreq"]', '88');
	await page.fill('input[name="endFreq"]', '108');
	await page.click('button:has-text("Start Scan")');

	// Verify FFT stream displays
	await expect(page.locator('canvas#fft-display')).toBeVisible();
	await expect(page.locator('text=Scanning')).toBeVisible();
});
```

---

## 5. Risk Mitigation

### 5.1 P1 Risks (Type Safety)

| Risk                                           | Mitigation                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Zod validation adds >5ms overhead              | Benchmark early, optimize schemas if needed                          |
| Breaking existing code with strict validation  | Use `.safeParse()` initially, migrate to `.parse()` after validation |
| Type inference breaks with complex Zod schemas | Use `z.infer<typeof Schema>` explicitly                              |

### 5.2 P2 Risks (UI Migration)

| Risk                                 | Mitigation                                                           |
| ------------------------------------ | -------------------------------------------------------------------- |
| Visual regressions                   | Visual regression baseline + screenshot comparison before deployment |
| Shadcn components don't support edge | Fallback to custom Tailwind classes while maintaining design system  |
| Performance on RPi5 ARM              | Benchmark render time early, optimize if needed                      |

### 5.3 P3 Risks (Service Layer Refactor)

| Risk                            | Mitigation                                                   |
| ------------------------------- | ------------------------------------------------------------ |
| WebSocket connections break     | Full test suite after each of 7 phases, rollback if failures |
| Import path errors (50+ files)  | TypeScript compiler + ESLint + manual grep verification      |
| Circular dependencies           | Phased approach prevents circular deps                       |
| Breaking real-time FFT/GPS data | Manual testing on actual hardware between phases             |

---

## 6. Deployment Strategy

### 6.1 Phase Deployment (Incremental Risk Reduction)

**P1 (Type Safety)**: Deploy to production immediately after merge

- **Duration**: 1-2 weeks development
- **Deployment**: Merge to `main` → deploy to RPi5 field units at NTC/JMRC
- **Evaluation**: Monitor for 1-2 weeks:
    - Zod validation errors in Docker logs
    - Performance impact (no degradation)
    - Operator feedback (no regressions)
- **Go/No-Go**: Proceed to P2 only if P1 validates successfully

**P2 (UI Migration)**: Deploy after P1 field validation

- **Duration**: 1-2 weeks development (after P1 evaluation completes)
- **Deployment**: Merge to `main` after operator screenshot approval
- **Evaluation**: Monitor for regressions

**P3 (Service Layer Refactor)**: Deploy after P2 field validation

- **Duration**: 1-2 weeks development (after P2 evaluation completes)
- **Deployment**: Merge to `main` after all 7 phases pass tests
- **Evaluation**: Monitor WebSocket uptime

---

## 7. Summary

**Dependencies Approved**: Zod, shadcn-svelte, clsx, tailwind-merge (pending user approval per Article IX §9.3)

**Migration Strategies Defined**:

- P1: File-by-file Zod migration with validation after each file
- P2: Component-by-component Shadcn migration with visual regression testing
- P3: Seven-phase service layer refactor with full test suite after each phase

**Performance Validation**: Benchmarking scripts for Zod overhead, Shadcn render time, bundle size impact

**Testing**: Unit tests (P1), visual regression + accessibility (P2), integration + E2E (P3)

**Deployment**: Incremental deployment with field evaluation checkpoints between phases

**Total Timeline**: 3-6 weeks across all three phases

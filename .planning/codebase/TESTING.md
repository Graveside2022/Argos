# Testing

> Mapped: 2026-02-24 | Source: tests/, src/\*_/_.test.ts, tests/setup.ts, package.json

## Test Framework

| Tool                      | Version | Purpose                                                              |
| ------------------------- | ------- | -------------------------------------------------------------------- |
| Vitest                    | 3.2.4   | Primary test runner (unit, integration, security, performance, load) |
| Playwright                | 1.53.2  | E2E browser tests                                                    |
| Puppeteer                 | 24.12.1 | Visual regression (screenshot comparison)                            |
| jsdom                     | 26.1.0  | Browser DOM simulation for unit tests                                |
| fast-check                | 4.5.3   | Property-based testing (security test suite)                         |
| pixelmatch                | 7.1.0   | Visual diff (pixel-level screenshot comparison)                      |
| @axe-core/playwright      | 4.11.1  | Accessibility testing                                                |
| @testing-library/jest-dom | 6.6.3   | DOM assertion matchers                                               |

## Test Structure

### Dual Location Pattern

Tests live in two places:

1. **Co-located** (`src/**/*.test.ts`) — 17 files, adjacent to source
2. **Dedicated** (`tests/`) — 22 files, organized by test type

```
src/                               # Co-located unit tests (17 files)
├── lib/data/tool-hierarchy.test.ts
├── lib/schemas/hardware.test.ts
├── lib/server/services/kismet.service.test.ts
├── lib/server/tak/cert-manager.test.ts
├── lib/server/tak/tak-package-parser.test.ts
├── lib/server/exec.test.ts
├── lib/server/api/error-utils.test.ts
├── lib/server/api/create-handler.test.ts
├── lib/server/result.test.ts
├── lib/server/retry.test.ts
├── lib/server/timeout.test.ts
├── lib/utils/mgrs-converter.test.ts
├── lib/utils/theme-colors.test.ts
├── lib/utils/gsm-tower-utils.test.ts
├── lib/components/components.test.ts
├── routes/api/tak/config/server.test.ts
└── routes/api/tak/enroll/server.test.ts

tests/                             # Dedicated test suites (22 files)
├── unit/                          # Additional unit tests
├── integration/                   # API + WebSocket integration
│   ├── app.test.ts
│   ├── api.test.ts
│   └── websocket.test.ts
├── security/                      # Security-specific tests
│   ├── auth.test.ts               # Auth middleware
│   ├── injection.test.ts          # Input injection prevention
│   ├── rate-limit.test.ts         # Rate limiting
│   ├── cors.test.ts               # CORS policy
│   ├── headers.test.ts            # Security headers
│   ├── ws-auth.test.ts            # WebSocket authentication
│   ├── body-size.test.ts          # Body size limits
│   ├── validation.test.ts         # Input validation
│   └── property-based.test.ts     # Property-based (fast-check)
├── e2e/                           # Playwright browser tests
│   ├── smoke.test.ts              # Smoke test
│   ├── user-flows.test.ts         # User journey tests
│   └── verify-kismet-ui.test.ts   # Kismet UI verification
├── visual/                        # Visual regression
│   ├── visual-regression.test.ts
│   └── pi-visual-regression.test.ts
├── performance/                   # Performance benchmarks
│   ├── benchmarks.test.ts
│   ├── persistence-benchmarks.test.ts
│   ├── store-benchmarks.test.ts
│   └── tak-markers.test.ts
├── load/                          # Load testing
│   └── dataVolumes.test.ts
└── setup.ts                       # Global test setup
```

## Test Commands

```bash
# Safe targeted run (recommended on RPi)
npx vitest run --no-coverage src/path/to/file.test.ts

# Suite runners
npm run test:unit          # src/ + tests/unit/ (vitest run)
npm run test:integration   # tests/integration/
npm run test:security      # tests/security/
npm run test:visual        # tests/visual/
npm run test:performance   # tests/performance/
npm run test:e2e           # Playwright (config/playwright.config.ts)
npm run test:all           # unit + integration + visual + performance

# Development
npm run test:watch         # Vitest watch mode
npm run test:ui            # Browser-based Vitest UI
npm run test:coverage      # Coverage with v8 provider
```

## Global Test Setup (`tests/setup.ts`)

The setup file provides these global mocks:

| Mock                                 | Purpose                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `WebSocket`                          | Stubbed WebSocket constructor (send, close, addEventListener)            |
| `fetch`                              | Mocked globally (integration tests restore via `globalThis.__realFetch`) |
| `localStorage`                       | In-memory mock (getItem, setItem, removeItem, clear)                     |
| `HTMLCanvasElement.getContext('2d')` | Proxy-based auto-stub (measureText, getImageData, etc.)                  |
| `ResizeObserver`                     | Stubbed (observe, unobserve, disconnect)                                 |
| `IntersectionObserver`               | Stubbed (observe, unobserve, disconnect)                                 |

Environment setup:

- Loads `.env` via `dotenv` for `ARGOS_API_KEY` and other env vars
- Falls back to test API key if `.env` not present: `test-api-key-for-vitest-minimum-32-chars-required`

## Testing Patterns

### Unit Test Pattern

```typescript
import { describe, it, expect, vi } from 'vitest';
import { safe } from '$lib/server/result';

describe('safe()', () => {
	it('returns [data, null] on success', async () => {
		const [data, err] = await safe(() => Promise.resolve(42));
		expect(err).toBeNull();
		expect(data).toBe(42);
	});

	it('returns [null, Error] on failure', async () => {
		const [data, err] = await safe(() => Promise.reject(new Error('fail')));
		expect(data).toBeNull();
		expect(err?.message).toBe('fail');
	});
});
```

### Security Test Pattern (Property-Based)

```typescript
import fc from 'fast-check';

it('rejects all SQL injection patterns', () => {
  fc.assert(fc.property(
    fc.constantFrom("'; DROP TABLE--", "1 OR 1=1", ...),
    (payload) => {
      expect(sanitize(payload)).not.toContain(payload);
    }
  ));
});
```

### Integration Test Pattern

Integration tests restore real `fetch` via `globalThis.__realFetch` for actual HTTP calls against the running dev server.

## Memory Safety on RPi 5

**CRITICAL**: Running `npm run test:unit` (full suite) is unsafe while VS Code Server / Antigravity is active. Combined memory exceeds available headroom (~2.7GB).

Safe approach:

```bash
# Always safe — targeted tests
npx vitest run --no-coverage src/lib/server/result.test.ts

# Only safe when VS Code is stopped
npm run test:unit
```

Vitest forks a worker process that loads ALL test files + SvelteKit transform → high RSS. `--max-old-space-size` doesn't reliably help because fork may not inherit it.

## Known Test Issues

4 pre-existing test failures (not blocking):

- `tests/load/dataVolumes.test.ts` — 3 failures
- `tests/performance/tak-markers.test.ts` — 1 failure

Unit tests (`npm run test:unit`) pass clean.

## Coverage

Coverage uses `@vitest/coverage-v8` provider:

```bash
npm run test:coverage    # Generates coverage report
```

No enforced coverage thresholds currently configured.

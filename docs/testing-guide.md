# Testing Strategies

## Test Organization

```
tests/
├── unit/              # Fast, isolated (services, utils, components)
├── integration/       # API endpoints, WebSocket, database
├── e2e/               # Playwright end-to-end (smoke.test.ts, workflows)
├── visual/            # Visual regression (screenshot baselines)
└── performance/       # Performance benchmarks
```

## Hardware-Dependent Code

**Problem:** Hardware unavailable in CI/CD or test environments.

**Solution:** Mock hardware interfaces with dependency injection.

```typescript
// Service with hardware abstraction
class HackRFService {
	private hardware: HackRFInterface;

	constructor(hardware?: HackRFInterface) {
		this.hardware = hardware ?? (env.MOCK_HARDWARE ? new MockHackRF() : new RealHackRF());
	}

	async getSpectrum() {
		return this.hardware.readSpectrum();
	}
}

// Test with mock
test('spectrum analysis returns valid data', async () => {
	const mockHardware = new MockHackRF();
	const service = new HackRFService(mockHardware);

	const spectrum = await service.getSpectrum();
	expect(spectrum.frequencies).toHaveLength(1024);
});
```

**Gotcha:** Test YOUR code's handling of hardware responses, not hardware behavior itself.

## Running Tests

**TDD workflow:**

```bash
npm run test:watch  # Watch mode for active development
```

**Pre-commit:**

```bash
npm run typecheck   # TypeScript errors
npm run lint        # ESLint errors
npm run test:unit   # Fast unit tests
```

**Pre-PR:**

```bash
npm run test:all               # Full test suite
npm run framework:validate-all # Framework integrity
```

**Visual regression:**

```bash
npm run test:visual:generate  # Generate baselines (when UI changes)
npm run test:visual           # Compare against baselines
```

## Isolated Hardware Testing

**Scripts:**

```bash
./scripts/dev/test-hackrf.sh      # Test HackRF detection
./scripts/dev/test-kismet.sh      # Test Kismet connection
./scripts/dev/test-gps.sh         # Test GPS module
./scripts/diagnose-hardware.sh    # Hardware diagnostics
```

## Integration Test Pattern

```typescript
// tests/integration/api/hackrf.test.ts
test('HackRF status endpoint returns hardware state', async () => {
	const response = await fetch('http://localhost:5173/api/hackrf/status', {
		headers: { 'X-API-Key': process.env.ARGOS_API_KEY! }
	});

	expect(response.status).toBe(200);
	const data = await response.json();
	expect(data).toHaveProperty('connected');
});
```

# ArgosFinal Test Suite

Comprehensive testing infrastructure for pixel-perfect validation and performance benchmarking.

## Quick Start

```bash
# Install test dependencies
npm install --save-dev vitest @testing-library/svelte @playwright/test

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:visual
npm run test:performance
```

## Test Structure

```
tests/
├── unit/           # Component and utility tests
├── integration/    # API and WebSocket tests
├── e2e/           # End-to-end user flows
├── visual/        # Visual regression tests
├── performance/   # Performance benchmarks
├── fixtures/      # Test data and mocks
└── helpers/       # Test utilities
```

## Visual Regression Testing

Generate baselines:

```bash
npm run test:visual -- --generate-baselines
```

Run visual tests:

```bash
npm run test:visual
```

## Performance Benchmarks

```bash
# Run with memory profiling
node --expose-gc ./node_modules/.bin/vitest run tests/performance/benchmarks.test.ts

# Generate performance report
npm run test:performance -- --reporter=html
```

## Key Features

- **Pixel-Perfect Validation**: 0.1% threshold for visual regression
- **API Testing**: Full endpoint coverage with performance metrics
- **WebSocket Testing**: Connection, message flow, and load tests
- **Component Testing**: Functional validation of all UI components
- **Performance Benchmarks**: Response times, memory usage, rendering FPS
- **E2E Flows**: Complete user journeys with Playwright

## CI Integration

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: |
      npm ci
      npm run test:unit
      npm run test:integration
      npm run test:visual
      npm run test:performance
```

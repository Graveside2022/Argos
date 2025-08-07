# Testing Directory Context

This file documents the comprehensive testing infrastructure for Argos.

## Directory Purpose

Multi-layered testing approach covering unit, integration, E2E, visual, and performance testing.

## Test Architecture

### Test Types Available
- **Unit Tests**: `npm run test:unit` - Component and function testing
- **Integration Tests**: `npm run test:integration` - Service integration testing  
- **E2E Tests**: `npm run test:e2e` - Full application testing with Playwright
- **Visual Tests**: `npm run test:visual` - Visual regression testing
- **Performance Tests**: `npm run test:performance` - Performance benchmarking
- **Smoke Tests**: `npm run test:smoke` - Critical path validation

### Testing Tools
- **Vitest** - Primary test runner and framework
- **Playwright** - End-to-end testing
- **Visual regression tools** - UI consistency validation

## Critical Testing Considerations

- Hardware integration tests must handle missing devices gracefully
- WebSocket connection testing requires careful setup/teardown
- Real-time data stream testing needs proper mocking
- GPS and RF signal testing requires simulation

## AI Agent Guidelines

- Always run full test suite before finalizing changes
- Mock hardware interfaces for consistent testing
- Maintain test isolation and cleanup
- Document test data requirements clearly
- Add tests for any new functionality
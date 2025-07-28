# Testing Strategy

## Testing Pyramid

```text
              E2E Tests
             /        \
        Integration Tests
           /            \
      Frontend Unit  Backend Unit
```

## Test Organization

### Frontend Tests

```text
apps/web/tests/
├── unit/
│   ├── components/
│   │   ├── SignalMap.test.ts
│   │   ├── SpectrumChart.test.ts
│   │   └── DeviceList.test.ts
│   ├── stores/
│   │   ├── signalStore.test.ts
│   │   └── authStore.test.ts
│   └── utils/
│       ├── geoUtils.test.ts
│       └── signalProcessing.test.ts
├── integration/
│   ├── api/
│   │   ├── signalApi.test.ts
│   │   └── authApi.test.ts
│   └── workflows/
│       ├── signalDetection.test.ts
│       └── missionPlanning.test.ts
├── performance/
│   ├── signal-load.test.ts
│   ├── map-rendering.test.ts
│   └── websocket-throughput.test.ts
└── setup.ts
```

### Backend Tests

```text
apps/api/tests/
├── unit/
│   ├── services/
│   │   ├── SignalService.test.ts
│   │   ├── DroneService.test.ts
│   │   └── AuthService.test.ts
│   ├── models/
│   │   ├── Signal.test.ts
│   │   └── Mission.test.ts
│   └── utils/
│       ├── spatialQuery.test.ts
│       └── validation.test.ts
├── integration/
│   ├── routes/
│   │   ├── signals.test.ts
│   │   ├── missions.test.ts
│   │   └── hardware.test.ts
│   └── database/
│       ├── migrations.test.ts
│       └── queries.test.ts
├── performance/
│   ├── load-testing.test.ts
│   ├── spatial-query-performance.test.ts
│   └── concurrent-writes.test.ts
└── fixtures/
    ├── signals.json
    └── missions.json
```

### E2E Tests

```text
tests/e2e/
├── scenarios/
│   ├── signal-detection-flow.spec.ts
│   ├── mission-planning-flow.spec.ts
│   ├── real-time-tracking.spec.ts
│   └── offline-sync.spec.ts
├── performance/
│   ├── large-dataset.spec.ts
│   └── multi-user-load.spec.ts
├── fixtures/
│   ├── test-signals.json
│   └── test-missions.json
├── helpers/
│   ├── auth.helper.ts
│   ├── api.helper.ts
│   └── signalGenerator.ts
└── playwright.config.ts
```

## Test Examples

### Frontend Component Test

```typescript
// apps/web/tests/unit/components/SignalMap.test.ts
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SignalMap from '$lib/components/SignalMap.svelte';
import { signalStore } from '$lib/stores/signalStore';

describe('SignalMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders signal markers on map', async () => {
    const mockSignals = [
      { id: '1', latitude: 40.7128, longitude: -74.0060, rssi: -70, frequency: 2437000000 },
      { id: '2', latitude: 40.7130, longitude: -74.0062, rssi: -65, frequency: 2437000000 }
    ];

    const { container } = render(SignalMap, {
      props: { signals: mockSignals, center: [40.7128, -74.0060], zoom: 15 }
    });

    await waitFor(() => {
      const markers = container.querySelectorAll('.leaflet-marker-icon');
      expect(markers).toHaveLength(2);
    });
  });

  it('updates heatmap on signal strength change', async () => {
    const { component, container } = render(SignalMap, {
      props: { signals: [], showHeatmap: true }
    });

    // Add new signal
    signalStore.addSignal({
      id: '3', latitude: 40.7132, longitude: -74.0064, rssi: -55, frequency: 2437000000
    });

    await waitFor(() => {
      const heatmapLayer = container.querySelector('.leaflet-heatmap-layer');
      expect(heatmapLayer).toBeTruthy();
    });
  });

  it('handles offline mode gracefully', async () => {
    // Mock offline state
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    const { getByText } = render(SignalMap, {
      props: { signals: [], enableOfflineMode: true }
    });

    expect(getByText('Offline Mode - Using Cached Map Tiles')).toBeTruthy();
  });
});
```

### Backend API Test

```typescript
// apps/api/tests/integration/routes/signals.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/app';
import { db } from '../../../src/db';
import { generateAuthToken } from '../../helpers/auth';

describe('POST /api/signals/batch', () => {
  let authToken: string;

  beforeEach(async () => {
    await db.migrate.latest();
    authToken = await generateAuthToken({ userId: 'test-user', role: 'operator' });
  });

  afterEach(async () => {
    await db.migrate.rollback();
  });

  it('successfully processes batch signal upload', async () => {
    const signals = [
      {
        timestamp: new Date().toISOString(),
        frequency: 2437000000,
        rssi: -70,
        latitude: 40.7128,
        longitude: -74.0060,
        altitude: 100,
        droneId: 'drone-1'
      },
      {
        timestamp: new Date().toISOString(),
        frequency: 2437000000,
        rssi: -65,
        latitude: 40.7130,
        longitude: -74.0062,
        altitude: 102,
        droneId: 'drone-1'
      }
    ];

    const response = await request(app)
      .post('/api/signals/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ signals })
      .expect(201);

    expect(response.body).toEqual({
      success: true,
      processed: 2,
      stored: 2,
      duplicates: 0
    });

    // Verify spatial indexing
    const nearbySignals = await db('signals')
      .whereRaw('signals_idx.minLat <= ? AND signals_idx.maxLat >= ?', [40.7129, 40.7129])
      .whereRaw('signals_idx.minLon <= ? AND signals_idx.maxLon >= ?', [-74.0061, -74.0061]);
    
    expect(nearbySignals).toHaveLength(2);
  });

  it('validates signal data schema', async () => {
    const invalidSignals = [
      {
        // Missing required fields
        frequency: 2437000000,
        rssi: -70
      }
    ];

    const response = await request(app)
      .post('/api/signals/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ signals: invalidSignals })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({
        field: 'signals[0].latitude',
        message: 'Required'
      })
    );
  });

  it('enforces rate limiting', async () => {
    // Make 100 requests rapidly
    const requests = Array(100).fill(null).map(() =>
      request(app)
        .post('/api/signals/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ signals: [] })
    );

    await Promise.all(requests);

    // 101st request should be rate limited
    const response = await request(app)
      .post('/api/signals/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ signals: [] })
      .expect(429);

    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

### E2E Test

```typescript
// tests/e2e/scenarios/signal-detection-flow.spec.ts
import { test, expect } from '@playwright/test';
import { setupTestData, cleanupTestData } from '../helpers/testData';

test.describe('Signal Detection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestData();
    await page.goto('/');
    
    // Login
    await page.fill('[data-testid="email"]', 'operator@test.com');
    await page.fill('[data-testid="password"]', 'test123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard');
  });

  test.afterEach(async () => {
    await cleanupTestData();
  });

  test('complete signal detection mission', async ({ page }) => {
    // Navigate to mission planning
    await page.click('[data-testid="new-mission"]');
    
    // Configure mission
    await page.selectOption('[data-testid="mission-type"]', 'signal-sweep');
    await page.fill('[data-testid="mission-name"]', 'Test Signal Detection');
    
    // Draw mission area on map
    await page.click('[data-testid="draw-area"]');
    await page.click('#map', { position: { x: 100, y: 100 } });
    await page.click('#map', { position: { x: 200, y: 100 } });
    await page.click('#map', { position: { x: 200, y: 200 } });
    await page.click('#map', { position: { x: 100, y: 200 } });
    await page.click('#map', { position: { x: 100, y: 100 } }); // Close polygon
    
    // Start mission
    await page.click('[data-testid="start-mission"]');
    
    // Verify real-time updates
    await expect(page.locator('[data-testid="mission-status"]')).toContainText('Active');
    
    // Wait for signals to appear
    await page.waitForSelector('[data-testid="signal-marker"]', { timeout: 10000 });
    
    // Verify signal details
    const firstSignal = page.locator('[data-testid="signal-marker"]').first();
    await firstSignal.click();
    
    await expect(page.locator('[data-testid="signal-details"]')).toContainText('Frequency:');
    await expect(page.locator('[data-testid="signal-details"]')).toContainText('RSSI:');
    
    // Test offline capability
    await page.context().setOffline(true);
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    
    // Verify data persists offline
    await page.reload();
    await expect(page.locator('[data-testid="signal-marker"]')).toHaveCount(await page.locator('[data-testid="signal-marker"]').count());
    
    // Go back online and verify sync
    await page.context().setOffline(false);
    await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Synced');
  });

  test('handles hardware disconnection gracefully', async ({ page }) => {
    await page.goto('/hardware-status');
    
    // Verify initial connection
    await expect(page.locator('[data-testid="hackrf-status"]')).toContainText('Connected');
    
    // Simulate disconnection via API
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('hardware-disconnect', { detail: { device: 'hackrf' } }));
    });
    
    // Verify UI updates
    await expect(page.locator('[data-testid="hackrf-status"]')).toContainText('Disconnected');
    await expect(page.locator('[data-testid="reconnect-button"]')).toBeVisible();
    
    // Test reconnection
    await page.click('[data-testid="reconnect-button"]');
    await expect(page.locator('[data-testid="hackrf-status"]')).toContainText('Reconnecting...');
  });
});
```

### Performance Test Suite

```typescript
// tests/performance/signal-load.test.ts
import { test, expect } from '@playwright/test';
import { generateSignals } from '../helpers/signalGenerator';

test.describe('Signal Load Performance', () => {
  test('handles 10,000 concurrent signals', async ({ page }) => {
    await page.goto('/tactical-map');
    
    const signals = generateSignals(10000);
    
    // Measure rendering performance
    const startTime = Date.now();
    await page.evaluate((signals) => {
      window.postMessage({ type: 'BULK_SIGNAL_UPDATE', signals }, '*');
    }, signals);
    
    const renderTime = Date.now() - startTime;
    expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    
    // Verify no dropped signals
    const renderedCount = await page.locator('[data-testid="signal-marker"]').count();
    expect(renderedCount).toBe(10000);
    
    // Check memory usage
    const metrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize / 1048576, // Convert to MB
          totalJSHeapSize: performance.memory.totalJSHeapSize / 1048576
        };
      }
      return null;
    });
    
    if (metrics) {
      expect(metrics.usedJSHeapSize).toBeLessThan(200); // Should use less than 200MB
    }
  });

  test('maintains 60fps during signal updates', async ({ page }) => {
    await page.goto('/tactical-map');
    
    // Start performance measurement
    await page.evaluate(() => {
      window.frameCount = 0;
      window.startTime = performance.now();
      
      function countFrames() {
        window.frameCount++;
        if (performance.now() - window.startTime < 1000) {
          requestAnimationFrame(countFrames);
        }
      }
      requestAnimationFrame(countFrames);
    });
    
    // Stream signals for 1 second
    const updateInterval = setInterval(() => {
      page.evaluate(() => {
        window.postMessage({ 
          type: 'SIGNAL_UPDATE', 
          signal: {
            id: Math.random().toString(),
            latitude: 40.7128 + (Math.random() - 0.5) * 0.01,
            longitude: -74.0060 + (Math.random() - 0.5) * 0.01,
            rssi: -70 + Math.random() * 20,
            frequency: 2437000000
          }
        }, '*');
      });
    }, 16); // ~60Hz updates
    
    await page.waitForTimeout(1000);
    clearInterval(updateInterval);
    
    // Check frame rate
    const fps = await page.evaluate(() => window.frameCount);
    expect(fps).toBeGreaterThan(55); // Allow slight variation from 60fps
  });
});
```

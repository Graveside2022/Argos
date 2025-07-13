import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

test.describe('End-to-End User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test.describe('Spectrum Analysis Flow', () => {
    test('should complete full spectrum analysis workflow', async ({ page }) => {
      // Navigate to spectrum page
      await page.click('nav >> text=Spectrum');
      await expect(page).toHaveURL(`${BASE_URL}/spectrum`);

      // Wait for spectrum canvas
      await page.waitForSelector('.spectrum-canvas');

      // Configure spectrum settings
      await page.fill('input[name="centerFrequency"]', '100000000');
      await page.fill('input[name="sampleRate"]', '2400000');
      await page.selectOption('select[name="gain"]', '30');
      
      // Apply settings
      await page.click('button:has-text("Apply Settings")');
      
      // Verify spectrum is updating
      await page.waitForTimeout(1000);
      const canvas = page.locator('.spectrum-canvas');
      await expect(canvas).toBeVisible();

      // Take screenshot for visual verification
      await page.screenshot({ path: 'tests/e2e/screenshots/spectrum-active.png' });

      // Test zoom functionality
      await page.click('button[aria-label="Zoom In"]');
      await page.waitForTimeout(500);
      
      // Test pause/resume
      await page.click('button:has-text("Pause")');
      await expect(page.locator('button:has-text("Resume")')).toBeVisible();
      
      await page.click('button:has-text("Resume")');
      await expect(page.locator('button:has-text("Pause")')).toBeVisible();
    });

    test('should save and load spectrum presets', async ({ page }) => {
      await page.click('nav >> text=Spectrum');
      
      // Configure custom settings
      await page.fill('input[name="centerFrequency"]', '433920000');
      await page.fill('input[name="sampleRate"]', '1000000');
      
      // Save preset
      await page.click('button:has-text("Save Preset")');
      await page.fill('input[placeholder="Preset name"]', 'ISM 433MHz');
      await page.click('button:has-text("Save")');
      
      // Verify preset saved
      await expect(page.locator('text=Preset saved successfully')).toBeVisible();
      
      // Change settings
      await page.fill('input[name="centerFrequency"]', '100000000');
      
      // Load preset
      await page.click('button:has-text("Load Preset")');
      await page.click('text=ISM 433MHz');
      
      // Verify settings restored
      await expect(page.locator('input[name="centerFrequency"]')).toHaveValue('433920000');
    });
  });

  test.describe('Frequency Sweep Flow', () => {
    test('should perform frequency sweep and detect signals', async ({ page }) => {
      await page.click('nav >> text=Sweep');
      await expect(page).toHaveURL(`${BASE_URL}/sweep`);

      // Configure sweep parameters
      await page.fill('input[name="startFrequency"]', '88000000');
      await page.fill('input[name="endFrequency"]', '108000000');
      await page.fill('input[name="stepSize"]', '100000');
      await page.fill('input[name="dwellTime"]', '100');

      // Start sweep
      await page.click('button:has-text("Start Sweep")');
      
      // Verify sweep is running
      await expect(page.locator('.progress-bar')).toBeVisible();
      await expect(page.locator('button:has-text("Stop Sweep")')).toBeVisible();

      // Wait for some progress
      await page.waitForTimeout(3000);
      
      // Check for detected signals
      const signalList = page.locator('.detected-signals');
      await expect(signalList).toBeVisible();
      
      // Stop sweep
      await page.click('button:has-text("Stop Sweep")');
      await expect(page.locator('button:has-text("Start Sweep")')).toBeVisible();

      // Export results
      await page.click('button:has-text("Export Results")');
      const download = await page.waitForEvent('download');
      expect(download.suggestedFilename()).toContain('sweep-results');
    });

    test('should visualize sweep results in real-time', async ({ page }) => {
      await page.click('nav >> text=Sweep');
      
      // Start sweep
      await page.click('button:has-text("Start Sweep")');
      
      // Verify waterfall display updates
      await page.waitForSelector('.waterfall-display');
      await page.waitForTimeout(2000);
      
      // Check for peak detection markers
      const peakMarkers = page.locator('.peak-marker');
      const count = await peakMarkers.count();
      expect(count).toBeGreaterThanOrEqual(0);
      
      // Test interactive features
      const waterfall = page.locator('.waterfall-display');
      await waterfall.hover();
      await expect(page.locator('.frequency-tooltip')).toBeVisible();
    });
  });

  test.describe('Device Tracking Flow', () => {
    test('should track and display WiFi devices', async ({ page }) => {
      await page.click('nav >> text=Devices');
      await expect(page).toHaveURL(`${BASE_URL}/devices`);

      // Wait for device list to load
      await page.waitForSelector('.device-card', { timeout: 10000 });
      
      // Verify device cards are displayed
      const deviceCards = page.locator('.device-card');
      const count = await deviceCards.count();
      expect(count).toBeGreaterThan(0);

      // Click on a device for details
      await deviceCards.first().click();
      
      // Verify device details modal
      await expect(page.locator('.device-details-modal')).toBeVisible();
      await expect(page.locator('text=Signal History')).toBeVisible();
      await expect(page.locator('.signal-graph')).toBeVisible();

      // Test filtering
      await page.click('[aria-label="Close modal"]');
      await page.fill('input[placeholder="Search devices..."]', 'iPhone');
      
      // Verify filtered results
      const filteredCards = await page.locator('.device-card').count();
      expect(filteredCards).toBeLessThanOrEqual(count);

      // Test signal strength filter
      await page.selectOption('select[name="signalFilter"]', 'strong');
      await page.waitForTimeout(500);
      
      // Verify only strong signal devices shown
      const signalIndicators = page.locator('.signal-strength');
      for (let i = 0; i < await signalIndicators.count(); i++) {
        const signal = await signalIndicators.nth(i).textContent();
        if (signal) {
          const dbm = parseInt(signal.replace(' dBm', ''));
          expect(dbm).toBeGreaterThan(-70);
        }
      }
    });

    test('should update device locations on map', async ({ page }) => {
      await page.click('nav >> text=Map');
      await expect(page).toHaveURL(`${BASE_URL}/map`);

      // Wait for map to load
      await page.waitForSelector('.map-container');
      await page.waitForTimeout(2000); // Wait for map tiles

      // Verify device markers
      const markers = page.locator('.device-marker');
      const markerCount = await markers.count();
      expect(markerCount).toBeGreaterThan(0);

      // Click on a marker
      await markers.first().click();
      
      // Verify popup with device info
      await expect(page.locator('.marker-popup')).toBeVisible();
      await expect(page.locator('.marker-popup >> text=MAC:')).toBeVisible();
      await expect(page.locator('.marker-popup >> text=Signal:')).toBeVisible();

      // Test real-time updates
      await page.waitForTimeout(5000);
      
      // Verify marker positions may have updated
      const updatedMarkers = await page.locator('.device-marker').count();
      expect(updatedMarkers).toBeGreaterThanOrEqual(markerCount);
    });
  });

  test.describe('Integration Flow', () => {
    test('should integrate spectrum analysis with device detection', async ({ page }) => {
      // Start with spectrum analysis
      await page.click('nav >> text=Spectrum');
      
      // Enable device detection mode
      await page.click('button:has-text("Enable Device Detection")');
      await expect(page.locator('text=Device detection active')).toBeVisible();

      // Navigate to devices while detection is running
      await page.click('nav >> text=Devices');
      
      // Verify new devices are being detected
      const initialCount = await page.locator('.device-card').count();
      await page.waitForTimeout(10000);
      const newCount = await page.locator('.device-card').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('should export comprehensive report', async ({ page }) => {
      // Collect data from multiple sources
      await page.click('nav >> text=Spectrum');
      await page.waitForTimeout(2000);
      
      await page.click('nav >> text=Devices');
      await page.waitForTimeout(2000);
      
      // Generate report
      await page.click('button[aria-label="Menu"]');
      await page.click('text=Generate Report');
      
      // Configure report options
      await page.check('input[name="includeSpectrum"]');
      await page.check('input[name="includeDevices"]');
      await page.check('input[name="includeMap"]');
      
      // Generate report
      await page.click('button:has-text("Generate PDF Report")');
      
      // Wait for download
      const download = await page.waitForEvent('download');
      expect(download.suggestedFilename()).toContain('argos-report');
      expect(download.suggestedFilename()).toContain('.pdf');
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle connection loss gracefully', async ({ page }) => {
      await page.click('nav >> text=Spectrum');
      
      // Simulate offline mode
      await page.context().setOffline(true);
      await page.waitForTimeout(2000);
      
      // Verify error message
      await expect(page.locator('text=Connection lost')).toBeVisible();
      
      // Restore connection
      await page.context().setOffline(false);
      await page.waitForTimeout(2000);
      
      // Verify reconnection
      await expect(page.locator('text=Connected')).toBeVisible();
    });

    test('should validate user inputs', async ({ page }) => {
      await page.click('nav >> text=Sweep');
      
      // Invalid frequency range
      await page.fill('input[name="startFrequency"]', '108000000');
      await page.fill('input[name="endFrequency"]', '88000000');
      await page.click('button:has-text("Start Sweep")');
      
      // Verify error message
      await expect(page.locator('text=Start frequency must be less than end frequency')).toBeVisible();
      
      // Invalid step size
      await page.fill('input[name="startFrequency"]', '88000000');
      await page.fill('input[name="stepSize"]', '0');
      await page.click('button:has-text("Start Sweep")');
      
      await expect(page.locator('text=Step size must be greater than 0')).toBeVisible();
    });
  });

  test.describe('Accessibility Tests', () => {
    test('should be navigable with keyboard', async ({ page }) => {
      // Tab through navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Verify navigation worked
      await expect(page).toHaveURL(/spectrum|sweep|devices|map/);
      
      // Tab through form controls
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON', 'SELECT']).toContain(focusedElement);
    });

    test('should have proper ARIA labels', async ({ page }) => {
      const ariaElements = page.locator('[aria-label], [aria-describedby], [role]');
      const count = await ariaElements.count();
      expect(count).toBeGreaterThan(10);
      
      // Verify important controls have labels
      await expect(page.locator('button[aria-label="Zoom In"]')).toBeVisible();
      await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    });
  });
});
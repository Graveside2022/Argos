#!/usr/bin/env node
/* eslint-env node, browser */
/**
 * Visual Regression Check Script
 * Part of the Feature Creep Prevention Framework
 * 
 * This script performs pixel-perfect comparison between current
 * implementation and baseline screenshots to detect any visual changes.
 */

const puppeteer = require('puppeteer');
const pixelmatch = require('pixelmatch');
const PNG = require('pngjs').PNG;
const fs = require('fs');
const path = require('path');
const { logError, logWarn, logInfo } = require('./logger.cjs');

const BASELINE_DIR = './visual-baselines';
const CURRENT_DIR = './visual-current';
const DIFF_DIR = './visual-diffs';

// Test configurations for different components and viewports
const TEST_CONFIGS = [
  {
    name: 'hackrf-desktop',
    url: 'http://localhost:8006/hackrf',
    viewport: { width: 1920, height: 1080 },
    waitFor: '.spectrum-chart', // Wait for key component to load
  },
  {
    name: 'hackrf-tablet',
    url: 'http://localhost:8006/hackrf',
    viewport: { width: 768, height: 1024 },
    waitFor: '.spectrum-chart',
  },
  {
    name: 'hackrf-mobile',
    url: 'http://localhost:8006/hackrf',
    viewport: { width: 375, height: 667 },
    waitFor: '.spectrum-chart',
  },
  {
    name: 'kismet-desktop',
    url: 'http://localhost:8006/kismet',
    viewport: { width: 1920, height: 1080 },
    waitFor: '.device-list', // Wait for Kismet component to load
  },
  {
    name: 'kismet-tablet',
    url: 'http://localhost:8006/kismet',
    viewport: { width: 768, height: 1024 },
    waitFor: '.device-list',
  },
  {
    name: 'kismet-mobile',
    url: 'http://localhost:8006/kismet',
    viewport: { width: 375, height: 667 },
    waitFor: '.device-list',
  }
];

// Ensure directories exist
[BASELINE_DIR, CURRENT_DIR, DIFF_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function captureScreenshot(config, outputDir) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport(config.viewport);
    
    // Navigate to page
    await page.goto(config.url, { waitUntil: 'networkidle0' });
    
    // Wait for critical elements to load
    try {
      await page.waitForSelector(config.waitFor, { timeout: 10000 });
    } catch {
      logWarn(`Could not find selector ${config.waitFor} for ${config.name}`);
    }
    
    // Wait additional time for animations to complete
    await page.waitForTimeout(2000);
    
    // Hide dynamic elements that change between screenshots
    await page.evaluate(() => {
      // Hide timestamps, loading indicators, etc.
      // eslint-disable-next-line no-undef
      const dynamicElements = document.querySelectorAll(
        '.timestamp, .loading-indicator, .current-time, [data-dynamic="true"]'
      );
      dynamicElements.forEach(el => el.style.visibility = 'hidden');
    });
    
    // Capture screenshot
    const filename = `${config.name}.png`;
    const filepath = path.join(outputDir, filename);
    
    await page.screenshot({
      path: filepath,
      fullPage: true,
      type: 'png'
    });
    
    return filepath;
  } finally {
    await browser.close();
  }
}

function compareImages(baselinePath, currentPath, diffPath) {
  if (!fs.existsSync(baselinePath)) {
    logWarn(`No baseline found for ${baselinePath}. Creating baseline...`);
    fs.copyFileSync(currentPath, baselinePath);
    return { match: true, pixelDifference: 0, isNewBaseline: true };
  }
  
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath));
  const current = PNG.sync.read(fs.readFileSync(currentPath));
  
  // Check if dimensions match
  if (baseline.width !== current.width || baseline.height !== current.height) {
    logError(`Dimension mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`);
    return { match: false, pixelDifference: -1, error: 'Dimension mismatch' };
  }
  
  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  
  const pixelDifference = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.0, // Exact match required (no tolerance)
      includeAA: false, // Don't ignore anti-aliasing
      alpha: 0.1
    }
  );
  
  // Save diff image if there are differences
  if (pixelDifference > 0) {
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
  }
  
  return {
    match: pixelDifference === 0,
    pixelDifference,
    totalPixels: width * height,
    percentageDiff: (pixelDifference / (width * height)) * 100
  };
}

async function runVisualRegressionTest(generateBaseline = false) {
  logInfo('🔍 Starting Visual Regression Test...');
  logInfo('Feature Creep Prevention Framework - Visual Preservation Check');
  logInfo('='.repeat(70));
  
  const results = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const config of TEST_CONFIGS) {
    logInfo(`\n📸 Testing: ${config.name}`);
    logInfo(`   URL: ${config.url}`);
    logInfo(`   Viewport: ${config.viewport.width}x${config.viewport.height}`);
    
    try {
      // Capture current screenshot
      const currentPath = await captureScreenshot(config, CURRENT_DIR);
      logInfo(`   ✅ Screenshot captured: ${currentPath}`);
      
      if (generateBaseline) {
        // Copy current to baseline when generating baselines
        const baselinePath = path.join(BASELINE_DIR, `${config.name}.png`);
        fs.copyFileSync(currentPath, baselinePath);
        logInfo(`   📋 Baseline created: ${baselinePath}`);
        results.push({ config: config.name, status: 'baseline-created' });
        continue;
      }
      
      // Compare with baseline
      const baselinePath = path.join(BASELINE_DIR, `${config.name}.png`);
      const diffPath = path.join(DIFF_DIR, `${config.name}.png`);
      
      const comparison = compareImages(baselinePath, currentPath, diffPath);
      
      totalTests++;
      
      if (comparison.match) {
        logInfo(`   ✅ PASS - Perfect match (0 pixel difference)`);
        passedTests++;
        results.push({
          config: config.name,
          status: 'pass',
          pixelDifference: 0,
          isNewBaseline: comparison.isNewBaseline || false
        });
      } else {
        logError(`   ❌ FAIL - ${comparison.pixelDifference} pixels differ (${comparison.percentageDiff?.toFixed(4)}%)`);
        logInfo(`   📊 Diff saved: ${diffPath}`);
        failedTests++;
        results.push({
          config: config.name,
          status: 'fail',
          pixelDifference: comparison.pixelDifference,
          percentageDiff: comparison.percentageDiff,
          error: comparison.error
        });
      }
      
    } catch (error) {
      logError(`   ❌ ERROR: ${error.message}`);
      totalTests++;
      failedTests++;
      results.push({
        config: config.name,
        status: 'error',
        error: error.message
      });
    }
  }
  
  // Generate summary report
  logInfo('\n' + '='.repeat(70));
  logInfo('📊 VISUAL REGRESSION TEST SUMMARY');
  logInfo('='.repeat(70));
  
  if (generateBaseline) {
    logInfo('📋 Baseline generation completed');
    logInfo(`   Created ${TEST_CONFIGS.length} baseline screenshots`);
  } else {
    logInfo(`📈 Total Tests: ${totalTests}`);
    logInfo(`✅ Passed: ${passedTests}`);
    logInfo(`❌ Failed: ${failedTests}`);
    logInfo(`📊 Success Rate: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%`);
    
    if (failedTests > 0) {
      logError('\n❌ FEATURE CREEP PREVENTION ALERT:');
      logError('   Visual changes detected! This violates the preservation framework.');
      logError('   See diff images in:', DIFF_DIR);
      logError('   Immediate rollback required per framework rules.');
    } else {
      logInfo('\n✅ VISUAL PRESERVATION VERIFIED:');
      logInfo('   All components match baseline exactly.');
      logInfo('   Zero unauthorized visual changes detected.');
    }
  }
  
  // Save detailed results
  const reportPath = './visual-regression-report.json';
  const report = {
    timestamp: new Date().toISOString(),
    totalTests,
    passedTests,
    failedTests,
    successRate: totalTests > 0 ? ((passedTests / totalTests) * 100) : 0,
    results,
    frameworkCompliant: failedTests === 0
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logInfo(`\n📄 Detailed report saved: ${reportPath}`);
  
  // Exit with appropriate code
  if (generateBaseline) {
    process.exit(0);
  } else {
    process.exit(failedTests > 0 ? 1 : 0);
  }
}

// Command line interface
const args = process.argv.slice(2);
const generateBaseline = args.includes('--generate-baseline') || args.includes('-g');

if (args.includes('--help') || args.includes('-h')) {
  logInfo(`
Visual Regression Check - Feature Creep Prevention Framework

Usage:
  node visual-regression-check.js [options]

Options:
  -g, --generate-baseline   Generate new baseline screenshots
  -h, --help               Show this help message

Description:
  This script performs pixel-perfect comparison between the current
  implementation and baseline screenshots to detect any unauthorized
  visual changes during the Argos migration.

  The script enforces zero-tolerance for visual changes as per the
  Feature Creep Prevention Framework binding rules.
  `);
  process.exit(0);
}

// Run the test
runVisualRegressionTest(generateBaseline).catch(error => {
  logError('Fatal error in visual regression test:', error);
  process.exit(1);
});
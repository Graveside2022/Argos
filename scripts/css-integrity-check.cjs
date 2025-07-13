#!/usr/bin/env node
/* eslint-env node */
/**
 * CSS Integrity Check Script
 * Part of the Feature Creep Prevention Framework
 * 
 * This script validates that all CSS files remain exactly as they were
 * in the original implementation, detecting any unauthorized modifications.
 */

const fs = require('fs');
const crypto = require('crypto');
const { logError, logWarn, logInfo } = require('./logger.cjs');

// CSS files that must be preserved exactly
const PROTECTED_CSS_FILES = [
  'src/lib/styles/hackrf/style.css',
  'src/lib/styles/hackrf/monochrome-theme.css',
  'src/lib/styles/hackrf/geometric-backgrounds.css',
  'src/lib/styles/hackrf/custom-components-exact.css',
  'src/lib/styles/hackrf/saasfly-buttons.css'
];

// Store original checksums (these would be generated during initial setup)
const BASELINE_CHECKSUMS_FILE = './css-integrity-baselines.json';

function calculateChecksum(filepath) {
  if (!fs.existsSync(filepath)) {
    return null;
  }
  
  const content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('md5').update(content).digest('hex');
}

function generateBaselines() {
  logInfo('📋 Generating CSS Integrity Baselines...');
  logInfo('='.repeat(60));
  
  const baselines = {};
  
  for (const file of PROTECTED_CSS_FILES) {
    const checksum = calculateChecksum(file);
    if (checksum) {
      baselines[file] = {
        checksum,
        size: fs.statSync(file).size,
        lastModified: fs.statSync(file).mtime.toISOString()
      };
      logInfo(`✅ ${file}: ${checksum}`);
    } else {
      logWarn(`⚠️  ${file}: File not found`);
      baselines[file] = null;
    }
  }
  
  fs.writeFileSync(BASELINE_CHECKSUMS_FILE, JSON.stringify(baselines, null, 2));
  logInfo(`\n📄 Baselines saved to: ${BASELINE_CHECKSUMS_FILE}`);
  
  return baselines;
}

function loadBaselines() {
  if (!fs.existsSync(BASELINE_CHECKSUMS_FILE)) {
    logWarn('⚠️  No baseline file found. Generating baselines...');
    return generateBaselines();
  }
  
  return JSON.parse(fs.readFileSync(BASELINE_CHECKSUMS_FILE, 'utf8'));
}

function analyzeCSS(filepath) {
  if (!fs.existsSync(filepath)) {
    return null;
  }
  
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  
  return {
    totalLines: lines.length,
    totalCharacters: content.length,
    cssRules: (content.match(/[^{}]+\{[^{}]*\}/g) || []).length,
    customProperties: (content.match(/--[\w-]+\s*:/g) || []).length,
    mediaQueries: (content.match(/@media[^{]+\{/g) || []).length,
    keyframes: (content.match(/@keyframes[^{]+\{/g) || []).length,
    colorValues: (content.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\)/g) || []).length
  };
}

function checkCSSIntegrity() {
  logInfo('🔍 CSS Integrity Check - Feature Creep Prevention');
  logInfo('='.repeat(60));
  
  const baselines = loadBaselines();
  const results = [];
  let totalFiles = 0;
  let intactFiles = 0;
  let modifiedFiles = 0;
  let missingFiles = 0;
  
  for (const file of PROTECTED_CSS_FILES) {
    logInfo(`\n📄 Checking: ${file}`);
    totalFiles++;
    
    const currentChecksum = calculateChecksum(file);
    const baseline = baselines[file];
    
    if (!currentChecksum) {
      logError(`   ❌ MISSING: File not found`);
      missingFiles++;
      results.push({
        file,
        status: 'missing',
        issue: 'File not found'
      });
      continue;
    }
    
    if (!baseline) {
      logWarn(`   ⚠️  NEW: No baseline exists`);
      results.push({
        file,
        status: 'new',
        currentChecksum,
        analysis: analyzeCSS(file)
      });
      continue;
    }
    
    if (currentChecksum === baseline.checksum) {
      logInfo(`   ✅ INTACT: Checksum matches baseline`);
      intactFiles++;
      results.push({
        file,
        status: 'intact',
        checksum: currentChecksum
      });
    } else {
      logError(`   ❌ MODIFIED: Checksum mismatch!`);
      logInfo(`      Expected: ${baseline.checksum}`);
      logInfo(`      Current:  ${currentChecksum}`);
      
      const currentStats = fs.statSync(file);
      const currentAnalysis = analyzeCSS(file);
      
      modifiedFiles++;
      results.push({
        file,
        status: 'modified',
        baselineChecksum: baseline.checksum,
        currentChecksum,
        sizeDifference: currentStats.size - baseline.size,
        analysis: currentAnalysis,
        violation: true
      });
    }
  }
  
  // Generate detailed report
  logInfo('\n' + '='.repeat(60));
  logInfo('📊 CSS INTEGRITY SUMMARY');
  logInfo('='.repeat(60));
  logInfo(`📈 Total Files: ${totalFiles}`);
  logInfo(`✅ Intact: ${intactFiles}`);
  logInfo(`❌ Modified: ${modifiedFiles}`);
  logInfo(`⚠️  Missing: ${missingFiles}`);
  
  const integrityScore = totalFiles > 0 ? ((intactFiles / totalFiles) * 100).toFixed(1) : 0;
  logInfo(`📊 Integrity Score: ${integrityScore}%`);
  
  if (modifiedFiles > 0) {
    logError('\n❌ FRAMEWORK VIOLATION DETECTED:');
    logError('   CSS files have been modified without authorization!');
    logError('   This violates the Feature Creep Prevention Framework.');
    logError('   Immediate rollback required.');
    
    // Show detailed changes
    logInfo('\n📋 MODIFICATION DETAILS:');
    results.filter(r => r.status === 'modified').forEach(result => {
      logInfo(`\n   File: ${result.file}`);
      logInfo(`   Size Change: ${result.sizeDifference > 0 ? '+' : ''}${result.sizeDifference} bytes`);
      if (result.analysis) {
        logInfo(`   CSS Rules: ${result.analysis.cssRules}`);
        logInfo(`   Custom Properties: ${result.analysis.customProperties}`);
        logInfo(`   Color Values: ${result.analysis.colorValues}`);
      }
    });
  } else if (missingFiles > 0) {
    logWarn('\n⚠️  MISSING FILES DETECTED:');
    logWarn('   Required CSS files are missing!');
    logWarn('   This may indicate a configuration problem.');
  } else {
    logInfo('\n✅ CSS INTEGRITY VERIFIED:');
    logInfo('   All CSS files match baseline exactly.');
    logInfo('   No unauthorized modifications detected.');
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalFiles,
    intactFiles,
    modifiedFiles,
    missingFiles,
    integrityScore: parseFloat(integrityScore),
    frameworkCompliant: modifiedFiles === 0 && missingFiles === 0,
    results
  };
  
  const reportPath = './css-integrity-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logInfo(`\n📄 Detailed report saved: ${reportPath}`);
  
  return report;
}

function validateCSSProperties() {
  logInfo('\n🎨 CSS Custom Properties Validation');
  logInfo('-'.repeat(40));
  
  const propertyViolations = [];
  
  for (const file of PROTECTED_CSS_FILES) {
    if (!fs.existsSync(file)) continue;
    
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for new CSS custom properties
      const newPropertyMatch = line.match(/--[\w-]+\s*:\s*[^;]+/);
      if (newPropertyMatch) {
        // This would need to be validated against a baseline
        // For now, just log for manual verification
        logInfo(`   Property in ${file}:${index + 1}: ${newPropertyMatch[0].trim()}`);
      }
      
      // Check for color value modifications
      const colorMatches = line.match(/#[0-9a-fA-F]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g);
      if (colorMatches) {
        colorMatches.forEach(color => {
          // Log color values for manual verification
          logInfo(`   Color in ${file}:${index + 1}: ${color}`);
        });
      }
    });
  }
  
  return propertyViolations;
}

// Command line interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  logInfo(`
CSS Integrity Check - Feature Creep Prevention Framework

Usage:
  node css-integrity-check.js [options]

Options:
  --generate-baselines     Generate new baseline checksums
  --validate-properties    Validate CSS custom properties
  -h, --help              Show this help message

Description:
  This script ensures that all CSS files remain exactly as they were
  in the original implementation. Any modifications are detected and
  reported as framework violations.

  The script enforces the binding rule that CSS files must not be
  modified without explicit authorization.
  `);
  process.exit(0);
}

if (args.includes('--generate-baselines')) {
  generateBaselines();
  process.exit(0);
}

// Run integrity check
const report = checkCSSIntegrity();

if (args.includes('--validate-properties')) {
  validateCSSProperties();
}

// Exit with appropriate code
process.exit(report.frameworkCompliant ? 0 : 1);
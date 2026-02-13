#!/usr/bin/env node
/* eslint-env node */
/**
 * HTML Structure Validator Script
 * Part of the Feature Creep Prevention Framework
 * 
 * This script validates that HTML structure in Svelte components
 * matches the original implementation exactly, preventing unauthorized
 * DOM modifications.
 */

const fs = require('fs');
const { parse } = require('svelte/compiler');
const { logError, logWarn, logInfo } = require('./logger.cjs');

// Svelte components that must preserve original HTML structure
const PROTECTED_COMPONENTS = [
  'src/routes/hackrf/+page.svelte',
  'src/routes/kismet/+page.svelte',
  'src/lib/components/hackrf/HackRFHeader.svelte',
  'src/lib/components/hackrf/SpectrumChart.svelte',
  'src/lib/components/hackrf/FrequencyConfig.svelte',
  'src/lib/components/hackrf/StatusDisplay.svelte',
  'src/lib/components/hackrf/SweepControl.svelte',
  'src/lib/components/hackrf/AnalysisTools.svelte',
  'src/lib/components/hackrf/GeometricBackground.svelte'
];

const BASELINE_STRUCTURE_FILE = './html-structure-baselines.json';

/**
 * Extract HTML structure from Svelte component
 */
function extractHTMLStructure(componentPath) {
  if (!fs.existsSync(componentPath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(componentPath, 'utf8');
    const ast = parse(content);
    
    return analyzeNode(ast.html);
  } catch (error) {
    logError(`Error parsing ${componentPath}:`, error.message);
    return null;
  }
}

/**
 * Recursively analyze AST node structure
 */
function analyzeNode(node) {
  if (!node) return null;
  
  const result = {
    type: node.type,
    name: node.name || null,
    attributes: [],
    children: []
  };
  
  // Extract attributes (class, id, etc.)
  if (node.attributes) {
    result.attributes = node.attributes.map(attr => ({
      name: attr.name,
      type: attr.type,
      value: attr.value ? extractAttributeValue(attr.value) : null
    }));
  }
  
  // Recursively analyze children
  if (node.children && node.children.length > 0) {
    result.children = node.children
      .filter(child => child.type !== 'Text' || child.data.trim()) // Skip empty text nodes
      .map(child => analyzeNode(child));
  }
  
  return result;
}

/**
 * Extract attribute value handling different types
 */
function extractAttributeValue(valueNode) {
  if (!valueNode) return null;
  
  if (Array.isArray(valueNode)) {
    return valueNode.map(v => {
      if (v.type === 'Text') return v.data;
      if (v.type === 'MustacheTag') return '{expression}';
      return v.type;
    }).join('');
  }
  
  if (valueNode.type === 'Text') {
    return valueNode.data;
  }
  
  return valueNode.type;
}

/**
 * Generate baseline structures for all protected components
 */
function generateBaselines() {
  logInfo('📋 Generating HTML Structure Baselines...');
  logInfo('='.repeat(60));
  
  const baselines = {};
  
  for (const component of PROTECTED_COMPONENTS) {
    logInfo(`Analyzing: ${component}`);
    
    const structure = extractHTMLStructure(component);
    if (structure) {
      baselines[component] = {
        structure,
        generatedAt: new Date().toISOString(),
        checksum: generateStructureChecksum(structure)
      };
      logInfo(`✅ Structure extracted (checksum: ${baselines[component].checksum})`);
    } else {
      logWarn(`⚠️  Could not extract structure`);
      baselines[component] = null;
    }
  }
  
  fs.writeFileSync(BASELINE_STRUCTURE_FILE, JSON.stringify(baselines, null, 2));
  logInfo(`\n📄 Baselines saved to: ${BASELINE_STRUCTURE_FILE}`);
  
  return baselines;
}

/**
 * Generate checksum for structure comparison
 */
function generateStructureChecksum(structure) {
  const crypto = require('crypto');
  const normalized = JSON.stringify(structure, Object.keys(structure).sort());
  return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Compare two HTML structures
 */
function compareStructures(baseline, current) {
  const differences = [];
  
  compareNodes(baseline.structure, current.structure, '', differences);
  
  return {
    identical: differences.length === 0,
    differences,
    checksumMatch: baseline.checksum === current.checksum
  };
}

/**
 * Recursively compare two structure nodes
 */
function compareNodes(baseline, current, path, differences) {
  if (!baseline && !current) return;
  
  if (!baseline) {
    differences.push({
      type: 'added',
      path,
      description: `Node added: ${current.type} ${current.name || ''}`
    });
    return;
  }
  
  if (!current) {
    differences.push({
      type: 'removed',
      path,
      description: `Node removed: ${baseline.type} ${baseline.name || ''}`
    });
    return;
  }
  
  // Compare node type and name
  if (baseline.type !== current.type) {
    differences.push({
      type: 'modified',
      path,
      description: `Node type changed: ${baseline.type} -> ${current.type}`
    });
  }
  
  if (baseline.name !== current.name) {
    differences.push({
      type: 'modified',
      path,
      description: `Node name changed: ${baseline.name || 'null'} -> ${current.name || 'null'}`
    });
  }
  
  // Compare attributes
  compareAttributes(baseline.attributes, current.attributes, path, differences);
  
  // Compare children
  const maxChildren = Math.max(baseline.children.length, current.children.length);
  for (let i = 0; i < maxChildren; i++) {
    const childPath = `${path}[${i}]`;
    const baselineChild = baseline.children[i];
    const currentChild = current.children[i];
    
    compareNodes(baselineChild, currentChild, childPath, differences);
  }
}

/**
 * Compare attributes between two nodes
 */
function compareAttributes(baselineAttrs, currentAttrs, path, differences) {
  const baselineMap = new Map(baselineAttrs.map(attr => [attr.name, attr]));
  const currentMap = new Map(currentAttrs.map(attr => [attr.name, attr]));
  
  // Check for removed attributes
  for (const [name] of baselineMap) {
    if (!currentMap.has(name)) {
      differences.push({
        type: 'removed',
        path,
        description: `Attribute removed: ${name}`
      });
    }
  }
  
  // Check for added or modified attributes
  for (const [name, attr] of currentMap) {
    const baselineAttr = baselineMap.get(name);
    
    if (!baselineAttr) {
      differences.push({
        type: 'added',
        path,
        description: `Attribute added: ${name}="${attr.value}"`
      });
    } else if (baselineAttr.value !== attr.value) {
      // Special handling for class attributes (order might differ)
      if (name === 'class' && typeof attr.value === 'string' && typeof baselineAttr.value === 'string') {
        const baselineClasses = baselineAttr.value.split(/\s+/).sort();
        const currentClasses = attr.value.split(/\s+/).sort();
        
        if (JSON.stringify(baselineClasses) !== JSON.stringify(currentClasses)) {
          differences.push({
            type: 'modified',
            path,
            description: `Class attribute changed: "${baselineAttr.value}" -> "${attr.value}"`
          });
        }
      } else {
        differences.push({
          type: 'modified',
          path,
          description: `Attribute value changed: ${name}="${baselineAttr.value}" -> "${attr.value}"`
        });
      }
    }
  }
}

/**
 * Load baseline structures
 */
function loadBaselines() {
  if (!fs.existsSync(BASELINE_STRUCTURE_FILE)) {
    logWarn('⚠️  No baseline file found. Generating baselines...');
    return generateBaselines();
  }
  
  return JSON.parse(fs.readFileSync(BASELINE_STRUCTURE_FILE, 'utf8'));
}

/**
 * Validate HTML structure integrity
 */
function validateHTMLStructure() {
  logInfo('🏗️  HTML Structure Validation - Feature Creep Prevention');
  logInfo('='.repeat(60));
  
  const baselines = loadBaselines();
  const results = [];
  let totalComponents = 0;
  let intactComponents = 0;
  let modifiedComponents = 0;
  let missingComponents = 0;
  
  for (const component of PROTECTED_COMPONENTS) {
    logInfo(`\n📄 Validating: ${component}`);
    totalComponents++;
    
    const currentStructure = extractHTMLStructure(component);
    const baseline = baselines[component];
    
    if (!currentStructure) {
      logError(`   ❌ MISSING: Component not found or could not parse`);
      missingComponents++;
      results.push({
        component,
        status: 'missing',
        issue: 'Component not found or parsing failed'
      });
      continue;
    }
    
    if (!baseline) {
      logWarn(`   ⚠️  NEW: No baseline exists`);
      results.push({
        component,
        status: 'new',
        currentChecksum: generateStructureChecksum(currentStructure)
      });
      continue;
    }
    
    const currentChecksum = generateStructureChecksum(currentStructure);
    const comparison = compareStructures(baseline, {
      structure: currentStructure,
      checksum: currentChecksum
    });
    
    if (comparison.identical) {
      logInfo(`   ✅ INTACT: Structure matches baseline exactly`);
      intactComponents++;
      results.push({
        component,
        status: 'intact',
        checksum: currentChecksum
      });
    } else {
      logError(`   ❌ MODIFIED: Structure changes detected!`);
      logInfo(`      Differences: ${comparison.differences.length}`);
      
      // Show first few differences
      comparison.differences.slice(0, 3).forEach(diff => {
        logInfo(`      - ${diff.type.toUpperCase()}: ${diff.description}`);
      });
      
      if (comparison.differences.length > 3) {
        logInfo(`      ... and ${comparison.differences.length - 3} more differences`);
      }
      
      modifiedComponents++;
      results.push({
        component,
        status: 'modified',
        baselineChecksum: baseline.checksum,
        currentChecksum,
        differences: comparison.differences,
        violation: true
      });
    }
  }
  
  // Generate summary report
  logInfo('\n' + '='.repeat(60));
  logInfo('📊 HTML STRUCTURE VALIDATION SUMMARY');
  logInfo('='.repeat(60));
  logInfo(`📈 Total Components: ${totalComponents}`);
  logInfo(`✅ Intact: ${intactComponents}`);
  logInfo(`❌ Modified: ${modifiedComponents}`);
  logInfo(`⚠️  Missing: ${missingComponents}`);
  
  const integrityScore = totalComponents > 0 ? ((intactComponents / totalComponents) * 100).toFixed(1) : 0;
  logInfo(`📊 Structure Integrity: ${integrityScore}%`);
  
  if (modifiedComponents > 0) {
    logError('\n❌ FRAMEWORK VIOLATION DETECTED:');
    logError('   HTML structure has been modified without authorization!');
    logError('   This violates the Feature Creep Prevention Framework.');
    logError('   Immediate rollback required.');
  } else if (missingComponents > 0) {
    logWarn('\n⚠️  MISSING COMPONENTS DETECTED:');
    logWarn('   Some protected components are missing or unparseable.');
  } else {
    logInfo('\n✅ HTML STRUCTURE INTEGRITY VERIFIED:');
    logInfo('   All component structures match baseline exactly.');
    logInfo('   No unauthorized DOM modifications detected.');
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    totalComponents,
    intactComponents,
    modifiedComponents,
    missingComponents,
    integrityScore: parseFloat(integrityScore),
    frameworkCompliant: modifiedComponents === 0 && missingComponents === 0,
    results
  };
  
  const reportPath = './html-structure-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logInfo(`\n📄 Detailed report saved: ${reportPath}`);
  
  return report;
}

// Command line interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  logInfo(`
HTML Structure Validator - Feature Creep Prevention Framework

Usage:
  node html-structure-validator.js [options]

Options:
  --generate-baselines     Generate new baseline structures
  -h, --help              Show this help message

Description:
  This script validates that HTML structure in Svelte components
  matches the original implementation exactly. It detects unauthorized
  DOM modifications, class changes, and structural alterations.

  The script enforces the binding rule that HTML structure must be
  preserved exactly as in the original implementation.
  `);
  process.exit(0);
}

if (args.includes('--generate-baselines')) {
  generateBaselines();
  process.exit(0);
}

// Run structure validation
const report = validateHTMLStructure();

// Exit with appropriate code
process.exit(report.frameworkCompliant ? 0 : 1);
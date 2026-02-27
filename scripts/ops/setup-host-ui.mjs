#!/usr/bin/env node
// Argos Host Provisioning — Interactive Installer
// Powered by @clack/prompts for a polished CLI experience.
// Launched by setup-host.sh after Node.js is bootstrapped.
//
// Usage (called by setup-host.sh, not directly):
//   NODE_PATH=.setup-cache/node_modules node scripts/ops/setup-host-ui.mjs [--yes] [--verbose]

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, '../..');

// Dynamic import of @clack/prompts — installed to .setup-cache by bootstrap
let p, pc;
try {
  p = await import('@clack/prompts');
  pc = (await import('picocolors')).default;
} catch {
  console.error('Error: @clack/prompts not found. Run via setup-host.sh (not directly).');
  process.exit(1);
}

// =============================================
// CONFIG
// =============================================

const FUNCTIONS_SH = resolve(__dirname, 'setup-host-functions.sh');
const COMPONENTS_JSON = resolve(__dirname, 'components.json');

const NON_INTERACTIVE = process.argv.includes('--yes') || process.argv.includes('-y');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

// Env vars passed from bootstrap
const {
  SETUP_USER = 'unknown',
  SETUP_HOME = '',
  OS_ID = 'unknown',
  OS_NAME = 'Unknown OS',
} = process.env;

// =============================================
// LOAD COMPONENT REGISTRY
// =============================================

/** @type {Array<{id: string, desc: string, core: boolean, func: string, group: string}>} */
let components;
try {
  components = JSON.parse(readFileSync(COMPONENTS_JSON, 'utf8'));
} catch (err) {
  console.error(`Error: Failed to load ${COMPONENTS_JSON}: ${err.message}`);
  process.exit(1);
}

// =============================================
// INTRO
// =============================================

console.log('');
p.intro(pc.bgCyan(pc.black(' Argos Host Provisioning ')));

p.log.info([
  `OS:      ${pc.cyan(OS_NAME)}`,
  `User:    ${pc.cyan(SETUP_USER)}`,
  `Project: ${pc.dim(PROJECT_DIR)}`,
].join('\n'));

// Pre-flight: Parrot OS Kismet check
if (OS_ID === 'parrot') {
  try {
    execFileSync('bash', ['-c', 'command -v kismet'], { stdio: 'pipe' });
  } catch {
    p.log.warn([
      'Parrot OS detected but Kismet not found.',
      'Install first: sudo apt install parrot-tools-full',
    ].join('\n'));
  }
}

// =============================================
// COMPONENT SELECTION
// =============================================

/** @type {string[]} */
let selectedIds;
const coreIds = components.filter((c) => c.core).map((c) => c.id);

if (NON_INTERACTIVE) {
  // --yes mode: select everything
  selectedIds = components.map((c) => c.id);
  p.log.info(`Non-interactive mode: installing all ${selectedIds.length} components.`);
} else {
  // Express vs Customize — mirrors BMAD-METHOD installer pattern
  const mode = await p.select({
    message: 'Installation mode',
    options: [
      { value: 'express', label: 'Express', hint: `install all ${components.length} components` },
      { value: 'customize', label: 'Customize', hint: 'choose individual components' },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel('Setup cancelled.');
    process.exit(0);
  }

  if (mode === 'express') {
    selectedIds = components.map((c) => c.id);
    p.log.info(`Express mode: installing all ${selectedIds.length} components.`);
  } else {
    // Build grouped options — only optional components are selectable
    /** @type {Record<string, Array<{value: string, label: string, hint?: string}>>} */
    const groups = {};
    for (const comp of components) {
      if (comp.core) continue; // cores are always installed, skip from selection
      if (!groups[comp.group]) groups[comp.group] = [];
      groups[comp.group].push({
        value: comp.id,
        label: comp.desc,
      });
    }

    p.log.info(`${pc.dim(`${coreIds.length} core components always installed.`)} Select optional components:`);

    const selection = await p.groupMultiselect({
      message: 'Optional components',
      options: groups,
      required: false,
      initialValues: components.filter((c) => !c.core).map((c) => c.id),
    });

    if (p.isCancel(selection)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }

    const userSelection = /** @type {string[]} */ (selection);
    selectedIds = [...coreIds, ...userSelection];
  }
}

// Enforce implicit dependencies (zsh_default requires zsh_dotfiles)
if (selectedIds.includes('zsh_default') && !selectedIds.includes('zsh_dotfiles')) {
  selectedIds.push('zsh_dotfiles');
  p.log.warn('Added "Zsh + dotfiles" — required by "Set Zsh as default shell".');
}

// Sort selectedIds to match registry order (install order matters)
const idOrder = new Map(components.map((c, i) => [c.id, i]));
selectedIds.sort((a, b) => (idOrder.get(a) ?? 99) - (idOrder.get(b) ?? 99));

// =============================================
// API KEY PROMPTS
// =============================================

let stadiaKey = '';
let ocidKey = '';
let downloadTowers = false;

const envFileExists = existsSync(resolve(PROJECT_DIR, '.env'));

if (selectedIds.includes('env_file') && !envFileExists) {
  if (NON_INTERACTIVE) {
    p.log.info('Skipping API key prompts (--yes mode). Edit .env manually.');
  } else {
    p.log.step('API keys configure map tiles and cell tower data.');

    const stadiaResult = await p.text({
      message: 'Stadia Maps API key (vector map tiles)',
      placeholder: 'Press Enter to skip — falls back to Google satellite tiles',
      validate: () => undefined,
    });
    if (p.isCancel(stadiaResult)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }
    stadiaKey = stadiaResult?.trim() || '';
    if (stadiaKey) {
      p.log.success('Stadia Maps key saved.');
    } else {
      p.log.info('Skipped — map will use Google satellite fallback.');
    }

    const ocidResult = await p.text({
      message: 'OpenCellID API key (global cell tower database)',
      placeholder: 'Press Enter to skip — get free key at opencellid.org',
      validate: () => undefined,
    });
    if (p.isCancel(ocidResult)) {
      p.cancel('Setup cancelled.');
      process.exit(0);
    }
    ocidKey = ocidResult?.trim() || '';

    if (ocidKey) {
      p.log.success('OpenCellID key saved.');
      const dlResult = await p.confirm({
        message: 'Download global cell tower database now? (~500MB, takes a few minutes)',
        initialValue: true,
      });
      if (p.isCancel(dlResult)) {
        p.cancel('Setup cancelled.');
        process.exit(0);
      }
      downloadTowers = dlResult === true;
    } else {
      p.log.info('Skipped — cell tower overlay disabled.');
    }
  }
} else if (envFileExists) {
  p.log.info('.env already exists — skipping API key prompts.');
}

// =============================================
// INSTALL COMPONENTS
// =============================================

const s = p.spinner();
let installed = 0;
let failed = 0;
let skipped = 0;
const failedNames = [];
const total = selectedIds.length;
const selectedSet = new Set(selectedIds);

// Graceful Ctrl+C during install loop
process.on('SIGINT', () => {
  s.stop(pc.yellow('Interrupted'));
  p.cancel('Setup interrupted by user.');
  process.exit(130);
});

// Build comma-separated list for _is_selected() in bash
const selectedCsv = selectedIds.join(',');

for (let i = 0; i < total; i++) {
  const id = selectedIds[i];
  const comp = components.find((c) => c.id === id);
  if (!comp) continue;

  const progress = pc.dim(`[${i + 1}/${total}]`);
  const bashCmd = `source "${FUNCTIONS_SH}" && ${comp.func}`;
  const childEnv = {
    ...process.env,
    SETUP_USER,
    SETUP_HOME,
    PROJECT_DIR,
    SCRIPT_DIR: __dirname,
    OS_ID,
    NON_INTERACTIVE: NON_INTERACTIVE ? 'true' : 'false',
    STADIA_KEY: stadiaKey,
    OCID_KEY: ocidKey,
    DOWNLOAD_TOWERS: downloadTowers ? 'true' : 'false',
    SELECTED_COMPONENTS: selectedCsv,
  };

  try {
    if (VERBOSE) {
      // Verbose: show raw output, no spinner (avoids tty interleaving)
      p.log.step(`${progress} Installing ${comp.desc}...`);
      execFileSync('bash', ['-c', bashCmd], {
        stdio: 'inherit',
        env: childEnv,
        timeout: 600_000,
      });
      p.log.success(`${pc.green('✓')} ${comp.desc}`);
    } else {
      // Normal: spinner hides child output
      s.start(`${progress} Installing ${comp.desc}...`);
      execFileSync('bash', ['-c', bashCmd], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv,
        timeout: 600_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      s.stop(`${pc.green('✓')} ${comp.desc}`);
    }
    installed++;
  } catch (err) {
    if (VERBOSE) {
      p.log.error(`${pc.red('✗')} ${comp.desc} — failed`);
    } else {
      s.stop(`${pc.red('✗')} ${comp.desc} — failed`);
      const stderr = err.stderr?.toString().trim();
      const stdout = err.stdout?.toString().trim();
      const output = stderr || stdout || err.message;
      const lines = output.split('\n');
      const tail = lines.slice(-5).join('\n');
      p.log.error(tail);
    }
    failedNames.push(comp.desc);
    failed++;
  }
}

// Count skipped (not selected)
skipped = components.length - total;

// =============================================
// DATA EXTRACTION (outside component system)
// =============================================

// Extract DTED tiles and cell tower database from bundled zips
for (const extractFn of ['extract_dted', 'extract_celltowers']) {
  try {
    const output = execFileSync('bash', ['-c',
      `source "${FUNCTIONS_SH}" && ${extractFn}`,
    ], {
      stdio: VERBOSE ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PROJECT_DIR, SCRIPT_DIR: __dirname },
      timeout: 120_000, // 2 min (celltowers.zip is ~219MB)
      maxBuffer: 10 * 1024 * 1024,
    });
    if (!VERBOSE && output) {
      const msg = output.toString().trim();
      if (msg) p.log.info(msg);
    }
  } catch (err) {
    const msg = err.stderr?.toString().trim().split('\n').pop() || err.message || 'unknown error';
    p.log.warn(`${extractFn}: ${msg} (non-fatal)`);
  }
}

// =============================================
// SUMMARY
// =============================================

const summaryLines = [
  `${pc.green(`${installed} installed`)}`,
];
if (failed > 0) {
  summaryLines.push(`${pc.red(`${failed} failed`)}`);
  summaryLines.push('');
  summaryLines.push(pc.dim('Failed:'));
  for (const name of failedNames) {
    summaryLines.push(pc.red(`  ✗ ${name}`));
  }
}
if (skipped > 0) {
  summaryLines.push(`${pc.dim(`${skipped} skipped`)}`);
}

p.note(summaryLines.join('\n'), 'Setup Complete');

// VNC reminder (if installed and no password set)
if (selectedSet.has('vnc')) {
  const vncPasswd = resolve(SETUP_HOME, '.vnc/passwd');
  if (!existsSync(vncPasswd)) {
    p.log.warn('VNC password not set. Run: vncpasswd ~/.vnc/passwd');
  }
}

// Next steps
p.log.step([
  'Next steps:',
  `  1. ${pc.dim('Edit .env to set service passwords')}`,
  `  2. ${pc.cyan('npm run dev')} — start development server`,
  `  3. ${pc.dim('Open http://<pi-ip>:5173 in your browser')}`,
  '',
  'API keys (can be set later in .env):',
  `  ${pc.dim('STADIA_MAPS_API_KEY')}  — vector map tiles (stadiamaps.com)`,
  `  ${pc.dim('OPENCELLID_API_KEY')}   — cell tower database (opencellid.org)`,
  '',
  'Cell tower database:',
  `  ${pc.dim('bash scripts/ops/import-celltowers.sh')}`,
].join('\n'));

p.outro(pc.green('Provisioning complete.'));

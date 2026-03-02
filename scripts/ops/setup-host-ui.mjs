#!/usr/bin/env node
// Argos Host Provisioning — Interactive Installer
// Powered by @clack/prompts for a polished CLI experience.
// Launched by setup-host.sh after Node.js is bootstrapped.
//
// Usage (called by setup-host.sh, not directly):
//   NODE_PATH=.setup-cache/node_modules node scripts/ops/setup-host-ui.mjs [--yes] [--verbose]

import { execFile, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, '../..');

// Dynamic import of @clack/prompts — installed to .setup-cache by bootstrap.
// ESM bare imports ignore NODE_PATH, so use createRequire to resolve the path
// (it respects NODE_PATH), then dynamic import() on the resolved file URL.
let p, pc;
try {
  const require = createRequire(import.meta.url);
  const clackPath = pathToFileURL(require.resolve('@clack/prompts'));
  const pcPath = pathToFileURL(require.resolve('picocolors'));
  p = await import(clackPath);
  pc = (await import(pcPath)).default;
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
// HELPERS
// =============================================

/** Run a bash command asynchronously (allows spinner animation) */
function execAsync(cmd, env, timeout = 600_000) {
  return new Promise((resolve, reject) => {
    execFile('bash', ['-c', cmd], {
      env,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

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

// Get version from git or package.json
let version = 'dev';
try {
  version = execFileSync('git', ['-C', PROJECT_DIR, 'describe', '--tags', '--always'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 5_000,
  }).toString().trim();
} catch {
  try {
    const pkg = JSON.parse(readFileSync(resolve(PROJECT_DIR, 'package.json'), 'utf8'));
    version = pkg.version || 'dev';
  } catch { /* keep 'dev' */ }
}

console.log('');
console.log(pc.cyan([
  '   ╔════════════════════════════════════════════════════╗',
  '   ║                                                    ║',
  '   ║     █████  ██████   ██████   ██████  ███████       ║',
  '   ║    ██   ██ ██   ██ ██       ██    ██ ██            ║',
  '   ║    ███████ ██████  ██   ███ ██    ██ ███████       ║',
  '   ║    ██   ██ ██   ██ ██    ██ ██    ██      ██       ║',
  '   ║    ██   ██ ██   ██  ██████   ██████  ███████       ║',
  '   ║                                                    ║',
  '   ╚════════════════════════════════════════════════════╝',
].join('\n')));
console.log('');

p.intro(pc.bgCyan(pc.black(' Argos Host Provisioning ')));

p.log.info([
  `${pc.dim('SDR & Network Analysis Console for EW Training')}`,
  '',
  `Version: ${pc.cyan(version)}`,
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
// API KEY PROMPT (Stadia Maps only — cell tower data ships with repo)
// =============================================

let stadiaKey = '';

const envFileExists = existsSync(resolve(PROJECT_DIR, '.env'));

if (selectedIds.includes('env_file') && !envFileExists) {
  if (NON_INTERACTIVE) {
    p.log.info('Skipping API key prompt (--yes mode). Edit .env manually.');
  } else {
    p.log.step('Optional API key for vector map tiles.');

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
  }
} else if (envFileExists) {
  p.log.info('.env already exists — skipping API key prompt.');
}

// =============================================
// PRE-FLIGHT: DETECT ALREADY-INSTALLED
// =============================================

const s = p.spinner();
s.start('Scanning system for existing components...');

/** @type {Set<string>} */
const alreadyInstalled = new Set();
const checkEnv = {
  ...process.env,
  SETUP_USER,
  SETUP_HOME,
  PROJECT_DIR,
  SCRIPT_DIR: __dirname,
  OS_ID,
};

for (const id of selectedIds) {
  try {
    execFileSync('bash', ['-c', `source "${FUNCTIONS_SH}" && check_component "${id}"`], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: checkEnv,
      timeout: 10_000,
    });
    alreadyInstalled.add(id);
  } catch {
    // Not installed — will be installed
  }
}

const freshCount = selectedIds.length - alreadyInstalled.size;
if (alreadyInstalled.size > 0) {
  s.stop(`${pc.cyan(`${alreadyInstalled.size} already present`)}, ${freshCount} to install`);
} else {
  s.stop(`${freshCount} components to install (fresh system)`);
}

// =============================================
// INSTALL COMPONENTS
// =============================================

let installed = 0;
let alreadyCount = 0;
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
    SELECTED_COMPONENTS: selectedCsv,
  };

  const wasPresent = alreadyInstalled.has(id);
  const verb = wasPresent ? 'Verifying' : 'Installing';

  try {
    if (VERBOSE) {
      // Verbose: show raw output, no spinner (avoids tty interleaving)
      p.log.step(`${progress} ${verb} ${comp.desc}...`);
      execFileSync('bash', ['-c', bashCmd], {
        stdio: 'inherit',
        env: childEnv,
        timeout: 600_000,
      });
      if (wasPresent) {
        p.log.success(`${pc.blue('●')} ${comp.desc} ${pc.dim('(already installed)')}`);
      } else {
        p.log.success(`${pc.green('✓')} ${comp.desc}`);
      }
    } else {
      // Normal: async exec so the spinner animation runs on the main thread
      s.start(`${progress} ${verb} ${comp.desc}...`);
      await execAsync(bashCmd, childEnv);
      if (wasPresent) {
        s.stop(`${pc.blue('●')} ${comp.desc} ${pc.dim('(already installed)')}`);
      } else {
        s.stop(`${pc.green('✓')} ${comp.desc}`);
      }
    }
    if (wasPresent) {
      alreadyCount++;
    } else {
      installed++;
    }
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
    s.start(`Extracting ${extractFn === 'extract_dted' ? 'DTED elevation tiles' : 'cell tower database'}...`);
    const { stdout } = await execAsync(
      `source "${FUNCTIONS_SH}" && ${extractFn}`,
      { ...process.env, PROJECT_DIR, SCRIPT_DIR: __dirname },
      120_000,
    );
    const msg = stdout?.toString().trim();
    s.stop(`${pc.green('✓')} ${msg || extractFn}`);
  } catch (err) {
    const msg = err.stderr?.toString().trim().split('\n').pop() || err.message || 'unknown error';
    s.stop(`${pc.yellow('!')} ${extractFn}: ${msg} (non-fatal)`);
  }
}

// =============================================
// SUMMARY
// =============================================

const summaryLines = [];
if (installed > 0) summaryLines.push(pc.green(`${installed} freshly installed`));
if (alreadyCount > 0) summaryLines.push(pc.blue(`${alreadyCount} already present`));
if (failed > 0) {
  summaryLines.push(pc.red(`${failed} failed`));
  summaryLines.push('');
  summaryLines.push(pc.dim('Failed:'));
  for (const name of failedNames) {
    summaryLines.push(pc.red(`  ✗ ${name}`));
  }
}
if (skipped > 0) {
  summaryLines.push(pc.dim(`${skipped} skipped`));
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
  'Optional API key (can be set later in .env):',
  `  ${pc.dim('STADIA_MAPS_API_KEY')}  — vector map tiles (stadiamaps.com)`,
].join('\n'));

p.outro(pc.green('Provisioning complete.'));

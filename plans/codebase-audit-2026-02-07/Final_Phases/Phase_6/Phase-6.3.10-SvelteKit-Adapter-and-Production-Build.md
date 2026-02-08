# Phase 6.3.10: Build and Deployment Automation

**Document ID**: ARGOS-AUDIT-P6.3.10
**Parent Document**: Phase-6.3-SYSTEMD-PATHS-AND-DEPLOYMENT-PIPELINE.md
**Original Task ID**: 6.3.10
**Version**: 1.0
**Date**: 2026-02-08
**Author**: Claude Opus 4.6 (Lead Audit Agent)
**Classification**: UNCLASSIFIED // FOR OFFICIAL USE ONLY
**Risk Level**: MEDIUM-HIGH
**Review Standard**: DISA STIG, NIST SP 800-123, CIS Benchmarks

---

## 1. Objective / Problem Statement

Four deployment and build issues have been identified:

1. **`argos-final.service` runs `npm run preview`** (Vite dev preview server), not a production Node.js server. The Vite preview server is not designed for production use -- it lacks security hardening, has no graceful shutdown, and serves unminified assets.

2. **`release.yml` creates a non-runnable tarball**: With `adapter-auto`, the build output is not a standalone server. The tarball cannot be deployed without additional tooling.

3. **No deployment script exists**: There is no automated process for: stop service, pull code, install deps, build, restart service. Each deployment is manual and error-prone.

4. **`package.json` version is `0.0.1` with no `engines` field**: No restriction on Node.js version means the application can be installed on unsupported runtimes, leading to silent failures.

### Current State vs Desired State

| Metric                     | Current                             | Target                                                  |
| -------------------------- | ----------------------------------- | ------------------------------------------------------- |
| Production start command   | `npm run preview` (Vite dev server) | `node build` (standalone Node.js server)                |
| Build output               | Static files (adapter-auto)         | Standalone server at `build/index.js` (adapter-node)    |
| Deployment automation      | None (manual process)               | `scripts/deploy/deploy-to-pi.sh`                        |
| package.json engines field | Missing                             | `node >=20.0.0, npm >=10.0.0`                           |
| release.yml package step   | Includes node_modules for x86_64    | Includes package.json/package-lock.json; Pi runs npm ci |

---

## 2. Prerequisites

- Task 6.3.7 Fix 3 must be complete: `@sveltejs/adapter-node` must be installed and `svelte.config.js` updated.
- Task 6.3.1 must be complete: `deployment/generate-services.sh` and service templates must exist for the deployment script to reference.
- Task 6.3.1a must be complete: `scripts/lib/argos-env.sh` must exist for the deployment script to source.

---

## 3. Dependencies

- **Upstream**: Task 6.3.7 Fix 3 (adapter-node switch provides standalone build output)
- **Upstream**: Task 6.3.1 (generate-services.sh and templates must exist)
- **Upstream**: Task 6.3.1a (argos-env.sh must exist for deployment script)
- **Downstream**: None (terminal task for build/deployment infrastructure)

---

## 4. Rollback Strategy

```bash
# Revert svelte.config.js and package changes
git checkout HEAD -- svelte.config.js docker/

# Remove adapter-node and restore adapter-auto
npm remove @sveltejs/adapter-node
npm install --save-dev @sveltejs/adapter-auto

# Remove deployment script
rm scripts/deploy/deploy-to-pi.sh

# Revert package.json engines field
git checkout HEAD -- package.json
```

---

## 5. Current State / Inventory

### 5.1 Production Service File

File: `deployment/argos-final.service`

Current ExecStart line:

```ini
ExecStart=/usr/bin/npm run preview
```

The Vite preview server is intended for local testing after a build, NOT for production deployment. Issues with using Vite preview in production:

| Issue                    | Risk Level | Detail                                                                          |
| ------------------------ | ---------- | ------------------------------------------------------------------------------- |
| No security hardening    | HIGH       | Vite dev server has known security advisories (4 moderate in current npm audit) |
| No graceful shutdown     | MEDIUM     | `npm run preview` does not handle SIGTERM cleanly; systemd may need to SIGKILL  |
| Serves unminified assets | LOW        | Larger payloads, slower page loads                                              |
| Single-threaded          | MEDIUM     | No clustering or worker threads; blocks on I/O                                  |
| No production logging    | MEDIUM     | Vite logs to stdout with dev-oriented formatting                                |

### 5.2 Build Output (adapter-auto vs adapter-node)

| Adapter                | Build Output                       | Runnable           | Standalone |
| ---------------------- | ---------------------------------- | ------------------ | ---------- |
| adapter-auto (current) | Static files in `build/`           | No (needs Vite)    | No         |
| adapter-node (target)  | Node.js server at `build/index.js` | Yes (`node build`) | Yes        |

### 5.3 Package.json Current State

```json
{
	"name": "argos",
	"version": "0.0.1"
}
```

No `engines` field. No version restriction on Node.js or npm.

### 5.4 Deployment Process (current -- manual)

Current deployment to the RPi 5 is entirely manual:

1. SSH into Pi
2. `cd /home/kali/Documents/Argos/Argos`
3. `git pull`
4. `npm install`
5. `npm run build`
6. `sudo systemctl restart argos-final`

No error handling, no service file regeneration, no dependency cleanup.

---

## 6. Actions / Changes

### 6.1 Action A: Production Build with adapter-node

**Already addressed in Task 6.3.7 Fix 3.** After switching to `adapter-node`:

- `npm run build` produces `build/index.js` (standalone Node.js server).
- Production start command: `PORT=4173 HOST=0.0.0.0 node build`.
- No dependency on Vite at runtime.
- No need for `npm run preview`.

This action verifies the adapter-node output is correct and documents the production configuration.

**Production environment variables for the standalone server:**

| Variable          | Default        | Purpose                |
| ----------------- | -------------- | ---------------------- |
| `PORT`            | 3000           | HTTP listening port    |
| `HOST`            | 0.0.0.0        | Bind address           |
| `ORIGIN`          | (from request) | CSRF origin validation |
| `BODY_SIZE_LIMIT` | 512K           | Max request body size  |

### 6.2 Action B: Add engines Field to package.json

```json
{
	"engines": {
		"node": ">=20.0.0",
		"npm": ">=10.0.0"
	}
}
```

This prevents deployment on unsupported Node.js versions. The RPi 5 runs Node 20.x. Key compatibility requirements:

- Node 20+: Required for native `fetch()`, `structuredClone()`, and ES2022 features used in the codebase.
- npm 10+: Required for workspaces support and `--omit` flag used in deployment scripts.

### 6.3 Action C: Create Deployment Script

Create `scripts/deploy/deploy-to-pi.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Source environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/argos-env.sh
source "${SCRIPT_DIR}/../lib/argos-env.sh"

echo "=== Argos Deployment Script ==="
echo "ARGOS_DIR: ${ARGOS_DIR}"
echo "ARGOS_USER: ${ARGOS_USER}"

# 1. Stop service
echo "[1/6] Stopping service..."
sudo systemctl stop argos-final.service 2>/dev/null || true

# 2. Pull latest code
echo "[2/6] Pulling latest code..."
cd "${ARGOS_DIR}"
git pull --ff-only origin main

# 3. Install dependencies
echo "[3/6] Installing dependencies..."
npm ci --omit=dev

# 4. Build
echo "[4/6] Building production bundle..."
NODE_OPTIONS="--max-old-space-size=1024" npm run build

# 5. Generate service files
echo "[5/6] Generating service files..."
bash deployment/generate-services.sh

# 6. Restart service
echo "[6/6] Restarting service..."
sudo cp deployment/generated/argos-final.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start argos-final.service

echo "=== Deployment complete ==="
sudo systemctl status argos-final.service --no-pager
```

**Deployment script design:**

| Step | Command                | Purpose                  | Failure Behavior                                        |
| ---- | ---------------------- | ------------------------ | ------------------------------------------------------- | --- | -------------------------- |
| 1    | `systemctl stop`       | Stop running service     | `                                                       |     | true` -- OK if not running |
| 2    | `git pull --ff-only`   | Pull latest code         | Fails on merge conflicts (intentional -- no auto-merge) |
| 3    | `npm ci --omit=dev`    | Clean dependency install | Fails on lock file mismatch (intentional)               |
| 4    | `npm run build`        | Build production bundle  | Fails on compile errors (intentional)                   |
| 5    | `generate-services.sh` | Regenerate service files | Fails if templates are invalid                          |
| 6    | `systemctl start`      | Start production server  | Fails if build output is invalid                        |

The `--ff-only` flag on `git pull` prevents automatic merge commits. If the local branch has diverged from remote, the script fails explicitly rather than creating an unexpected merge. This is a safety measure for production deployments.

The `npm ci --omit=dev` flag performs a clean install (removes existing node_modules) and excludes dev dependencies. On the RPi 5 (aarch64), this correctly compiles native modules (better-sqlite3) for the target architecture, avoiding the x86_64 binary mismatch from CI.

### 6.4 Action D: Update release.yml for adapter-node Output

Update the assembly step in `.github/workflows/release.yml` to package the adapter-node build output:

```yaml
- name: 'Assemble Clean Production Package'
  run: |
      mkdir release
      cp -r build/ release/
      cp package.json release/
      cp package-lock.json release/
      cp -r deployment/templates/ release/deployment/templates/
      cp deployment/generate-services.sh release/deployment/
      cd release
      npm ci --omit=dev
      cd ..
```

**Important note on ARM architecture**: The `npm ci --omit=dev` step in release.yml compiles native modules for x86_64 (the GitHub Actions runner architecture). These binaries will NOT work on the RPi 5 (aarch64). The deployment script (Action C) intentionally runs `npm ci --omit=dev` on the Pi itself to compile native modules for the correct architecture.

The release tarball serves as a convenience package with pre-built JavaScript and service templates. Native module compilation must happen on the target system. This is the recommended approach per Task 6.3.7 Section 6.6 (ARM Architecture Testing Gap).

### 6.5 Action E: Update argos-final.service Template

In the `argos-final.service.template` (created in Task 6.3.1), replace the ExecStart:

Before:

```ini
ExecStart=/usr/bin/npm run preview
```

After:

```ini
ExecStart=/usr/bin/node @@ARGOS_DIR@@/build
```

This starts the standalone Node.js server produced by adapter-node, replacing the Vite dev preview server. The `@@ARGOS_DIR@@` token is substituted by `generate-services.sh`.

---

## 7. Verification Commands

```bash
# 1. Verify engines field in package.json
node -e "const p=require('./package.json'); console.log(p.engines)"
# Expected: { node: '>=20.0.0', npm: '>=10.0.0' }

# 2. Verify deploy script exists and passes syntax check
bash -n scripts/deploy/deploy-to-pi.sh
# Expected: exit 0

# 3. Verify deploy script sources argos-env.sh
grep 'argos-env.sh' scripts/deploy/deploy-to-pi.sh
# Expected: found

# 4. Verify deploy script uses --ff-only for safety
grep 'ff-only' scripts/deploy/deploy-to-pi.sh
# Expected: found

# 5. Verify build produces standalone server
npm run build
node -e "const fs=require('fs'); console.log(fs.existsSync('build/index.js') ? 'PASS' : 'FAIL')"
# Expected: PASS

# 6. Verify production server starts (smoke test)
PORT=9999 timeout 5 node build 2>&1 || true
curl -s -o /dev/null -w "%{http_code}" http://localhost:9999/
# Expected: 200 (or connection refused if timeout killed it -- either proves the server started)

# 7. Verify argos-final template uses node build (not npm preview)
grep 'node.*build' deployment/templates/argos-final.service.template
# Expected: found

grep 'npm run preview' deployment/templates/argos-final.service.template
# Expected: no output
```

---

## 8. Acceptance Criteria

From parent Section 13 verification checklist:

| #   | Check                         | Command                                            | Expected  |
| --- | ----------------------------- | -------------------------------------------------- | --------- |
| 13  | adapter-node installed        | `grep 'adapter-node' package.json`                 | Found     |
| 14  | adapter-auto removed          | `grep 'adapter-auto' package.json`                 | No output |
| 15  | Build produces index.js       | `test -f build/index.js`                           | Exit 0    |
| 24  | engines field in package.json | `node -e "require('./package.json').engines.node"` | Truthy    |

### Additional Pass/Fail Criteria

1. `package.json` has an `engines` field specifying `node >=20.0.0` and `npm >=10.0.0`.
2. `scripts/deploy/deploy-to-pi.sh` exists, is valid bash, and sources `argos-env.sh`.
3. The deploy script uses `git pull --ff-only` (no auto-merge on diverged branches).
4. The deploy script uses `npm ci --omit=dev` (clean install, no dev dependencies).
5. `npm run build` produces `build/index.js` (standalone Node.js server).
6. The `argos-final.service.template` uses `node @@ARGOS_DIR@@/build` (not `npm run preview`).
7. The production server starts and responds to HTTP requests on the configured port.
8. `release.yml` assembly step includes `deployment/templates/` and `generate-services.sh`.

---

## 9. Traceability

| Finding                                               | Task                              | Status  |
| ----------------------------------------------------- | --------------------------------- | ------- |
| argos-final.service runs npm preview (not production) | 6.3.10 Action E                   | PLANNED |
| release.yml produces non-runnable tarball             | 6.3.10 Action D                   | PLANNED |
| No deployment automation script                       | 6.3.10 Action C                   | PLANNED |
| Package version 0.0.1 / no engines field              | 6.3.10 Action B                   | PLANNED |
| Build output not standalone (adapter-auto)            | 6.3.10 Action A (via 6.3.7 Fix 3) | PLANNED |

### Risk Assessment

| Risk                                                   | Likelihood | Impact | Mitigation                                                                                                                              |
| ------------------------------------------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| adapter-node build fails due to native dependencies    | Medium     | High   | Test `npm run build` locally on RPi 5 before merging; better-sqlite3 requires matching architecture                                     |
| Deploy script fails mid-execution (partial deployment) | Low        | High   | `set -euo pipefail` stops on first error; service was already stopped in Step 1, so partial deployment leaves service down (not broken) |
| Node.js version constraint too strict                  | Low        | Low    | `>=20.0.0` covers all LTS versions from Oct 2023 onward; current LTS is 20.x                                                            |
| release.yml tarball node_modules incompatible with ARM | Known      | Medium | Documented in 6.3.7 Section 6.6; deploy script runs `npm ci` on Pi for correct architecture                                             |

---

## 10. Execution Order Notes

This task runs on **Track C** (CI/CD pipeline chain).

**Position in execution chain:**

- After: Task 6.3.7 Fix 3 (adapter-node must be installed)
- After: Task 6.3.1 (generate-services.sh and argos-env.sh must exist)
- Parallel with: Tasks 6.3.8, 6.3.9 (all three depend on Task 6.3.7 but are independent of each other)
- Before: None (terminal task for build/deployment)

**Recommended execution within this task:**

1. Action B (engines field) -- immediate, simple package.json edit.
2. Action A (verify adapter-node build) -- confirms Task 6.3.7 Fix 3 output.
3. Action E (update argos-final template) -- requires Task 6.3.1 templates to exist.
4. Action C (create deployment script) -- requires argos-env.sh from Task 6.3.1a.
5. Action D (update release.yml) -- final step, depends on understanding the build output.
6. Run verification commands including smoke test.

**Phase-level execution order**: Phase 6.3 must execute BEFORE Phase 6.2 (Script Consolidation).

---

END OF DOCUMENT

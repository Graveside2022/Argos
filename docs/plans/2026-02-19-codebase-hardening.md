# Codebase Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all unsafe shell calls (19 files, ~66 call sites), decompose all oversized files (51 files >300 lines), and fix remaining convention violations — achieving zero CLAUDE.md/Constitution violations.

**Architecture:** Three sequential workstreams: (A) mechanical exec→execFile migration across all server-side code, (B) file decomposition using extract-and-orchestrate pattern, (C) minor convention fixes (4 UI elements). Each task = one atomic commit.

**Tech Stack:** TypeScript 5.8, SvelteKit 2.22, Node.js child_process (execFile/spawn), Vitest 3.2.4, shadcn-svelte UI components.

---

## Workstream A: Shell Call Migration (19 files → 0 unsafe calls)

### Task A0: Remove Dead Imports (3 files)

**Files:**

- Modify: `src/lib/server/hardware/detection/serial-detector.ts`
- Modify: `src/lib/server/hardware/detection/usb-detector.ts`
- Modify: `src/lib/server/kismet/alfa-detector.ts`

**Step 1: Remove unused exec import from serial-detector.ts**

In `serial-detector.ts`, the file imports `exec` from `child_process` but the actual calls use `execAsync = promisify(exec)`. If there are zero call sites that use template literals with dynamic input, simply change the import to `execFile` and update `execAsync` to `promisify(execFile)`. If the file imports but never calls, remove the import entirely.

Actually — research shows these files DO have call sites (serial-detector has 4, usb-detector has 8). They were incorrectly categorized as "dead imports" in the original spec. **Reclassify these to Task A3 (detection files).**

For alfa-detector.ts — research shows 1 static call (`'lsusb'`). Migrate to execFile.

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 3: Commit**

```
fix(security): T-A0 — remove unsafe exec from alfa-detector, use execFile
```

---

### Task A1: Migrate host-exec.ts (centralized wrapper)

**Files:**

- Modify: `src/lib/server/host-exec.ts`

**Context:** This is the most critical file — it's a pass-through wrapper called by 17 other files. The current signature takes a `cmd: string` which encourages shell string interpolation. We need to either:

- (a) Delete it and have callers use execFile directly, OR
- (b) Rewrite it to accept `(binary: string, args: string[])` format

**Decision:** Option (a) — delete the wrapper. It provides no value now that Argos runs natively (the Docker nsenter bridge was its original purpose). Callers should import `execFile` directly.

**Step 1: Check all callers of hostExec**

Search for `import.*hostExec` or `from.*host-exec` across all files. Update each caller in subsequent tasks (A4-A7 for API routes, A8-A15 for libraries).

**Step 2: Delete host-exec.ts**

Remove the file entirely. This will cause TypeScript errors in all 17 callers, which serves as a checklist — every error = a file that needs migration.

**Step 3: Commit**

```
refactor(security): T-A1 — delete host-exec.ts centralized exec wrapper
```

---

### Task A2: Migrate API Routes — Static Commands (5 files, LOW risk)

**Files:**

- Modify: `src/routes/api/system/metrics/+server.ts` (4 calls, all static)
- Modify: `src/routes/api/system/memory-pressure/+server.ts` (2 calls, all static)
- Modify: `src/routes/api/system/docker/+server.ts` (2 calls, all static)
- Modify: `src/routes/api/rf/status/+server.ts` (1 call, static)
- Modify: `src/routes/api/kismet/stop/+server.ts` (6 calls, all static)

**Pattern:** All commands in these files are static strings with no dynamic interpolation. The migration is mechanical:

Before:

```typescript
import { exec } from 'child_process';
const execAsync = promisify(exec);
const { stdout } = await execAsync('pgrep -x kismet');
```

After:

```typescript
import { execFile } from 'child_process';
const execFileAsync = promisify(execFile);
const { stdout } = await execFileAsync('/usr/bin/pgrep', ['-x', 'kismet']);
```

**Key rules:**

- Always use absolute binary paths (`/usr/bin/pgrep`, `/usr/bin/pkill`, `/usr/bin/timeout`, `/usr/sbin/ip`)
- Split command + args: `'pgrep -x kismet'` → `'/usr/bin/pgrep', ['-x', 'kismet']`
- For `2>&1` redirect: remove it, just catch stderr from the promise
- For `2>/dev/null`: wrap in try/catch and ignore stderr
- For pipes (`|`): split into separate calls, parse stdout in JS

**Step 1: Migrate metrics/+server.ts**

This file has 4 exec calls:

1. `top -bn1 | grep 'Cpu(s)' | awk ...` → Replace with `os.cpus()` from Node.js (no exec needed)
2. `df -B1 / | tail -1 | awk ...` → `execFileAsync('/usr/bin/df', ['-B1', '/'])` + JS parse
3. `vcgencmd measure_temp` → `execFileAsync('/usr/bin/vcgencmd', ['measure_temp'])`
4. `cat /proc/net/dev | grep ...` → `fs.readFileSync('/proc/net/dev', 'utf8')` + JS parse (no exec needed)

**Step 2: Migrate memory-pressure/+server.ts**

2 static calls:

1. `pgrep earlyoom` → `execFileAsync('/usr/bin/pgrep', ['earlyoom'])`
2. `zramctl --output ...` → `execFileAsync('/usr/sbin/zramctl', ['--output', 'NAME,DISKSIZE,DATA,COMPR'])`

**Step 3: Migrate docker/+server.ts**

2 static calls:

1. `docker ps -a --format ...` → `execFileAsync('/usr/bin/docker', ['ps', '-a', '--format', '{{.Names}}|{{.State}}|{{.Status}}|{{.Image}}'])`
2. `docker info --format ...` → `execFileAsync('/usr/bin/docker', ['info', '--format', '{{json .}}'])`

**Step 4: Migrate rf/status/+server.ts**

1 static call:

1. `timeout 2 hackrf_info` → `execFileAsync('/usr/bin/timeout', ['2', 'hackrf_info'])`
   Or better: `execFileAsync('/usr/bin/hackrf_info', [], { timeout: 2000 })`

**Step 5: Migrate kismet/stop/+server.ts**

6 static calls (pgrep, pkill, ip link delete):

1. Each `pgrep -x kismet` → `execFileAsync('/usr/bin/pgrep', ['-x', 'kismet'])`
2. Each `pkill` → `execFileAsync('/usr/bin/pkill', ['-TERM', 'kismet'])` etc.
3. `sudo ip link delete kismon0` → `execFileAsync('/usr/bin/sudo', ['ip', 'link', 'delete', 'kismon0'])`

**Step 6: Run verification**

Run: `npx tsc --noEmit && npm run test:security`
Expected: 0 errors, all security tests pass

**Step 7: Commit**

```
fix(security): T-A2 — migrate 5 API routes from exec to execFile (static commands)
```

---

### Task A3: Migrate API Routes — Dynamic Commands (2 files, HIGH risk)

**Files:**

- Modify: `src/routes/api/system/docker/[action]/+server.ts` (3 calls with dynamic service/path)
- Modify: `src/routes/api/system/services/+server.ts` (2 calls with dynamic service names)

**Step 1: Migrate docker/[action]/+server.ts**

3 calls with template literals for `composeFile` and `service`:

```typescript
// Before:
await execAsync(`docker compose -f ${composeFile} --profile tools up -d ${service}`);

// After:
await execFileAsync('/usr/bin/docker', [
	'compose',
	'-f',
	composeFile,
	'--profile',
	'tools',
	'up',
	'-d',
	service
]);
```

The `service` value already comes from an allowlist validation — keep that validation. The `composeFile` is constructed from `process.cwd()` which is safe.

**Step 2: Add Zod validation for request body**

The docker action route currently lacks Zod validation on the request body. Add it:

```typescript
const DockerActionBody = z.object({
	service: z.enum(['openwebrx', 'bettercap'])
});
```

**Step 3: Migrate services/+server.ts**

2 calls using `service.process` and `service.port` from a hardcoded service list:

```typescript
// Before:
await execAsync(`pgrep -f "${service.process}"`);

// After:
await execFileAsync('/usr/bin/pgrep', ['-f', service.process]);
```

**Step 4: Run verification**

Run: `npx tsc --noEmit && npm run test:security`

**Step 5: Commit**

```
fix(security): T-A3 — migrate docker/services API routes, add Zod body validation
```

---

### Task A4: Migrate Detection Files (3 files)

**Files:**

- Modify: `src/lib/server/hardware/detection/network-detector.ts` (1 call, static)
- Modify: `src/lib/server/hardware/detection/serial-detector.ts` (4 calls, 2 dynamic)
- Modify: `src/lib/server/hardware/detection/usb-detector.ts` (8 calls, 2 dynamic)

**Step 1: Migrate network-detector.ts**

1 static call:

- `uhd_find_devices --args="type=usrp" 2>&1` → `execFileAsync('/usr/bin/uhd_find_devices', ['--args=type=usrp'])`

**Step 2: Migrate serial-detector.ts**

4 calls, 2 dangerous:

- `timeout 2 cat ${devicePath} 2>/dev/null | head -5` → Read file with `fs.readFileSync(devicePath)` + take first 5 lines in JS. Validate devicePath with `validatePathWithinDir(devicePath, '/dev')`.
- `systemctl is-active gpsd 2>&1` → `execFileAsync('/usr/bin/systemctl', ['is-active', 'gpsd'])`
- `mmcli -L 2>&1` → `execFileAsync('/usr/bin/mmcli', ['-L'])`
- `` `mmcli -m ${modemId} 2>&1` `` → Validate modemId as numeric, then `execFileAsync('/usr/bin/mmcli', ['-m', String(modemId)])`

**Step 3: Migrate usb-detector.ts**

8 calls, 2 dangerous:

- 6 static calls: mechanical migration (hackrf_info, uhd_find_devices, rtl_test, iw dev, hciconfig, bluetoothctl)
- `` `iw ${iface} info 2>&1` `` → Validate with `validateInterfaceName(iface)`, then `execFileAsync('/usr/sbin/iw', [iface, 'info'])`
- `` `iw phy${iface} info 2>&1 | head -50` `` → `execFileAsync('/usr/sbin/iw', ['phy' + iface, 'info'])` + truncate stdout to 50 lines in JS

**Step 4: Run verification**

Run: `npx tsc --noEmit && npm run test:unit`

**Step 5: Commit**

```
fix(security): T-A4 — migrate 3 hardware detection files to execFile
```

---

### Task A5: Migrate Hardware Managers (2 files, CRITICAL risk)

**Files:**

- Modify: `src/lib/server/hardware/alfa-manager.ts` (3 calls, all dynamic)
- Modify: `src/lib/server/hardware/hackrf-manager.ts` (6 calls, 4 dynamic)

**Step 1: Migrate alfa-manager.ts**

All 3 calls use template literals with `iface` or `proc`:

```typescript
// Before:
await execAsync(`iwconfig "${iface}" 2>/dev/null`);

// After:
import { validateInterfaceName } from '$lib/server/security/input-sanitizer';
const safeIface = validateInterfaceName(iface);
const { stdout } = await execFileAsync('/usr/sbin/iwconfig', [safeIface]);
```

For pgrep/pkill with process names:

```typescript
// Before:
await execAsync(`pgrep -x "${proc}" 2>/dev/null`);

// After: proc comes from static CONFLICTING_PROCESSES array — safe but still use execFile
await execFileAsync('/usr/bin/pgrep', ['-x', proc]);
```

**Step 2: Migrate hackrf-manager.ts**

6 calls:

- 2 static (hackrf_info, lsusb) → mechanical
- 2 pgrep/pkill with `proc` from static array → `execFileAsync('/usr/bin/pgrep', ['-x', proc])`
- `docker ps --filter "name=${container}"` → `execFileAsync('/usr/bin/docker', ['ps', '--filter', `name=${container}`, '--format', '{{.Names}}'])`
- `docker stop "${container}"` → `execFileAsync('/usr/bin/docker', ['stop', container])`

Container names come from validated allowlist, but still use execFile for defense-in-depth.

**Step 3: Run verification**

Run: `npx tsc --noEmit && npm run test:unit`

**Step 4: Commit**

```
fix(security): T-A5 — migrate alfa-manager and hackrf-manager to execFile
```

---

### Task A6: Migrate Kismet Services (2 files, CRITICAL risk)

**Files:**

- Modify: `src/lib/server/kismet/service-manager.ts` (14+ calls, many dynamic)
- Modify: `src/lib/server/services/kismet/kismet-control-service.ts` (4 calls, 1 dynamic + nohup)

**Step 1: Migrate service-manager.ts**

This is the heaviest file (~14 call sites). Group by pattern:

**Static commands** (6 calls): pgrep kismet, pkill, iw dev del, lsusb — mechanical migration.

**Dynamic commands** (8 calls):

- `ps -p ${pid} -o %cpu,...` → Validate pid with `validateNumericParam(pid, 'pid', 1, 4194304)`, then `execFileAsync('/usr/bin/ps', ['-p', String(pid), '-o', '%cpu,%mem,etimes', '--no-headers'])`
- `ip link set ${interfaceName} down/up` → `validateInterfaceName(interfaceName)`, then `execFileAsync('/usr/sbin/ip', ['link', 'set', interfaceName, 'down'])`
- `ip link show ${interfaceName} | grep ...` → `execFileAsync('/usr/sbin/ip', ['link', 'show', interfaceName])` + JS regex parse
- USB unbind/bind with `${bus}-${device}` → Validate bus/device as numeric, use `fs.writeFileSync` to write to sysfs (no exec needed)
- `tail -n ${lines} ${this.LOG_FILE}` → Use `fs.readFileSync(this.LOG_FILE, 'utf8')` + `.split('\n').slice(-lines)` in JS

**Step 2: Migrate kismet-control-service.ts**

4 calls:

- `pgrep -x kismet` → mechanical
- `` `nohup ${scriptPath} > /tmp/kismet-start.log 2>&1 &` `` → Use `spawn`:
    ```typescript
    import { spawn } from 'child_process';
    const child = spawn(scriptPath, [], {
    	detached: true,
    	stdio: [
    		'ignore',
    		fs.openSync('/tmp/kismet-start.log', 'w'),
    		fs.openSync('/tmp/kismet-start.log', 'a')
    	]
    });
    child.unref();
    ```
- `nohup kismet --no-ncurses ...` → Same spawn pattern
- `tail -20 /tmp/kismet-start.log | grep ...` → `fs.readFileSync` + JS parse

**Step 3: Run verification**

Run: `npx tsc --noEmit && npm run test:unit`

**Step 4: Commit**

```
fix(security): T-A6 — migrate kismet service-manager and control-service to execFile/spawn
```

---

### Task A7: Migrate Remaining Libraries (3 files)

**Files:**

- Modify: `src/lib/server/services/hardware/hardware-details-service.ts` (4 calls, 3 dynamic)
- Modify: `src/lib/server/mcp/servers/test-runner.ts` (3 calls, from validated map)
- Modify: `src/lib/constitution/git-categorizer.ts` (3 calls, 1 dynamic)

**Step 1: Migrate hardware-details-service.ts**

4 calls:

- `iw dev` (static) → `execFileAsync('/usr/sbin/iw', ['dev'])`
- `iw dev ${iface} info` (dynamic x2) → Validate interface name, `execFileAsync('/usr/sbin/iw', ['dev', iface, 'info'])`
- `iw phy phy${phyIdx} info` → Validate phyIdx as numeric, `execFileAsync('/usr/sbin/iw', ['phy', `phy${phyIdx}`, 'info'])`

**Step 2: Migrate test-runner.ts**

3 calls from validated command map. Replace:

```typescript
// Before:
const { stdout, stderr } = await execAsync(command, { cwd: PROJECT_ROOT, timeout: 120000 });

// After:
const { stdout, stderr } = await execFileAsync('/usr/bin/npm', ['run', scriptName], {
	cwd: PROJECT_ROOT,
	timeout: 120000
});
```

Where `scriptName` is looked up from the validated enum map.

**Step 3: Migrate git-categorizer.ts**

3 calls:

- `git rev-parse --git-dir` (static x2) → `execFileAsync('/usr/bin/git', ['rev-parse', '--git-dir'])`
- `` `git blame --porcelain -L${line},${line} "${file}"` `` → `execFileAsync('/usr/bin/git', ['blame', '--porcelain', `-L${line},${line}`, file])` — file comes from internal violation scanning, but still safer as array arg

**Step 4: Run full verification**

Run: `npx tsc --noEmit && npm run test:unit && npm run test:security`
Expected: 0 errors, all tests pass

**Step 5: Verify zero exec imports remain**

Run: `grep -r "from 'child_process'" src/ | grep -v execFile | grep -v spawn`
Expected: empty output (zero matches)

Also: `grep -r "from 'node:child_process'" src/ | grep -v execFile | grep -v spawn`
Expected: empty output

**Step 6: Commit**

```
fix(security): T-A7 — migrate final 3 libraries, zero unsafe exec remaining
```

---

## Workstream B: File Decomposition (51 files → all under 300 lines)

**Note:** Workstream B is very large (51 files). This plan covers Tier 1 (4 files >1000 lines) in full detail. Tiers 2 and 3 follow the same pattern and should be planned in follow-up sessions after Tier 1 is complete.

### Task B1: Decompose DashboardMap.svelte (1794 → ~5 files)

**Files:**

- Modify: `src/lib/components/dashboard/DashboardMap.svelte` (1794 lines)
- Create: `src/lib/components/dashboard/map/MapControls.svelte`
- Create: `src/lib/components/dashboard/map/MapLayers.svelte`
- Create: `src/lib/components/dashboard/map/MapPopups.svelte`
- Create: `src/lib/components/dashboard/map/MapOverlays.svelte`
- Create: `src/lib/components/dashboard/map/map-helpers.ts`

**Step 1: Read and analyze DashboardMap.svelte**

Identify logical sections:

- Map initialization and lifecycle (~200 lines)
- Layer management (satellite, base, device markers) (~400 lines)
- Control buttons (locate, zoom) (~150 lines)
- Popup/overlay rendering (device info, isolation) (~300 lines)
- Event handlers and store integration (~400 lines)
- Helper functions (coordinate transforms, color mapping) (~200 lines)

**Step 2: Extract MapControls.svelte**

Move the locate button, zoom controls, and any custom control components. Accept map instance as prop.

**Step 3: Extract MapLayers.svelte**

Move satellite/vector layer logic, band filtering, and device marker creation. Accept map instance and settings stores as props.

**Step 4: Extract MapPopups.svelte**

Move popup content rendering, device info display, and isolation overlay. Accept map instance and device data as props.

**Step 5: Extract MapOverlays.svelte**

Move any fixed-position overlays (coordinate display, signal strength HUD).

**Step 6: Extract map-helpers.ts**

Move pure functions: coordinate conversions, MGRS formatting, color interpolation, marker creation.

**Step 7: Rewire DashboardMap.svelte as orchestrator**

The original file becomes a thin wrapper that imports and composes the 5 extracted pieces. Target: <300 lines.

**Step 8: Run verification**

Run: `npx tsc --noEmit && npm run test:unit && npm run build`

**Step 9: Commit**

```
refactor(dashboard): T-B1 — decompose DashboardMap into 5 focused modules
```

---

### Task B2: Decompose sweep-manager.ts (1417 → ~4 files)

**Files:**

- Modify: `src/lib/server/hackrf/sweep-manager.ts` (1417 lines)
- Create: `src/lib/server/hackrf/sweep-health-checker.ts`
- Create: `src/lib/server/hackrf/sweep-cleanup-manager.ts`
- Create: `src/lib/server/hackrf/sweep-memory-monitor.ts`

**Step 1: Read and analyze sweep-manager.ts**

Identify extractable concerns:

- Health check logic (heartbeat monitoring, stall detection)
- Cleanup procedures (process termination, resource release)
- Memory monitoring (heap snapshots, pressure detection)
- Core orchestration (start/stop/cycle coordination)

**Step 2: Extract sweep-health-checker.ts**

Move health monitoring functions. Export a class or set of functions that the main manager calls.

**Step 3: Extract sweep-cleanup-manager.ts**

Move cleanup/teardown logic.

**Step 4: Extract sweep-memory-monitor.ts**

Move memory pressure detection and heap monitoring.

**Step 5: Rewire sweep-manager.ts**

Import and delegate to extracted modules. Target: <300 lines.

**Step 6: Run verification**

Run: `npx tsc --noEmit && npm run test:unit`

**Step 7: Commit**

```
refactor(hackrf): T-B2 — decompose sweep-manager into 4 focused modules
```

---

### Task B3: Decompose TopStatusBar.svelte (1203 → ~4 files)

**Files:**

- Modify: `src/lib/components/dashboard/TopStatusBar.svelte` (1203 lines)
- Create: `src/lib/components/dashboard/status/StatusIndicators.svelte`
- Create: `src/lib/components/dashboard/status/NetworkInfo.svelte`
- Create: `src/lib/components/dashboard/status/SystemMonitor.svelte`

**Step 1: Read and identify sections**

- Hardware status indicators (HackRF, GPS, Kismet connection states)
- Network info display (IP, interfaces, WiFi signal)
- System monitor (CPU, memory, temperature)
- Modal dialogs (if any)

**Step 2-4: Extract components**

Each component receives its specific store data as props and renders its section.

**Step 5: Rewire TopStatusBar.svelte**

Becomes layout container + store subscriptions, delegates rendering to children. Target: <300 lines.

**Step 6: Run verification and commit**

```
refactor(dashboard): T-B3 — decompose TopStatusBar into 4 focused modules
```

---

### Task B4: Decompose DevicesPanel.svelte (1047 → ~4 files)

**Files:**

- Modify: `src/lib/components/dashboard/panels/DevicesPanel.svelte` (1047 lines)
- Create: `src/lib/components/dashboard/panels/devices/DeviceList.svelte`
- Create: `src/lib/components/dashboard/panels/devices/DeviceFilters.svelte`
- Create: `src/lib/components/dashboard/panels/devices/DeviceDetails.svelte`

**Step 1: Read and identify sections**

- Device list rendering (MAC, RSSI, packets, encryption)
- Search/sort/filter controls
- Detail view (expanded device info)
- Whitelist management

**Step 2-4: Extract components**

**Step 5: Rewire DevicesPanel.svelte**

Target: <300 lines.

**Step 6: Run verification and commit**

```
refactor(dashboard): T-B4 — decompose DevicesPanel into 4 focused modules
```

---

## Workstream C: Convention Fixes

### Task C1: Migrate Raw HTML Elements to shadcn (4 elements)

**Files:**

- Modify: `src/lib/components/status/TAKIndicator.svelte` (1 button → shadcn Button)
- Modify: `src/lib/components/dashboard/tak/TakConfigView.svelte` (1 checkbox → shadcn Checkbox, 2 radios → shadcn RadioGroup)

**Step 1: Migrate TAKIndicator configure button**

```svelte
<!-- Before: -->
<button class="configure-btn" onclick={configure}>Configure</button>

<!-- After: -->
<Button variant="outline" size="sm" onclick={configure}>Configure</Button>
```

Import shadcn Button at top of file.

**Step 2: Migrate TakConfigView checkbox**

```svelte
<!-- Before: -->
<input type="checkbox" bind:checked={config.connectOnStartup} class="accent-primary" />

<!-- After: -->
<Checkbox bind:checked={config.connectOnStartup} />
```

**Step 3: Migrate TakConfigView radio buttons**

```svelte
<!-- Before: -->
<input type="radio" bind:group={config.authMethod} value="import" class="accent-primary" />

<!-- After: Use shadcn RadioGroup -->
<RadioGroup.Root bind:value={config.authMethod}>
	<RadioGroup.Item value="import" />
	<RadioGroup.Item value="enroll" />
</RadioGroup.Root>
```

**Step 4: Run verification**

Run: `npx tsc --noEmit && npm run build`

**Step 5: Commit**

```
fix(ui): T-C1 — migrate raw button/input elements to shadcn components
```

---

### Task C2: Add Constitutional Exemptions (intentional raw elements)

**Files:**

- Modify: `src/lib/components/dashboard/DashboardMap.svelte` (2 map control buttons)
- Verify: `src/lib/components/dashboard/IconRail.svelte` (already has exemption comment)
- Modify: `src/routes/dashboard/+page.svelte` (5 tab buttons)
- Modify: `src/lib/components/status/TAKIndicator.svelte` (1 indicator button — the toggle, not the configure)

**Step 1: Add exemption comments**

For each intentionally raw button, add:

```svelte
<!-- @constitutional-exemption Article-IV-4.2 — [reason] -->
```

Reasons:

- DashboardMap: "Map overlay control requires MapLibre-specific positioning"
- +page.svelte: "Tab bar buttons use custom active state indicators incompatible with shadcn Button"
- TAKIndicator toggle: "Custom status indicator with dot+label pattern"

**Step 2: Run constitutional audit**

Run: `npx tsx scripts/run-audit.ts`
Expected: No violations from exempted elements

**Step 3: Commit**

```
docs(constitution): T-C2 — add exemption comments for intentional raw HTML elements
```

---

## Verification Checklist (Final)

After all tasks complete, run:

1. `npx tsc --noEmit` — 0 errors
2. `npm run test:unit` — all 163+ tests pass
3. `npm run test:security` — all 151 security tests pass
4. `npm run build` — production build succeeds
5. `grep -r "promisify(exec)" src/` — 0 matches
6. `grep -r "from 'child_process'" src/ | grep -v execFile | grep -v spawn` — 0 matches
7. Line count audit: no component/logic file >300 lines (data exempt)
8. `npx tsx scripts/run-audit.ts` — no new violations

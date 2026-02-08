# Phase 7.4.03: Config Manager (`config-manager.ts`)

**Decomposed from**: Phase-7.4-SERVICE-LAYER.md (Task 7.4.3)
**Risk Level**: MEDIUM -- Configuration loading, file I/O, frequency band definitions
**Prerequisites**: Phase 7.4.06 (shared types)
**Estimated Duration**: 2-3 hours
**Estimated Lines**: ~180
**Audit Date**: 2026-02-08
**Auditor**: Claude Opus 4.6 (Final Gate Audit)

---

## Purpose

Migrate the Python `ConfigManager` to TypeScript. This service handles loading, saving, and querying the HackRF transmit configuration: frequency band definitions, device settings, workflow defaults, and restricted frequency lists.

**Target file**: `src/lib/server/hackrf/transmit/config-manager.ts`

**Replaces**: `hackrf_emitter/backend/utils/config_manager.py` (254 lines)

---

## OMITTED FROM ORIGINAL PLAN

This is a new addition. The Python `config_manager.py` (254 lines) was not mentioned anywhere in the original Phase 7 plan. It was discovered during the independent audit (2026-02-08) of the `hackrf_emitter/backend/utils/` directory.

Without this migration, the transmit layer would have no way to:

- Load frequency band definitions (ISM, GPS, ADS-B, amateur, cellular, etc.)
- Retrieve device settings (default gain, sample rate)
- Access workflow default parameters
- Check restricted frequency lists

---

## What ConfigManager Handles

The Python `ConfigManager` manages four categories of configuration:

### 1. Frequency Band Definitions

Named frequency ranges with metadata. Examples:

- ISM 433 MHz (433.05-434.79 MHz)
- ISM 915 MHz (902-928 MHz)
- GPS L1 (1575.42 MHz)
- ADS-B (1090 MHz)
- Amateur 2m (144-148 MHz)
- Amateur 70cm (420-450 MHz)
- Cellular LTE Band 7 (2500-2570 MHz)
- ELRS 868 MHz, 915 MHz, 2.4 GHz

### 2. Device Settings

Default hardware parameters:

- Default gain (dB)
- Default sample rate (Hz)
- Amplifier enable/disable
- Device timeout values

### 3. Workflow Default Parameters

Per-workflow default parameter sets. Each workflow type (FM, AM, GPS, ADS-B, ELRS, etc.) has its own default frequency, gain, sample rate, and duration.

### 4. Restricted Frequency Lists

Frequencies that should not be transmitted on. Currently empty (matching the all-permissive safety behavior in `safety_manager.py`), but the infrastructure exists for future enforcement.

---

## Methods to Migrate (14 Methods)

| #   | Python Method                | TypeScript Method            | Description                                |
| --- | ---------------------------- | ---------------------------- | ------------------------------------------ |
| 1   | `__init__`                   | `constructor()`              | Load config from JSON                      |
| 2   | `_load_config`               | `loadConfig()`               | Read settings.json from disk               |
| 3   | `_merge_configs`             | `mergeConfigs()`             | Deep merge defaults with user overrides    |
| 4   | `_save_config`               | `saveConfig()`               | Write settings.json to disk                |
| 5   | `get_frequency_bands`        | `getFrequencyBands()`        | Return all defined frequency bands         |
| 6   | `get_device_settings`        | `getDeviceSettings()`        | Return HackRF device defaults              |
| 7   | `get_safety_settings`        | `getSafetySettings()`        | Return safety configuration values         |
| 8   | `get_workflow_defaults`      | `getWorkflowDefaults()`      | Return per-workflow default params         |
| 9   | `get_restricted_frequencies` | `getRestrictedFrequencies()` | Return restricted frequency list           |
| 10  | `is_frequency_allowed`       | `isFrequencyAllowed()`       | Check frequency against restricted list    |
| 11  | `get_band_for_frequency`     | `getBandForFrequency()`      | Find the band containing a given frequency |
| 12  | `get_elrs_bands`             | `getELRSBands()`             | Return ELRS-specific frequency bands       |
| 13  | `get_gps_bands`              | `getGPSBands()`              | Return GPS-specific frequency bands        |
| 14  | `update_config`              | `updateConfig()`             | Modify a config section and save to disk   |

### Method Details

**1. `constructor(configPath?: string)`**
Accept an optional config file path (defaults to `config/hackrf-settings.json`). Call `loadConfig()` to read from disk. If the file does not exist, use built-in defaults and write the default config to disk on first run.

**2. `loadConfig(): HackRFConfig`**
Read and parse the JSON config file. If the file is missing or malformed, log a warning and return the built-in defaults. Use `fs.readFileSync` for synchronous loading at startup (config is needed before any async operations).

**3. `mergeConfigs(defaults: HackRFConfig, overrides: Partial<HackRFConfig>): HackRFConfig`**
Deep merge the user's config overrides onto the built-in defaults. This ensures that new fields added in future versions are always present, even if the user's config file predates them. Use a recursive merge (not `Object.assign`, which is shallow).

**4. `saveConfig(): void`**
Write the current config object to the JSON file with 2-space indentation. Use `fs.writeFileSync` with `{ mode: 0o600 }` for file permissions (config may contain restricted frequency lists that are operationally sensitive).

**5. `getFrequencyBands(): FrequencyBand[]`**
Return the complete array of frequency band definitions from the config.

**6. `getDeviceSettings(): DeviceSettings`**
Return the device settings section of the config.

**7. `getSafetySettings(): SafetySettings`**
Return the safety settings section of the config.

**8. `getWorkflowDefaults(workflowName?: string): WorkflowDefaults | Record<string, WorkflowDefaults>`**
If a workflow name is provided, return that workflow's defaults. If no name, return the entire defaults map.

**9. `getRestrictedFrequencies(): number[]`**
Return the list of restricted frequencies (currently empty).

**10. `isFrequencyAllowed(frequencyHz: number): boolean`**
Check whether a frequency falls within any restricted range. Currently always returns `true` (matches Python behavior). The implementation should still perform the check against the restricted list -- it just happens that the list is empty.

**11. `getBandForFrequency(frequencyHz: number): FrequencyBand | null`**
Iterate through frequency bands and return the first band where `minHz <= frequencyHz <= maxHz`. Return `null` if no band contains the frequency.

**12. `getELRSBands(): FrequencyBand[]`**
Filter `getFrequencyBands()` by category `'elrs'`.

**13. `getGPSBands(): FrequencyBand[]`**
Filter `getFrequencyBands()` by category `'gps'`.

**14. `updateConfig(section: string, values: Record<string, unknown>): void`**
Update a specific section of the config object (e.g., `'deviceSettings'`, `'safetySettings'`), then call `saveConfig()` to persist.

---

## Config File Migration Path

### Current Location

```
hackrf_emitter/backend/config/settings.json  (62 lines)
```

### New Location

```
config/hackrf-settings.json  (project root config directory)
```

The `config/` directory at project root is the standard location for application configuration in Argos (already contains ESLint config, Playwright config, etc.). Moving the HackRF settings here follows the established convention.

### Migration Steps

1. Copy `hackrf_emitter/backend/config/settings.json` to `config/hackrf-settings.json`
2. Validate JSON structure matches the TypeScript interfaces
3. Update any hardcoded paths in deployment scripts
4. The Python version continues to use its own copy until Phase 7.7 (deletion/cleanup)
5. Both copies coexist during the migration period -- the TypeScript version reads from `config/` and the Python version reads from `hackrf_emitter/backend/config/`

---

## TypeScript Interfaces

```typescript
interface FrequencyBand {
	name: string;
	category: string; // 'ism', 'gps', 'adsb', 'amateur', 'cellular', 'elrs'
	minHz: number;
	maxHz: number;
	description: string;
	defaultGainDb: number;
	defaultSampleRateMsps: number;
}

interface DeviceSettings {
	defaultGainDb: number;
	defaultSampleRateHz: number;
	amplifierEnabled: boolean;
	timeoutMs: number;
}

interface SafetySettings {
	maxGainDb: number;
	maxFrequencyHz: number;
	minFrequencyHz: number;
	maxSampleRateMsps: number;
	maxDurationS: number;
	restrictedFrequencies: number[];
}

interface WorkflowDefaults {
	frequency: number;
	gain: number;
	sampleRate: number;
	duration: number;
	repeat: boolean;
}

interface HackRFConfig {
	frequencyBands: FrequencyBand[];
	deviceSettings: DeviceSettings;
	safetySettings: SafetySettings;
	workflowDefaults: Record<string, WorkflowDefaults>;
}
```

---

## Verification Commands

```bash
# File exists and compiles
test -f src/lib/server/hackrf/transmit/config-manager.ts && echo "EXISTS" || echo "MISSING"
npx tsc --noEmit src/lib/server/hackrf/transmit/config-manager.ts

# Line count within budget
wc -l src/lib/server/hackrf/transmit/config-manager.ts
# Expected: <= 250 lines

# Config file exists at new location
test -f config/hackrf-settings.json && echo "EXISTS" || echo "MISSING"

# Config file is valid JSON
node -e "JSON.parse(require('fs').readFileSync('config/hackrf-settings.json', 'utf-8')); console.log('VALID JSON')"

# All 14 methods present
grep -cE '(constructor|loadConfig|mergeConfigs|saveConfig|getFrequencyBands|getDeviceSettings|getSafetySettings|getWorkflowDefaults|getRestrictedFrequencies|isFrequencyAllowed|getBandForFrequency|getELRSBands|getGPSBands|updateConfig)' src/lib/server/hackrf/transmit/config-manager.ts
# Expected: >= 14

# No console.log in production code
grep -c 'console\.log' src/lib/server/hackrf/transmit/config-manager.ts
# Expected: 0

# Full typecheck
npm run typecheck
```

---

## Verification Checklist

- [ ] `config-manager.ts` exists at `src/lib/server/hackrf/transmit/config-manager.ts`
- [ ] All 14 methods implemented (matching Python `config_manager.py` API surface)
- [ ] `config/hackrf-settings.json` exists with valid JSON
- [ ] Config file copied from `hackrf_emitter/backend/config/settings.json`
- [ ] `loadConfig()` handles missing file gracefully (falls back to built-in defaults)
- [ ] `loadConfig()` handles malformed JSON gracefully (logs warning, uses defaults)
- [ ] `mergeConfigs()` performs deep merge (not shallow Object.assign)
- [ ] `saveConfig()` writes with 0o600 permissions
- [ ] `isFrequencyAllowed()` returns `true` for all frequencies (matches current Python behavior)
- [ ] `getBandForFrequency()` correctly identifies band membership by min/max Hz range
- [ ] `getELRSBands()` filters by category `'elrs'`
- [ ] `getGPSBands()` filters by category `'gps'`
- [ ] `updateConfig()` persists changes to disk
- [ ] TypeScript interfaces match JSON structure exactly
- [ ] No `console.log` statements in production code
- [ ] File does not exceed 300 lines
- [ ] No function exceeds 60 lines
- [ ] `npm run typecheck` passes

---

## Definition of Done

This task is complete when:

1. `ConfigManager` loads `config/hackrf-settings.json` and returns all 4 config categories
2. `getFrequencyBands()` returns a non-empty array of band definitions
3. `isFrequencyAllowed()` returns `true` for any frequency (matching Python behavior)
4. `getBandForFrequency(433_920_000)` correctly identifies ISM 433 band
5. `updateConfig()` persists changes and they survive a reload
6. Missing config file triggers default creation (not crash)
7. All unit tests pass
8. `npm run typecheck` passes with zero errors

---

## Cross-References

- **Phase 7.4.01** (Transmit Manager): Uses ConfigManager for workflow defaults and frequency bands
- **Phase 7.4.04** (Safety Manager): Uses ConfigManager.getSafetySettings() for hardware limits
- **Phase 7.4.06** (Shared Types): `WorkflowParams` interface, config-specific interfaces
- **Phase 7.5** (API Routes): Config endpoints expose ConfigManager data to frontend
- **Phase 7.7** (Deletion/Cleanup): Original `hackrf_emitter/backend/config/settings.json` deleted after migration verified

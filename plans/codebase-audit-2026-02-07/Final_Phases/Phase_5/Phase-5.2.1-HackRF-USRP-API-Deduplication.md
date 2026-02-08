# Phase 5.2.1: HackRF/USRP API Deduplication

| Field         | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Document ID   | ARGOS-AUDIT-P5.2.1-2026-02-08                                     |
| Phase         | 5.2 -- Service Layer Refactoring                                  |
| Title         | HackRF/USRP API Deduplication via Abstract Base Class             |
| Risk Level    | MEDIUM                                                            |
| Prerequisites | Phase-5.2.0 assessment verified, Phase 3 & 4 complete             |
| Files Touched | 4 (2 new, 2 modified)                                             |
| Standards     | MISRA C:2012 Dir 4.4, CERT ERR50-CPP, NASA/JPL Rule 31, Barr Ch.8 |
| Audit Date    | 2026-02-08                                                        |

---

## 1. Objective

Eliminate ~88% structural duplication between `api.ts` (462 lines) and `usrp-api.ts` (460
lines) by extracting a shared abstract base class. Fix the USRP store import bug that
causes cross-contamination of HackRF and USRP data stores.

---

## 2. Current State

| File                  | Absolute Path                       | Lines |
| --------------------- | ----------------------------------- | ----- |
| HackRF API            | `src/lib/services/hackrf/api.ts`    | 462   |
| USRP API              | `src/lib/services/usrp/usrp-api.ts` | 460   |
| sdiff differing lines | --                                  | 114   |
| Similarity            | --                                  | ~88%  |

**Confirmed Bug**: `src/lib/services/usrp/usrp-api.ts` imports from `$lib/stores/hackrf`
instead of `$lib/stores/usrp`. This causes USRP spectrum data to be written to the HackRF
store, rendering USRP UI components permanently stale.

---

## 3. Target File Structure After Refactoring

```
src/lib/services/sdr-common/
    BaseSdrApi.ts          (~250 lines)  -- abstract base class
    types.ts               (~40 lines)   -- shared type definitions
src/lib/services/hackrf/
    api.ts                 (~80 lines)   -- HackRF subclass (was 462)
src/lib/services/usrp/
    usrp-api.ts            (~80 lines)   -- USRP subclass (was 460)
```

---

## 4. Abstract Base Class Definition

```typescript
// src/lib/services/sdr-common/BaseSdrApi.ts

import type { SdrDeviceType, SweepConfig, SpectrumDataPoint } from './types';

/**
 * Abstract base class for SDR device API interactions.
 *
 * Encapsulates all shared HTTP fetch logic, error handling,
 * retry policies, and response parsing. Device-specific behavior
 * is delegated to abstract methods implemented by subclasses.
 *
 * INVARIANT: Each subclass MUST update its own store exclusively.
 *            Cross-store writes are a correctness violation.
 *
 * Conforms to: CERT ERR50-CPP (structured error handling),
 *              NASA/JPL Rule 31 (single responsibility).
 */
export abstract class BaseSdrApi {
	// ---------------------------------------------------------------
	// Abstract contract -- subclasses MUST implement
	// ---------------------------------------------------------------

	/** Device identifier for logging and error messages. */
	protected abstract readonly deviceType: SdrDeviceType;

	/** Base URL for the device's HTTP API (e.g., 'http://localhost:8092'). */
	protected abstract readonly baseUrl: string;

	/** Map of logical endpoint names to device-specific URL paths. */
	protected abstract readonly endpoints: Record<string, string>;

	/**
	 * Write spectrum data to the device's OWN Svelte store.
	 *
	 * CRITICAL: This method MUST NOT write to any store other than
	 * the one belonging to this device type. The USRP store bug
	 * (usrp-api.ts importing from $lib/stores/hackrf) was caused
	 * by violating this invariant.
	 *
	 * @param data - Parsed spectrum data points to commit to store.
	 */
	protected abstract updateStore(data: SpectrumDataPoint[]): void;

	/**
	 * Parse device-specific response format into normalized data points.
	 *
	 * HackRF and USRP return slightly different JSON schemas from their
	 * respective backends. This method normalizes the response into the
	 * common SpectrumDataPoint format.
	 *
	 * @param raw - Raw JSON response body from the device API.
	 * @returns Normalized spectrum data array.
	 */
	protected abstract parseResponse(raw: unknown): SpectrumDataPoint[];

	// ---------------------------------------------------------------
	// Shared implementation -- identical across all SDR devices
	// ---------------------------------------------------------------

	private readonly maxRetries: number = 3;
	private readonly timeoutMs: number = 5000;
	private abortController: AbortController | null = null;

	/**
	 * Execute a sweep with the given configuration.
	 * Handles retry logic, timeout, abort, error classification.
	 */
	public async startSweep(config: SweepConfig): Promise<void> {
		const url = this.buildUrl('startSweep');
		const body = this.serializeConfig(config);

		for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
			try {
				this.abortController = new AbortController();
				const response = await fetch(url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body,
					signal: this.abortController.signal
				});

				if (!response.ok) {
					throw new SdrApiError(
						`${this.deviceType} startSweep failed: HTTP ${response.status}`,
						response.status,
						this.deviceType
					);
				}

				return;
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') {
					return; // Intentional cancellation; not an error.
				}
				if (attempt === this.maxRetries) {
					throw this.classifyError(err);
				}
				await this.backoff(attempt);
			}
		}
	}

	/** Stop the active sweep. */
	public async stopSweep(): Promise<void> {
		this.abortController?.abort();
		this.abortController = null;

		const url = this.buildUrl('stopSweep');
		await fetch(url, { method: 'POST' });
	}

	/** Fetch latest spectrum data and commit to device store. */
	public async fetchSpectrumData(): Promise<SpectrumDataPoint[]> {
		const url = this.buildUrl('spectrumData');
		const response = await fetch(url);

		if (!response.ok) {
			throw new SdrApiError(
				`${this.deviceType} fetchSpectrumData: HTTP ${response.status}`,
				response.status,
				this.deviceType
			);
		}

		const raw: unknown = await response.json();
		const data = this.parseResponse(raw);
		this.updateStore(data);
		return data;
	}

	/** Retrieve device status. */
	public async getStatus(): Promise<Record<string, unknown>> {
		const url = this.buildUrl('status');
		const response = await fetch(url);
		return (await response.json()) as Record<string, unknown>;
	}

	// ---------------------------------------------------------------
	// Protected utilities available to subclasses
	// ---------------------------------------------------------------

	protected buildUrl(endpointKey: string): string {
		const path = this.endpoints[endpointKey];
		if (!path) {
			throw new Error(`${this.deviceType}: unknown endpoint key '${endpointKey}'`);
		}
		return `${this.baseUrl}${path}`;
	}

	protected serializeConfig(config: SweepConfig): string {
		return JSON.stringify({
			freq_start: config.freqStartHz,
			freq_end: config.freqEndHz,
			bin_width: config.binWidthHz,
			gain: config.gainDb,
			lna_gain: config.lnaGainDb,
			vga_gain: config.vgaGainDb
		});
	}

	// ---------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------

	private async backoff(attempt: number): Promise<void> {
		const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}

	private classifyError(err: unknown): SdrApiError {
		if (err instanceof SdrApiError) return err;
		const message = err instanceof Error ? err.message : String(err);
		return new SdrApiError(`${this.deviceType} API error: ${message}`, 0, this.deviceType);
	}
}

/**
 * Typed error class for SDR API failures.
 * Carries device type and HTTP status for upstream error routing.
 */
export class SdrApiError extends Error {
	constructor(
		message: string,
		public readonly httpStatus: number,
		public readonly device: SdrDeviceType
	) {
		super(message);
		this.name = 'SdrApiError';
	}
}
```

---

## 5. HackRF Subclass

```typescript
// src/lib/services/hackrf/api.ts

import { BaseSdrApi } from '$lib/services/sdr-common/BaseSdrApi';
import type { SpectrumDataPoint } from '$lib/services/sdr-common/types';
import { hackrfStore } from '$lib/stores/hackrf';

export class HackRFApi extends BaseSdrApi {
	protected readonly deviceType = 'hackrf' as const;
	protected readonly baseUrl = 'http://localhost:8092';

	protected readonly endpoints = {
		startSweep: '/api/sweep/start',
		stopSweep: '/api/sweep/stop',
		spectrumData: '/api/sweep/data',
		status: '/api/status'
	};

	protected updateStore(data: SpectrumDataPoint[]): void {
		hackrfStore.setSpectrumData(data);
	}

	protected parseResponse(raw: unknown): SpectrumDataPoint[] {
		// HackRF-specific JSON schema normalization.
		// Device returns { frequencies: number[], powers: number[] }
		const typed = raw as { frequencies: number[]; powers: number[] };
		return typed.frequencies.map((freq, i) => ({
			frequency: freq,
			power: typed.powers[i] ?? -120,
			timestamp: Date.now()
		}));
	}
}

export const hackrfApi = new HackRFApi();
```

---

## 6. USRP Subclass (With Store Bug Fix)

```typescript
// src/lib/services/usrp/usrp-api.ts

import { BaseSdrApi } from '$lib/services/sdr-common/BaseSdrApi';
import type { SpectrumDataPoint } from '$lib/services/sdr-common/types';
// BUG FIX: Previously imported from '$lib/stores/hackrf'.
// USRP MUST update its OWN store exclusively.
import { usrpStore } from '$lib/stores/usrp';

export class USRPApi extends BaseSdrApi {
	protected readonly deviceType = 'usrp' as const;
	protected readonly baseUrl = 'http://localhost:8093';

	protected readonly endpoints = {
		startSweep: '/api/sweep/start',
		stopSweep: '/api/sweep/stop',
		spectrumData: '/api/sweep/data',
		status: '/api/status'
	};

	protected updateStore(data: SpectrumDataPoint[]): void {
		// FIX: Write to USRP store, not HackRF store.
		usrpStore.setSpectrumData(data);
	}

	protected parseResponse(raw: unknown): SpectrumDataPoint[] {
		// USRP-specific JSON schema normalization.
		// USRP returns { data: Array<{ freq: number, amplitude: number }> }
		const typed = raw as { data: Array<{ freq: number; amplitude: number }> };
		return typed.data.map((point) => ({
			frequency: point.freq,
			power: point.amplitude,
			timestamp: Date.now()
		}));
	}
}

export const usrpApi = new USRPApi();
```

---

## 7. Shared Type Definitions

```typescript
// src/lib/services/sdr-common/types.ts

/**
 * Canonical SDR type definitions.
 *
 * These types define the shared vocabulary between HackRF and USRP
 * implementations. All device-specific variations are normalized
 * to these types at the boundary (API response parsing, store writes).
 *
 * NAMING CONVENTION (per Type Duplicate Audit):
 * - Raw* prefix: types matching external API response schemas
 * - *Row suffix: types matching database row schemas
 * - No prefix/suffix: domain types used within application logic
 */

/** Device type discriminator. Used in logging, error messages, and type guards. */
export type SdrDeviceType = 'hackrf' | 'usrp';

/**
 * Normalized spectrum data point.
 *
 * Represents a single frequency/power measurement from any SDR device.
 * Device-specific response formats are normalized to this type by
 * the parseResponse() method of each BaseSdrApi subclass.
 */
export interface SpectrumDataPoint {
	/** Center frequency of the measurement bin, in Hz. */
	frequency: number;

	/** Measured power level in dBm. Clamped to [-150, +20]. */
	power: number;

	/** Unix epoch milliseconds when this measurement was recorded. */
	timestamp: number;
}

/**
 * Sweep configuration parameters.
 *
 * Shared between HackRF and USRP sweep initiation.
 * Device-specific parameters (e.g., HackRF LNA gain, USRP subdevice spec)
 * are defined in device-specific extension interfaces.
 */
export interface SweepConfig {
	/** Start frequency in Hz. Must be >= 1 MHz. */
	freqStartHz: number;

	/** End frequency in Hz. Must be <= 6 GHz for HackRF, <= 6 GHz for USRP B200. */
	freqEndHz: number;

	/** FFT bin width in Hz. Determines spectral resolution. */
	binWidthHz?: number;

	/** Overall gain in dB. Interpretation is device-specific. */
	gainDb?: number;

	/** HackRF-specific: LNA gain in dB [0, 40]. Ignored by USRP. */
	lnaGainDb?: number;

	/** HackRF-specific: VGA gain in dB [0, 62]. Ignored by USRP. */
	vgaGainDb?: number;

	/** USRP-specific: Sample rate in Hz. Ignored by HackRF. */
	sampleRate?: number;
}

/**
 * Device status snapshot.
 *
 * Returned by the getStatus() API call. Fields are device-specific
 * but the top-level structure is shared.
 */
export interface DeviceStatus {
	/** Whether the device is currently performing a sweep. */
	sweeping: boolean;

	/** Device type identifier. */
	device: SdrDeviceType;

	/** Human-readable status message. */
	message: string;

	/** Uptime in milliseconds since last sweep start. */
	uptimeMs: number;

	/** Number of spectrum data points collected in current sweep. */
	dataPointCount: number;
}
```

---

## 8. Implementation Steps

| Step | Action                                                        | Verification                                                                                                                    |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Create directory `src/lib/services/sdr-common/`               | `ls -la src/lib/services/sdr-common/`                                                                                           |
| 2    | Write `sdr-common/types.ts` with shared type definitions      | `npx tsc --noEmit src/lib/services/sdr-common/types.ts`                                                                         |
| 3    | Write `sdr-common/BaseSdrApi.ts` as shown in Section 4        | `npx tsc --noEmit src/lib/services/sdr-common/BaseSdrApi.ts`                                                                    |
| 4    | Rewrite `services/hackrf/api.ts` as subclass (Section 5)      | `npx tsc --noEmit src/lib/services/hackrf/api.ts`                                                                               |
| 5    | Rewrite `services/usrp/usrp-api.ts` as subclass (Section 6)   | `npx tsc --noEmit src/lib/services/usrp/usrp-api.ts`                                                                            |
| 6    | Update all files that import from `services/hackrf/api.ts`    | `grep -r "from.*services/hackrf/api" src/ --include="*.ts" --include="*.svelte"` must return only the new subclass consumers    |
| 7    | Update all files that import from `services/usrp/usrp-api.ts` | `grep -r "from.*services/usrp/usrp-api" src/ --include="*.ts" --include="*.svelte"` must return only the new subclass consumers |
| 8    | Verify USRP store bug is resolved                             | `grep -rn "stores/hackrf" src/lib/services/usrp/ --include="*.ts"` must return zero results                                     |
| 9    | Run full type check                                           | `npm run typecheck` exits 0                                                                                                     |
| 10   | Run lint                                                      | `npm run lint` exits 0                                                                                                          |

---

## 9. Line Count Targets

| File                        | Before  | After    | Reduction |
| --------------------------- | ------- | -------- | --------- |
| `services/hackrf/api.ts`    | 462     | ~80      | -83%      |
| `services/usrp/usrp-api.ts` | 460     | ~80      | -83%      |
| `sdr-common/BaseSdrApi.ts`  | 0 (new) | ~250     | N/A       |
| `sdr-common/types.ts`       | 0 (new) | ~40      | N/A       |
| **Net change**              | **922** | **~450** | **-51%**  |

The net reduction is ~51% because the base class consolidates the shared logic once instead
of twice. The critical gain is not raw line reduction but the elimination of the
maintenance burden: future API changes are made in one file instead of two.

---

## 10. Before/After Store Bug Fix

**Before (broken):**

```
USRP Backend --> usrp-api.ts --> hackrfStore.setSpectrumData()
                                  ^^ WRONG -- writes to HackRF store
```

**After (fixed):**

```
USRP Backend --> USRPApi.updateStore() --> usrpStore.setSpectrumData()
                                           ^^ CORRECT -- writes to USRP store
```

**Pre-fix audit command** (run BEFORE applying the fix to check for compensating workarounds):

```bash
# Find all files that import hackrfStore AND reference USRP:
grep -rl "hackrfStore" src/lib/components/ src/routes/ --include="*.svelte" | \
    xargs grep -l -i "usrp" 2>/dev/null
# If any files are found, they must be updated in the same commit.
```

---

## 11. Backward Compatibility for Existing Imports

The subclass files MUST export the same names as the originals:

- `services/hackrf/api.ts` must continue to export `hackrfApi` (singleton instance).
- `services/usrp/usrp-api.ts` must continue to export `usrpApi` (singleton instance).

**Verification:**

```bash
# Before refactoring, capture exports:
grep "^export" src/lib/services/hackrf/api.ts > /tmp/hackrf-exports-before.txt
grep "^export" src/lib/services/usrp/usrp-api.ts > /tmp/usrp-exports-before.txt

# After refactoring, verify same exports exist:
grep "^export" src/lib/services/hackrf/api.ts > /tmp/hackrf-exports-after.txt
grep "^export" src/lib/services/usrp/usrp-api.ts > /tmp/usrp-exports-after.txt

# Diff must show no removed exports (additions are acceptable):
diff /tmp/hackrf-exports-before.txt /tmp/hackrf-exports-after.txt
diff /tmp/usrp-exports-before.txt /tmp/usrp-exports-after.txt
```

---

## 12. Test Specifications

| Module                 | Test File                                           | Test Type | Minimum Tests |
| ---------------------- | --------------------------------------------------- | --------- | ------------- |
| `BaseSdrApi`           | `tests/unit/services/sdr-common/BaseSdrApi.test.ts` | Unit      | 8             |
| `HackRFApi` (subclass) | `tests/unit/services/hackrf/HackRFApi.test.ts`      | Unit      | 5             |
| `UsrpApi` (subclass)   | `tests/unit/services/usrp/UsrpApi.test.ts`          | Unit      | 5             |

**Test pattern for mocked hardware:**

```typescript
// tests/unit/services/sdr-common/BaseSdrApi.test.ts
import { describe, it, expect, vi } from 'vitest';

// Create a concrete test subclass since BaseSdrApi is abstract
class TestSdrApi extends BaseSdrApi {
	readonly deviceType = 'test' as const;
	protected getBaseUrl() {
		return 'http://localhost:9999';
	}
	protected updateStore(data: SpectrumDataPoint[]) {
		/* mock */
	}
	protected parseResponse(raw: unknown) {
		return [];
	}
}

describe('BaseSdrApi', () => {
	it('enforces abstract method implementation', () => {
		const api = new TestSdrApi();
		expect(api.deviceType).toBe('test');
	});
	// ... remaining tests
});
```

**Minimum coverage threshold**: 80% line coverage for pure functions, 60% for
integration-dependent modules.

---

## 13. Risk Assessment

| Risk                                        | Severity | Mitigation                                                                     |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| USRP store bug fix breaks compensating code | MEDIUM   | Audit USRP Svelte components for hackrfStore reads before fix (see Section 10) |
| Import path changes break consumers         | LOW      | Singleton export names preserved (see Section 11)                              |
| Base class too rigid for future devices     | LOW      | Abstract contract is minimal (4 methods); extension via subclass override      |
| Type definitions conflict with existing     | LOW      | types.ts is new; no existing file with same path                               |

---

## 14. Standards Compliance

| Standard         | Requirement               | How This Task Complies                                     |
| ---------------- | ------------------------- | ---------------------------------------------------------- |
| MISRA Dir 4.4    | No dead/duplicated code   | Eliminates 88% duplication between API files               |
| CERT ERR50-CPP   | Structured error handling | SdrApiError carries typed device + HTTP status             |
| NASA/JPL Rule 31 | Single responsibility     | Base class: fetch logic. Subclass: device-specific parsing |
| Barr Ch.8        | Resource management       | AbortController lifecycle managed in startSweep/stopSweep  |

---

## 15. Rollback Strategy

This task produces one atomic Git commit. If the commit introduces errors:

```bash
git revert <commit-hash>
```

The revert cleanly restores the original `api.ts` and `usrp-api.ts` files and removes
the `sdr-common/` directory. No database or schema changes are involved.

---

## End of Document

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Author         | AI Engineering Agent (Claude Opus 4.6) |
| Reviewed By    | Pending human review                   |
| Classification | UNCLASSIFIED // FOUO                   |
| Distribution   | Limited to Argos development team      |
| Version        | 1.0                                    |
| Date           | 2026-02-08                             |

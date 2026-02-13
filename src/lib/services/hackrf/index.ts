/**
 * HackRF Services Module
 *
 * Core HackRF SDR service layer: device management, spectrum sweep analysis,
 * signal processing, time-window filtering, API client, USRP API bridge,
 * and low-level sweep manager components.
 */

// --- api ---
export { HackRFAPI, hackrfAPI } from './api';

// --- hackrf-service ---
export { HackRFService, hackrfService } from './hackrf-service';

// --- time-window-filter ---
export type {
	TimedSignal,
	TimeWindowConfig,
	TimeWindowState,
	TimeWindowStats
} from '$lib/hackrf/spectrum';
export { formatAge, getAgeColor, getRelevanceIcon, timeWindowFilter } from '$lib/hackrf/spectrum';

// --- usrp-api ---
export { USRPAPI, usrpAPI } from './usrp-api';

// --- sweep-manager/ subdirectory (types only) ---
// NOTE: Value re-exports (BufferManager, ErrorTracker, FrequencyCycler,
// ProcessManager) are intentionally excluded from this barrel. ProcessManager
// imports node:path and node:url which are server-only — re-exporting here
// would pull Node.js built-ins into the client bundle via the barrel chain.
// Import sweep-manager classes directly:
//   import { ProcessManager } from '$lib/hackrf/sweep';
export type {
	BufferConfig,
	BufferState,
	CycleConfig,
	CycleState,
	DeviceState,
	ErrorAnalysis,
	ErrorState,
	FrequencyConfig,
	ParsedLine,
	ProcessConfig,
	ProcessState,
	RecoveryConfig
} from '$lib/hackrf/sweep';

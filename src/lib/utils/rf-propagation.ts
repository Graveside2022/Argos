/**
 * Friis free-space propagation calculator for RF range overlay.
 *
 * Pure functions — no browser APIs, no Svelte imports, no side effects.
 * All frequency inputs are in Hz. All distance outputs are in meters.
 */
import { resolveMapColor, SIGNAL_COLORS } from '$lib/components/dashboard/map/map-colors';
import type { RFBandKey, RFRangeBand } from '$lib/types/rf-range';

// ── Constants ────────────────────────────────────────────────────────

/** Display range limits for the RF overlay */
export const RF_RANGE_LIMITS = {
	MIN_DISPLAY_METERS: 50,
	MAX_DISPLAY_METERS: 50_000
} as const;

/** GPS stale timeout — freeze overlay for this long after GPS fix loss */
export const GPS_STALE_TIMEOUT_MS = 30_000;

/**
 * The FSPL constant: 20·log₁₀(4π/c) ≈ -147.55
 * Used as: FSPL(dB) = 20·log₁₀(d) + 20·log₁₀(f) + FSPL_CONSTANT
 * Or rearranged: d_max = 10^((linkBudget - 20·log₁₀(f) - FSPL_CONSTANT) / 20)
 */
const FSPL_OFFSET = 147.55;

// ── Band definitions ─────────────────────────────────────────────────

interface BandDef {
	key: RFBandKey;
	/** Fraction of d_max for outer radius (0-1) */
	outerFraction: number;
	/** Fraction of d_max for inner radius (0-1) */
	innerFraction: number;
	marginLabel: string;
	colorEntry: { var: string; fallback: string };
}

/**
 * RF band color mapping — aliases SIGNAL_COLORS to RF coverage semantics.
 *
 * The SIGNAL_COLORS keys reflect WiFi signal quality (critical=strongest),
 * while RF bands use coverage semantics (strong=closest). The visual result
 * is: green (strong) → blue (usable) → gold (marginal) → red (maximum).
 */
export const RF_BAND_COLORS = {
	strong: SIGNAL_COLORS.fair, // sage green #8bbfa0 — best coverage
	usable: SIGNAL_COLORS.weak, // blue #809ad0 — reliable coverage
	marginal: SIGNAL_COLORS.strong, // gold #d4a054 — degraded coverage
	maximum: SIGNAL_COLORS.critical // red #c45b4a — theoretical maximum
} as const;

const BAND_DEFS: readonly BandDef[] = [
	{
		key: 'strong',
		outerFraction: 0.25,
		innerFraction: 0,
		marginLabel: '> 12 dB margin',
		colorEntry: RF_BAND_COLORS.strong
	},
	{
		key: 'usable',
		outerFraction: 0.5,
		innerFraction: 0.25,
		marginLabel: '6-12 dB margin',
		colorEntry: RF_BAND_COLORS.usable
	},
	{
		key: 'marginal',
		outerFraction: 0.75,
		innerFraction: 0.5,
		marginLabel: '3-6 dB margin',
		colorEntry: RF_BAND_COLORS.marginal
	},
	{
		key: 'maximum',
		outerFraction: 1.0,
		innerFraction: 0.75,
		marginLabel: '0-3 dB margin',
		colorEntry: RF_BAND_COLORS.maximum
	}
] as const;

// ── Core math ────────────────────────────────────────────────────────

/**
 * Calculate maximum free-space range using the Friis transmission equation.
 *
 * Link Budget = Pt + Gt + Gr - Sensitivity
 * d_max = 10^((LinkBudget - 20·log₁₀(f) + 147.55) / 20)
 *
 * @param frequencyHz - Operating frequency in Hz (1e6 to 6e9)
 * @param txPowerDbm - Transmit power in dBm
 * @param txGainDbi - Transmit antenna gain in dBi
 * @param rxGainDbi - Receive antenna gain in dBi
 * @param sensitivityDbm - Receiver sensitivity threshold in dBm (negative)
 * @returns Maximum range in meters (uncapped, always >= 0)
 */
export function calculateFriisRange(
	frequencyHz: number,
	txPowerDbm: number,
	txGainDbi: number,
	rxGainDbi: number,
	sensitivityDbm: number
): number {
	if (frequencyHz <= 0) return 0;

	const linkBudget = txPowerDbm + txGainDbi + rxGainDbi - sensitivityDbm;
	const exponent = (linkBudget - 20 * Math.log10(frequencyHz) + FSPL_OFFSET) / 20;

	return Math.max(0, Math.pow(10, exponent));
}

/**
 * Format a distance in meters to a human-readable label.
 */
function formatDistance(meters: number): string {
	if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
	return `${Math.round(meters)} m`;
}

/**
 * Build 4 concentric range bands from a maximum display range.
 * Band radii are proportional: 25%, 50%, 75%, 100% of maxRangeMeters.
 *
 * @param maxRangeMeters - Maximum display range in meters (already capped)
 * @returns Array of 4 RFRangeBand objects ordered inner → outer
 */
export function buildRFRangeBands(maxRangeMeters: number): RFRangeBand[] {
	return BAND_DEFS.map((def) => ({
		outerR: maxRangeMeters * def.outerFraction,
		innerR: maxRangeMeters * def.innerFraction,
		band: def.key,
		color: resolveMapColor(def.colorEntry),
		marginLabel: def.marginLabel,
		distanceLabel: formatDistance(maxRangeMeters * def.outerFraction)
	}));
}

/**
 * Build RF range bands using fallback hex colors (for SSR/test contexts
 * where CSS custom properties are unavailable).
 */
export function buildRFRangeBandsFallback(maxRangeMeters: number): RFRangeBand[] {
	return BAND_DEFS.map((def) => ({
		outerR: maxRangeMeters * def.outerFraction,
		innerR: maxRangeMeters * def.innerFraction,
		band: def.key,
		color: def.colorEntry.fallback,
		marginLabel: def.marginLabel,
		distanceLabel: formatDistance(maxRangeMeters * def.outerFraction)
	}));
}

/**
 * Clamp a range value to display limits.
 * Minimum 50m (below GPS accuracy), maximum 50km (practical VHF/UHF LOS limit).
 *
 * @param rangeMeters - Raw Friis range in meters
 * @returns Clamped display range and whether capping was applied
 */
export function clampDisplayRange(rangeMeters: number): {
	displayRange: number;
	isCapped: boolean;
} {
	if (rangeMeters <= RF_RANGE_LIMITS.MIN_DISPLAY_METERS) {
		return { displayRange: RF_RANGE_LIMITS.MIN_DISPLAY_METERS, isCapped: true };
	}
	if (rangeMeters >= RF_RANGE_LIMITS.MAX_DISPLAY_METERS) {
		return { displayRange: RF_RANGE_LIMITS.MAX_DISPLAY_METERS, isCapped: true };
	}
	return { displayRange: rangeMeters, isCapped: false };
}

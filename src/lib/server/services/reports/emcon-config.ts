/**
 * EMCON diff engine thresholds.
 *
 * Power deltas between matched emitters in a baseline/posture pair are
 * classified into NOTABLE (>=6 dB absolute delta) and CRITICAL (>=15 dB).
 * Generic RF emitters are matched into a frequency bin of FREQ_BIN_HZ
 * (25 kHz, matching typical narrowband channel spacing).
 */
export const EMCON_THRESHOLDS = {
	NOTABLE_DB: 6,
	CRITICAL_DB: 15,
	FREQ_BIN_HZ: 25_000
} as const;

/**
 * Formatting utilities for HackRF frequency, power, and sample rate values.
 */

export function formatFrequency(freq: number): string {
	if (freq >= 1e9) {
		return `${(freq / 1e9).toFixed(3)} GHz`;
	} else if (freq >= 1e6) {
		return `${(freq / 1e6).toFixed(3)} MHz`;
	} else if (freq >= 1e3) {
		return `${(freq / 1e3).toFixed(3)} kHz`;
	} else {
		return `${freq.toFixed(0)} Hz`;
	}
}

export function formatPower(power: number): string {
	return `${power.toFixed(1)} dBm`;
}

export function formatSampleRate(rate: number): string {
	if (rate >= 1e6) {
		return `${(rate / 1e6).toFixed(1)} MS/s`;
	} else if (rate >= 1e3) {
		return `${(rate / 1e3).toFixed(1)} kS/s`;
	} else {
		return `${rate.toFixed(0)} S/s`;
	}
}

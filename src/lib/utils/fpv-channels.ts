const FPV_BANDS: Record<string, number[]> = {
	A: [5865, 5845, 5825, 5805, 5785, 5765, 5745, 5725],
	B: [5733, 5752, 5771, 5790, 5809, 5828, 5847, 5866],
	E: [5705, 5685, 5665, 5645, 5885, 5905, 5925, 5945],
	F: [5740, 5760, 5780, 5800, 5820, 5840, 5860, 5880],
	R: [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917],
	D: [5362, 5399, 5436, 5473, 5510, 5547, 5584, 5621],
	U: [5325, 5348, 5366, 5384, 5402, 5420, 5438, 5456],
	O: [5474, 5492, 5510, 5528, 5546, 5564, 5582, 5600],
	L: [5333, 5373, 5413, 5453, 5493, 5533, 5573, 5613],
	H: [5653, 5693, 5733, 5773, 5813, 5853, 5893, 5933]
};

export interface FpvChannelInfo {
	mhz: number;
	band: string | null;
	channel: number | null;
	label: string;
}

function findBandChannel(mhz: number): { band: string; channel: number } | null {
	for (const [band, freqs] of Object.entries(FPV_BANDS)) {
		const idx = freqs.indexOf(mhz);
		if (idx >= 0) return { band, channel: idx + 1 };
	}
	return null;
}

export function hzToChannel(hz: number | null): FpvChannelInfo {
	if (hz === null || !Number.isFinite(hz) || hz <= 0) {
		return { mhz: 0, band: null, channel: null, label: '—' };
	}
	const mhz = Math.round(hz / 1e6);
	const match = findBandChannel(mhz);
	if (match) {
		return {
			mhz,
			band: match.band,
			channel: match.channel,
			label: `${match.band}-CH${match.channel}`
		};
	}
	return { mhz, band: null, channel: null, label: `${mhz} MHz` };
}

export function fpvChannelLabel(hz: number | null): string {
	const info = hzToChannel(hz);
	return info.band ? `${info.mhz} MHz (${info.label})` : info.label;
}

/**
 * CloudRF server-side colormap definitions.
 *
 * Each entry maps a CloudRF colormap ID to a human-readable label
 * and a CSS gradient for the UI selector preview.
 *
 * Only includes colormaps verified against the live CloudRF API.
 */

export type CloudRFColormapId = 'RAINBOW45.dBm' | 'LTE.dBm' | 'HF.dBm';

export interface CloudRFColormap {
	id: CloudRFColormapId;
	label: string;
	gradient: string;
}

export const CLOUDRF_COLORMAPS: CloudRFColormap[] = [
	{
		id: 'RAINBOW45.dBm',
		label: 'Rainbow',
		gradient: 'linear-gradient(90deg, blue, cyan, green, yellow, red)'
	},
	{
		id: 'LTE.dBm',
		label: 'LTE',
		gradient: 'linear-gradient(90deg, #d00, #f80, #ff0, #0c0, #080)'
	},
	{
		id: 'HF.dBm',
		label: 'HF',
		gradient: 'linear-gradient(90deg, #1b2a49, #3567a0, #5ba55f, #f0e443, #f04040)'
	}
];

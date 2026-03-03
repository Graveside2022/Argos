/**
 * CloudRF server-side colormap definitions.
 *
 * Each entry maps a CloudRF colormap ID to a human-readable label
 * and a CSS gradient for the UI selector preview.
 */

export type CloudRFColormapId =
	| 'RAINBOW.dBm'
	| 'GREYSCALE.dBm'
	| 'HEAT.dBm'
	| 'LTE.dBm'
	| 'MBPS.dBm'
	| 'RdYlGn_r.dBm'
	| 'CLOUD_35.dBm';

export interface CloudRFColormap {
	id: CloudRFColormapId;
	label: string;
	gradient: string;
}

export const CLOUDRF_COLORMAPS: CloudRFColormap[] = [
	{
		id: 'RAINBOW.dBm',
		label: 'Rainbow',
		gradient: 'linear-gradient(90deg, blue, cyan, green, yellow, red)'
	},
	{
		id: 'GREYSCALE.dBm',
		label: 'Greyscale',
		gradient: 'linear-gradient(90deg, #222, #aaa, #fff)'
	},
	{
		id: 'HEAT.dBm',
		label: 'Heat',
		gradient: 'linear-gradient(90deg, #000, #800, #f00, #ff0, #fff)'
	},
	{
		id: 'LTE.dBm',
		label: 'LTE',
		gradient: 'linear-gradient(90deg, #d00, #f80, #ff0, #0c0, #080)'
	},
	{
		id: 'MBPS.dBm',
		label: 'Mbps',
		gradient: 'linear-gradient(90deg, #00f, #0cf, #0f0, #ff0, #f00)'
	},
	{
		id: 'RdYlGn_r.dBm',
		label: 'Red-Yellow-Green',
		gradient: 'linear-gradient(90deg, #1a9641, #a6d96a, #ffffbf, #fdae61, #d7191c)'
	},
	{
		id: 'CLOUD_35.dBm',
		label: 'Cloud 35',
		gradient: 'linear-gradient(90deg, #1b2a49, #3567a0, #5ba55f, #f0e443, #f04040)'
	}
];

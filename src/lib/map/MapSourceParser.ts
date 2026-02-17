import { DOMParser } from '@xmldom/xmldom';

export interface MapSourceConfig {
	name: string;
	url: string;
	minZoom: number;
	maxZoom: number;
}

export class MapSourceParser {
	/**
	 * Parses a TAK Map Source XML string.
	 * @param xmlContent The XML content of the .xml file.
	 * @returns A MapSourceConfig object or null if parsing fails.
	 */
	static parse(xmlContent: string): MapSourceConfig | null {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(xmlContent, 'text/xml');

			const customMapSource = doc.getElementsByTagName('customMapSource')[0];
			if (!customMapSource) return null;

			const name =
				customMapSource.getElementsByTagName('name')[0]?.textContent || 'Custom Layer';
			const url = customMapSource.getElementsByTagName('url')[0]?.textContent || '';
			const minZoom = parseInt(
				customMapSource.getElementsByTagName('minZoom')[0]?.textContent || '0',
				10
			);
			const maxZoom = parseInt(
				customMapSource.getElementsByTagName('maxZoom')[0]?.textContent || '22',
				10
			);

			if (!url) return null;

			return {
				name,
				url, // TAK XML often uses {$z}, {$x}, {$y} -> needs conversion to {z}, {x}, {y}
				minZoom,
				maxZoom
			};
		} catch (e) {
			console.error('Failed to parse Map Source XML', e);
			return null;
		}
	}

	/**
	 * Converts TAK URL format to standard XYZ format.
	 * TAK: http://.../z={minZoom}-{$z}&x={$x}&y={$y}
	 * Standard: http://.../{z}/{x}/{y}
	 */
	static convertUrl(takUrl: string): string {
		return takUrl
			.replace(/\{\$z\}/g, '{z}')
			.replace(/\{\$x\}/g, '{x}')
			.replace(/\{\$y\}/g, '{y}')
			.replace(/&amp;/g, '&');
	}
}

/**
 * Palantir-styled popup HTML templates for Leaflet map markers.
 * Uses Palantir design system CSS classes (map-popup, popup-title, etc.)
 */

import type { KismetDevice } from '$lib/types/kismet';
import { formatLastSeen } from './signalUtils';

/** Generate popup HTML for a Kismet WiFi device */
export function devicePopupHTML(device: KismetDevice): string {
	const mac = device.mac || 'Unknown';
	const ssid = device.ssid || 'Hidden';
	const rssi = device.signal?.last_signal ?? -100;
	const type = device.type || 'unknown';
	const channel = device.channel || '-';
	const manufacturer = device.manufacturer || device.manuf || '-';
	const lastSeen = formatLastSeen(device.last_seen || device.last_time || 0);

	return `<div class="map-popup">
		<div class="popup-title">${escapeHTML(ssid)}</div>
		<div class="popup-row"><span class="popup-label">MAC</span><span class="popup-value" style="font-family:var(--font-mono)">${escapeHTML(mac)}</span></div>
		<div class="popup-row"><span class="popup-label">RSSI</span><span class="popup-value">${rssi} dBm</span></div>
		<div class="popup-row"><span class="popup-label">TYPE</span><span class="popup-value">${escapeHTML(type)}</span></div>
		<div class="popup-row"><span class="popup-label">CH</span><span class="popup-value">${channel}</span></div>
		<div class="popup-row"><span class="popup-label">MFR</span><span class="popup-value">${escapeHTML(manufacturer)}</span></div>
		<div class="popup-row"><span class="popup-label">SEEN</span><span class="popup-value">${lastSeen}</span></div>
	</div>`;
}

/** Generate popup HTML for a cell tower */
export function cellTowerPopupHTML(tower: {
	id: string;
	mcc?: number;
	mnc?: number;
	lac?: number;
	cellId?: number;
	lat: number;
	lon: number;
}): string {
	return `<div class="map-popup">
		<div class="popup-title">Cell Tower</div>
		<div class="popup-row"><span class="popup-label">ID</span><span class="popup-value" style="font-family:var(--font-mono)">${escapeHTML(tower.id)}</span></div>
		${tower.mcc ? `<div class="popup-row"><span class="popup-label">MCC</span><span class="popup-value">${tower.mcc}</span></div>` : ''}
		${tower.mnc ? `<div class="popup-row"><span class="popup-label">MNC</span><span class="popup-value">${tower.mnc}</span></div>` : ''}
		${tower.lac ? `<div class="popup-row"><span class="popup-label">LAC</span><span class="popup-value">${tower.lac}</span></div>` : ''}
		${tower.cellId ? `<div class="popup-row"><span class="popup-label">CELL</span><span class="popup-value">${tower.cellId}</span></div>` : ''}
	</div>`;
}

/** Escape HTML entities to prevent XSS */
function escapeHTML(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

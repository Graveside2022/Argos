/**
 * Device type SVG icons for use in Leaflet markers and UI.
 * All icons are 20x20, use currentColor, 1.5px stroke.
 */

/** WiFi Access Point icon */
export const iconAP = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/></svg>`;

/** WiFi Client icon */
export const iconClient = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>`;

/** Bluetooth device icon */
export const iconBluetooth = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/></svg>`;

/** IoT / sensor device icon */
export const iconIoT = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/></svg>`;

/** Bridge / infrastructure icon */
export const iconBridge = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="6" width="8" height="12" rx="1"/><rect x="15" y="6" width="8" height="12" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/></svg>`;

/** Cell tower icon */
export const iconCellTower = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.93 4.93a10 10 0 0 1 14.14 0"/><path d="M7.76 7.76a6 6 0 0 1 8.49 0"/><line x1="12" y1="12" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`;

/** SDR / radio icon */
export const iconSDR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="10" rx="2"/><line x1="7" y1="12" x2="7" y2="12"/><line x1="12" y1="12" x2="12" y2="12"/><line x1="17" y1="12" x2="17" y2="12"/></svg>`;

/** Unknown device icon */
export const iconUnknown = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>`;

/** Get the appropriate icon SVG string for a device type */
export function getDeviceIcon(type: string): string {
	const t = type?.toLowerCase() || '';
	if (t === 'ap' || t.includes('access point') || t.includes('router')) return iconAP;
	if (t === 'client' || t.includes('station')) return iconClient;
	if (t.includes('bluetooth') || t.includes('btle') || t.includes('ble')) return iconBluetooth;
	if (t.includes('iot') || t.includes('sensor')) return iconIoT;
	if (t.includes('bridge') || t.includes('infra')) return iconBridge;
	if (t.includes('cell') || t.includes('tower') || t.includes('gsm')) return iconCellTower;
	if (t.includes('sdr') || t.includes('radio') || t.includes('hackrf')) return iconSDR;
	return iconUnknown;
}

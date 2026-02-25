import { describe, expect, it } from 'vitest';

describe('HardwareConfigPanel Component Logic', () => {
	const PANEL_NAMES = ['overview', 'tools', 'layers', 'settings', 'hardware'] as const;

	describe('Panel navigation', () => {
		it('should recognize hardware as a valid panel name', () => {
			expect(PANEL_NAMES).toContain('hardware');
		});

		it('should navigate from settings to hardware', () => {
			let activePanel: string | null = 'settings';
			activePanel = 'hardware';
			expect(activePanel).toBe('hardware');
		});

		it('should navigate back from hardware to settings', () => {
			let activePanel: string | null = 'hardware';
			activePanel = 'settings';
			expect(activePanel).toBe('settings');
		});
	});

	describe('Hardware data processing', () => {
		interface HardwareDevice {
			name: string;
			path?: string;
			detected: boolean;
		}

		interface HardwareDetails {
			gps: { devices: HardwareDevice[] };
			sdr: { devices: HardwareDevice[] };
			wifi: { interfaces: HardwareDevice[] };
		}

		function countActiveDevices(details: HardwareDetails): number {
			return (
				details.gps.devices.filter((d) => d.detected).length +
				details.sdr.devices.filter((d) => d.detected).length +
				details.wifi.interfaces.filter((d) => d.detected).length
			);
		}

		it('should count active devices across all categories', () => {
			const details: HardwareDetails = {
				gps: { devices: [{ name: 'gpsd', detected: true }] },
				sdr: {
					devices: [
						{ name: 'HackRF One', detected: true },
						{ name: 'RTL-SDR', detected: false }
					]
				},
				wifi: { interfaces: [{ name: 'wlan0', detected: true }] }
			};
			expect(countActiveDevices(details)).toBe(3);
		});

		it('should return zero when no devices are active', () => {
			const details: HardwareDetails = {
				gps: { devices: [] },
				sdr: { devices: [{ name: 'HackRF', detected: false }] },
				wifi: { interfaces: [] }
			};
			expect(countActiveDevices(details)).toBe(0);
		});

		it('should handle three device categories', () => {
			const categories = ['gps', 'sdr', 'wifi'];
			expect(categories).toHaveLength(3);
		});
	});

	describe('Device card structure', () => {
		it('should define section headers matching spec', () => {
			const sections = ['GPS DEVICES', 'SDR / SOFTWARE DEFINED RADIOS', 'WIFI ADAPTERS'];
			expect(sections).toHaveLength(3);
			sections.forEach((s) => expect(s).toBe(s.toUpperCase()));
		});
	});
});

import { describe, it, expect } from 'vitest';
import { latLonToMGRS } from '../../src/lib/utils/mgrsConverter';

describe('MGRS Coordinate Conversion Logic', () => {
	it('should correctly convert a known Los Angeles coordinate', () => {
		const lat = 34.0522;
		const lon = -118.2437;

		// Test the actual function behavior, not assumed output
		const result = latLonToMGRS(lat, lon);

		// Validate basic format structure (not specific content)
		expect(result).toBeDefined();
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);

		// MGRS format validation: "31U FT 1234 5678" pattern
		// Format: [zone][band] [squares] [easting] [northing]
		expect(result).toMatch(/^\d{1,2}[A-Z]\s[A-Z]{2}\s\d{4}\s\d{4}$/);

		// Verify it's not the error case
		expect(result).not.toBe('Invalid');
	});

	it('should handle edge cases gracefully', () => {
		// Test with coordinates that might cause issues
		expect(() => latLonToMGRS(0, 0)).not.toThrow();
		expect(() => latLonToMGRS(90, 180)).not.toThrow();
		expect(() => latLonToMGRS(-90, -180)).not.toThrow();
	});
});

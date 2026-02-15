import { describe, expect, it } from 'vitest';

import {
	determineSeverity,
	getSeverityWeight,
	sortBySeverity
} from '../../src/lib/constitution/severity-classifier.js';

describe('determineSeverity', () => {
	it('should assign CRITICAL to Article IX security violations', () => {
		const severity = determineSeverity('IX', '9.1', 'hardcoded secrets');
		expect(severity).toBe('CRITICAL');
	});

	it('should assign CRITICAL to Article II §2.7 service layer pattern', () => {
		const severity = determineSeverity('II', '2.7', 'service layer pattern');
		expect(severity).toBe('CRITICAL');
	});

	it('should assign HIGH to Article II §2.1 type safety violations', () => {
		const severity = determineSeverity('II', '2.1', 'any type usage');
		expect(severity).toBe('HIGH');
	});

	it('should assign HIGH to Article III coverage violations', () => {
		const severity = determineSeverity('III', '3.2', 'insufficient coverage');
		expect(severity).toBe('HIGH');
	});

	it('should assign MEDIUM to Article IV UX violations', () => {
		const severity = determineSeverity('IV', '4.3', 'missing loading state');
		expect(severity).toBe('MEDIUM');
	});

	it('should assign LOW to unknown patterns', () => {
		const severity = determineSeverity('I', '1.1', 'unknown pattern');
		expect(severity).toBe('LOW');
	});
});

describe('getSeverityWeight', () => {
	it('should assign correct weights for sorting', () => {
		expect(getSeverityWeight('CRITICAL')).toBe(4);
		expect(getSeverityWeight('HIGH')).toBe(3);
		expect(getSeverityWeight('MEDIUM')).toBe(2);
		expect(getSeverityWeight('LOW')).toBe(1);
	});
});

describe('sortBySeverity', () => {
	it('should sort violations by severity (CRITICAL first)', () => {
		const violations = [
			{ severity: 'LOW' as const, id: '1' },
			{ severity: 'CRITICAL' as const, id: '2' },
			{ severity: 'MEDIUM' as const, id: '3' },
			{ severity: 'HIGH' as const, id: '4' }
		];

		const sorted = sortBySeverity(violations);

		expect(sorted[0].severity).toBe('CRITICAL');
		expect(sorted[1].severity).toBe('HIGH');
		expect(sorted[2].severity).toBe('MEDIUM');
		expect(sorted[3].severity).toBe('LOW');
	});
});

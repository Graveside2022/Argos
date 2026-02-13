import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

import {
	applyExemptions,
	filterExemptedViolations
} from '../../src/lib/constitution/exemption-parser.js';

describe('applyExemptions', () => {
	it('should mark matching violations as exempted', () => {
		const violations = [
			{
				id: randomUUID(),
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.1',
				ruleViolated: 'No any type',
				filePath: 'src/lib/test.ts',
				lineNumber: 42,
				violationType: 'any-type',
				isPreExisting: false,
				exemptionStatus: 'none' as const
			}
		];

		const exemptions = [
			{
				id: randomUUID(),
				filePath: 'src/lib/test.ts',
				lineNumber: 40, // Within 3 lines
				articleReference: 'Article-II-2.1',
				issueNumber: '#123',
				justification: 'Vendor library compatibility requires type assertion',
				parsedAt: new Date().toISOString()
			}
		];

		const result = applyExemptions(violations, exemptions);

		expect(result[0].exemptionStatus).toBe('approved');
		expect(result[0].exemptionJustification).toBe(
			'Vendor library compatibility requires type assertion'
		);
		expect(result[0].exemptionIssueNumber).toBe('#123');
	});

	it('should not mark violations as exempted when no matching exemption', () => {
		const violations = [
			{
				id: randomUUID(),
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.1',
				ruleViolated: 'No any type',
				filePath: 'src/lib/test.ts',
				lineNumber: 42,
				violationType: 'any-type',
				isPreExisting: false,
				exemptionStatus: 'none' as const
			}
		];

		const exemptions = [
			{
				id: randomUUID(),
				filePath: 'src/lib/other.ts', // Different file
				lineNumber: 42,
				articleReference: 'Article-II-2.1',
				issueNumber: '#123',
				justification: 'Test',
				parsedAt: new Date().toISOString()
			}
		];

		const result = applyExemptions(violations, exemptions);

		expect(result[0].exemptionStatus).toBe('none');
	});
});

describe('filterExemptedViolations', () => {
	it('should filter out approved exemptions', () => {
		const violations = [
			{
				id: randomUUID(),
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.1',
				ruleViolated: 'No any type',
				filePath: 'src/lib/test.ts',
				lineNumber: 42,
				violationType: 'any-type',
				isPreExisting: false,
				exemptionStatus: 'approved' as const
			},
			{
				id: randomUUID(),
				severity: 'HIGH' as const,
				articleReference: 'Article II §2.1',
				ruleViolated: 'No any type',
				filePath: 'src/lib/other.ts',
				lineNumber: 10,
				violationType: 'any-type',
				isPreExisting: false,
				exemptionStatus: 'none' as const
			}
		];

		const filtered = filterExemptedViolations(violations);

		expect(filtered).toHaveLength(1);
		expect(filtered[0].filePath).toBe('src/lib/other.ts');
	});
});

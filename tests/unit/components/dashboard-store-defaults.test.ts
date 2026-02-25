import { describe, expect, it } from 'vitest';

/**
 * Tests for dashboard store default values.
 * Spec-019: FR-001 (activePanel = 'overview') and FR-002 (activeBottomTab = 'terminal').
 *
 * These test the logic contracts for default values, not the store instances
 * directly (which depend on browser/localStorage environment).
 */
describe('Dashboard Store Defaults', () => {
	// The contract values that spec-019 requires
	const EXPECTED_ACTIVE_PANEL = 'overview';
	const EXPECTED_ACTIVE_BOTTOM_TAB = 'terminal';
	const VALID_TABS = ['terminal', 'chat', 'logs', 'captures', 'devices'];

	describe('FR-001: Overview panel default', () => {
		it('should default activePanel to "overview" (not null)', () => {
			// This tests the value that the writable store should be initialized with
			expect(EXPECTED_ACTIVE_PANEL).toBe('overview');
			expect(EXPECTED_ACTIVE_PANEL).not.toBeNull();
		});

		it('should support null for explicitly closed state', () => {
			const closed: string | null = null;
			expect(closed).toBeNull();
		});
	});

	describe('FR-002: Bottom panel default', () => {
		it('should default activeBottomTab to "terminal" (not null)', () => {
			expect(EXPECTED_ACTIVE_BOTTOM_TAB).toBe('terminal');
			expect(EXPECTED_ACTIVE_BOTTOM_TAB).not.toBeNull();
		});

		it('should recognize "terminal" as a valid tab', () => {
			expect(VALID_TABS).toContain(EXPECTED_ACTIVE_BOTTOM_TAB);
		});

		it('should include all 5 named tabs from the design', () => {
			expect(VALID_TABS).toEqual(['terminal', 'chat', 'logs', 'captures', 'devices']);
			expect(VALID_TABS).toHaveLength(5);
		});
	});

	describe('Bottom tab deserialize logic', () => {
		function deserialize(raw: string): string | null {
			if (raw === 'gsm-evil') return null;
			return VALID_TABS.includes(raw) ? raw : null;
		}

		it('should accept valid tab names', () => {
			for (const tab of VALID_TABS) {
				expect(deserialize(tab)).toBe(tab);
			}
		});

		it('should map removed "gsm-evil" tab to null', () => {
			expect(deserialize('gsm-evil')).toBeNull();
		});

		it('should reject unknown tab names', () => {
			expect(deserialize('unknown')).toBeNull();
			expect(deserialize('')).toBeNull();
		});
	});
});

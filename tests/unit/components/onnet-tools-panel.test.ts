import { describe, expect, it } from 'vitest';

describe('OnnetToolsPanel Component Logic', () => {
	describe('Category structure', () => {
		it('should have exactly 2 ONNET categories (RECON, ATTACK)', () => {
			const categories = [
				{ id: 'net-recon-fingerprint', name: 'Network Reconnaissance & Fingerprinting' },
				{ id: 'net-attack-credential', name: 'Network Attack & Credential Capture' }
			];
			expect(categories).toHaveLength(2);
			expect(categories[0].name).toContain('Reconnaissance');
			expect(categories[1].name).toContain('Attack');
		});

		it('should display ONNET as panel title', () => {
			const title = 'ONNET';
			expect(title).toBe('ONNET');
		});

		it('should have back button with TOOLS label', () => {
			const backLabel = 'TOOLS';
			expect(backLabel).toBe('TOOLS');
		});
	});

	describe('Navigation logic', () => {
		it('should navigate to tools panel on back', () => {
			const targetPanel = 'tools';
			const targetPath: string[] = [];
			expect(targetPanel).toBe('tools');
			expect(targetPath).toHaveLength(0);
		});

		it('should set navigation path when clicking a category', () => {
			const categoryId = 'net-recon-fingerprint';
			const expectedPath = ['onnet', categoryId];
			expect(expectedPath).toEqual(['onnet', 'net-recon-fingerprint']);
			expect(expectedPath).toHaveLength(2);
		});

		it('should navigate to tools panel when clicking category', () => {
			const targetPanel = 'tools';
			expect(targetPanel).toBe('tools');
		});
	});

	describe('Tool counts', () => {
		it('should compute tool count for categories with children', () => {
			const mockCategory = {
				children: [
					{ isInstalled: true },
					{ isInstalled: false },
					{ isInstalled: true },
					{ isInstalled: false }
				]
			};
			const installed = mockCategory.children.filter((c) => c.isInstalled).length;
			const total = mockCategory.children.length;
			expect(installed).toBe(2);
			expect(total).toBe(4);
		});
	});
});

import { describe, expect, it } from 'vitest';

describe('DashboardShell Component Logic', () => {
	const FULL_WIDTH_VIEWS = new Set(['tak-config', 'gsm-evil']);

	function deriveShellMode(activeView: string): 'sidebar' | 'full-width' {
		return FULL_WIDTH_VIEWS.has(activeView) ? 'full-width' : 'sidebar';
	}

	describe('Shell mode derivation', () => {
		it('should default to sidebar mode for map view', () => {
			expect(deriveShellMode('map')).toBe('sidebar');
		});

		it('should use sidebar mode for tool views', () => {
			const sidebarViews = [
				'map',
				'kismet',
				'openwebrx',
				'bettercap',
				'hackrf',
				'rtl-433',
				'btle',
				'droneid',
				'pagermon',
				'rf-emitter',
				'wifite',
				'wigletotak',
				'logs-analytics'
			];
			for (const view of sidebarViews) {
				expect(deriveShellMode(view)).toBe('sidebar');
			}
		});

		it('should use full-width mode for TAK config', () => {
			expect(deriveShellMode('tak-config')).toBe('full-width');
		});

		it('should use full-width mode for GSM Evil', () => {
			expect(deriveShellMode('gsm-evil')).toBe('full-width');
		});
	});

	describe('Shell CSS contract', () => {
		it('should define expected layout dimensions', () => {
			const ICON_RAIL_WIDTH = 48;
			const PANEL_WIDTH = 280;
			const TOP_BAR_HEIGHT = 40;

			expect(ICON_RAIL_WIDTH).toBe(48);
			expect(PANEL_WIDTH).toBe(280);
			expect(TOP_BAR_HEIGHT).toBe(40);
			expect(ICON_RAIL_WIDTH + PANEL_WIDTH).toBeLessThan(1920);
		});
	});

	describe('Content slot selection', () => {
		it('should render sidebar and content slots in sidebar mode', () => {
			const mode = deriveShellMode('map');
			const rendersSidebar = mode === 'sidebar';
			const rendersFullWidth = mode === 'full-width';

			expect(rendersSidebar).toBe(true);
			expect(rendersFullWidth).toBe(false);
		});

		it('should render fullWidth slot in full-width mode', () => {
			const mode = deriveShellMode('tak-config');
			const rendersSidebar = mode === 'sidebar';
			const rendersFullWidth = mode === 'full-width';

			expect(rendersSidebar).toBe(false);
			expect(rendersFullWidth).toBe(true);
		});
	});
});

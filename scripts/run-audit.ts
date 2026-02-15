#!/usr/bin/env tsx
/**
 * CLI runner for constitutional audit
 * Usage: npm run audit
 */

import { runAudit } from '../src/lib/constitution/auditor.js';

async function main() {
	console.log('🔍 Running Constitutional Audit...\n');

	try {
		const report = await runAudit({
			scope: 'full',
			outputFormats: ['terminal', 'json', 'markdown'],
			projectRoot: process.cwd(),
			timeoutMs: 120000 // 2 minutes
		});

		console.log('\n✅ Audit complete!');
		console.log(`📊 Overall Compliance: ${report.overallCompliancePercent.toFixed(1)}%`);
		console.log(
			`📁 Report saved to: .specify/audit-reports/audit-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
		);

		// Exit with error code if critical violations found
		if (report.criticalViolations > 0) {
			console.error(`\n❌ ${report.criticalViolations} CRITICAL violations found!`);
			process.exit(1);
		}

		process.exit(0);
	} catch (error) {
		console.error('❌ Audit failed:', error);
		process.exit(1);
	}
}

main();

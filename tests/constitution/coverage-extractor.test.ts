import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	extractCoverageMetrics,
	filePassesCoverageThreshold,
	getFileCoverage
} from '../../src/lib/constitution/coverage-extractor.js';
import {
	CoverageNotFoundError,
	VitestNotConfiguredError
} from '../../src/lib/constitution/types.js';

describe('extractCoverageMetrics', () => {
	const fixtureRoot = join(process.cwd(), 'tests/constitution/fixtures/temp-coverage');
	const coverageDir = join(fixtureRoot, 'coverage');

	beforeEach(() => {
		mkdirSync(coverageDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it('should throw CoverageNotFoundError when coverage file missing', async () => {
		const emptyRoot = join(fixtureRoot, 'no-coverage');
		mkdirSync(emptyRoot, { recursive: true });

		await expect(extractCoverageMetrics(emptyRoot)).rejects.toThrow(CoverageNotFoundError);
	});

	it('should throw VitestNotConfiguredError for malformed JSON', async () => {
		writeFileSync(join(coverageDir, 'coverage-final.json'), 'not valid json {{{');

		await expect(extractCoverageMetrics(fixtureRoot)).rejects.toThrow(VitestNotConfiguredError);
	});

	it('should parse valid coverage data correctly', async () => {
		const coverageData = {
			'src/lib/utils.ts': {
				path: 'src/lib/utils.ts',
				s: { '0': 1, '1': 1, '2': 0, '3': 1, '4': 1 },
				b: { '0': [1, 0], '1': [1, 1] },
				f: { '0': 1, '1': 0, '2': 1 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.totalFilesAnalyzed).toBe(1);
		expect(summary.globalCoveragePercent).toBeGreaterThan(0);
		expect(summary.details).toHaveLength(1);
		expect(summary.details[0].filePath).toBe('src/lib/utils.ts');
	});

	it('should calculate statement coverage percentage', async () => {
		const coverageData = {
			'src/lib/math.ts': {
				path: 'src/lib/math.ts',
				s: { '0': 1, '1': 1, '2': 1, '3': 1 }, // 4/4 = 100%
				b: {},
				f: { '0': 1 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.details[0].statementsPct).toBe(100);
		expect(summary.details[0].meetsThreshold).toBe(true);
	});

	it('should calculate function coverage percentage', async () => {
		const coverageData = {
			'src/lib/helpers.ts': {
				path: 'src/lib/helpers.ts',
				s: { '0': 1, '1': 1 },
				b: {},
				f: { '0': 1, '1': 0, '2': 1, '3': 0 }, // 2/4 = 50%
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.details[0].functionsPct).toBe(50);
	});

	it('should calculate branch coverage percentage', async () => {
		const coverageData = {
			'src/lib/logic.ts': {
				path: 'src/lib/logic.ts',
				s: { '0': 1, '1': 1 },
				b: {
					'0': [1, 0], // if/else: true branch taken, false not
					'1': [1, 1], // if/else: both taken
					'2': [0, 0] // neither taken
				},
				f: { '0': 1 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		// 3 covered out of 6 total = 50%
		expect(summary.details[0].branchesPct).toBe(50);
	});

	it('should skip node_modules and test files', async () => {
		const coverageData = {
			'node_modules/lib/index.ts': {
				path: 'node_modules/lib/index.ts',
				s: { '0': 0 },
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			},
			'src/lib/utils.test.ts': {
				path: 'src/lib/utils.test.ts',
				s: { '0': 1 },
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			},
			'src/lib/real.ts': {
				path: 'src/lib/real.ts',
				s: { '0': 1, '1': 1 },
				b: {},
				f: { '0': 1 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.totalFilesAnalyzed).toBe(1);
		expect(summary.details[0].filePath).toBe('src/lib/real.ts');
	});

	it('should correctly identify passing and failing files', async () => {
		const coverageData = {
			'src/lib/well-tested.ts': {
				path: 'src/lib/well-tested.ts',
				s: { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1 }, // 100% > 80%
				b: {},
				f: { '0': 1 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			},
			'src/lib/poorly-tested.ts': {
				path: 'src/lib/poorly-tested.ts',
				s: { '0': 1, '1': 0, '2': 0, '3': 0, '4': 0 }, // 20% < 80%
				b: {},
				f: { '0': 0 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.filesPassing).toBe(1);
		expect(summary.filesFailing).toBe(1);
		expect(summary.totalFilesAnalyzed).toBe(2);
	});

	it('should calculate global coverage as average of file coverages', async () => {
		const coverageData = {
			'src/lib/a.ts': {
				path: 'src/lib/a.ts',
				s: { '0': 1, '1': 1 }, // 100%
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			},
			'src/lib/b.ts': {
				path: 'src/lib/b.ts',
				s: { '0': 1, '1': 0 }, // 50%
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		// Average of 100% and 50% = 75%
		expect(summary.globalCoveragePercent).toBe(75);
	});

	it('should handle empty coverage data', async () => {
		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify({}));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.totalFilesAnalyzed).toBe(0);
		expect(summary.globalCoveragePercent).toBe(0);
		expect(summary.filesPassing).toBe(0);
		expect(summary.filesFailing).toBe(0);
		expect(summary.details).toEqual([]);
	});

	it('should handle files with empty coverage objects', async () => {
		const coverageData = {
			'src/lib/empty.ts': {
				path: 'src/lib/empty.ts',
				s: {},
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};

		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));

		const summary = await extractCoverageMetrics(fixtureRoot);

		expect(summary.totalFilesAnalyzed).toBe(1);
		expect(summary.details[0].linesPct).toBe(0);
		expect(summary.details[0].functionsPct).toBe(0);
		expect(summary.details[0].branchesPct).toBe(0);
	});
});

describe('getFileCoverage', () => {
	const fixtureRoot = join(process.cwd(), 'tests/constitution/fixtures/temp-coverage-file');
	const coverageDir = join(fixtureRoot, 'coverage');

	beforeEach(() => {
		mkdirSync(coverageDir, { recursive: true });
		const coverageData = {
			'src/lib/target.ts': {
				path: 'src/lib/target.ts',
				s: { '0': 1, '1': 1 },
				b: {},
				f: { '0': 1 },
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};
		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it('should return coverage for a specific file', async () => {
		const coverage = await getFileCoverage('src/lib/target.ts', fixtureRoot);

		expect(coverage).not.toBeNull();
		expect(coverage?.filePath).toBe('src/lib/target.ts');
		expect(coverage?.linesPct).toBe(100);
	});

	it('should return null for file not in coverage', async () => {
		const coverage = await getFileCoverage('src/lib/nonexistent.ts', fixtureRoot);

		expect(coverage).toBeNull();
	});
});

describe('filePassesCoverageThreshold', () => {
	const fixtureRoot = join(process.cwd(), 'tests/constitution/fixtures/temp-coverage-threshold');
	const coverageDir = join(fixtureRoot, 'coverage');

	beforeEach(() => {
		mkdirSync(coverageDir, { recursive: true });
		const coverageData = {
			'src/lib/passing.ts': {
				path: 'src/lib/passing.ts',
				s: { '0': 1, '1': 1, '2': 1, '3': 1, '4': 1 }, // 100%
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			},
			'src/lib/failing.ts': {
				path: 'src/lib/failing.ts',
				s: { '0': 1, '1': 0, '2': 0, '3': 0, '4': 0 }, // 20%
				b: {},
				f: {},
				fnMap: {},
				statementMap: {},
				branchMap: {}
			}
		};
		writeFileSync(join(coverageDir, 'coverage-final.json'), JSON.stringify(coverageData));
	});

	afterEach(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it('should return true for file meeting threshold', async () => {
		const passes = await filePassesCoverageThreshold('src/lib/passing.ts', fixtureRoot);
		expect(passes).toBe(true);
	});

	it('should return false for file below threshold', async () => {
		const passes = await filePassesCoverageThreshold('src/lib/failing.ts', fixtureRoot);
		expect(passes).toBe(false);
	});

	it('should return false for nonexistent file', async () => {
		const passes = await filePassesCoverageThreshold('src/lib/ghost.ts', fixtureRoot);
		expect(passes).toBe(false);
	});
});

import { readFile } from 'fs/promises';
import { join } from 'path';

import {
	CoverageNotFoundError,
	type CoverageSummary,
	type FileCoverage,
	VitestNotConfiguredError
} from './types.js';

/**
 * Coverage threshold for Article III §3.2
 */
const COVERAGE_THRESHOLD = 80;

/**
 * Extract Vitest test coverage metrics
 * Uses Istanbul CoverageMap API via coverage-final.json (per R2 research)
 *
 * @param projectRoot - Absolute path to project root (default: process.cwd())
 * @returns Promise<CoverageSummary> - Coverage metrics with per-file breakdown
 * @throws CoverageNotFoundError if coverage/coverage-final.json does not exist
 * @throws VitestNotConfiguredError if coverage file is malformed
 */
export async function extractCoverageMetrics(
	projectRoot: string = process.cwd()
): Promise<CoverageSummary> {
	const coveragePath = join(projectRoot, 'coverage/coverage-final.json');

	// Read coverage file
	let coverageData: Record<string, CoverageFileData>;
	try {
		const content = await readFile(coveragePath, 'utf-8');
		coverageData = JSON.parse(content);
	} catch (error) {
		// Safe: File system errors have ErrnoException shape with code property
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			throw new CoverageNotFoundError(coveragePath);
		}
		throw new VitestNotConfiguredError();
	}

	// Extract per-file metrics
	const details: FileCoverage[] = [];
	let totalLinesPct = 0;
	let filesPassing = 0;
	let filesFailing = 0;

	for (const [filePath, fileData] of Object.entries(coverageData)) {
		// Skip non-source files (node_modules, tests, etc.)
		if (filePath.includes('node_modules') || filePath.includes('.test.')) {
			continue;
		}

		const linesPct = calculatePercentage(fileData.s);
		const statementsPct = calculatePercentage(fileData.s);
		const functionsPct = calculatePercentage(fileData.f);
		const branchesPct = calculateBranchPercentage(fileData.b);

		const meetsThreshold = linesPct >= COVERAGE_THRESHOLD;

		details.push({
			filePath: filePath.replace(projectRoot, '').replace(/^\//, ''),
			linesPct,
			statementsPct,
			functionsPct,
			branchesPct,
			meetsThreshold
		});

		totalLinesPct += linesPct;
		if (meetsThreshold) {
			filesPassing++;
		} else {
			filesFailing++;
		}
	}

	const totalFiles = details.length;
	const globalCoveragePercent = totalFiles > 0 ? totalLinesPct / totalFiles : 0;

	return {
		globalCoveragePercent: Math.round(globalCoveragePercent * 100) / 100,
		totalFilesAnalyzed: totalFiles,
		filesPassing,
		filesFailing,
		details
	};
}

/**
 * Calculate coverage percentage from Istanbul coverage object
 */
function calculatePercentage(coverage: Record<string, number> | undefined): number {
	if (!coverage) return 0;

	const values = Object.values(coverage);
	if (values.length === 0) return 0;

	const covered = values.filter((v) => v > 0).length;
	return (covered / values.length) * 100;
}

/**
 * Calculate branch coverage percentage from Istanbul branch coverage object
	// Safe: Type cast to Record for dynamic property access
 * Branch coverage is stored as Record<string, number[]> where each array represents
 * hit counts for each branch path (e.g., { '0': [1, 0], '1': [5, 3] })
 */
function calculateBranchPercentage(branches: Record<string, number[]> | undefined): number {
	if (!branches) return 0;

	// Flatten all branch arrays into a single array
	const allBranches = Object.values(branches).flat();
	if (allBranches.length === 0) return 0;

	// Count covered branches (hit count > 0)
	const covered = allBranches.filter((hitCount) => hitCount > 0).length;
	return (covered / allBranches.length) * 100;
}

/**
 * Extract coverage for specific file
 */
export async function getFileCoverage(
	filePath: string,
	projectRoot: string = process.cwd()
): Promise<FileCoverage | null> {
	const summary = await extractCoverageMetrics(projectRoot);
	return summary.details.find((file) => file.filePath === filePath) || null;
}

/**
 * Check if file meets coverage threshold
 */
export async function filePassesCoverageThreshold(
	filePath: string,
	projectRoot: string = process.cwd()
): Promise<boolean> {
	const coverage = await getFileCoverage(filePath, projectRoot);
	return coverage?.meetsThreshold ?? false;
}

// ============================================================================
// ISTANBUL COVERAGE DATA TYPES
// ============================================================================

interface CoverageFileData {
	path: string;
	s: Record<string, number>; // Statements
	b: Record<string, number[]>; // Branches
	f: Record<string, number>; // Functions
	fnMap: Record<string, unknown>;
	statementMap: Record<string, unknown>;
	branchMap: Record<string, unknown>;
}

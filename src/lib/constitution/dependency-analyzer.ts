/**
 * Dependency Analyzer for Constitutional Audit
 *
 * Analyzes dependency requirements for each violation category
 * using the Dependency Verification Rulebook v2.0 methodology.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

import { type ViolationCategory } from './category-organizer.js';

export interface DependencyAnalysis {
	categoryId: string;
	categoryName: string;
	newDependencies: DependencyRequirement[];
	existingDependencies: string[];
	bundleSizeImpactKB: number;
	totalCost: 'ZERO' | 'LOW' | 'MEDIUM' | 'HIGH';
	riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
	prerequisites: string[];
	installCommands: string[];
	verificationCommands: string[];
}

export interface DependencyRequirement {
	name: string;
	version: string;
	purpose: string;
	packageType: 'dependency' | 'devDependency';
	sizeKB: number;
	license: string;
	isRequired: boolean;
}

/**
 * Analyze dependencies for all categories
 */
export async function analyzeDependencies(
	categories: ViolationCategory[],
	projectRoot: string
): Promise<Map<string, DependencyAnalysis>> {
	const analyses = new Map<string, DependencyAnalysis>();

	// Read package.json to understand existing dependencies
	const packageJsonPath = join(projectRoot, 'package.json');
	const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
	const existingDeps = {
		...packageJson.dependencies,
		...packageJson.devDependencies
	};

	for (const category of categories) {
		const analysis = await analyzeCategoryDependencies(category, existingDeps, projectRoot);
		analyses.set(category.id, analysis);
	}

	return analyses;
}

/**
 * Analyze dependencies for a specific category
 */
async function analyzeCategoryDependencies(
	category: ViolationCategory,
	existingDeps: Record<string, string>,
	_projectRoot: string
): Promise<DependencyAnalysis> {
	// Different analysis per category
	switch (category.folderName) {
		case '01-ui-modernization':
			return analyzeUIModernizationDependencies(category, existingDeps);

		case '02-service-layer-violations':
			return analyzeServiceLayerDependencies(category, existingDeps);

		case '03-type-safety-violations':
			return analyzeTypeSafetyDependencies(category, existingDeps);

		case '04-component-reuse':
			return analyzeComponentReuseDependencies(category, existingDeps);

		default:
			return analyzeGenericDependencies(category, existingDeps);
	}
}

/**
 * Analyze UI Modernization dependencies (Shadcn)
 */
function analyzeUIModernizationDependencies(
	category: ViolationCategory,
	existingDeps: Record<string, string>
): DependencyAnalysis {
	const newDeps: DependencyRequirement[] = [];

	// Check if Shadcn dependencies are missing
	if (!existingDeps['clsx']) {
		newDeps.push({
			name: 'clsx',
			version: '^2.1.1',
			purpose: 'Utility for constructing className strings conditionally',
			packageType: 'dependency',
			sizeKB: 1,
			license: 'MIT',
			isRequired: true
		});
	}

	if (!existingDeps['tailwind-merge']) {
		newDeps.push({
			name: 'tailwind-merge',
			version: '^2.5.5',
			purpose: 'Merge Tailwind CSS classes without style conflicts',
			packageType: 'dependency',
			sizeKB: 5,
			license: 'MIT',
			isRequired: true
		});
	}

	if (!existingDeps['tailwind-variants']) {
		newDeps.push({
			name: 'tailwind-variants',
			version: '^0.2.1',
			purpose: 'Create component variants with Tailwind CSS',
			packageType: 'dependency',
			sizeKB: 3,
			license: 'MIT',
			isRequired: true
		});
	}

	if (!existingDeps['lucide-svelte']) {
		newDeps.push({
			name: 'lucide-svelte',
			version: '^0.468.0',
			purpose: 'Icon library for Shadcn components',
			packageType: 'dependency',
			sizeKB: 150,
			license: 'ISC',
			isRequired: true
		});
	}

	if (!existingDeps['shadcn-svelte']) {
		newDeps.push({
			name: 'shadcn-svelte',
			version: 'latest',
			purpose: 'CLI for adding Shadcn components',
			packageType: 'devDependency',
			sizeKB: 50,
			license: 'MIT',
			isRequired: true
		});
	}

	const bundleSizeImpact = newDeps.reduce((sum, dep) => sum + dep.sizeKB, 0);
	const installCommands =
		newDeps.length > 0
			? [
					`npm install ${newDeps
						.filter((d) => d.packageType === 'dependency')
						.map((d) => `${d.name}@${d.version}`)
						.join(' ')}`,
					`npm install -D ${newDeps
						.filter((d) => d.packageType === 'devDependency')
						.map((d) => `${d.name}@${d.version}`)
						.join(' ')}`,
					'npx shadcn-svelte@latest init'
				]
			: [];

	return {
		categoryId: category.id,
		categoryName: category.name,
		newDependencies: newDeps,
		existingDependencies: ['tailwindcss', '@tailwindcss/forms', 'svelte', '@sveltejs/kit'],
		bundleSizeImpactKB: bundleSizeImpact,
		totalCost: newDeps.length > 0 ? 'LOW' : 'ZERO',
		riskLevel: 'MEDIUM',
		prerequisites: [
			'Tailwind CSS installed and configured',
			'Svelte 5.x installed',
			'SvelteKit 2.x installed'
		],
		installCommands,
		verificationCommands: ['npm run typecheck', 'npm run build']
	};
}

/**
 * Analyze Service Layer dependencies (zero new deps, just refactoring)
 */
function analyzeServiceLayerDependencies(
	category: ViolationCategory,
	_existingDeps: Record<string, string>
): DependencyAnalysis {
	return {
		categoryId: category.id,
		categoryName: category.name,
		newDependencies: [],
		existingDependencies: ['typescript', 'eslint', 'vitest', 'madge'],
		bundleSizeImpactKB: 0,
		totalCost: 'ZERO',
		riskLevel: 'MEDIUM',
		prerequisites: [
			'Git repository for tracking changes',
			'TypeScript compiler for import validation',
			'Test suite for regression testing'
		],
		installCommands: [],
		verificationCommands: ['npm run typecheck', 'npm run lint', 'npm run test']
	};
}

/**
 * Analyze Type Safety dependencies (Zod already installed)
 */
function analyzeTypeSafetyDependencies(
	category: ViolationCategory,
	existingDeps: Record<string, string>
): DependencyAnalysis {
	const zodInstalled = !!existingDeps['zod'];

	const newDeps: DependencyRequirement[] = zodInstalled
		? []
		: [
				{
					name: 'zod',
					version: '^3.25.76',
					purpose: 'Runtime type validation and schema definition',
					packageType: 'dependency',
					sizeKB: 50,
					license: 'MIT',
					isRequired: true
				}
			];

	return {
		categoryId: category.id,
		categoryName: category.name,
		newDependencies: newDeps,
		existingDependencies: zodInstalled
			? ['zod', 'typescript', 'vitest']
			: ['typescript', 'vitest'],
		bundleSizeImpactKB: newDeps.reduce((sum, dep) => sum + dep.sizeKB, 0),
		totalCost: newDeps.length > 0 ? 'LOW' : 'ZERO',
		riskLevel: 'LOW',
		prerequisites: [
			'Zod installed (runtime validation)',
			'TypeScript configured',
			'Test suite for validation testing'
		],
		installCommands: newDeps.length > 0 ? ['npm install zod@^3.25.76'] : [],
		verificationCommands: ['npm run typecheck', 'npm run test']
	};
}

/**
 * Analyze Component Reuse dependencies (zero, covered by UI modernization)
 */
function analyzeComponentReuseDependencies(
	category: ViolationCategory,
	_existingDeps: Record<string, string>
): DependencyAnalysis {
	return {
		categoryId: category.id,
		categoryName: category.name,
		newDependencies: [],
		existingDependencies: ['svelte', '@sveltejs/kit'],
		bundleSizeImpactKB: 0,
		totalCost: 'ZERO',
		riskLevel: 'LOW',
		prerequisites: ['Svelte 5.x installed'],
		installCommands: [],
		verificationCommands: ['npm run typecheck']
	};
}

/**
 * Generic dependency analysis for other categories
 */
function analyzeGenericDependencies(
	category: ViolationCategory,
	_existingDeps: Record<string, string>
): DependencyAnalysis {
	return {
		categoryId: category.id,
		categoryName: category.name,
		newDependencies: [],
		existingDependencies: [],
		bundleSizeImpactKB: 0,
		totalCost: 'ZERO',
		riskLevel: 'LOW',
		prerequisites: [],
		installCommands: [],
		verificationCommands: ['npm run typecheck', 'npm run lint', 'npm run test']
	};
}

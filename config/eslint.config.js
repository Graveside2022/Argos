import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import sonarjs from 'eslint-plugin-sonarjs';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteParser from 'svelte-eslint-parser';

export default [
	js.configs.recommended,
	{
		ignores: [
			'node_modules/**',
			'build/**',
			'.svelte-kit/**',
			'.next/**',
			'package/**',
			'**/.venv/**',
			'**/venv/**',
			'**/dist/**',
			'service/dist/**',
			'.env',
			'.env.*',
			'!.env.example',
			'vite.config.js.timestamp-*',
			'vite.config.ts.timestamp-*',
			'hackrfbackup.svelte',
			'tests/reports/**',
			'tests/reports/**/*.js',
			'playwright-report/**'
		]
	},
	{
		files: ['**/*.js', '**/*.ts', '**/*.svelte'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node,
				...globals.es2022,
				NodeJS: 'readonly'
			}
		},
		plugins: {
			'simple-import-sort': simpleImportSort
		},
		rules: {
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error'
		}
	},
	{
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			globals: {
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly',
				$host: 'readonly'
			}
		}
	},
	{
		files: ['**/*.ts', '**/*.svelte'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: false, // Disable type checking for performance
				ecmaVersion: 2022,
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': ts,
			sonarjs
		},
		rules: {
			...ts.configs.recommended.rules, // Use non-type-checked rules
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],
			'@typescript-eslint/no-explicit-any': 'warn', // Enforce proper typing
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn', // Prefer type guards
			'no-console': ['warn', { allow: ['warn', 'error'] }], // Use proper logging
			complexity: ['warn', 15], // Cyclomatic complexity threshold
			'sonarjs/cognitive-complexity': ['warn', 20] // Cognitive complexity threshold
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser
			}
		},
		plugins: {
			svelte
		},
		rules: {
			...svelte.configs.recommended.rules
		}
	},
	{
		files: ['**/*.cjs'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'commonjs',
			globals: {
				...globals.node
			}
		},
		rules: {
			'no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	},
	prettier
];

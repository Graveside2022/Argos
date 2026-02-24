/**
 * Contract: Expanded Environment Variable Schema
 *
 * This contract defines the target env.ts Zod schema after FR-023 expansion.
 * Implementation lives at: src/lib/server/env.ts
 *
 * NOTE: This is a TYPE-ONLY contract file for planning purposes.
 * It is NOT executable code — it will be deleted after implementation.
 *
 * Spec: 016-code-expressiveness FR-023, FR-024, FR-025
 */

import type { z } from 'zod';

// --- Target Schema Shape ---

export interface ArgosEnv {
	// Existing (4 vars)
	NODE_ENV: 'development' | 'production' | 'test';
	DATABASE_PATH: string;
	KISMET_API_URL: string;
	ARGOS_API_KEY: string;

	// Kismet auth/connection (FR-023)
	KISMET_HOST: string; // default: 'localhost'
	KISMET_PORT: number; // default: 2501
	KISMET_API_KEY: string; // default: ''
	KISMET_USER: string; // default: 'kismet'
	KISMET_PASSWORD: string; // default: 'kismet'

	// External API keys (FR-023, optional)
	ANTHROPIC_API_KEY?: string;
	OPENCELLID_API_KEY?: string;

	// Public-facing URLs (FR-023)
	PUBLIC_KISMET_API_URL: string; // default: 'http://localhost:2501'
	PUBLIC_HACKRF_API_URL: string; // default: 'http://localhost:8092'

	// Self / CORS (FR-023, FR-025)
	ARGOS_API_URL: string; // default: 'http://localhost:5173'
	ARGOS_CORS_ORIGINS: string; // default: ''

	// Third-party service URLs (FR-025, new env vars)
	GSM_EVIL_URL: string; // default: 'http://localhost:8080'
	OPENWEBRX_URL: string; // default: 'http://localhost:8073'
	BETTERCAP_URL: string; // default: 'http://localhost:80'

	// Temp directory (FR-024)
	ARGOS_TEMP_DIR: string; // default: path.join(os.tmpdir(), 'argos')
}

// --- Migration Contract ---
// After Phase 1.4 completes:
// - Zero `process.env.` accesses in src/ (excluding src/lib/server/mcp/)
// - All env var reads go through: `import { env } from '$lib/server/env'`
// - env.ts Zod schema validates ALL vars at startup
// - Missing required vars → system exits with clear error naming the var

// --- Temp Dir Contract (FR-024) ---
// On startup, ensure ARGOS_TEMP_DIR exists:
//   const tempDir = env.ARGOS_TEMP_DIR || path.join(os.tmpdir(), 'argos');
//   mkdirSync(tempDir, { recursive: true });
// All files that currently use '/tmp/...' paths use:
//   path.join(env.ARGOS_TEMP_DIR, 'filename')

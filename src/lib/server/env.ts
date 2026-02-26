import { config } from 'dotenv';
import { mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';

// Load .env variables
config();

const envSchema = z.object({
	// Core (existing)
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	DATABASE_PATH: z.string().min(1).default('./rf_signals.db'),
	KISMET_API_URL: z
		.string()
		.url({ message: 'Invalid KISMET_API_URL' })
		.default('http://localhost:2501'),
	ARGOS_API_KEY: z.string().min(32, {
		message: 'ARGOS_API_KEY must be at least 32 characters. Generate with: openssl rand -hex 32'
	}),

	// Kismet auth/connection (FR-023)
	KISMET_HOST: z.string().default('localhost'),
	KISMET_PORT: z.coerce.number().int().min(1).max(65535).default(2501),
	KISMET_API_KEY: z.string().default(''),
	KISMET_USER: z.string().default('admin'),
	KISMET_PASSWORD: z.string().default(''),

	// External API keys (FR-023, optional)
	ANTHROPIC_API_KEY: z.string().optional(),
	OPENCELLID_API_KEY: z.string().optional(),
	STADIA_MAPS_API_KEY: z.string().optional(),

	// Public-facing URLs (FR-023)
	PUBLIC_KISMET_API_URL: z.string().url().default('http://localhost:2501'),
	PUBLIC_HACKRF_API_URL: z.string().url().default('http://localhost:8092'),

	// Self / CORS (FR-023, FR-025)
	ARGOS_API_URL: z.string().url().default('http://localhost:5173'),
	ARGOS_CORS_ORIGINS: z.string().default(''),

	// Third-party service URLs (FR-025)
	GSM_EVIL_URL: z.string().url().default('http://localhost:8080'),
	OPENWEBRX_URL: z.string().url().default('http://localhost:8073'),
	BETTERCAP_URL: z.string().url().default('http://localhost:80'),

	// GSM Evil data directory
	GSMEVIL_DIR: z.string().default(''),

	// DTED terrain elevation data directory (022-terrain-viewshed)
	DTED_DATA_DIR: z.string().min(1).default('./data/dted'),

	// Temp directory (FR-024) — resolved at runtime below
	ARGOS_TEMP_DIR: z.string().default(''),

	// GPSD socket path (FR-040)
	GPSD_SOCKET_PATH: z.string().default('/var/run/gpsd.sock')
});

// Parse and validate environment variables at startup
const parsed = envSchema.parse(process.env);

// T033: Resolve ARGOS_TEMP_DIR and ensure it exists (FR-024)
const resolvedTempDir = parsed.ARGOS_TEMP_DIR || path.join(os.tmpdir(), 'argos');
mkdirSync(resolvedTempDir, { recursive: true });

export const env = {
	...parsed,
	ARGOS_TEMP_DIR: resolvedTempDir
};

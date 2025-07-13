#!/usr/bin/env node

// This script validates environment variables before server startup
// It ensures fail-fast behavior as specified in Initiative 5

import { config } from 'dotenv';
import { z } from 'zod';

// Load .env variables
config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().min(1).default('./rf_signals.db'),
  KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL - must be a valid URL" }),
});

console.log('🔍 Validating environment variables...');

try {
  const env = envSchema.parse(process.env);
  console.log('✅ Environment validation successful');
  console.log('   - NODE_ENV:', env.NODE_ENV);
  console.log('   - DATABASE_PATH:', env.DATABASE_PATH);
  console.log('   - KISMET_API_URL:', env.KISMET_API_URL);
  process.exit(0);
} catch (error) {
  console.error('\n❌ Environment validation failed!\n');
  if (error instanceof z.ZodError) {
    error.errors.forEach(err => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
  }
  console.error('\n🔧 Please check your .env file and ensure all required variables are set correctly.\n');
  console.error('   Required variables:');
  console.error('   - KISMET_API_URL: Must be a valid URL (e.g., http://localhost:2501)');
  console.error('   - DATABASE_PATH: Path to SQLite database (default: ./rf_signals.db)');
  console.error('   - NODE_ENV: development, production, or test (default: development)\n');
  process.exit(1);
}
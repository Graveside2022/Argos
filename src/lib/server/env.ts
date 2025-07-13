import { z } from 'zod';
import { config } from 'dotenv';

// Load .env variables
config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_PATH: z.string().min(1).default('./rf_signals.db'),
  KISMET_API_URL: z.string().url({ message: "Invalid KISMET_API_URL" }),
});

// Parse environment variables
// Note: Validation happens at startup via npm scripts (validate:env)
export const env = envSchema.parse(process.env);
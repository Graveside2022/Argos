/* eslint-disable no-console */
import Database from 'better-sqlite3';
import { join } from 'path';

import { runMigrations } from '../src/lib/server/db/migrations/run-migrations';

const dbPath = process.env.DB_PATH || './rf_signals.db';
const db = new Database(dbPath);
const migrationsPath = join(process.cwd(), 'src/lib/server/db/migrations');

console.log(`Running migrations on ${dbPath} from ${migrationsPath}...`);
try {
	runMigrations(db, migrationsPath);
	console.log('Migrations completed successfully.');
} catch (error) {
	console.error('Migration failed:', error);
	process.exit(1);
}

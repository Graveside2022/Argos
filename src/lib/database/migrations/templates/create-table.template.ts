import type { Migration } from '../../migrations';
import type { Database } from 'sqlite3';

export const createTableMigration = (
	version: number,
	tableName: string,
	schema: string,
	indexStatements: string[] = []
): Migration => ({
	version,
	name: `create_${tableName}_table`,
	description: `Create ${tableName} table with schema from audit`,
	up: async (db: Database) => {
		// Create table using schema from audit
		await new Promise<void>((resolve, reject) => {
			db.run(schema, (err) => {
				if (err) reject(new Error(err.message));
				else resolve();
			});
		});

		// Create indexes
		for (const indexSql of indexStatements) {
			await new Promise<void>((resolve, reject) => {
				db.run(indexSql, (err) => {
					if (err) reject(new Error(err.message));
					else resolve();
				});
			});
		}
	},
	down: async (db: Database) => {
		// Drop indexes first
		for (const indexSql of indexStatements) {
			const indexName = indexSql.match(/CREATE INDEX (\w+)/)?.[1];
			if (indexName) {
				await new Promise<void>((resolve, reject) => {
					db.run(`DROP INDEX IF EXISTS ${indexName}`, (err) => {
						if (err) reject(new Error(err.message));
						else resolve();
					});
				});
			}
		}

		// Drop table
		await new Promise<void>((resolve, reject) => {
			db.run(`DROP TABLE IF EXISTS ${tableName}`, (err) => {
				if (err) reject(new Error(err.message));
				else resolve();
			});
		});
	},
	validate: async (db: Database) => {
		// Validate table exists and has correct structure
		return new Promise((resolve) => {
			db.get(
				`SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
				[tableName],
				(_err, row) => {
					resolve(!_err && !!row);
				}
			);
		});
	}
});

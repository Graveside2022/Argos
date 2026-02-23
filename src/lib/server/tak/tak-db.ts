import type Database from 'better-sqlite3';

import type { TakServerConfig } from '../../types/tak';

/** Coalesce a row field to undefined if nullish */
function strOrUndef(val: unknown): string | undefined {
	return (val as string) ?? undefined;
}

/** Coalesce a row field to a string default */
function strOrDefault(val: unknown, fallback: string): string {
	return (val as string) ?? fallback;
}

/** Maps snake_case DB rows to camelCase TakServerConfig */
export function rowToConfig(row: Record<string, unknown>): TakServerConfig {
	return {
		id: row.id as string,
		name: row.name as string,
		hostname: row.hostname as string,
		port: row.port as number,
		protocol: 'tls',
		certPath: strOrUndef(row.cert_path),
		keyPath: strOrUndef(row.key_path),
		caPath: strOrUndef(row.ca_path),
		shouldConnectOnStartup: Boolean(row.connect_on_startup),
		authMethod: strOrUndef(row.auth_method) as 'enroll' | 'import' | undefined,
		truststorePath: strOrUndef(row.truststore_path),
		truststorePass: strOrDefault(row.truststore_pass, 'atakatak'),
		certPass: strOrDefault(row.cert_pass, 'atakatak'),
		enrollmentUser: strOrUndef(row.enrollment_user),
		enrollmentPass: strOrUndef(row.enrollment_pass),
		enrollmentPort: (row.enrollment_port as number) ?? 8446
	};
}

/** Coalesce an optional field to null for SQL */
function orNull<T>(val: T | undefined): T | null {
	return val ?? null;
}

/** Converts camelCase config to positional args for SQL statements */
function configToParams(config: TakServerConfig): unknown[] {
	return [
		config.name,
		config.hostname,
		config.port,
		config.protocol,
		orNull(config.certPath),
		orNull(config.keyPath),
		orNull(config.caPath),
		config.shouldConnectOnStartup ? 1 : 0,
		orNull(config.authMethod),
		orNull(config.truststorePath),
		config.truststorePass,
		config.certPass,
		orNull(config.enrollmentUser),
		orNull(config.enrollmentPass),
		config.enrollmentPort
	];
}

/** Loads the first TAK server configuration from the database, or null if none exists. */
export function loadTakConfig(db: Database.Database): TakServerConfig | null {
	const row = db.prepare('SELECT * FROM tak_configs LIMIT 1').get() as
		| Record<string, unknown>
		| undefined;
	return row ? rowToConfig(row) : null;
}

const UPDATE_SQL = `UPDATE tak_configs SET
	name = ?, hostname = ?, port = ?, protocol = ?,
	cert_path = ?, key_path = ?, ca_path = ?,
	connect_on_startup = ?, auth_method = ?,
	truststore_path = ?, truststore_pass = ?, cert_pass = ?,
	enrollment_user = ?, enrollment_pass = ?, enrollment_port = ?
WHERE id = ?`;

const INSERT_SQL = `INSERT INTO tak_configs (
	id, name, hostname, port, protocol,
	cert_path, key_path, ca_path,
	connect_on_startup, auth_method,
	truststore_path, truststore_pass, cert_pass,
	enrollment_user, enrollment_pass, enrollment_port
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** Upserts a TAK server configuration into the database (inserts if new, updates if existing). */
export function saveTakConfig(db: Database.Database, config: TakServerConfig): void {
	const existing = db.prepare('SELECT id FROM tak_configs WHERE id = ?').get(config.id);
	const params = configToParams(config);

	if (existing) {
		db.prepare(UPDATE_SQL).run(...params, config.id);
	} else {
		db.prepare(INSERT_SQL).run(config.id, ...params);
	}
}

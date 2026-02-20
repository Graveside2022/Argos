import type Database from 'better-sqlite3';

import type { TakServerConfig } from '../../types/tak';

/** Maps snake_case DB rows to camelCase TakServerConfig */
export function rowToConfig(row: Record<string, unknown>): TakServerConfig {
	return {
		id: row.id as string,
		name: row.name as string,
		hostname: row.hostname as string,
		port: row.port as number,
		protocol: 'tls',
		certPath: (row.cert_path as string) ?? undefined,
		keyPath: (row.key_path as string) ?? undefined,
		caPath: (row.ca_path as string) ?? undefined,
		shouldConnectOnStartup: Boolean(row.connect_on_startup),
		authMethod: (row.auth_method as 'enroll' | 'import') ?? undefined,
		truststorePath: (row.truststore_path as string) ?? undefined,
		truststorePass: (row.truststore_pass as string) ?? 'atakatak',
		certPass: (row.cert_pass as string) ?? 'atakatak',
		enrollmentUser: (row.enrollment_user as string) ?? undefined,
		enrollmentPass: (row.enrollment_pass as string) ?? undefined,
		enrollmentPort: (row.enrollment_port as number) ?? 8446
	};
}

/** Converts camelCase config to positional args for SQL statements */
function configToParams(config: TakServerConfig): unknown[] {
	return [
		config.name,
		config.hostname,
		config.port,
		config.protocol,
		config.certPath ?? null,
		config.keyPath ?? null,
		config.caPath ?? null,
		config.shouldConnectOnStartup ? 1 : 0,
		config.authMethod ?? null,
		config.truststorePath ?? null,
		config.truststorePass,
		config.certPass,
		config.enrollmentUser ?? null,
		config.enrollmentPass ?? null,
		config.enrollmentPort
	];
}

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

export function saveTakConfig(db: Database.Database, config: TakServerConfig): void {
	const existing = db.prepare('SELECT id FROM tak_configs WHERE id = ?').get(config.id);
	const params = configToParams(config);

	if (existing) {
		db.prepare(UPDATE_SQL).run(...params, config.id);
	} else {
		db.prepare(INSERT_SQL).run(config.id, ...params);
	}
}

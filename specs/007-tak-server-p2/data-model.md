# Data Model: TAK Server Integration Phase 2

## Entities

### TAKConfiguration

Extends the existing TAK configuration to support mutual TLS truststores and automated enrollment.

| Field              | Type                   | Storage (SQLite)   | Description                                                                                    |
| ------------------ | ---------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `id`               | `string`               | `id` (PK)          | Unique ID (usually 'default').                                                                 |
| `name`             | `string`               | `name`             | User-defined label (e.g., "Unit TAK").                                                         |
| `hostname`         | `string`               | `hostname`         | Server IP or DNS.                                                                              |
| `port`             | `number`               | `port`             | Streaming port (default 8089).                                                                 |
| `protocol`         | `'tcp' \| 'tls'`       | `protocol`         | Connection protocol. Internal value `'tls'` maps to UI label "SSL" (TAK ecosystem convention). |
| `certPath`         | `string?`              | `certPath`         | Path to extracted client certificate (.pem).                                                   |
| `keyPath`          | `string?`              | `keyPath`          | Path to extracted client private key (.key).                                                   |
| `caPath`           | `string?`              | `caPath`           | Path to extracted CA truststore (.pem).                                                        |
| `connectOnStartup` | `boolean`              | `connectOnStartup` | Auto-connect flag.                                                                             |
| `authMethod`       | `'enroll' \| 'import'` | `auth_method`      | Authentication strategy.                                                                       |
| `enrollmentUser`   | `string?`              | `enrollment_user`  | TAK enrollment username.                                                                       |
| `enrollmentPass`   | `string?`              | `enrollment_pass`  | TAK enrollment password.                                                                       |
| `enrollmentPort`   | `number`               | `enrollment_port`  | Enrollment API port (default 8446).                                                            |
| `truststorePath`   | `string?`              | `truststore_path`  | Original .p12 truststore path.                                                                 |
| `truststorePass`   | `string`               | `truststore_pass`  | Password for truststore .p12.                                                                  |
| `certPass`         | `string`               | `cert_pass`        | Password for client cert .p12.                                                                 |

### TAKStatus

Extended status object for TopStatusBar and Overview panel.

```ts
export interface TakStatus {
	status: 'connected' | 'disconnected' | 'error';
	serverName?: string;
	serverHost?: string;
	uptime?: number;
	messageCount?: number;
	lastError?: string;
}
```

## Relationships

- **Config -> Files**: `TAKConfiguration` references paths in the Argos-managed `data/certs/` directory.
- **Service -> Config**: `TakService` loads and persists `TAKConfiguration`.
- **UI -> Store**: Components react to `takStatus` and `takConfig` stores.

## Validation Rules

- **Hostname**: Must be valid IPv4/IPv6 or DNS hostname.
- **Port**: Must be 1-65535.
- **Certificates**: Must be valid PKCS#12 (.p12) and unlockable with the provided password.
- **Data Package**: Must contain a `manifest.xml` to be processed.

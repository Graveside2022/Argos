# Phase 2.2.13: Data-at-Rest Encryption for SQLite

**Classification**: UNCLASSIFIED // FOUO
**Document Version**: 1.0
**Created**: 2026-02-08
**Authority**: Codebase Audit 2026-02-07, Final Phases
**Standards Compliance**: NIST SP 800-53 SC-28 (Protection of Information at Rest), NIST SP 800-111 (Guide to Storage Encryption), FIPS 140-2 (AES-256)
**Review Panel**: US Cyber Command Engineering Review Board
**Origin**: NEW from regrade C3

---

## Purpose

Implement data-at-rest encryption for the Argos SQLite database (`rf_signals.db`). The database stores IMSI identifiers, RF signal intelligence data, GPS positions of operators, WiFi device MAC addresses, and tactical network topology information. On a field-deployed RPi 5, physical capture of the device grants an adversary immediate, unencrypted access to this intelligence data. NIST SP 800-53 SC-28 requires protection of information at rest.

## Execution Constraints

| Constraint    | Value                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Risk Level    | HIGH -- Database migration from unencrypted to encrypted format is a one-way operation         |
| Severity      | HIGH                                                                                           |
| Prerequisites | Phase 2.1 complete (authentication middleware and input sanitization library must be in place) |
| Files Touched | 3-5 (package.json, database initialization, .env, migration script, database.ts)               |
| Blocks        | Nothing (encryption is transparent to application code after initial setup)                    |
| Blocked By    | Phase 2.1 (must not disrupt database during security hardening)                                |

## Threat Context

Argos is deployed on Raspberry Pi 5 hardware in contested electromagnetic environments at Army EW training sites. The device is portable and operates in field conditions where physical security cannot be guaranteed. The following scenarios require data-at-rest encryption:

1. **Device capture by adversary** -- During field exercises or actual operations, the RPi 5 may be physically captured. The NVMe SSD can be removed and mounted on any Linux system, providing immediate access to the SQLite database. Without encryption, all stored intelligence is exposed.

2. **Device loss during transit** -- Equipment is lost or left behind during tactical movements. A non-adversary finding (or an adversary recovering) the device can access stored data.

3. **Device theft from staging area** -- Equipment staged for training or maintenance is stolen. Serial numbers, MAC addresses, IMSI data, and GPS positions of operators are exposed.

4. **Decommissioning without proper sanitization** -- When an RPi is retired or reassigned, the NVMe may not be properly wiped. Encrypted data remains protected even if sanitization is incomplete.

### Data Stored in rf_signals.db

| Data Type                 | Sensitivity | Impact if Exposed                                           |
| ------------------------- | ----------- | ----------------------------------------------------------- |
| IMSI identifiers          | HIGH        | Identifies specific cellular devices; enables tracking      |
| WiFi device MAC addresses | MEDIUM      | Enables device fingerprinting and tracking                  |
| GPS positions             | HIGH        | Reveals operator movement patterns and positions            |
| RF signal parameters      | MEDIUM      | Reveals monitoring capabilities and frequency coverage      |
| Network topology          | MEDIUM      | Reveals tactical network architecture                       |
| Kismet device history     | MEDIUM      | Full inventory of detected wireless devices in AO           |
| Cell tower data           | LOW         | Public infrastructure data, but combined with GPS = pattern |

SQLCipher provides AES-256-CBC encryption at the page level, making the database unreadable without the passphrase. Even partial recovery of database pages yields no usable data.

## Current State Assessment

| Metric                          | Value                      | Verification Command                                    |
| ------------------------------- | -------------------------- | ------------------------------------------------------- |
| SQLite library in use           | **better-sqlite3 ^12.2.0** | `grep "better-sqlite3" package.json`                    |
| Database file                   | **rf_signals.db**          | Located at application root (configured in database.ts) |
| Database encryption             | **None**                   | `file rf_signals.db` shows "SQLite 3.x database"        |
| Database size (approximate)     | Varies by deployment       | `ls -lh rf_signals.db`                                  |
| R-tree spatial indexing         | **Active**                 | `src/lib/server/db/` implements spatial queries         |
| Database.ts initialization      | Single file                | `src/lib/server/db/database.ts`                         |
| Environment variable for DB key | **Does not exist**         | `grep "DB_KEY\|DB_PASS" .env 2>/dev/null`               |
| SQLCipher support               | **Not installed**          | `npm list better-sqlite3-sqlcipher 2>/dev/null`         |
| WAL mode active                 | **Yes**                    | WAL journaling for concurrent reads                     |

## Implementation Plan

### Subtask 2.2.13.1: Encryption Options Evaluation

Three approaches were evaluated for protecting the Argos SQLite database at rest:

| Option        | Approach                                              | Encryption Algorithm | Performance Impact | Complexity | R-tree Compatible | Recommendation  |
| ------------- | ----------------------------------------------------- | -------------------- | ------------------ | ---------- | ----------------- | --------------- |
| **SQLCipher** | Drop-in SQLite replacement with page-level encryption | AES-256-CBC          | 5-15% overhead     | LOW        | YES               | **RECOMMENDED** |
| LUKS          | Full-disk encryption at OS/block level                | AES-256-XTS          | 2-5% overhead      | MEDIUM     | YES (transparent) | Alternative     |
| dm-crypt      | Per-file encrypted loopback mount                     | AES-256-XTS          | 3-8% overhead      | MEDIUM     | YES (transparent) | Alternative     |

#### Evaluation Criteria

| Criterion                                  | SQLCipher                              | LUKS                                         | dm-crypt per-file                  |
| ------------------------------------------ | -------------------------------------- | -------------------------------------------- | ---------------------------------- |
| Protects data if SSD removed from RPi      | YES (database is encrypted)            | YES (entire disk is encrypted)               | YES (database file is encrypted)   |
| Protects data if mounted on another system | YES (AES-256 without passphrase)       | NO (if boot partition not encrypted)         | YES (loopback requires passphrase) |
| Application code changes required          | Minimal (replace package + add PRAGMA) | None (transparent at block level)            | None (transparent via mount)       |
| Key management                             | Application-level (.env or env var)    | OS-level (LUKS keyslot)                      | OS-level (loopback key)            |
| Boot-time passphrase required              | No (app provides key at runtime)       | Yes (manual entry or TPM)                    | Yes (mount requires key)           |
| Headless deployment compatible             | YES (key from environment variable)    | Complex (requires TPM or network key escrow) | Complex (requires key escrow)      |
| Recovery if key lost                       | Data unrecoverable (by design)         | Data unrecoverable (by design)               | Data unrecoverable (by design)     |

**Decision**: SQLCipher is recommended because:

- It requires the fewest code changes (npm package swap + 1 PRAGMA statement)
- It does not require OS-level configuration changes or boot-time interaction
- It is compatible with headless RPi deployment (no passphrase prompt at boot)
- The encryption key is managed at the application level via environment variable
- R-tree spatial indexing remains fully functional
- WAL journaling mode remains supported

### Subtask 2.2.13.2: SQLCipher Implementation Plan

#### Step 1: Replace better-sqlite3 with better-sqlite3-sqlcipher

```bash
# Remove the unencrypted SQLite binding
npm uninstall better-sqlite3

# Install the SQLCipher-enabled binding
# Note: better-sqlite3-sqlcipher is a fork that links against libsqlcipher
npm install better-sqlite3-sqlcipher

# Alternative: @aspect-build/better-sqlite3-sqlcipher (if the above is unavailable)
# npm install @aspect-build/better-sqlite3-sqlcipher
```

**NOTE**: The `better-sqlite3-sqlcipher` package is a drop-in replacement. The API is identical to `better-sqlite3`. No import changes are required if the package name alias is configured in `package.json`:

```json
{
	"dependencies": {
		"better-sqlite3": "npm:better-sqlite3-sqlcipher@^12.0.0"
	}
}
```

This aliasing approach means zero changes to any import statement in the codebase. All files that `import Database from 'better-sqlite3'` will transparently use the SQLCipher-enabled version.

#### Step 2: Add Database Passphrase to Environment

Add to `.env`:

```
# Database encryption key (NIST SP 800-53 SC-28)
# Generate with: openssl rand -hex 32
# CRITICAL: This key must be backed up securely. If lost, the database is unrecoverable.
ARGOS_DB_KEY=<generate-at-deployment-time>
```

Add to `src/lib/server/validate-env.js` (or equivalent environment validation):

```javascript
// Required for database encryption
if (!process.env.ARGOS_DB_KEY || process.env.ARGOS_DB_KEY.length < 32) {
	console.error('FATAL: ARGOS_DB_KEY must be set (minimum 32 characters)');
	process.exit(1);
}
```

**SECURITY**: The `ARGOS_DB_KEY` value MUST NOT be:

- Committed to git (add `ARGOS_DB_KEY` pattern to `.gitignore` and `.env.example`)
- Logged to console or audit logs
- Included in error messages or stack traces
- Transmitted over the network

#### Step 3: Apply PRAGMA key on Database Open

**File**: `src/lib/server/db/database.ts`

**BEFORE** (unencrypted database open):

```typescript
import Database from 'better-sqlite3';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

**AFTER** (encrypted database open):

```typescript
import Database from 'better-sqlite3';

const db = new Database(DB_PATH);

// NIST SP 800-53 SC-28: Encrypt database at rest
// PRAGMA key MUST be the first statement after opening the database.
// Any other PRAGMA or query before this will fail on an encrypted database.
const dbKey = process.env.ARGOS_DB_KEY;
if (!dbKey) {
	throw new Error('FATAL: ARGOS_DB_KEY environment variable is not set');
}
db.pragma(`key = '${dbKey}'`);

// These PRAGMAs are applied after the key, on the decrypted database
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Verify the key works by executing a simple query
try {
	db.pragma('schema_version');
} catch (error) {
	throw new Error(
		'FATAL: Database decryption failed. Check ARGOS_DB_KEY. ' +
			'If this is a new deployment, the database may need migration from unencrypted format.'
	);
}
```

**CRITICAL**: The `PRAGMA key` statement MUST be the very first statement executed after `new Database()`. If any other PRAGMA or query executes first, SQLCipher will fail to decrypt the database and all subsequent operations will fail with "file is not a database" errors.

#### Step 4: Migrate Existing Unencrypted Database

Existing deployments have an unencrypted `rf_signals.db`. This must be migrated to encrypted format. The migration is a one-time, one-way operation.

**Create**: `scripts/security/migrate-db-encryption.sh`

```bash
#!/usr/bin/env bash
# scripts/security/migrate-db-encryption.sh
#
# Migrate existing unencrypted rf_signals.db to SQLCipher encrypted format.
#
# PREREQUISITES:
# - ARGOS_DB_KEY must be set in environment
# - sqlcipher CLI must be installed (apt install sqlcipher)
# - Argos application must be STOPPED
#
# WARNING: This is a ONE-WAY migration. Back up the original database first.
#
# Usage: ARGOS_DB_KEY=<key> bash scripts/security/migrate-db-encryption.sh

set -euo pipefail

DB_PATH="${1:-rf_signals.db}"
DB_KEY="${ARGOS_DB_KEY:?ERROR: ARGOS_DB_KEY environment variable must be set}"

if [[ ! -f "${DB_PATH}" ]]; then
    echo "ERROR: Database not found at ${DB_PATH}" >&2
    exit 1
fi

# Verify this is an unencrypted SQLite database
if ! file "${DB_PATH}" | grep -q "SQLite"; then
    echo "ERROR: ${DB_PATH} is not an unencrypted SQLite database." >&2
    echo "       It may already be encrypted, or it may be corrupted." >&2
    exit 1
fi

# Verify sqlcipher is available
if ! command -v sqlcipher &>/dev/null; then
    echo "ERROR: sqlcipher CLI not found. Install with: apt install sqlcipher" >&2
    exit 1
fi

echo "[*] Backing up original database..."
cp "${DB_PATH}" "${DB_PATH}.unencrypted.bak"
cp "${DB_PATH}-wal" "${DB_PATH}-wal.unencrypted.bak" 2>/dev/null || true
cp "${DB_PATH}-shm" "${DB_PATH}-shm.unencrypted.bak" 2>/dev/null || true

echo "[*] Migrating to encrypted format..."
ENCRYPTED_PATH="${DB_PATH}.encrypted"

# Use sqlcipher to create encrypted copy
sqlcipher "${DB_PATH}" << EOF
ATTACH DATABASE '${ENCRYPTED_PATH}' AS encrypted KEY '${DB_KEY}';
SELECT sqlcipher_export('encrypted');
DETACH DATABASE encrypted;
EOF

echo "[*] Verifying encrypted database..."
# Verify the encrypted database is NOT recognized as SQLite
if file "${ENCRYPTED_PATH}" | grep -q "SQLite"; then
    echo "ERROR: Encrypted database still shows SQLite header. Migration failed." >&2
    rm -f "${ENCRYPTED_PATH}"
    exit 1
fi

# Verify the encrypted database can be opened with the key
sqlcipher "${ENCRYPTED_PATH}" << EOF
PRAGMA key = '${DB_KEY}';
SELECT count(*) FROM sqlite_master;
EOF

if [[ $? -ne 0 ]]; then
    echo "ERROR: Cannot open encrypted database with provided key. Migration failed." >&2
    rm -f "${ENCRYPTED_PATH}"
    exit 1
fi

echo "[*] Replacing original database with encrypted version..."
mv "${ENCRYPTED_PATH}" "${DB_PATH}"
rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"  # WAL/SHM recreated on open

echo "[*] Migration complete."
echo "[*] Original backup: ${DB_PATH}.unencrypted.bak"
echo "[*] Encrypted database: ${DB_PATH}"
echo ""
echo "[!] IMPORTANT: After verifying the application works correctly:"
echo "    1. Securely delete the unencrypted backup:"
echo "       shred -vfz -n 3 ${DB_PATH}.unencrypted.bak"
echo "    2. Store the ARGOS_DB_KEY in a secure location"
echo "    3. If the key is lost, the database is UNRECOVERABLE"
```

#### Step 5: Verify Encryption

```bash
# After migration, the database file should NOT be recognized as SQLite
file rf_signals.db
# Expected: "rf_signals.db: data" (NOT "SQLite 3.x database")

# Attempting to open without key should fail
sqlite3 rf_signals.db "SELECT count(*) FROM sqlite_master;"
# Expected: "Error: file is not a database"

# Opening with sqlcipher and correct key should succeed
sqlcipher rf_signals.db "PRAGMA key = '${ARGOS_DB_KEY}'; SELECT count(*) FROM sqlite_master;"
# Expected: Returns row count (success)
```

## Verification Checklist

1. **SQLCipher package is installed**

    ```bash
    npm list better-sqlite3 2>/dev/null | grep -i sqlcipher
    # Expected: better-sqlite3-sqlcipher or aliased package visible
    ```

2. **ARGOS_DB_KEY environment variable is set**

    ```bash
    test -n "$ARGOS_DB_KEY" && echo "PASS" || echo "FAIL"
    # Expected: PASS
    ```

3. **ARGOS_DB_KEY is NOT committed to git**

    ```bash
    grep -rn "ARGOS_DB_KEY.*=" .env 2>/dev/null | grep -v "^#\|example\|template" | wc -l
    # This is in .env which should be in .gitignore
    git ls-files .env | wc -l
    # Expected: 0 (.env is gitignored)
    ```

4. **Database file is encrypted**

    ```bash
    file rf_signals.db | grep -v "SQLite"
    # Expected: "rf_signals.db: data" (no SQLite header recognized)
    ```

5. **Database is NOT readable without key**

    ```bash
    sqlite3 rf_signals.db "SELECT count(*) FROM sqlite_master;" 2>&1 | grep -c "not a database"
    # Expected: 1
    ```

6. **Application can open and query the encrypted database**

    ```bash
    # Start the Argos application with ARGOS_DB_KEY set
    # Then verify API endpoint works:
    curl -s -H "X-API-Key: $ARGOS_API_KEY" http://localhost:5173/api/system/info | head -1
    # Expected: Valid JSON response (database queries succeed)
    ```

7. **R-tree spatial queries still work**

    ```bash
    # Test spatial query endpoint (requires GPS data in database)
    curl -s -H "X-API-Key: $ARGOS_API_KEY" \
        "http://localhost:5173/api/tactical-map/signals?lat=35.28&lon=-116.67&radius=1000" | head -1
    # Expected: Valid JSON response (R-tree queries succeed through encryption)
    ```

8. **Build verification**

    ```bash
    npm run typecheck && npm run build
    # Expected: Both exit 0 (no type errors from package swap)
    ```

9. **Unencrypted backup is securely deleted**
    ```bash
    ls rf_signals.db.unencrypted.bak 2>/dev/null | wc -l
    # Expected: 0 (backup has been shredded after verification)
    ```

## Commit Strategy

```
security(phase2.2.13): implement data-at-rest encryption with SQLCipher

Phase 2.2 Task 13: Data-at-Rest Encryption (NIST SC-28, AES-256)
- Replaced better-sqlite3 with better-sqlite3-sqlcipher (drop-in)
- PRAGMA key applied as first statement after db.open()
- Migration script for existing unencrypted databases
- ARGOS_DB_KEY env var validation on startup
Verified: file rf_signals.db shows "data" (not SQLite), queries succeed with key

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

## Rollback Strategy

**WARNING**: Rollback from encrypted to unencrypted requires the database key. If the key is lost, the database is unrecoverable.

```bash
# 1. If unencrypted backup still exists:
cp rf_signals.db.unencrypted.bak rf_signals.db

# 2. Revert package change:
git reset --soft HEAD~1
npm install  # Restores original better-sqlite3

# 3. Remove ARGOS_DB_KEY from .env

# 4. If no backup exists, export from encrypted:
sqlcipher rf_signals.db << 'EOF'
PRAGMA key = '<your-key>';
ATTACH DATABASE 'rf_signals.db.decrypted' AS decrypted KEY '';
SELECT sqlcipher_export('decrypted');
DETACH DATABASE decrypted;
EOF
mv rf_signals.db.decrypted rf_signals.db
```

## Risk Assessment

| Risk                                         | Level    | Mitigation                                                                |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| Key loss = permanent data loss               | CRITICAL | Document key backup procedure; store in unit safe / secure key management |
| Migration corrupts database                  | HIGH     | Backup created before migration; verified before replacing original       |
| Performance degradation (5-15%)              | LOW      | Acceptable for security benefit; RPi 5 has adequate CPU headroom          |
| Application crashes if key not set           | MEDIUM   | Startup validation rejects missing/short key with clear error message     |
| Key exposed in environment variable          | MEDIUM   | .env is gitignored; process environment cleared after startup (future)    |
| PRAGMA key SQL injection via DB_KEY          | LOW      | Key validated as hex string (minimum 32 chars); no user-controlled input  |
| better-sqlite3-sqlcipher package unavailable | LOW      | Alternative: @aspect-build/better-sqlite3-sqlcipher; LUKS as fallback     |
| WAL mode incompatible with SQLCipher         | LOW      | SQLCipher supports WAL mode since version 4.0                             |

## Standards Traceability

| Standard        | Control      | Requirement                                | How This Task Satisfies It                                         |
| --------------- | ------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| NIST SP 800-53  | SC-28        | Protection of Information at Rest          | AES-256 encryption of SQLite database containing SIGINT data       |
| NIST SP 800-53  | SC-28(1)     | Cryptographic Protection                   | SQLCipher AES-256-CBC at page level                                |
| NIST SP 800-53  | SC-12        | Cryptographic Key Establishment/Management | ARGOS_DB_KEY via environment variable; backup procedure documented |
| NIST SP 800-53  | SC-13        | Cryptographic Protection                   | AES-256 (FIPS 140-2 approved algorithm)                            |
| NIST SP 800-111 | Section 4    | Storage Encryption Technologies            | Application-layer encryption using vetted cryptographic library    |
| FIPS 140-2      | Level 1      | Approved cryptographic algorithm           | AES-256-CBC (SQLCipher default)                                    |
| DISA STIG       | DATA-REST-01 | Data at rest must be encrypted             | Direct implementation                                              |

## Execution Tracking

| Subtask  | Description                                                    | Status  | Started | Completed | Verified By |
| -------- | -------------------------------------------------------------- | ------- | ------- | --------- | ----------- |
| 2.2.13.1 | Encryption options evaluation (SQLCipher recommended)          | PENDING | --      | --        | --          |
| 2.2.13.2 | SQLCipher implementation (package swap, PRAGMA key, migration) | PENDING | --      | --        | --          |

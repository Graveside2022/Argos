# Database Patterns

## R-tree Spatial Indexing

**Why?** Tactical mapping requires "find all signals within N meters of GPS coordinate" queries.

**Performance:** R-tree provides O(log N) spatial lookups vs O(N) table scans.

## Spatial Query Pattern

**✅ RIGHT - Use R-tree subquery:**

```sql
SELECT * FROM signals
WHERE id IN (
  SELECT id FROM signal_rtree
  WHERE lat >= ? AND lat <= ?
    AND lon >= ? AND lon <= ?
);
```

**❌ WRONG - Full table scan:**

```sql
SELECT * FROM signals
WHERE lat >= ? AND lat <= ?
  AND lon >= ? AND lon <= ?;
```

## Prepared Statements

**✅ RIGHT - Prepare once, execute many:**

```typescript
const stmt = db.prepare('INSERT INTO signals VALUES (?, ?, ?)');
for (const signal of signals) {
	stmt.run(signal.frequency, signal.power, signal.timestamp);
}
```

**❌ WRONG - Prepare for each insert:**

```typescript
for (const signal of signals) {
	db.prepare('INSERT INTO signals VALUES (?, ?, ?)').run(
		signal.frequency,
		signal.power,
		signal.timestamp
	);
}
```

## Migrations

**Location:** [src/lib/server/db/migrations/](../../src/lib/server/db/migrations/)

**Pattern:**

```typescript
// NNN_description.ts
export function up(db: Database) {
	db.exec(`
    ALTER TABLE signals ADD COLUMN new_field TEXT;
    CREATE INDEX idx_new_field ON signals(new_field);
  `);
}

export function down(db: Database) {
	db.exec(`
    DROP INDEX idx_new_field;
    ALTER TABLE signals DROP COLUMN new_field;
  `);
}
```

**Commands:**

- Apply: `npm run db:migrate`
- Rollback: `npm run db:rollback`

**Gotcha:** SQLite has limited ALTER TABLE support. Complex changes require: create new table → copy data → drop old → rename new.

## SQLite Limitations

**Write Concurrency:**

- Only one writer at a time
- WAL mode enabled for better concurrency
- Prepare statements outside transactions

**R-tree Indexes:**

- Require numeric columns (REAL)
- Can't index TEXT columns
- Convert lat/lon to REAL for R-tree

**ALTER TABLE:**

- Can't drop columns (recreate table)
- Can't change types (requires migration)

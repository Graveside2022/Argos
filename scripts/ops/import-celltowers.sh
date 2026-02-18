#!/usr/bin/env bash
# Import OpenCellID cell tower database into local SQLite
# Downloads the full global dump (~500MB gzipped, ~3GB CSV, ~40M rows)
# and loads it into data/celltowers/towers.db for offline tower lookups.
#
# Usage: bash scripts/ops/import-celltowers.sh
# Requires: OPENCELLID_API_KEY in .env (or pass as argument)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_DIR/data/celltowers"
DB_PATH="$DATA_DIR/towers.db"
CSV_GZ="$DATA_DIR/cell_towers.csv.gz"
CSV_FILE="$DATA_DIR/cell_towers.csv"

# Load .env if present
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^#' "$PROJECT_DIR/.env" | grep -v '^\s*$' | sed 's/\s*#.*//')
  set +a
fi

# Accept key from argument, env, or prompt
API_KEY="${1:-${OPENCELLID_API_KEY:-}}"
if [[ -z "$API_KEY" ]]; then
  echo "Error: OPENCELLID_API_KEY not set."
  echo "  Set it in .env, or pass as argument:"
  echo "  bash scripts/ops/import-celltowers.sh pk.your_key_here"
  exit 1
fi

DOWNLOAD_URL="https://opencellid.org/ocid/downloads?token=${API_KEY}&type=full&file=cell_towers.csv.gz"

echo "=== OpenCellID Cell Tower Import ==="
echo "Database: $DB_PATH"
echo ""

mkdir -p "$DATA_DIR"

# --- Download ---
if [[ -f "$CSV_GZ" ]]; then
  echo "[1/4] cell_towers.csv.gz already exists — skipping download"
  echo "  (Delete $CSV_GZ to re-download)"
else
  echo "[1/4] Downloading full cell tower database (~500MB)..."
  echo "  This may take several minutes depending on your connection."
  curl -fSL --progress-bar -o "$CSV_GZ" "$DOWNLOAD_URL"
  echo "  Downloaded: $(du -h "$CSV_GZ" | cut -f1)"
fi

# --- Decompress ---
if [[ -f "$CSV_FILE" ]]; then
  echo "[2/4] cell_towers.csv already exists — skipping decompression"
else
  echo "[2/4] Decompressing (~3GB uncompressed)..."
  gunzip -k "$CSV_GZ"
  echo "  Decompressed: $(du -h "$CSV_FILE" | cut -f1)"
fi

# --- Create database and import ---
echo "[3/4] Creating SQLite database and importing CSV..."
echo "  This will take several minutes on a Raspberry Pi 5."

# Remove old database if it exists
rm -f "$DB_PATH"

# Use sqlite3 CLI for fast bulk import (much faster than row-by-row insert)
# OpenCellID CSV columns: radio,mcc,net,area,cell,unit,lon,lat,range,samples,changeable,created,updated,averageSignal
sqlite3 "$DB_PATH" <<'SQL'
CREATE TABLE towers (
    radio TEXT NOT NULL,
    mcc INTEGER NOT NULL,
    net INTEGER NOT NULL,
    area INTEGER NOT NULL,
    cell INTEGER NOT NULL,
    unit INTEGER,
    lon REAL NOT NULL,
    lat REAL NOT NULL,
    range INTEGER DEFAULT 0,
    samples INTEGER DEFAULT 0,
    changeable INTEGER,
    created INTEGER,
    updated INTEGER,
    averageSignal REAL DEFAULT 0
);

.mode csv
.separator ","
SQL

# Import CSV, skipping the header row
# Use tail to skip header, then pipe into sqlite3 .import
echo "  Importing rows (this is the slow part)..."
TOTAL_LINES=$(wc -l < "$CSV_FILE")
echo "  Total lines in CSV: $TOTAL_LINES"

# Import using sqlite3's .import with stdin
# Skip header line with tail, wrap in a transaction for speed
tail -n +2 "$CSV_FILE" | sqlite3 "$DB_PATH" \
  ".mode csv" \
  ".import /dev/stdin towers"

ROW_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM towers;")
echo "  Imported $ROW_COUNT towers"

# --- Create indexes ---
echo "[4/4] Creating spatial indexes..."
sqlite3 "$DB_PATH" <<'SQL'
-- Spatial index on lat/lon for bounding-box queries (the main query pattern)
CREATE INDEX idx_towers_lat_lon ON towers (lat, lon);

-- Index for tower identity lookups (GSM Evil tower location)
CREATE INDEX idx_towers_identity ON towers (mcc, net, area, cell);

-- Analyze for query planner
ANALYZE;
SQL

DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
echo ""
echo "=== Import Complete ==="
echo "  Database: $DB_PATH ($DB_SIZE)"
echo "  Towers:   $ROW_COUNT"
echo ""
echo "  You can now see cell towers on the Argos map."
echo "  To refresh the data later, delete $CSV_GZ and re-run this script."

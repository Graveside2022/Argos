#!/usr/bin/env bash
# Extract DTED Level 0 tiles from a zip archive.
# Usage: bash scripts/ops/extract-dted.sh <zip-path> [output-dir]
# Example: bash scripts/ops/extract-dted.sh docs/dtedlevel0.zip data/dted
set -euo pipefail

ZIP_PATH="${1:?Usage: $0 <zip-path> [output-dir]}"
OUTPUT_DIR="${2:-data/dted}"

if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Error: $ZIP_PATH not found" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
echo "Extracting $ZIP_PATH → $OUTPUT_DIR ..."
unzip -qo "$ZIP_PATH" -d "$OUTPUT_DIR"

COUNT=$(find "$OUTPUT_DIR" -name '*.dt0' | wc -l)
if [[ "$COUNT" -eq 0 ]]; then
  echo "Error: No .dt0 files found after extraction" >&2
  exit 1
fi

# Coverage summary from directory/file names
MIN_LON=$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | head -1)
MAX_LON=$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | tail -1)
MIN_LAT=$(find "$OUTPUT_DIR" -mindepth 2 -name '*.dt0' -printf '%f\n' | sed 's/\.dt0$//' | sort -u | head -1)
MAX_LAT=$(find "$OUTPUT_DIR" -mindepth 2 -name '*.dt0' -printf '%f\n' | sed 's/\.dt0$//' | sort -u | tail -1)

echo "Extracted $COUNT tiles"
echo "Coverage: lat $MIN_LAT–$MAX_LAT, lon $MIN_LON–$MAX_LON"

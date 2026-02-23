-- Migration 003: Add Composite Spatial+Timestamp Index
-- Eliminates post-filter sort step on spatial queries by combining
-- the spatial grid coordinates with timestamp ordering in one index.

CREATE INDEX IF NOT EXISTS idx_signals_spatial_timestamp
ON signals(
  CAST(latitude * 10000 AS INTEGER),
  CAST(longitude * 10000 AS INTEGER),
  timestamp DESC
);

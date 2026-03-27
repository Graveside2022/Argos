-- Add composite index for spatial+time queries to avoid post-filter scans
CREATE INDEX IF NOT EXISTS idx_signals_location_time
  ON signals(latitude, longitude, timestamp);

-- Migration: Add altitude column to signals table
-- This migration adds altitude tracking to signals
-- It uses a safe approach that won't fail if the column already exists

-- Add altitude column to signals table
-- Default value is 0 (ground level)
ALTER TABLE signals ADD COLUMN altitude REAL DEFAULT 0;

-- Update existing records to have altitude 0 (ground level)
UPDATE signals SET altitude = 0 WHERE altitude IS NULL;

-- Create index for altitude-based queries (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_signals_altitude ON signals(altitude);
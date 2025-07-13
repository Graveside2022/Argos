-- Migration 001: Add Cleanup and Optimization Features
-- This migration adds aggregation tables, cleanup triggers, and maintenance views

-- The migrations table is managed by the migration runner
-- Migration will be tracked automatically when applied

-- ============================================
-- ADD MISSING COLUMNS (if they don't exist)
-- ============================================

-- SQLite doesn't support IF NOT EXISTS for columns, so we'll handle this in application code

-- ============================================
-- CREATE AGGREGATION TABLES
-- ============================================

-- Hourly signal statistics
CREATE TABLE IF NOT EXISTS signal_stats_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour_timestamp INTEGER NOT NULL,
    total_signals INTEGER NOT NULL,
    unique_devices INTEGER NOT NULL,
    avg_power REAL,
    min_power REAL,
    max_power REAL,
    dominant_frequency REAL,
    coverage_area REAL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(hour_timestamp)
);

-- Daily device summary
CREATE TABLE IF NOT EXISTS device_stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_timestamp INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    signal_count INTEGER NOT NULL,
    avg_power REAL,
    freq_min REAL,
    freq_max REAL,
    first_seen_hour INTEGER,
    last_seen_hour INTEGER,
    active_hours INTEGER,
    avg_lat REAL,
    avg_lon REAL,
    movement_distance REAL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(day_timestamp, device_id)
);

-- Network activity summary
CREATE TABLE IF NOT EXISTS network_stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_timestamp INTEGER NOT NULL,
    network_id TEXT NOT NULL,
    device_count INTEGER NOT NULL,
    connection_count INTEGER NOT NULL,
    avg_signal_strength REAL,
    peak_hour INTEGER,
    total_data_points INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(day_timestamp, network_id)
);

-- Spatial heatmap aggregation
CREATE TABLE IF NOT EXISTS spatial_heatmap_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hour_timestamp INTEGER NOT NULL,
    grid_lat INTEGER NOT NULL,
    grid_lon INTEGER NOT NULL,
    signal_count INTEGER NOT NULL,
    unique_devices INTEGER NOT NULL,
    avg_power REAL,
    dominant_source TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(hour_timestamp, grid_lat, grid_lon)
);

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_signal_stats_hourly_timestamp ON signal_stats_hourly(hour_timestamp);
CREATE INDEX IF NOT EXISTS idx_device_stats_daily_timestamp ON device_stats_daily(day_timestamp);
CREATE INDEX IF NOT EXISTS idx_device_stats_daily_device ON device_stats_daily(device_id);
CREATE INDEX IF NOT EXISTS idx_network_stats_daily_timestamp ON network_stats_daily(day_timestamp);
CREATE INDEX IF NOT EXISTS idx_spatial_heatmap_grid ON spatial_heatmap_hourly(grid_lat, grid_lon);

-- ============================================
-- CREATE CLEANUP TRIGGERS
-- ============================================

-- Update device stats on signal insert
DROP TRIGGER IF EXISTS update_device_stats;
CREATE TRIGGER update_device_stats
AFTER INSERT ON signals
BEGIN
    UPDATE devices 
    SET 
        last_seen = NEW.timestamp,
        avg_power = CASE 
            WHEN avg_power IS NULL THEN NEW.power
            ELSE (avg_power * (
                SELECT COUNT(*) - 1 FROM signals WHERE device_id = NEW.device_id
            ) + NEW.power) / (
                SELECT COUNT(*) FROM signals WHERE device_id = NEW.device_id
            )
        END,
        freq_min = CASE 
            WHEN freq_min IS NULL OR NEW.frequency < freq_min THEN NEW.frequency 
            ELSE freq_min 
        END,
        freq_max = CASE 
            WHEN freq_max IS NULL OR NEW.frequency > freq_max THEN NEW.frequency 
            ELSE freq_max 
        END
    WHERE device_id = NEW.device_id;
END;

-- Cleanup orphaned relationships
DROP TRIGGER IF EXISTS cleanup_orphaned_relationships;
CREATE TRIGGER cleanup_orphaned_relationships
AFTER DELETE ON devices
BEGIN
    DELETE FROM relationships 
    WHERE source_device_id = OLD.device_id 
       OR target_device_id = OLD.device_id;
END;

-- Cleanup pattern associations
DROP TRIGGER IF EXISTS cleanup_pattern_signals;
CREATE TRIGGER cleanup_pattern_signals
AFTER DELETE ON signals
BEGIN
    DELETE FROM pattern_signals WHERE signal_id = OLD.signal_id;
    
    DELETE FROM patterns 
    WHERE pattern_id IN (
        SELECT p.pattern_id 
        FROM patterns p
        LEFT JOIN pattern_signals ps ON p.pattern_id = ps.pattern_id
        WHERE ps.pattern_id IS NULL
    );
END;

-- ============================================
-- CREATE MAINTENANCE VIEWS
-- ============================================

-- Retention policy violations
CREATE VIEW IF NOT EXISTS retention_policy_violations AS
SELECT 
    'signals' as table_name,
    signal_id as record_id,
    timestamp,
    CASE 
        WHEN source = 'hackrf' AND frequency > 2400 THEN timestamp + 3600000
        WHEN source IN ('kismet', 'wifi') THEN timestamp + 604800000
        ELSE timestamp + 3600000
    END as expires_at,
    strftime('%s', 'now') * 1000 as current_time
FROM signals
WHERE timestamp < (strftime('%s', 'now') * 1000 - 
    CASE 
        WHEN source = 'hackrf' AND frequency > 2400 THEN 3600000
        WHEN source IN ('kismet', 'wifi') THEN 604800000
        ELSE 3600000
    END
);

-- Inactive devices
CREATE VIEW IF NOT EXISTS inactive_devices AS
SELECT 
    device_id,
    type,
    last_seen,
    (strftime('%s', 'now') * 1000 - last_seen) / 86400000.0 as days_inactive
FROM devices
WHERE last_seen < (strftime('%s', 'now') * 1000 - 604800000);

-- Expired patterns
CREATE VIEW IF NOT EXISTS expired_patterns AS
SELECT * FROM patterns
WHERE expires_at IS NOT NULL 
  AND expires_at < strftime('%s', 'now') * 1000;

-- Cleanup candidates
DROP VIEW IF EXISTS signals_to_delete;
CREATE VIEW IF NOT EXISTS signals_to_delete AS
SELECT record_id as signal_id
FROM retention_policy_violations
WHERE table_name = 'signals';

CREATE VIEW IF NOT EXISTS devices_to_delete AS
SELECT d.device_id
FROM devices d
WHERE NOT EXISTS (
    SELECT 1 FROM signals s 
    WHERE s.device_id = d.device_id 
    AND s.timestamp > (strftime('%s', 'now') * 1000 - 604800000)
);

CREATE VIEW IF NOT EXISTS relationships_to_delete AS
SELECT r.id
FROM relationships r
WHERE NOT EXISTS (SELECT 1 FROM devices WHERE device_id = r.source_device_id)
   OR NOT EXISTS (SELECT 1 FROM devices WHERE device_id = r.target_device_id);

-- Database statistics
CREATE VIEW IF NOT EXISTS table_sizes AS
SELECT 
    'devices' as table_name,
    COUNT(*) as row_count
FROM devices
UNION ALL
SELECT 'signals', COUNT(*) FROM signals
UNION ALL
SELECT 'relationships', COUNT(*) FROM relationships
UNION ALL
SELECT 'patterns', COUNT(*) FROM patterns
UNION ALL
SELECT 'networks', COUNT(*) FROM networks;

-- Data growth trends
CREATE VIEW IF NOT EXISTS data_growth_hourly AS
SELECT 
    strftime('%Y-%m-%d %H:00:00', timestamp/1000, 'unixepoch') as hour,
    COUNT(*) as signal_count,
    COUNT(DISTINCT device_id) as unique_devices
FROM signals
WHERE timestamp > (strftime('%s', 'now') * 1000 - 86400000)
GROUP BY strftime('%Y-%m-%d %H:00:00', timestamp/1000, 'unixepoch')
ORDER BY hour DESC;
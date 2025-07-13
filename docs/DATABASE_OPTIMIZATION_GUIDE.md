# Database Cleanup and Optimization Strategy

## Overview

This document outlines the comprehensive database cleanup and optimization strategy implemented for the Argos RF Signal Database. The strategy is designed specifically for SQLite on Raspberry Pi hardware, focusing on efficient data retention, automatic cleanup, and performance optimization.

## Architecture

### 1. Data Retention Policies

Different data types have different retention periods based on their value and storage requirements:

- **HackRF High-Frequency Data**: 24 hours (high volume, low long-term value)
- **WiFi/Kismet Signals**: 7 days (moderate volume, network tracking)
- **Unknown Signals**: 3 days (default retention)
- **Device Records**: 7 days after last signal
- **Pattern Data**: Configurable expiry (default 24 hours)

### 2. Aggregation Tables

To maintain historical insights while reducing storage:

- **signal_stats_hourly**: Hourly summaries of signal activity
- **device_stats_daily**: Daily device behavior patterns
- **network_stats_daily**: Network activity summaries
- **spatial_heatmap_hourly**: Geographic distribution data

### 3. Automatic Cleanup Features

#### Database Triggers

- `update_device_stats`: Maintains device statistics automatically
- `cleanup_orphaned_relationships`: Removes invalid relationships
- `cleanup_pattern_signals`: Cleans up pattern associations

#### Cleanup Views

- `retention_policy_violations`: Identifies data past retention
- `signals_to_delete`: Signals ready for cleanup
- `devices_to_delete`: Inactive devices
- `relationships_to_delete`: Orphaned relationships

### 4. Service Implementation

#### DatabaseCleanupService

- Automatic scheduled cleanup
- Configurable retention policies
- Batch processing for performance
- Transaction-based consistency

#### DatabaseOptimizer

- SQLite-specific optimizations
- Query performance tracking
- Index analysis and suggestions
- Workload-based tuning

## Usage

### Manual Operations

#### Command Line

```bash
# Run cleanup manually
./scripts/db-cleanup.sh

# Run cleanup without backup
./scripts/db-cleanup.sh --no-backup

# Create backup only
./scripts/db-backup.sh

# Setup cron jobs
./scripts/setup-db-cron.sh
```

#### API Endpoints

```bash
# Get cleanup status
curl http://localhost:5173/api/db/cleanup?action=status

# Run manual cleanup
curl http://localhost:5173/api/db/cleanup?action=manual

# Run VACUUM
curl http://localhost:5173/api/db/cleanup?action=vacuum

# Get optimization suggestions
curl http://localhost:5173/api/db/cleanup?action=optimize

# Export aggregated data (last 7 days)
curl http://localhost:5173/api/db/cleanup?action=export&days=7
```

### Automatic Operations

The system automatically:

- Runs cleanup every hour
- Aggregates data every 10 minutes
- Creates daily backups at 2 AM
- Runs VACUUM daily at 3 AM

## Configuration

### Cleanup Service Configuration

```typescript
{
  hackrfRetention: 24 * 60 * 60 * 1000,     // 24 hours
  wifiRetention: 7 * 24 * 60 * 60 * 1000,   // 7 days
  defaultRetention: 3 * 24 * 60 * 60 * 1000, // 3 days
  cleanupInterval: 60 * 60 * 1000,           // Every hour
  aggregateInterval: 10 * 60 * 1000,         // Every 10 minutes
  batchSize: 500,                            // Records per batch
  maxRuntime: 20000                          // 20 seconds max
}
```

### Optimizer Configuration

```typescript
{
  cacheSize: -2000,        // 2MB cache
  walMode: true,           // Write-Ahead Logging
  synchronous: 'NORMAL',   // Balance safety/speed
  mmapSize: 30000000,      // 30MB memory map
  memoryLimit: 50MB        // Soft heap limit
}
```

## Performance Considerations

### For Raspberry Pi

- Smaller batch sizes (500 records)
- Limited memory usage (50MB soft limit)
- Shorter cleanup runtime (20 seconds)
- Conservative cache settings (2MB)

### Optimization Tips

1. Monitor fragmentation with health reports
2. Adjust retention policies based on storage
3. Use workload optimization for your use case
4. Schedule heavy operations during low activity

## Monitoring

### Health Checks

```javascript
// Get database health report
const health = await fetch('/api/db/cleanup?action=status');
const report = await health.json();

// Check key metrics
console.log('Database size:', report.health.database_size);
console.log('Fragmentation:', report.stats.fragmentation);
console.log('Slow queries:', report.health.slow_queries);
```

### Backup Status

Check `/backups/backup_status.json` for:

- Last backup timestamp
- Backup file locations
- Compression statistics
- Available backup count

## Troubleshooting

### High Database Growth

1. Check retention policies
2. Verify cleanup is running
3. Look for stuck transactions
4. Review aggregation settings

### Poor Performance

1. Run ANALYZE to update statistics
2. Check index recommendations
3. Review slow query log
4. Consider workload optimization

### Backup Issues

1. Verify disk space
2. Check file permissions
3. Review backup logs
4. Test backup integrity

## SQLite Alternatives

If SQLite limitations become problematic, consider:

1. **PostgreSQL with TimescaleDB**
    - Better for time-series data
    - Advanced partitioning
    - Parallel queries
    - Requires more resources

2. **InfluxDB**
    - Purpose-built for time-series
    - Automatic retention policies
    - Built-in aggregations
    - Higher memory usage

3. **DuckDB**
    - Column-oriented storage
    - Better analytics performance
    - SQLite-compatible
    - Good for historical queries

## Migration Path

To migrate to another database:

1. Export aggregated data using the API
2. Use the provided SQL schema as reference
3. Adjust data types for target database
4. Migrate indexes and triggers
5. Update connection configuration

The modular design allows switching databases with minimal code changes.

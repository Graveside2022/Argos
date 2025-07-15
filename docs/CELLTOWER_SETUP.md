# Cell Tower Location Setup

This guide explains how to set up the offline cell tower location database for Argos.

## Overview

Argos includes cell tower location lookup functionality that works completely offline using the OpenCellID database. This allows you to:

- Get GPS coordinates for any cell tower based on MCC-MNC-LAC-CI
- Identify suspicious or fake towers
- Display tower locations on the tactical map
- Work without internet connection

## Setup Options

### Option 1: Use Sample Database (Immediate)

For testing, a sample database with towers from major countries is included:

```bash
./scripts/create-sample-celltower-db.sh
```

This creates a small database with sample towers from USA, Germany, Iran, UK, and other countries.

### Option 2: Download Full OpenCellID Database (Recommended)

For production use, download the complete OpenCellID database with millions of towers worldwide:

```bash
./scripts/download-opencellid-full.sh
```

**Note**: OpenCellID limits downloads to 2 per day. The download is ~100MB compressed and expands to ~600MB.

## API Key

The scripts include the OpenCellID API key: `pk.d6291c07a2907c915cd8994fb22bc189`

## Database Location

The cell tower database is stored at:
```
/home/ubuntu/projects/Argos/data/celltowers/towers.db
```

## Usage

### In GSM Evil Page

1. Captured IMSIs automatically show location data
2. Click "Lookup" button to fetch coordinates for unknown towers
3. Coordinates appear in the table as lat/long

### In Tactical Map

1. Click "Towers" button to toggle cell tower display
2. Tower icons appear on map with color coding:
   - Green: Known legitimate tower
   - Orange: Unknown carrier
   - Red: Suspicious/fake MCC
3. Click tower icons for detailed information

## Database Schema

```sql
CREATE TABLE cell_towers (
    radio TEXT,        -- Network type (GSM, UMTS, LTE, etc)
    mcc INTEGER,       -- Mobile Country Code
    mnc INTEGER,       -- Mobile Network Code
    area INTEGER,      -- Location Area Code (LAC)
    cell INTEGER,      -- Cell Identity (CI)
    unit INTEGER,      -- Physical Cell ID
    lon REAL,          -- Longitude
    lat REAL,          -- Latitude
    range INTEGER,     -- Estimated range in meters
    samples INTEGER,   -- Number of measurements
    changeable INTEGER,-- Tower mobility flag
    created INTEGER,   -- First seen timestamp
    updated INTEGER,   -- Last update timestamp
    averageSignal INTEGER -- Average signal strength
);
```

## Troubleshooting

### Rate Limited Error

If you see "RATE_LIMITED" error, you've exceeded the 2 downloads per day limit. Wait 24 hours or use the sample database.

### Database Not Found

Ensure SQLite is installed:
```bash
sudo apt-get install sqlite3
```

### Lookup Returns No Results

The tower may be new or not in the OpenCellID database. The database is community-sourced and may not have every tower.

## Security Considerations

Cell tower location data helps identify:

1. **Fake Towers**: MCCs like 001, 999 are test/fake codes
2. **IMSI Catchers**: Unknown carriers or towers appearing suddenly
3. **Tower Movement**: Legitimate towers don't move - track location changes
4. **Coverage Holes**: Areas without expected tower coverage

## Updates

To update the database with new tower data:

1. Delete the existing database
2. Run the download script again
3. The script will download the latest data

Remember the 2 downloads per day limit!
#!/usr/bin/env python3
"""
This script is deprecated - OpenCellID database has been imported locally
"""

print("=" * 60)
print("NOTICE: OpenCellID database is already available locally!")
print("=" * 60)
print()
print("The cell tower database has been imported and is available at:")
print("  /home/ubuntu/projects/Argos/data/celltowers/towers.db")
print()
print("Database Statistics:")
print("  - 820,000+ cell towers worldwide")
print("  - Includes GSM, UMTS, LTE, and CDMA towers")
print("  - Real latitude/longitude coordinates")
print("  - No API key needed - fully offline operation")
print()
print("To query the database:")
print("  sqlite3 /home/ubuntu/projects/Argos/data/celltowers/towers.db")
print()
print("Example query:")
print('  SELECT * FROM towers WHERE mcc=310 AND net=260 LIMIT 5;')
print()
print("=" * 60)
#!/usr/bin/env python3
"""
Import OpenCellID CSV data into SQLite database
"""

import sqlite3
import csv
import sys
import os
from datetime import datetime

def create_database(db_path):
    """Create the towers database with proper schema"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Drop existing table if it exists
    cursor.execute("DROP TABLE IF EXISTS towers")
    
    # Create table with OpenCellID schema
    cursor.execute("""
        CREATE TABLE towers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            radio TEXT,
            mcc INTEGER,
            net INTEGER,  -- mnc
            area INTEGER,  -- lac
            cell INTEGER,  -- ci
            unit INTEGER,
            lon REAL,
            lat REAL,
            range INTEGER,
            samples INTEGER,
            changeable INTEGER,
            created INTEGER,
            updated INTEGER,
            averageSignal INTEGER
        )
    """)
    
    # Create indexes for performance
    cursor.execute("CREATE INDEX idx_mcc_net ON towers(mcc, net)")
    cursor.execute("CREATE INDEX idx_area_cell ON towers(area, cell)")
    cursor.execute("CREATE INDEX idx_lat_lon ON towers(lat, lon)")
    
    conn.commit()
    return conn

def import_csv(conn, csv_path):
    """Import CSV data into the database"""
    cursor = conn.cursor()
    
    print(f"Reading CSV file: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        
        batch = []
        batch_size = 10000
        total_rows = 0
        
        for row in reader:
            # Convert data types
            record = (
                row['radio'],
                int(row['mcc']) if row['mcc'] else None,
                int(row['net']) if row['net'] else None,
                int(row['area']) if row['area'] else None,
                int(row['cell']) if row['cell'] else None,
                int(row['unit']) if row['unit'] else 0,
                float(row['lon']) if row['lon'] else None,
                float(row['lat']) if row['lat'] else None,
                int(row['range']) if row['range'] else None,
                int(row['samples']) if row['samples'] else None,
                int(row['changeable']) if row['changeable'] else None,
                int(row['created']) if row['created'] else None,
                int(row['updated']) if row['updated'] else None,
                int(row['averageSignal']) if row['averageSignal'] else None
            )
            
            batch.append(record)
            
            if len(batch) >= batch_size:
                cursor.executemany("""
                    INSERT INTO towers (radio, mcc, net, area, cell, unit, lon, lat, 
                                      range, samples, changeable, created, updated, averageSignal)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, batch)
                conn.commit()
                total_rows += len(batch)
                print(f"Imported {total_rows:,} rows...", end='\r')
                batch = []
        
        # Insert remaining records
        if batch:
            cursor.executemany("""
                INSERT INTO towers (radio, mcc, net, area, cell, unit, lon, lat, 
                                  range, samples, changeable, created, updated, averageSignal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            conn.commit()
            total_rows += len(batch)
        
        print(f"\nTotal rows imported: {total_rows:,}")

def verify_import(conn):
    """Verify the import and show some statistics"""
    cursor = conn.cursor()
    
    # Total count
    cursor.execute("SELECT COUNT(*) FROM towers")
    total = cursor.fetchone()[0]
    print(f"\nDatabase contains {total:,} cell towers")
    
    # Sample data
    print("\nSample data:")
    cursor.execute("SELECT radio, mcc, net, area, cell, lat, lon FROM towers LIMIT 5")
    for row in cursor.fetchall():
        print(f"  {row}")
    
    # Statistics by radio type
    print("\nTowers by radio type:")
    cursor.execute("SELECT radio, COUNT(*) as count FROM towers GROUP BY radio ORDER BY count DESC")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]:,}")
    
    # Statistics by country (MCC)
    print("\nTop 10 countries by tower count:")
    cursor.execute("""
        SELECT mcc, COUNT(*) as count 
        FROM towers 
        GROUP BY mcc 
        ORDER BY count DESC 
        LIMIT 10
    """)
    for row in cursor.fetchall():
        print(f"  MCC {row[0]}: {row[1]:,} towers")

def main():
    csv_path = "/home/ubuntu/projects/Argos/data/celltowers/cell_towers.csv"
    db_path = "/home/ubuntu/projects/Argos/data/celltowers/towers.db"
    
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        sys.exit(1)
    
    print(f"Creating database at {db_path}")
    conn = create_database(db_path)
    
    print("Starting import...")
    start_time = datetime.now()
    import_csv(conn, csv_path)
    end_time = datetime.now()
    
    print(f"\nImport completed in {end_time - start_time}")
    
    verify_import(conn)
    conn.close()
    
    # Remove the CSV file to save space
    print("\nRemoving CSV file to save space...")
    os.remove(csv_path)
    print("Done!")

if __name__ == "__main__":
    main()
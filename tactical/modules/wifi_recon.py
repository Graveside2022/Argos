#!/usr/bin/env python3
"""
wifi_recon — Query Kismet-populated rf_signals.db for WiFi targets.

Source: Argos-native (not in PentAGI or Artemis).
CLI deps: none (pure SQLite queries)
Output: List of WiFi APs and clients with signal strength, SSID, encryption, channel.

This is the starting point for most WiFi kill chains — it queries the
devices, signals, and networks tables that Kismet populates in real time.
"""

import json
import sqlite3

from base_module import TacticalModule


class WiFiRecon(TacticalModule):
    name = "wifi_recon"
    description = "Query Kismet DB for WiFi targets (APs and clients)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--min-signal",
            type=float,
            default=-80.0,
            help="Minimum signal strength in dBm (default: -80)",
        )
        self.parser.add_argument(
            "--type",
            choices=["ap", "client", "all"],
            default="all",
            help="Filter by device type (default: all)",
        )
        self.parser.add_argument(
            "--max-age",
            type=int,
            default=3600,
            help="Max age in seconds — only devices seen within this window (default: 3600)",
        )
        self.parser.add_argument(
            "--ssid",
            help="Filter by SSID substring (case-insensitive)",
        )
        self.parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="Maximum number of results (default: 100)",
        )

    def run(self, args) -> None:
        db_path = args.db_path

        if not db_path:
            self.output_error("No database path specified")
            return

        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
        except sqlite3.Error as e:
            self.output_error(f"Cannot open database: {e}")
            return

        try:
            targets = self._query_targets(conn, args)
            networks = self._query_networks(conn, args)

            self.output_success({
                "targets": targets,
                "networks": networks,
                "count": len(targets),
                "network_count": len(networks),
                "filters": {
                    "min_signal": args.min_signal,
                    "type": args.type,
                    "max_age": args.max_age,
                    "ssid": args.ssid,
                },
            })
        except sqlite3.Error as e:
            self.output_error(f"Query failed: {e}")
        finally:
            conn.close()

    def _query_targets(self, conn: sqlite3.Connection, args) -> list[dict]:
        """Query devices table joined with latest signal data."""
        import time

        cutoff_ms = (int(time.time()) - args.max_age) * 1000

        query = """
            SELECT
                d.device_id,
                d.type,
                d.manufacturer,
                d.first_seen,
                d.last_seen,
                d.avg_power,
                d.freq_min,
                d.freq_max,
                d.metadata,
                s.power AS last_signal_dbm,
                s.frequency AS last_freq_mhz,
                s.latitude,
                s.longitude
            FROM devices d
            LEFT JOIN signals s ON d.device_id = s.device_id
                AND s.id = (
                    SELECT id FROM signals
                    WHERE device_id = d.device_id
                    ORDER BY timestamp DESC LIMIT 1
                )
            WHERE d.last_seen >= ?
        """
        params: list = [cutoff_ms]

        if args.type != "all":
            query += " AND d.type = ?"
            params.append(args.type)

        if args.min_signal:
            query += " AND (d.avg_power >= ? OR d.avg_power IS NULL)"
            params.append(args.min_signal)

        query += " ORDER BY d.last_seen DESC LIMIT ?"
        params.append(args.limit)

        rows = conn.execute(query, params).fetchall()
        targets = []

        for row in rows:
            # Parse metadata JSON for SSID, encryption, channel
            metadata = {}
            if row["metadata"]:
                try:
                    metadata = json.loads(row["metadata"])
                except json.JSONDecodeError:
                    pass

            ssid = metadata.get("ssid", metadata.get("name", ""))
            encryption = metadata.get("encryption", metadata.get("crypt", ""))
            channel = metadata.get("channel", None)

            # Apply SSID filter if specified
            if args.ssid and args.ssid.lower() not in (ssid or "").lower():
                continue

            targets.append({
                "device_id": row["device_id"],
                "type": row["type"],
                "manufacturer": row["manufacturer"],
                "first_seen": row["first_seen"],
                "last_seen": row["last_seen"],
                "signal_dbm": row["last_signal_dbm"] or row["avg_power"],
                "frequency_mhz": row["last_freq_mhz"] or row["freq_min"],
                "ssid": ssid,
                "encryption": encryption,
                "channel": channel,
                "latitude": row["latitude"],
                "longitude": row["longitude"],
            })

        return targets

    def _query_networks(self, conn: sqlite3.Connection, args) -> list[dict]:
        """Query networks table for WiFi network summaries."""
        import time

        cutoff_ms = (int(time.time()) - args.max_age) * 1000

        query = """
            SELECT
                n.network_id,
                n.name AS ssid,
                n.encryption,
                n.channel,
                n.first_seen,
                n.last_seen,
                n.center_lat,
                n.center_lon,
                COUNT(DISTINCT r.source_device_id) + COUNT(DISTINCT r.target_device_id) AS device_count
            FROM networks n
            LEFT JOIN relationships r ON n.network_id = r.network_id
            WHERE n.type = 'wifi'
              AND n.last_seen >= ?
        """
        params: list = [cutoff_ms]

        if args.ssid:
            query += " AND n.name LIKE ?"
            params.append(f"%{args.ssid}%")

        query += " GROUP BY n.network_id ORDER BY n.last_seen DESC LIMIT ?"
        params.append(args.limit)

        rows = conn.execute(query, params).fetchall()
        return [
            {
                "network_id": row["network_id"],
                "ssid": row["ssid"],
                "encryption": row["encryption"],
                "channel": row["channel"],
                "first_seen": row["first_seen"],
                "last_seen": row["last_seen"],
                "center_lat": row["center_lat"],
                "center_lon": row["center_lon"],
                "device_count": row["device_count"],
            }
            for row in rows
        ]


if __name__ == "__main__":
    WiFiRecon().execute()

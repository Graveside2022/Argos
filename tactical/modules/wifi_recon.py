#!/usr/bin/env python3
"""
wifi_recon — Enumerate WiFi targets from Kismet capture databases.

Source: Argos-native (not in PentAGI or Artemis).
CLI deps: none (pure SQLite queries)
Output: List of WiFi APs and clients with signal strength, SSID, encryption, channel.

Supports TWO database formats:
  1. Kismet native .kismet files (raw JSON blobs in `devices` table)
  2. Argos rf_signals.db (devices/signals/networks tables)

Auto-detects format by checking which tables exist. Prefers Kismet native
files because they contain richer data (probed SSIDs, full device JSON).

Kismet can capture multiple PHY types beyond WiFi:
  - IEEE802.11 (WiFi) — requires monitor-mode WiFi adapter
  - Bluetooth (BTLE/BR/EDR) — requires hci adapter + kismet_cap_linux_bluetooth
  - Zigbee — requires compatible hardware
  - Other RF sources via plugins

This module queries whatever PHY types are present in the database.
"""

import glob
import json
import os
import sqlite3
import time

from base_module import TacticalModule

# Kismet type strings → normalized type
KISMET_TYPE_MAP = {
    "Wi-Fi AP": "ap",
    "Wi-Fi Client": "client",
    "Wi-Fi Bridged": "bridged",
    "Wi-Fi Ad-Hoc": "adhoc",
    "Wi-Fi Device": "device",
    # Bluetooth types
    "BR/EDR": "bt-classic",
    "BTLE": "bt-le",
    "Bt": "bt-generic",
}

# 2.4 GHz channel → frequency mapping (MHz)
CHANNEL_FREQ_24 = {2412: 1, 2417: 2, 2422: 3, 2427: 4, 2432: 5,
                   2437: 6, 2442: 7, 2447: 8, 2452: 9, 2457: 10,
                   2462: 11, 2467: 12, 2472: 13, 2484: 14}

# WiFi bands by frequency
def _freq_to_band(freq_khz: int) -> str:
    freq_mhz = freq_khz / 1000 if freq_khz > 100000 else freq_khz
    if freq_mhz < 2500:
        return "2.4GHz"
    elif freq_mhz < 5900:
        return "5GHz"
    elif freq_mhz < 7200:
        return "6GHz"
    return "unknown"


class WiFiRecon(TacticalModule):
    name = "wifi_recon"
    description = "Query Kismet DB for WiFi targets (APs and clients)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--kismet-db",
            help="Path to a Kismet .kismet capture file. If omitted, "
                 "auto-discovers the most recent .kismet file in ~ or uses --db-path.",
        )
        self.parser.add_argument(
            "--min-signal",
            type=float,
            default=-90.0,
            help="Minimum signal strength in dBm (default: -90)",
        )
        self.parser.add_argument(
            "--type",
            choices=["ap", "client", "bridged", "adhoc", "all"],
            default="all",
            help="Filter by device type (default: all)",
        )
        self.parser.add_argument(
            "--max-age",
            type=int,
            default=86400,
            help="Max age in seconds — only devices seen within this window (default: 86400)",
        )
        self.parser.add_argument(
            "--ssid",
            help="Filter by SSID substring (case-insensitive). Also matches probed SSIDs.",
        )
        self.parser.add_argument(
            "--manufacturer",
            help="Filter by manufacturer/vendor substring (case-insensitive)",
        )
        self.parser.add_argument(
            "--channel",
            help="Filter by channel number (e.g., '6') or band ('2.4GHz', '5GHz')",
        )
        self.parser.add_argument(
            "--encryption",
            choices=["open", "wep", "wpa", "wpa2", "wpa3", "any"],
            default=None,
            help="Filter by encryption type",
        )
        self.parser.add_argument(
            "--has-clients",
            action="store_true",
            help="Only show APs that have associated clients (useful for target prioritization)",
        )
        self.parser.add_argument(
            "--cloaked",
            action="store_true",
            help="Only show APs with hidden/cloaked SSIDs",
        )
        self.parser.add_argument(
            "--wps",
            action="store_true",
            help="Only show APs with WPS enabled (attackable with reaver/bully)",
        )
        self.parser.add_argument(
            "--min-data",
            type=int,
            default=0,
            help="Minimum data bytes transferred (filters out idle devices)",
        )
        self.parser.add_argument(
            "--phy",
            choices=["wifi", "bluetooth", "all"],
            default="wifi",
            help="PHY type to query (default: wifi). Use 'bluetooth' if Kismet captured BT, "
                 "'all' for everything.",
        )
        self.parser.add_argument(
            "--limit",
            type=int,
            default=200,
            help="Maximum number of results (default: 200)",
        )
        self.parser.add_argument(
            "--sort",
            choices=["signal", "last_seen", "data", "packets", "clients"],
            default="signal",
            help="Sort results by field (default: signal)",
        )
        self.parser.add_argument(
            "--with-gps",
            action="store_true",
            help="Only show devices that have GPS coordinates",
        )
        self.parser.add_argument(
            "--report",
            metavar="FILE",
            help="Write a formatted Markdown report to FILE (view with: batcat FILE)",
        )
        self.parser.add_argument(
            "--connected-to",
            metavar="BSSID",
            help="Show only clients connected to this AP BSSID",
        )
        self.parser.add_argument(
            "--show-clients",
            action="store_true",
            help="Include associated client MACs for each AP in output",
        )
        self.parser.add_argument(
            "--alerts",
            action="store_true",
            help="Include Kismet alerts (deauth floods, source errors, etc.) in report",
        )

    def run(self, args) -> None:
        kismet_db = self._resolve_kismet_db(args)
        argos_db = args.db_path

        targets = []
        networks = []
        source = "none"
        phy_summary = {}

        alerts: list[dict] = []

        # Prefer Kismet native DB
        if kismet_db:
            try:
                conn = sqlite3.connect(f"file:{kismet_db}?mode=ro", uri=True)
                conn.row_factory = sqlite3.Row
                tables = {r[0] for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()}

                if "devices" in tables and "KISMET" in tables:
                    self.logger.info("Using Kismet native DB: %s", kismet_db)
                    # Get PHY summary before filtering
                    phy_rows = conn.execute(
                        "SELECT phyname, COUNT(*) FROM devices GROUP BY phyname"
                    ).fetchall()
                    phy_summary = {r[0]: r[1] for r in phy_rows}
                    targets = self._query_kismet_native(conn, args)
                    source = kismet_db

                    # Fetch alerts if requested
                    if args.alerts and "alerts" in tables:
                        alerts = self._query_kismet_alerts(conn)
                conn.close()
            except sqlite3.Error as e:
                self.logger.warning("Cannot open Kismet DB %s: %s", kismet_db, e)

        # Fall back to Argos rf_signals.db
        if not targets and argos_db:
            try:
                conn = sqlite3.connect(f"file:{argos_db}?mode=ro", uri=True)
                conn.row_factory = sqlite3.Row
                tables = {r[0] for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()}

                if "devices" in tables and "signals" in tables:
                    self.logger.info("Using Argos DB: %s", argos_db)
                    targets = self._query_argos_targets(conn, args)
                    networks = self._query_argos_networks(conn, args)
                    source = argos_db
                conn.close()
            except sqlite3.Error as e:
                self.logger.warning("Cannot open Argos DB %s: %s", argos_db, e)

        if source == "none":
            self.output_error(
                "No usable database found. Kismet may not be running.",
                {"searched_kismet": kismet_db or "(auto-discovery failed)",
                 "searched_argos": argos_db or "(none)"},
            )
            return

        # Compute summary stats
        type_counts: dict[str, int] = {}
        for t in targets:
            dtype = t.get("type", "unknown")
            type_counts[dtype] = type_counts.get(dtype, 0) + 1

        encryption_counts: dict[str, int] = {}
        for t in targets:
            enc = t.get("encryption") or "Unknown"
            enc_key = self._normalize_encryption(enc)
            encryption_counts[enc_key] = encryption_counts.get(enc_key, 0) + 1

        band_counts: dict[str, int] = {}
        for t in targets:
            freq = t.get("frequency_mhz", 0)
            if freq:
                band = _freq_to_band(freq)
                band_counts[band] = band_counts.get(band, 0) + 1

        close_range = [t for t in targets if (t.get("signal_dbm") or -999) >= -70]
        wps_targets = [t for t in targets if t.get("wps_enabled")]
        cloaked_targets = [t for t in targets if t.get("cloaked")]
        open_targets = [t for t in targets
                        if self._normalize_encryption(t.get("encryption", "")) == "Open"]

        summary = {
            "by_type": type_counts,
            "by_encryption": encryption_counts,
            "by_band": band_counts,
            "phy_types_in_db": phy_summary,
            "close_range_count": len(close_range),
            "close_range_macs": [t["mac"] for t in close_range[:20]],
            "wps_enabled_count": len(wps_targets),
            "cloaked_count": len(cloaked_targets),
            "open_network_count": len(open_targets),
        }
        filters = {
            "min_signal": args.min_signal,
            "type": args.type,
            "max_age": args.max_age,
            "ssid": args.ssid,
            "manufacturer": args.manufacturer,
            "channel": args.channel,
            "encryption": args.encryption,
            "has_clients": args.has_clients,
            "cloaked": args.cloaked,
            "wps": args.wps,
            "min_data": args.min_data,
            "phy": args.phy,
            "sort": args.sort,
            "with_gps": args.with_gps,
            "connected_to": args.connected_to,
            "show_clients": args.show_clients,
            "alerts": args.alerts,
        }

        # Write Markdown report if requested
        if args.report:
            self._write_report(args.report, source, targets, summary, filters, alerts)

        result: dict = {
            "source": source,
            "targets": targets,
            "networks": networks,
            "count": len(targets),
            "network_count": len(networks),
            "summary": summary,
            "filters": filters,
            "report": args.report or None,
        }
        if alerts:
            result["alerts"] = alerts
            result["alert_count"] = len(alerts)

        self.output_success(result)

    @staticmethod
    def _normalize_encryption(enc: str) -> str:
        if not enc or enc == "Unknown":
            return "Unknown"
        if "WPA3" in enc:
            return "WPA3"
        if "WPA2" in enc:
            return "WPA2"
        if "WPA" in enc:
            return "WPA"
        if "WEP" in enc:
            return "WEP"
        if "Open" in enc:
            return "Open"
        return enc

    def _write_report(self, path: str, source: str, targets: list[dict],
                      summary: dict, filters: dict,
                      alerts: list[dict] | None = None) -> None:
        """Write a formatted Markdown report for batcat viewing."""
        from datetime import datetime, timezone

        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        lines: list[str] = []
        w = lines.append  # shorthand

        w(f"# WiFi Recon Report")
        w(f"")
        w(f"**Generated:** {ts}")
        w(f"**Source:** `{os.path.basename(source)}`")
        w(f"**Total targets:** {len(targets)}")
        w(f"")

        # Active filters
        active = {k: v for k, v in filters.items()
                  if v is not None and v is not False and v != 0
                  and k not in ("min_signal", "max_age", "phy", "sort")}
        if active:
            w(f"**Active filters:** {', '.join(f'`{k}={v}`' for k, v in active.items())}")
            w(f"")

        # ── Summary table ────────────────────────────────────────
        w(f"## Summary")
        w(f"")
        w(f"| Metric | Count |")
        w(f"|--------|------:|")
        for dtype, cnt in sorted(summary["by_type"].items(), key=lambda x: -x[1]):
            w(f"| {dtype.upper()} | {cnt} |")
        w(f"| **Total** | **{len(targets)}** |")
        w(f"| Close range (>-70 dBm) | {summary['close_range_count']} |")
        w(f"| WPS enabled | {summary['wps_enabled_count']} |")
        w(f"| Cloaked/hidden | {summary['cloaked_count']} |")
        w(f"| Open (no encryption) | {summary['open_network_count']} |")
        w(f"")

        # Encryption breakdown
        if summary["by_encryption"]:
            w(f"### Encryption")
            w(f"")
            w(f"| Type | Count |")
            w(f"|------|------:|")
            for enc, cnt in sorted(summary["by_encryption"].items(), key=lambda x: -x[1]):
                w(f"| {enc} | {cnt} |")
            w(f"")

        # Band breakdown
        if summary["by_band"]:
            w(f"### Bands")
            w(f"")
            w(f"| Band | Count |")
            w(f"|------|------:|")
            for band, cnt in sorted(summary["by_band"].items(), key=lambda x: -x[1]):
                w(f"| {band} | {cnt} |")
            w(f"")

        # ── AP table ─────────────────────────────────────────────
        aps = [t for t in targets if t.get("type") == "ap"]
        if aps:
            w(f"## Access Points ({len(aps)})")
            w(f"")
            w(f"| # | SSID | BSSID | Signal | Ch | Band | Encryption | Manufacturer | Clients | WPS | Data | Beacon FP |")
            w(f"|--:|------|-------|-------:|---:|------|------------|-------------|--------:|:---:|-----:|-----------|")
            for i, t in enumerate(aps, 1):
                ssid = t.get("ssid", "") or "(hidden)"
                mac = t["mac"]
                sig = t.get("signal_dbm", 0)
                sig_bar = self._signal_bar(sig)
                ch = t.get("channel", "")
                band = t.get("band", "")
                enc = self._short_encryption(t.get("encryption", ""))
                manuf = (t.get("manufacturer", "") or "")[:18]
                clients = t.get("num_clients", "")
                wps = "Yes" if t.get("wps_enabled") else ""
                data = self._human_bytes(t.get("bytes_data", 0))
                cloaked_mark = " *" if t.get("cloaked") else ""
                bfp = t.get("beacon_fingerprint", "")[:10]
                w(f"| {i} | {ssid}{cloaked_mark} | `{mac}` | {sig_bar} {sig} | {ch} | {band} | {enc} | {manuf} | {clients} | {wps} | {data} | {bfp} |")
                # Show associated clients if --show-clients
                ac = t.get("associated_clients", [])
                if ac:
                    w(f"|   | ↳ Clients: {', '.join(f'`{c}`' for c in ac[:10])} {'...' if len(ac) > 10 else ''} | | | | | | | | | | |")
            w(f"")
            if any(t.get("cloaked") for t in aps):
                w(f"> \\* = cloaked/hidden SSID")
                w(f"")

        # ── Client table ─────────────────────────────────────────
        clients_list = [t for t in targets if t.get("type") == "client"]
        if clients_list:
            w(f"## Clients ({len(clients_list)})")
            w(f"")
            w(f"| # | MAC | Signal | Ch | Manufacturer | Connected To | Probed SSIDs | Data | Pkts |")
            w(f"|--:|-----|-------:|---:|-------------|-------------|-------------|-----:|-----:|")
            for i, t in enumerate(clients_list, 1):
                mac = t["mac"]
                sig = t.get("signal_dbm", 0)
                sig_bar = self._signal_bar(sig)
                ch = t.get("channel", "")
                manuf = (t.get("manufacturer", "") or "")[:20]
                conn_to = t.get("connected_to_bssid", "")
                if conn_to:
                    conn_to = f"`{conn_to}`"
                probed = ", ".join(t.get("probed_ssids", [])[:3])
                data = self._human_bytes(t.get("bytes_data", 0))
                pkts = t.get("packets_total", 0)
                w(f"| {i} | `{mac}` | {sig_bar} {sig} | {ch} | {manuf} | {conn_to} | {probed} | {data} | {pkts} |")
            w(f"")

        # ── Other device types ───────────────────────────────────
        others = [t for t in targets if t.get("type") not in ("ap", "client")]
        if others:
            w(f"## Other Devices ({len(others)})")
            w(f"")
            w(f"| # | MAC | Type | Signal | Ch | Manufacturer | Data |")
            w(f"|--:|-----|------|-------:|---:|-------------|-----:|")
            for i, t in enumerate(others, 1):
                mac = t["mac"]
                dtype = t.get("type", "")
                sig = t.get("signal_dbm", 0)
                sig_bar = self._signal_bar(sig)
                ch = t.get("channel", "")
                manuf = (t.get("manufacturer", "") or "")[:20]
                data = self._human_bytes(t.get("bytes_data", 0))
                w(f"| {i} | `{mac}` | {dtype} | {sig_bar} {sig} | {ch} | {manuf} | {data} |")
            w(f"")

        # ── Priority targets ─────────────────────────────────────
        priority = []
        for t in targets:
            reasons = []
            if self._normalize_encryption(t.get("encryption", "")) == "Open":
                reasons.append("OPEN network")
            if t.get("wps_enabled"):
                reasons.append("WPS enabled")
            if t.get("cloaked"):
                reasons.append("Hidden SSID")
            enc = t.get("encryption", "")
            if "TKIP" in enc:
                reasons.append("Weak crypto (TKIP)")
            if "WEP" in enc:
                reasons.append("Weak crypto (WEP)")
            if reasons and (t.get("signal_dbm") or -999) >= -80:
                priority.append((t, reasons))

        if priority:
            w(f"## Priority Targets")
            w(f"")
            w(f"| SSID | MAC | Signal | Why |")
            w(f"|------|-----|-------:|-----|")
            for t, reasons in priority:
                ssid = t.get("ssid", "") or "(hidden)"
                w(f"| {ssid} | `{t['mac']}` | {t.get('signal_dbm', 0)} dBm | {', '.join(reasons)} |")
            w(f"")

        # ── Retry & Error Analysis ──────────────────────────────
        retry_targets = [t for t in targets if t.get("retry_bytes", 0) > 0 or t.get("packets_error", 0) > 0]
        if retry_targets:
            w(f"## Retry & Error Analysis")
            w(f"")
            w(f"> High retry/error rates may indicate jamming, deauth attacks, or interference.")
            w(f"")
            w(f"| MAC | SSID | Type | Retry Bytes | Pkt Errors | Data | Ratio |")
            w(f"|-----|------|------|------------:|----------:|---------:|------:|")
            for t in sorted(retry_targets, key=lambda x: x.get("retry_bytes", 0), reverse=True)[:20]:
                rb = t.get("retry_bytes", 0)
                pe = t.get("packets_error", 0)
                bd = t.get("bytes_data", 0)
                ratio = f"{rb / bd * 100:.1f}%" if bd > 0 else "N/A"
                w(f"| `{t['mac']}` | {t.get('ssid', '')[:20]} | {t.get('type', '')} | {self._human_bytes(rb)} | {pe} | {self._human_bytes(bd)} | {ratio} |")
            w(f"")

        # ── Multi-Frequency Devices ────────────────────────────
        multi_freq = [t for t in targets if t.get("freq_map_khz") and len(t["freq_map_khz"]) > 1]
        if multi_freq:
            w(f"## Multi-Frequency Devices")
            w(f"")
            w(f"> Devices seen on multiple frequencies (band steering, channel hopping).")
            w(f"")
            for t in multi_freq[:10]:
                freqs = t["freq_map_khz"]
                freq_str = ", ".join(f"{int(k) // 1000}MHz ({v}pkts)" for k, v in
                                     sorted(freqs.items(), key=lambda x: -x[1])[:5])
                w(f"- `{t['mac']}` ({t.get('ssid', '') or t.get('type', '')}): {freq_str}")
            w(f"")

        # ── GPS Movement (bounding box) ─────────────────────
        moving_devices = [t for t in targets if t.get("gps_bounds")]
        if moving_devices:
            w(f"## GPS Movement Detected")
            w(f"")
            w(f"| MAC | Type | Min Lat | Max Lat | Min Lon | Max Lon |")
            w(f"|-----|------|--------:|--------:|--------:|--------:|")
            for t in moving_devices[:15]:
                b = t["gps_bounds"]
                w(f"| `{t['mac']}` | {t.get('type', '')} | {b['min_lat']:.6f} | {b['max_lat']:.6f} | {b['min_lon']:.6f} | {b['max_lon']:.6f} |")
            w(f"")

        # ── Beacon Fingerprint Duplicates (evil twin detection) ─
        bfp_map: dict[str, list[dict]] = {}
        for t in targets:
            bfp = t.get("beacon_fingerprint", "")
            if bfp and bfp != "0":
                bfp_map.setdefault(bfp, []).append(t)
        dupes = {k: v for k, v in bfp_map.items() if len(v) > 1}
        if dupes:
            w(f"## Beacon Fingerprint Duplicates (Possible Evil Twins)")
            w(f"")
            w(f"> Multiple APs sharing the same beacon fingerprint may indicate cloned/rogue APs.")
            w(f"")
            for bfp, devs in dupes.items():
                ssids = set(d.get("ssid", "") for d in devs if d.get("ssid"))
                macs = [f"`{d['mac']}`" for d in devs]
                w(f"- FP `{bfp}`: SSIDs={ssids or '(hidden)'} — MACs: {', '.join(macs)}")
            w(f"")

        # ── Alerts ──────────────────────────────────────────────
        if alerts:
            w(f"## Kismet Alerts ({len(alerts)})")
            w(f"")
            # Group by type
            alert_groups: dict[str, int] = {}
            for a in alerts:
                at = a.get("type", "UNKNOWN")
                alert_groups[at] = alert_groups.get(at, 0) + 1
            w(f"| Alert Type | Count | Class |")
            w(f"|------------|------:|-------|")
            for at, cnt in sorted(alert_groups.items(), key=lambda x: -x[1]):
                # Find class from first matching alert
                cls = next((a.get("class", "") for a in alerts if a.get("type") == at), "")
                w(f"| {at} | {cnt} | {cls} |")
            w(f"")
            # Show recent alert details (last 10)
            w(f"### Recent Alerts")
            w(f"")
            for a in alerts[:10]:
                from datetime import datetime, timezone
                ts = a.get("timestamp", 0)
                ts_str = datetime.fromtimestamp(ts, timezone.utc).strftime("%H:%M:%S") if ts else "?"
                text = (a.get("text", ""))[:120]
                w(f"- **[{ts_str}] {a.get('type', '')}**: {text}")
            w(f"")

        # ── Signal legend ─────────────────────────────────────────
        w(f"## Signal Legend")
        w(f"")
        w(f"| Icon | Range | Quality |")
        w(f"|------|-------|---------|")
        w(f"| ████ | > -50 dBm | Excellent (very close) |")
        w(f"| ███░ | -50 to -65 | Good |")
        w(f"| ██░░ | -65 to -75 | Fair |")
        w(f"| █░░░ | -75 to -85 | Weak |")
        w(f"| ░░░░ | < -85 dBm | Marginal |")
        w(f"")

        report_text = "\n".join(lines) + "\n"
        try:
            with open(path, "w") as f:
                f.write(report_text)
            self.logger.info("Report written to %s (%d bytes)", path, len(report_text))
        except OSError as e:
            self.logger.error("Failed to write report: %s", e)

    @staticmethod
    def _signal_bar(dbm: int) -> str:
        """Return a 4-char signal strength bar."""
        if dbm == 0:
            return "    "
        if dbm >= -50:
            return "████"
        if dbm >= -65:
            return "███░"
        if dbm >= -75:
            return "██░░"
        if dbm >= -85:
            return "█░░░"
        return "░░░░"

    @staticmethod
    def _human_bytes(b: int) -> str:
        """Format byte count to human-readable."""
        if b == 0:
            return "0"
        if b < 1024:
            return f"{b}B"
        if b < 1048576:
            return f"{b / 1024:.1f}K"
        return f"{b / 1048576:.1f}M"

    @staticmethod
    def _short_encryption(enc: str) -> str:
        """Shorten encryption string for table display."""
        if not enc:
            return ""
        # Remove redundant parts
        enc = enc.replace("AES-CCMP", "CCMP").replace("AES-OCB", "OCB")
        enc = enc.replace("WPA2-PSK", "PSK").replace("WPA3-PSK", "PSK")
        enc = enc.replace("WPA3-SAE", "SAE")
        return enc

    def _resolve_kismet_db(self, args) -> str | None:
        """Find the Kismet .kismet database to use."""
        if args.kismet_db:
            if os.path.isfile(args.kismet_db):
                return args.kismet_db
            self.logger.warning("Specified --kismet-db not found: %s", args.kismet_db)
            return None

        home = os.path.expanduser("~")
        kismet_files = glob.glob(os.path.join(home, "Kismet-*.kismet"))
        if not kismet_files:
            kismet_files = glob.glob("/var/log/kismet/Kismet-*.kismet")
        if not kismet_files:
            return None

        kismet_files.sort(key=os.path.getmtime, reverse=True)
        self.logger.info("Auto-discovered %d Kismet DBs, using newest: %s",
                         len(kismet_files), kismet_files[0])
        return kismet_files[0]

    def _query_kismet_native(self, conn: sqlite3.Connection, args) -> list[dict]:
        """Query Kismet's native .kismet SQLite database (JSON blobs)."""
        cutoff = int(time.time()) - args.max_age

        # PHY filter
        phy_filter = "AND phyname = 'IEEE802.11'"
        if args.phy == "bluetooth":
            phy_filter = "AND phyname IN ('Bluetooth', 'BTLE', 'BR/EDR')"
        elif args.phy == "all":
            phy_filter = ""

        # Type filter
        type_filter = ""
        if args.type != "all":
            reverse_map = {v: k for k, v in KISMET_TYPE_MAP.items()}
            kismet_type = reverse_map.get(args.type, "")
            if kismet_type:
                type_filter = f"AND type = '{kismet_type}'"

        query = f"""
            SELECT devmac, type, phyname, strongest_signal, first_time, last_time,
                   avg_lat, avg_lon, bytes_data, device
            FROM devices
            WHERE last_time >= ?
              {phy_filter}
              {type_filter}
            ORDER BY last_time DESC
        """
        rows = conn.execute(query, [cutoff]).fetchall()

        targets = []
        for row in rows:
            entry = self._parse_kismet_device(row, args)
            if entry is not None:
                targets.append(entry)

        # Sort
        sort_keys = {
            "signal": lambda t: t.get("signal_dbm") or -999,
            "data": lambda t: t.get("bytes_data") or 0,
            "last_seen": lambda t: t.get("last_seen") or 0,
            "packets": lambda t: t.get("packets_total") or 0,
            "clients": lambda t: t.get("num_clients") or 0,
        }
        key_fn = sort_keys.get(args.sort, sort_keys["signal"])
        targets.sort(key=key_fn, reverse=True)

        return targets[:args.limit]

    def _parse_kismet_device(self, row, args) -> dict | None:
        """Parse a single Kismet device row, applying all filters. Returns None if filtered out."""
        mac = row["devmac"]
        raw_type = row["type"] or ""
        normalized_type = KISMET_TYPE_MAP.get(raw_type, raw_type)
        signal = row["strongest_signal"]
        blob = row["device"]

        ssid = ""
        encryption = ""
        channel = ""
        manufacturer = ""
        probed_ssids: list[str] = []
        last_signal = signal
        frequency = 0
        packets_total = 0
        packets_data = 0
        num_clients = 0
        cloaked = False
        wps_enabled = False
        wps_version = 0
        ht_mode = ""
        max_rate = 0
        # New enrichment fields
        associated_clients: list[str] = []
        last_bssid = ""
        beacon_fingerprint = ""
        retry_bytes = 0
        packets_error = 0
        freq_map: dict[str, int] = {}
        gps_bounds: dict | None = None
        observation_duration = 0

        if blob:
            try:
                data = json.loads(blob)
                manufacturer = data.get("kismet.device.base.manuf", "")
                channel = str(data.get("kismet.device.base.channel", ""))
                frequency = data.get("kismet.device.base.frequency", 0)

                pkts = data.get("kismet.device.base.packets", {})
                packets_total = pkts.get("kismet.device.base.packets.total",
                                         data.get("kismet.device.base.packets.total", 0))
                packets_data = pkts.get("kismet.device.base.packets.data",
                                        data.get("kismet.device.base.packets.data", 0))
                packets_error = pkts.get("kismet.device.base.packets.error", 0)

                # Retry/error data
                retry_bytes = data.get("kismet.device.base.datasize.retry", 0) or 0

                sig_data = data.get("kismet.device.base.signal", {})
                last_signal = sig_data.get("kismet.common.signal.last_signal", signal)

                # Frequency map
                raw_fmap = data.get("kismet.device.base.freq_khz_map", {})
                if raw_fmap:
                    freq_map = {str(k): v for k, v in raw_fmap.items()}

                # GPS bounding box
                loc = data.get("kismet.device.base.location", {})
                min_loc = loc.get("kismet.common.location.min_loc", {})
                max_loc = loc.get("kismet.common.location.max_loc", {})
                if min_loc and max_loc:
                    min_gp = min_loc.get("kismet.common.location.geopoint", [])
                    max_gp = max_loc.get("kismet.common.location.geopoint", [])
                    if min_gp and max_gp and min_gp != [0, 0]:
                        gps_bounds = {
                            "min_lon": min_gp[0], "min_lat": min_gp[1],
                            "max_lon": max_gp[0], "max_lat": max_gp[1],
                        }

                # Observation duration from seenby
                seenby = data.get("kismet.device.base.seenby", [])
                if seenby:
                    sb = seenby[0]
                    ft = sb.get("kismet.common.seenby.first_time", 0)
                    lt = sb.get("kismet.common.seenby.last_time", 0)
                    if ft and lt:
                        observation_duration = max(0, lt - ft)

                d11 = data.get("dot11.device", {})
                num_clients = d11.get("dot11.device.num_associated_clients", 0)
                last_bssid = d11.get("dot11.device.last_bssid", "")
                beacon_fingerprint = str(d11.get("dot11.device.beacon_fingerprint", ""))

                # Associated client MACs (AP→client mapping)
                acm = d11.get("dot11.device.associated_client_map", {})
                if isinstance(acm, dict):
                    associated_clients = list(acm.keys())
                elif isinstance(acm, list):
                    associated_clients = [str(c) for c in acm]

                # Advertised SSIDs (APs)
                adv_ssids = d11.get("dot11.device.advertised_ssid_map", [])
                if adv_ssids:
                    first = adv_ssids[0] if isinstance(adv_ssids, list) else list(adv_ssids.values())[0]
                    ssid = first.get("dot11.advertisedssid.ssid", "")
                    encryption = first.get("dot11.advertisedssid.crypt_string", "")
                    cloaked = bool(first.get("dot11.advertisedssid.cloaked", 0))
                    wps_state = first.get("dot11.advertisedssid.wps_state", 0)
                    wps_version = first.get("dot11.advertisedssid.wps_version", 0)
                    wps_enabled = wps_state > 0
                    ht_mode = first.get("dot11.advertisedssid.ht_mode", "")
                    max_rate = first.get("dot11.advertisedssid.maxrate", 0)

                # Probed SSIDs (clients)
                probed_map = d11.get("dot11.device.probed_ssid_map", [])
                for p in probed_map:
                    ps = p.get("dot11.probedssid.ssid", "")
                    if ps:
                        probed_ssids.append(ps)

                # Fallback SSID
                if not ssid:
                    ssid = data.get("kismet.device.base.commonname", "")

            except (json.JSONDecodeError, AttributeError):
                pass

        # --- Apply filters ---

        effective_signal = last_signal if last_signal != 0 else signal
        if effective_signal != 0 and effective_signal < args.min_signal:
            return None

        # SSID filter (matches advertised + probed)
        all_ssids = ([ssid] if ssid else []) + probed_ssids
        if args.ssid:
            if not any(args.ssid.lower() in s.lower() for s in all_ssids):
                return None

        # Manufacturer filter
        if args.manufacturer:
            if args.manufacturer.lower() not in (manufacturer or "").lower():
                return None

        # Channel / band filter
        if args.channel:
            ch_filter = args.channel.lower()
            if ch_filter in ("2.4ghz", "5ghz", "6ghz"):
                band = _freq_to_band(frequency) if frequency else "unknown"
                if band.lower() != ch_filter:
                    return None
            else:
                if str(channel) != args.channel:
                    return None

        # Encryption filter
        if args.encryption and args.encryption != "any":
            enc_norm = self._normalize_encryption(encryption).lower()
            if args.encryption == "open" and enc_norm != "open":
                return None
            elif args.encryption != "open" and enc_norm != args.encryption:
                return None

        # Has-clients filter (APs only)
        if args.has_clients and num_clients == 0:
            return None

        # Cloaked filter
        if args.cloaked and not cloaked:
            return None

        # WPS filter
        if args.wps and not wps_enabled:
            return None

        # Min data filter
        if args.min_data and (row["bytes_data"] or 0) < args.min_data:
            return None

        # GPS filter
        if args.with_gps:
            if row["avg_lat"] == 0.0 and row["avg_lon"] == 0.0:
                return None

        # Connected-to filter: only clients whose last_bssid matches
        if args.connected_to:
            target_bssid = args.connected_to.upper()
            if normalized_type == "client":
                if last_bssid.upper() != target_bssid:
                    return None
            elif normalized_type == "ap":
                # Include the AP itself if it matches
                if mac.upper() != target_bssid:
                    return None
            else:
                return None

        entry: dict = {
            "mac": mac,
            "type": normalized_type,
            "ssid": ssid,
            "encryption": encryption,
            "channel": channel,
            "frequency_mhz": frequency,
            "band": _freq_to_band(frequency) if frequency else None,
            "signal_dbm": effective_signal,
            "manufacturer": manufacturer,
            "first_seen": row["first_time"],
            "last_seen": row["last_time"],
            "latitude": row["avg_lat"] if row["avg_lat"] != 0.0 else None,
            "longitude": row["avg_lon"] if row["avg_lon"] != 0.0 else None,
            "bytes_data": row["bytes_data"],
            "packets_total": packets_total,
            "packets_data": packets_data,
        }

        # Conditional fields — only include when present/relevant
        if num_clients > 0:
            entry["num_clients"] = num_clients
        if probed_ssids:
            entry["probed_ssids"] = probed_ssids[:10]
        if cloaked:
            entry["cloaked"] = True
        if wps_enabled:
            entry["wps_enabled"] = True
            entry["wps_version"] = wps_version
        if ht_mode:
            entry["ht_mode"] = ht_mode
        if max_rate:
            entry["max_rate_mbps"] = max_rate

        # Enrichment fields (always included when data exists)
        if associated_clients and args.show_clients:
            entry["associated_clients"] = associated_clients[:50]
        if last_bssid and last_bssid != "00:00:00:00:00:00":
            entry["connected_to_bssid"] = last_bssid
        if beacon_fingerprint and beacon_fingerprint != "0":
            entry["beacon_fingerprint"] = beacon_fingerprint
        if retry_bytes > 0:
            entry["retry_bytes"] = retry_bytes
        if packets_error > 0:
            entry["packets_error"] = packets_error
        if freq_map and len(freq_map) > 1:
            entry["freq_map_khz"] = freq_map
        if gps_bounds:
            entry["gps_bounds"] = gps_bounds
        if observation_duration > 0:
            entry["observation_secs"] = observation_duration

        return entry

    def _query_kismet_alerts(self, conn: sqlite3.Connection) -> list[dict]:
        """Query Kismet alerts table for security-relevant events."""
        rows = conn.execute(
            "SELECT header, json FROM alerts ORDER BY rowid DESC LIMIT 200"
        ).fetchall()
        alerts = []
        for row in rows:
            header = row["header"]
            try:
                data = json.loads(row["json"])
                alerts.append({
                    "type": header,
                    "class": data.get("kismet.alert.class", ""),
                    "severity": data.get("kismet.alert.severity", 0),
                    "text": data.get("kismet.alert.text", ""),
                    "timestamp": data.get("kismet.alert.timestamp", 0),
                    "channel": data.get("kismet.alert.channel", ""),
                    "source_mac": data.get("kismet.alert.source_mac", ""),
                    "transmitter_mac": data.get("kismet.alert.transmitter_mac", ""),
                })
            except (json.JSONDecodeError, AttributeError):
                alerts.append({"type": header, "text": str(row["json"])[:200]})
        return alerts

    def _query_argos_targets(self, conn: sqlite3.Connection, args) -> list[dict]:
        """Query Argos rf_signals.db devices table (fallback)."""
        cutoff_ms = (int(time.time()) - args.max_age) * 1000

        query = """
            SELECT
                d.device_id, d.type, d.manufacturer,
                d.first_seen, d.last_seen, d.avg_power,
                d.freq_min, d.freq_max, d.metadata,
                s.power AS last_signal_dbm,
                s.frequency AS last_freq_mhz,
                s.latitude, s.longitude
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

        if args.type not in ("all",):
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
            metadata = {}
            if row["metadata"]:
                try:
                    metadata = json.loads(row["metadata"])
                except json.JSONDecodeError:
                    pass

            ssid = metadata.get("ssid", metadata.get("name", ""))
            encryption = metadata.get("encryption", metadata.get("crypt", ""))
            channel_val = metadata.get("channel", None)

            if args.ssid and args.ssid.lower() not in (ssid or "").lower():
                continue

            targets.append({
                "mac": row["device_id"],
                "type": row["type"],
                "ssid": ssid,
                "encryption": encryption,
                "channel": channel_val,
                "signal_dbm": row["last_signal_dbm"] or row["avg_power"],
                "frequency_mhz": row["last_freq_mhz"] or row["freq_min"],
                "manufacturer": row["manufacturer"],
                "first_seen": row["first_seen"],
                "last_seen": row["last_seen"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
            })

        return targets

    def _query_argos_networks(self, conn: sqlite3.Connection, args) -> list[dict]:
        """Query Argos rf_signals.db networks table."""
        cutoff_ms = (int(time.time()) - args.max_age) * 1000

        query = """
            SELECT
                n.network_id, n.name AS ssid, n.encryption, n.channel,
                n.first_seen, n.last_seen, n.center_lat, n.center_lon,
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

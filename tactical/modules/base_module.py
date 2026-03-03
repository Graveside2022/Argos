#!/usr/bin/env python3
"""
Tactical Module Base Class — replaces Artemis ArtemisBase (Karton framework).

Provides shared infrastructure for all tactical modules:
- Structured JSON output (stdout only)
- CLI tool execution with timeout and capture
- SQLite DB logging to module_runs table
- Input validation helpers (MAC, IP, interface, port)
- Common argparse setup

Every module inherits from TacticalModule and implements run().
"""

import argparse
import json
import logging
import os
import re
import sqlite3
import subprocess
import sys
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Logging to stderr only (stdout reserved for JSON output) ───────
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)


class TacticalModule(ABC):
    """Base class for all tactical execution modules."""

    # Subclass must set these
    name: str = "unnamed_module"
    description: str = ""

    def __init__(self) -> None:
        self.logger = logging.getLogger(self.name)
        self.parser = argparse.ArgumentParser(
            prog=self.name,
            description=self.description,
        )
        self._add_common_args()
        self._add_module_args()

    # ── Argument setup ─────────────────────────────────────────────

    def _add_common_args(self) -> None:
        """Add args shared by all modules."""
        self.parser.add_argument(
            "--db-path",
            default=self._default_db_path(),
            help="Path to rf_signals.db (default: ../rf_signals.db)",
        )
        self.parser.add_argument(
            "--timeout",
            type=int,
            default=120,
            help="Execution timeout in seconds (default: 120)",
        )
        self.parser.add_argument(
            "--json",
            action="store_true",
            default=True,
            help="Output JSON (always true, kept for compatibility)",
        )

    def _add_module_args(self) -> None:
        """Override in subclass to add module-specific args."""
        pass

    @staticmethod
    def _default_db_path() -> str:
        """Resolve default DB path relative to this file's location."""
        module_dir = Path(__file__).resolve().parent
        db_path = module_dir.parent.parent / "rf_signals.db"
        return str(db_path)

    # ── JSON output ────────────────────────────────────────────────

    def output_success(self, data: dict[str, Any]) -> None:
        """Print success JSON to stdout and exit 0."""
        result = {
            "status": "success",
            "module": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **data,
        }
        print(json.dumps(result, default=str))
        sys.exit(0)

    def output_error(self, message: str, details: dict[str, Any] | None = None) -> None:
        """Print error JSON to stdout and exit 1."""
        result = {
            "status": "error",
            "module": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
        }
        if details:
            result["details"] = details
        print(json.dumps(result, default=str))
        sys.exit(1)

    # ── Extended validation helpers ────────────────────────────────

    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL format (http/https with host)."""
        return bool(re.match(
            r"^https?://[a-zA-Z0-9._-]+(:\d{1,5})?(/.*)?$", url
        ))

    @staticmethod
    def validate_domain(domain: str) -> bool:
        """Validate domain name format."""
        return bool(re.match(
            r"^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$",
            domain,
        ))

    @staticmethod
    def validate_hash(h: str) -> bool:
        """Validate NTLM LM:NT hash format (32hex:32hex)."""
        return bool(re.match(r"^[0-9a-fA-F]{32}:[0-9a-fA-F]{32}$", h))

    def check_root(self) -> bool:
        """Check for root privileges. Calls output_error and returns False if not root."""
        if os.geteuid() != 0:
            self.output_error("This module requires root privileges. Run with sudo.")
            return False
        return True

    # ── CLI tool execution ─────────────────────────────────────────

    def run_tool_popen(
        self,
        binary: str,
        args: list[str],
        duration: int = 60,
        env: dict[str, str] | None = None,
    ) -> tuple[str, str]:
        """
        Execute a long-running CLI tool via Popen with duration-limited capture.
        Sends SIGTERM after duration seconds, SIGKILL after 5s grace.
        Returns (stdout, stderr) strings.
        """
        import signal

        cmd = [binary] + args
        self.logger.info("Running (Popen, %ds): %s", duration, " ".join(cmd))
        merged_env = {**os.environ, **(env or {})}

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=merged_env,
                preexec_fn=os.setsid,
            )
        except FileNotFoundError:
            self.output_error(f"Tool not found: {binary}. Is it installed?")
            return "", ""  # unreachable

        try:
            stdout, stderr = proc.communicate(timeout=duration)
        except subprocess.TimeoutExpired:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            try:
                stdout, stderr = proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                stdout, stderr = proc.communicate(timeout=5)

        return stdout, stderr

    def run_tool(
        self,
        binary: str,
        args: list[str],
        timeout: int | None = None,
        env: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        """
        Execute a CLI tool safely via subprocess.run().
        No shell=True — arguments passed as list (no injection).
        """
        cmd = [binary] + args
        self.logger.info("Running: %s", " ".join(cmd))

        merged_env = {**os.environ, **(env or {})}
        timeout = timeout or 120

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=merged_env,
            )
            return result
        except FileNotFoundError:
            self.output_error(f"Tool not found: {binary}. Is it installed?")
            raise  # unreachable after output_error exits
        except subprocess.TimeoutExpired:
            self.output_error(
                f"Tool timed out after {timeout}s: {binary}",
                {"command": " ".join(cmd)},
            )
            raise

    # ── DB logging ─────────────────────────────────────────────────

    def log_run(
        self,
        db_path: str,
        module_name: str,
        args_json: str,
        exit_code: int,
        stdout: str,
        stderr: str,
        duration_ms: int,
        engagement_id: int | None = None,
    ) -> int | None:
        """Log a module execution to the module_runs table. Returns row ID."""
        if not db_path or not Path(db_path).exists():
            self.logger.warning("DB not found at %s, skipping log", db_path)
            return None

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.execute(
                """INSERT INTO module_runs
                   (engagement_id, module_name, args, exit_code, stdout, stderr, duration_ms)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (engagement_id, module_name, args_json, exit_code,
                 stdout[:10000], stderr[:10000], duration_ms),
            )
            conn.commit()
            row_id = cursor.lastrowid
            conn.close()
            return row_id
        except sqlite3.Error as e:
            self.logger.warning("Failed to log run to DB: %s", e)
            return None

    # ── Input validation helpers ───────────────────────────────────

    @staticmethod
    def validate_mac(mac: str) -> bool:
        """Validate MAC address format (AA:BB:CC:DD:EE:FF)."""
        return bool(re.match(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$", mac))

    @staticmethod
    def validate_ip(ip: str) -> bool:
        """Validate IPv4 address."""
        parts = ip.split(".")
        if len(parts) != 4:
            return False
        return all(p.isdigit() and 0 <= int(p) <= 255 for p in parts)

    @staticmethod
    def validate_interface(iface: str) -> bool:
        """Validate network interface name (Linux IFNAMSIZ: 1-15 chars)."""
        return bool(re.match(r"^[a-zA-Z0-9_-]{1,15}$", iface))

    @staticmethod
    def validate_port(port: int) -> bool:
        """Validate port number (1-65535)."""
        return 1 <= port <= 65535

    @staticmethod
    def validate_cidr(cidr: str) -> bool:
        """Validate CIDR notation (e.g., 192.168.1.0/24)."""
        parts = cidr.split("/")
        if len(parts) != 2:
            return False
        ip, prefix = parts[0], parts[1]
        if not prefix.isdigit() or not 0 <= int(prefix) <= 32:
            return False
        return TacticalModule.validate_ip(ip)

    @staticmethod
    def check_interface_exists(iface: str) -> bool:
        """Check if a network interface exists on the system."""
        return Path(f"/sys/class/net/{iface}").exists()

    @staticmethod
    def check_monitor_mode(iface: str) -> bool:
        """Check if interface is in monitor mode (type 803)."""
        type_path = Path(f"/sys/class/net/{iface}/type")
        if not type_path.exists():
            return False
        try:
            return type_path.read_text().strip() == "803"
        except OSError:
            return False

    # ── Credential loading ─────────────────────────────────────────

    @staticmethod
    def load_credentials(filepath: str | None, defaults: list[tuple[str, str]]) -> list[tuple[str, str]]:
        """
        Load credentials from a file (username:password per line).
        Falls back to defaults if no file specified or file missing.
        """
        if not filepath or not Path(filepath).exists():
            return defaults

        credentials = []
        with open(filepath) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(":", 1)
                if len(parts) == 2:
                    credentials.append((parts[0], parts[1]))
                elif len(parts) == 1:
                    credentials.append((parts[0], ""))
        return credentials or defaults

    # ── Entry point ────────────────────────────────────────────────

    @abstractmethod
    def run(self, args: argparse.Namespace) -> None:
        """Implement module logic. Call output_success() or output_error() when done."""
        ...

    def execute(self) -> None:
        """Parse args and run the module with timing and error handling."""
        args = self.parser.parse_args()
        start = time.monotonic()

        try:
            self.run(args)
        except SystemExit:
            raise  # Let output_success/output_error exit cleanly
        except Exception as e:
            self.logger.exception("Unhandled exception in %s", self.name)
            duration_ms = int((time.monotonic() - start) * 1000)

            # Log to DB if possible
            if hasattr(args, "db_path") and args.db_path:
                self.log_run(
                    args.db_path,
                    self.name,
                    json.dumps(vars(args), default=str),
                    1,
                    "",
                    str(e),
                    duration_ms,
                )

            self.output_error(f"Unhandled error: {type(e).__name__}: {e}")

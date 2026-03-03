#!/usr/bin/env python3
"""
mysql_bruter — MySQL credential brute-forcing via pymysql.

Source: Extracted from Artemis mysql_bruter.py (CERT-Polska/Artemis).
CLI deps: none (pure pymysql)
Karton dependency removed, base_module.py used instead.
"""

import json
import time

import pymysql

from base_module import TacticalModule

DEFAULT_CREDENTIALS = [
    ("root", ""),
    ("admin", "admin"),
    ("root", "root"),
    ("example", "example"),
    ("sql", "sql"),
]


class MySQLBruter(TacticalModule):
    name = "mysql_bruter"
    description = "MySQL credential brute-forcing (Artemis-extracted, pure pymysql)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True, help="Target MySQL host"
        )
        self.parser.add_argument(
            "--port", type=int, default=3306, help="MySQL port (default: 3306)"
        )
        self.parser.add_argument(
            "--credentials-file",
            help="Path to credentials file (username:password per line)",
        )
        self.parser.add_argument(
            "--connect-timeout",
            type=int, default=10,
            help="Connection timeout in seconds (default: 10)",
        )

    def run(self, args) -> None:
        if not self.validate_port(args.port):
            self.output_error(f"Invalid port: {args.port}")
            return

        credentials = self.load_credentials(
            args.credentials_file, DEFAULT_CREDENTIALS
        )

        found = []
        attempts = 0
        db_version = ""
        start = time.monotonic()

        for username, password in credentials:
            attempts += 1
            self.logger.info("Trying %s:%s on %s:%d", username, password or "(empty)", args.host, args.port)

            try:
                conn = pymysql.connect(
                    host=args.host,
                    port=args.port,
                    user=username,
                    password=password,
                    connect_timeout=args.connect_timeout,
                )

                # Get version
                with conn.cursor() as cursor:
                    cursor.execute("SELECT VERSION()")
                    row = cursor.fetchone()
                    if row:
                        db_version = str(row[0])

                conn.close()

                found.append({
                    "username": username,
                    "password": password,
                    "db_version": db_version,
                })
                self.logger.info("SUCCESS: %s:%s (MySQL %s)", username, password or "(empty)", db_version)

            except pymysql.err.OperationalError as e:
                err_code = e.args[0] if e.args else 0
                if err_code == 1045:  # Access denied
                    continue
                self.logger.warning("Connection error: %s", e)
                continue
            except (OSError, pymysql.err.Error) as e:
                self.logger.warning("Connection error: %s", e)
                continue

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0 if found else 1,
            json.dumps(found),
            "", duration_ms,
        )

        self.output_success({
            "host": args.host,
            "port": args.port,
            "found_credentials": found,
            "db_version": db_version,
            "attempts": attempts,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    MySQLBruter().execute()

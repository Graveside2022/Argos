#!/usr/bin/env python3
"""
postgresql_bruter — PostgreSQL credential brute-forcing via psycopg2.

Source: Extracted from Artemis postgresql_bruter.py (CERT-Polska/Artemis).
CLI deps: none (pure psycopg2)
Karton dependency removed, base_module.py used instead.
"""

import json
import time

import psycopg2

from base_module import TacticalModule

DEFAULT_CREDENTIALS = [
    ("postgres", ""),
    ("postgres", "postgres"),
    ("admin", "admin"),
    ("root", "root"),
]


class PostgreSQLBruter(TacticalModule):
    name = "postgresql_bruter"
    description = "PostgreSQL credential brute-forcing (Artemis-extracted, pure psycopg2)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True, help="Target PostgreSQL host"
        )
        self.parser.add_argument(
            "--port", type=int, default=5432, help="PostgreSQL port (default: 5432)"
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
                conn = psycopg2.connect(
                    host=args.host,
                    port=args.port,
                    user=username,
                    password=password,
                    connect_timeout=args.connect_timeout,
                    dbname="postgres",
                )
                conn.autocommit = True

                with conn.cursor() as cursor:
                    cursor.execute("SELECT version()")
                    row = cursor.fetchone()
                    if row:
                        db_version = str(row[0])

                conn.close()

                found.append({
                    "username": username,
                    "password": password,
                    "db_version": db_version,
                })
                self.logger.info("SUCCESS: %s:%s (PG %s)", username, password or "(empty)", db_version)

            except psycopg2.OperationalError as e:
                err_msg = str(e)
                if "authentication failed" in err_msg or "password authentication" in err_msg:
                    continue
                self.logger.warning("Connection error: %s", e)
                continue
            except (OSError, psycopg2.Error) as e:
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
    PostgreSQLBruter().execute()

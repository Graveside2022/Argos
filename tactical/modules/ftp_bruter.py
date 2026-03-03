#!/usr/bin/env python3
"""
ftp_bruter — FTP credential brute-forcing via ftplib.

Source: Extracted from Artemis ftp_bruter.py (CERT-Polska/Artemis).
CLI deps: none (pure Python ftplib)
Karton dependency removed, base_module.py used instead.

Tests anonymous access, TLS support, write access, and brute-forces credentials.
"""

import ftplib
import json
import time

from base_module import TacticalModule

DEFAULT_CREDENTIALS = [
    ("anonymous", ""),
    ("anonymous", "anonymous"),
    ("ftp", "ftp"),
    ("admin", "admin"),
    ("root", "root"),
    ("user", "user"),
    ("test", "test"),
    ("guest", "guest"),
]


class FTPBruter(TacticalModule):
    name = "ftp_bruter"
    description = "FTP credential brute-forcing (Artemis-extracted, pure ftplib)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True, help="Target FTP host"
        )
        self.parser.add_argument(
            "--port", type=int, default=21, help="FTP port (default: 21)"
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
        tls_supported = False
        start = time.monotonic()

        # Test TLS support first
        try:
            ftp_tls = ftplib.FTP_TLS()
            ftp_tls.connect(args.host, args.port, timeout=args.connect_timeout)
            ftp_tls.auth()
            tls_supported = True
            ftp_tls.quit()
        except Exception:
            pass

        for username, password in credentials:
            attempts += 1
            self.logger.info("Trying %s:%s on %s:%d", username, password or "(empty)", args.host, args.port)

            try:
                ftp = ftplib.FTP()
                ftp.connect(args.host, args.port, timeout=args.connect_timeout)
                ftp.login(username, password)

                # Check write access
                writable = False
                try:
                    ftp.mkd("__argos_test_dir__")
                    ftp.rmd("__argos_test_dir__")
                    writable = True
                except ftplib.error_perm:
                    pass

                # Get directory listing sample
                files_sample: list[str] = []
                try:
                    files_sample = ftp.nlst()[:10]
                except ftplib.error_perm:
                    pass

                banner = ftp.getwelcome()
                ftp.quit()

                found.append({
                    "username": username,
                    "password": password,
                    "writable": writable,
                    "files_sample": files_sample,
                    "banner": banner,
                })
                self.logger.info("SUCCESS: %s:%s (writable=%s)", username, password or "(empty)", writable)

            except ftplib.error_perm:
                continue
            except (OSError, EOFError, ftplib.error_reply) as e:
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
            "tls_supported": tls_supported,
            "attempts": attempts,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    FTPBruter().execute()

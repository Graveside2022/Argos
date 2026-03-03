#!/usr/bin/env python3
"""
ssh_bruter — SSH credential brute-forcing via paramiko.

Source: Extracted from Artemis ssh_bruter.py (CERT-Polska/Artemis).
CLI deps: none (pure paramiko)
Karton dependency removed, base_module.py used instead.

Attempts SSH login with a list of username:password pairs.
"""

import json
import socket
import time

import paramiko

from base_module import TacticalModule

DEFAULT_CREDENTIALS = [
    ("user", "password"),
    ("user", "user"),
    ("root", ""),
    ("root", "root"),
    ("root", "password"),
    ("root", "admin"),
    ("admin", "admin"),
    ("test", "test"),
    ("ppp", "ppp"),
]


class SSHBruter(TacticalModule):
    name = "ssh_bruter"
    description = "SSH credential brute-forcing (Artemis-extracted, pure paramiko)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--host", required=True, help="Target SSH host (IP or hostname)"
        )
        self.parser.add_argument(
            "--port", type=int, default=22, help="SSH port (default: 22)"
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
        start = time.monotonic()

        for username, password in credentials:
            attempts += 1
            self.logger.info("Trying %s:%s on %s:%d", username, password or "(empty)", args.host, args.port)

            try:
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                client.connect(
                    hostname=args.host,
                    port=args.port,
                    username=username,
                    password=password,
                    timeout=args.connect_timeout,
                    look_for_keys=False,
                    allow_agent=False,
                )
                # Success — get server banner
                transport = client.get_transport()
                banner = str(transport.remote_version) if transport else ""
                client.close()

                found.append({
                    "username": username,
                    "password": password,
                    "banner": banner,
                })
                self.logger.info("SUCCESS: %s:%s", username, password or "(empty)")

            except paramiko.AuthenticationException:
                continue
            except (
                paramiko.SSHException,
                socket.error,
                socket.timeout,
                OSError,
                EOFError,
            ) as e:
                self.logger.warning("Connection error: %s", e)
                # Don't abort — try next credential
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
            "attempts": attempts,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    SSHBruter().execute()

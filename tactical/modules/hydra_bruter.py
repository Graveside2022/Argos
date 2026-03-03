#!/usr/bin/env python3
"""
hydra_bruter — Multi-protocol credential brute-forcing via hydra.

CLI deps: hydra (installed on Kali)

Covers protocols without dedicated Python bruters: RDP, VNC, SMTP,
POP3, IMAP, SNMP, Telnet, HTTP-FORM, and more.
"""

import json
import re
import time

from base_module import TacticalModule


class HydraBruter(TacticalModule):
    name = "hydra_bruter"
    description = "Multi-protocol credential brute-forcing via hydra"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target IP or hostname",
        )
        self.parser.add_argument(
            "--service", required=True,
            help="Protocol/service (ssh, rdp, vnc, ftp, smtp, pop3, imap, telnet, snmp, http-get, http-post-form, smb, etc.)",
        )
        self.parser.add_argument(
            "--port", type=int,
            help="Target port (default: service default)",
        )
        self.parser.add_argument(
            "--username",
            help="Single username to test",
        )
        self.parser.add_argument(
            "--username-file",
            help="File with usernames (one per line)",
        )
        self.parser.add_argument(
            "--password",
            help="Single password to test",
        )
        self.parser.add_argument(
            "--password-file",
            help="File with passwords (one per line)",
        )
        self.parser.add_argument(
            "--threads", type=int, default=4,
            help="Parallel tasks (default: 4). Keep low to avoid lockouts.",
        )
        self.parser.add_argument(
            "--http-form",
            help="HTTP form params: '/path:user=^USER^&pass=^PASS^:F=error_string'",
        )
        self.parser.add_argument(
            "--ssl", action="store_true",
            help="Use SSL/TLS for the connection",
        )

    def run(self, args) -> None:
        if not args.username and not args.username_file:
            self.output_error("Provide --username or --username-file")
            return
        if not args.password and not args.password_file:
            self.output_error("Provide --password or --password-file")
            return

        hy_args: list[str] = []

        if args.username:
            hy_args.extend(["-l", args.username])
        elif args.username_file:
            hy_args.extend(["-L", args.username_file])

        if args.password:
            hy_args.extend(["-p", args.password])
        elif args.password_file:
            hy_args.extend(["-P", args.password_file])

        hy_args.extend(["-t", str(args.threads)])
        hy_args.extend(["-w", "10"])  # Wait time between retries
        hy_args.append("-V")  # Verbose

        if args.ssl:
            hy_args.append("-S")
        if args.port:
            hy_args.extend(["-s", str(args.port)])

        # Service specification
        service = args.service
        if args.http_form and "http" in service:
            hy_args.extend([args.target, service, args.http_form])
        else:
            hy_args.extend([args.target, service])

        start = time.monotonic()
        result = self.run_tool("hydra", hy_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        found = self._parse_output(result.stdout + result.stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0 if found else 1,
            result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "target": args.target,
            "service": args.service,
            "found_credentials": found,
            "credential_count": len(found),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse hydra output for found credentials."""
        found: list[dict] = []
        for line in output.split("\n"):
            # Pattern: [PORT][SERVICE] host: TARGET   login: USER   password: PASS
            match = re.search(
                r"\[(\d+)\]\[(\w+)\]\s+host:\s+(\S+)\s+login:\s+(\S+)\s+password:\s*(.*)",
                line,
            )
            if match:
                found.append({
                    "port": int(match.group(1)),
                    "service": match.group(2),
                    "host": match.group(3),
                    "username": match.group(4),
                    "password": match.group(5).strip(),
                })
        return found


if __name__ == "__main__":
    HydraBruter().execute()

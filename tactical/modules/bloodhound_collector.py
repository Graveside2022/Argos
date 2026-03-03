#!/usr/bin/env python3
"""
bloodhound_collector — AD graph data collection via bloodhound-python.

CLI deps: bloodhound-python (pip, installed on Kali)

Collects Active Directory data (users, groups, computers, sessions,
ACLs, trusts) for attack path analysis in BloodHound.
"""

import json
import os
import time

from base_module import TacticalModule


class BloodHoundCollector(TacticalModule):
    name = "bloodhound_collector"
    description = "AD graph data collection via bloodhound-python"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain", required=True,
            help="Target AD domain (e.g., corp.local)",
        )
        self.parser.add_argument(
            "--username", required=True,
            help="Domain username",
        )
        self.parser.add_argument(
            "--password",
            help="Domain password",
        )
        self.parser.add_argument(
            "--hash",
            help="NTLM hash for auth",
        )
        self.parser.add_argument(
            "--dc-ip",
            help="Domain controller IP (auto-detected if omitted)",
        )
        self.parser.add_argument(
            "--collection",
            default="Default",
            help="Collection method: Default, All, DCOnly, Group, LocalAdmin, Session, Trusts, ACL, ObjectProps, Container (default: Default)",
        )
        self.parser.add_argument(
            "--output-dir", default="/tmp/bloodhound",
            help="Output directory for JSON files (default: /tmp/bloodhound)",
        )

    def run(self, args) -> None:
        if not self.validate_domain(args.domain):
            self.output_error(f"Invalid domain: {args.domain}")
            return
        if not args.password and not args.hash:
            self.output_error("Provide --password or --hash")
            return

        os.makedirs(args.output_dir, exist_ok=True)

        bh_args = [
            "-d", args.domain,
            "-u", args.username,
            "-c", args.collection,
            "--zip",
            "-o", args.output_dir,
        ]

        if args.password:
            bh_args.extend(["-p", args.password])
        if args.hash:
            bh_args.extend(["--hashes", args.hash])
        if args.dc_ip:
            bh_args.extend(["-dc", args.dc_ip])

        start = time.monotonic()
        result = self.run_tool("bloodhound-python", bh_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        # Find generated zip files
        output_files = [
            os.path.join(args.output_dir, f)
            for f in os.listdir(args.output_dir)
            if f.endswith(".zip") or f.endswith(".json")
        ] if os.path.isdir(args.output_dir) else []

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "domain": args.domain,
            "collection": args.collection,
            "output_files": output_files,
            "file_count": len(output_files),
            "output_dir": args.output_dir,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    BloodHoundCollector().execute()

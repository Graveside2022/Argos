#!/usr/bin/env python3
"""
ad_enum — Active Directory enumeration via enum4linux + netexec.

CLI deps: enum4linux-ng (installed on Kali), nxc

Enumerates SMB/AD information: users, groups, shares, password policy,
machines, and domain information.
"""

import json
import re
import time

from base_module import TacticalModule


class ADEnum(TacticalModule):
    name = "ad_enum"
    description = "Active Directory enumeration via enum4linux + netexec"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--target", required=True,
            help="Target DC or SMB server IP",
        )
        self.parser.add_argument(
            "--username",
            help="Username for authenticated enumeration",
        )
        self.parser.add_argument(
            "--password",
            help="Password",
        )
        self.parser.add_argument(
            "--domain",
            help="AD domain name",
        )
        self.parser.add_argument(
            "--tool", choices=["enum4linux", "nxc", "both"], default="both",
            help="Enumeration tool (default: both)",
        )

    def run(self, args) -> None:
        start = time.monotonic()
        results: dict = {"target": args.target, "tool": args.tool}

        if args.tool in ("enum4linux", "both"):
            e4l_data = self._run_enum4linux(args)
            results["enum4linux"] = e4l_data

        if args.tool in ("nxc", "both"):
            nxc_data = self._run_nxc(args)
            results["nxc"] = nxc_data

        duration_ms = int((time.monotonic() - start) * 1000)
        results["duration_ms"] = duration_ms

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            0, "", "", duration_ms,
        )
        self.output_success(results)

    def _run_enum4linux(self, args) -> dict:
        """Run enum4linux-ng for SMB enumeration."""
        e4l_args = ["-A", args.target]  # -A = all simple enumeration

        if args.username:
            e4l_args.extend(["-u", args.username])
        if args.password:
            e4l_args.extend(["-p", args.password])

        result = self.run_tool("enum4linux-ng", e4l_args, timeout=args.timeout)
        return self._parse_enum4linux(result.stdout)

    def _run_nxc(self, args) -> dict:
        """Run netexec for SMB enumeration."""
        base_args = ["smb", args.target]
        if args.username:
            base_args.extend(["-u", args.username, "-p", args.password or ""])
        else:
            base_args.extend(["-u", "", "-p", ""])

        if args.domain:
            base_args.extend(["-d", args.domain])

        data: dict = {}

        # Users
        result = self.run_tool("nxc", base_args + ["--users"], timeout=60)
        data["users"] = self._parse_nxc_list(result.stdout)

        # Shares
        result = self.run_tool("nxc", base_args + ["--shares"], timeout=60)
        data["shares"] = self._parse_nxc_list(result.stdout)

        # Groups
        result = self.run_tool("nxc", base_args + ["--groups"], timeout=60)
        data["groups"] = self._parse_nxc_list(result.stdout)

        # Password policy
        result = self.run_tool("nxc", base_args + ["--pass-pol"], timeout=60)
        data["password_policy"] = result.stdout[:2000]

        return data

    @staticmethod
    def _parse_enum4linux(output: str) -> dict:
        """Parse enum4linux-ng output."""
        data: dict = {
            "os_info": "",
            "domain": "",
            "users": [],
            "shares": [],
            "groups": [],
            "password_policy": "",
        }
        section = ""
        for line in output.split("\n"):
            line = line.strip()
            if "OS:" in line:
                data["os_info"] = line
            elif "Domain:" in line and not data["domain"]:
                data["domain"] = line.split(":", 1)[-1].strip()
            elif "user:" in line.lower():
                user_match = re.search(r"user:\[([^\]]+)\]", line, re.IGNORECASE)
                if user_match:
                    data["users"].append(user_match.group(1))
            elif "Sharename" in line:
                section = "shares"
            elif section == "shares" and line and not line.startswith("---"):
                parts = line.split()
                if parts:
                    data["shares"].append(parts[0])
            elif "group:" in line.lower():
                grp_match = re.search(r"group:\[([^\]]+)\]", line, re.IGNORECASE)
                if grp_match:
                    data["groups"].append(grp_match.group(1))
        return data

    @staticmethod
    def _parse_nxc_list(output: str) -> list[str]:
        """Parse netexec list output."""
        items: list[str] = []
        for line in output.split("\n"):
            line = line.strip()
            if line and ("[*]" in line or "[+]" in line):
                # Remove prefix markers
                clean = re.sub(r"^\[.\]\s+\S+\s+", "", line).strip()
                if clean:
                    items.append(clean[:200])
        return items


if __name__ == "__main__":
    ADEnum().execute()

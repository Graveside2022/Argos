#!/usr/bin/env python3
"""
osint_framework — OSINT data gathering via recon-ng.

CLI deps: recon-ng (installed on Kali)

Dispatches recon-ng modules for OSINT data collection.
Runs in non-interactive mode with resource script generation.
"""

import json
import os
import tempfile
import time

from base_module import TacticalModule


class OSINTFramework(TacticalModule):
    name = "osint_framework"
    description = "OSINT data gathering via recon-ng"

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--domain",
            help="Target domain for reconnaissance",
        )
        self.parser.add_argument(
            "--workspace", default="argos",
            help="Recon-ng workspace name (default: argos)",
        )
        self.parser.add_argument(
            "--module",
            help="Specific recon-ng module to run (e.g., recon/domains-hosts/bing_domain_web)",
        )
        self.parser.add_argument(
            "--list-modules", action="store_true",
            help="List available recon-ng modules",
        )
        self.parser.add_argument(
            "--show",
            choices=["hosts", "contacts", "credentials", "vulnerabilities", "ports", "companies"],
            help="Show data from workspace",
        )

    def run(self, args) -> None:
        if args.list_modules:
            self._list_modules(args)
            return

        if args.show:
            self._show_data(args)
            return

        if not args.domain:
            self.output_error("--domain is required when running modules")
            return
        if not self.validate_domain(args.domain):
            self.output_error(f"Invalid domain: {args.domain}")
            return

        # Build resource script
        commands = [
            f"workspaces create {args.workspace}",
            f"db insert domains domain={args.domain}",
        ]

        if args.module:
            commands.extend([
                f"modules load {args.module}",
                f"options set SOURCE {args.domain}",
                "run",
            ])
        else:
            # Default module set
            default_modules = [
                "recon/domains-hosts/hackertarget",
                "recon/domains-hosts/threatminer",
            ]
            for mod in default_modules:
                commands.extend([
                    f"modules load {mod}",
                    f"options set SOURCE {args.domain}",
                    "run",
                    "back",
                ])

        commands.append("exit")

        # Write resource script
        rc_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".rc", delete=False
        )
        rc_file.write("\n".join(commands) + "\n")
        rc_file.close()

        start = time.monotonic()
        result = self.run_tool(
            "recon-ng", ["-r", rc_file.name],
            timeout=args.timeout,
        )
        duration_ms = int((time.monotonic() - start) * 1000)

        try:
            os.unlink(rc_file.name)
        except OSError:
            pass

        findings = self._parse_output(result.stdout)

        self.log_run(
            args.db_path, self.name,
            json.dumps(vars(args), default=str),
            result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms,
        )
        self.output_success({
            "domain": args.domain,
            "workspace": args.workspace,
            "module": args.module or "defaults",
            "findings": findings,
            "duration_ms": duration_ms,
        })

    def _list_modules(self, args) -> None:
        """List available recon-ng modules."""
        rc = "modules search\nexit\n"
        rc_file = tempfile.NamedTemporaryFile(mode="w", suffix=".rc", delete=False)
        rc_file.write(rc)
        rc_file.close()

        result = self.run_tool("recon-ng", ["-r", rc_file.name], timeout=30)
        try:
            os.unlink(rc_file.name)
        except OSError:
            pass

        modules: list[str] = []
        for line in result.stdout.split("\n"):
            line = line.strip()
            if line.startswith("recon/") or line.startswith("discovery/") or line.startswith("reporting/"):
                modules.append(line.split()[0])

        self.output_success({"modules": modules, "count": len(modules)})

    def _show_data(self, args) -> None:
        """Show data from recon-ng workspace."""
        rc = f"workspaces load {args.workspace}\nshow {args.show}\nexit\n"
        rc_file = tempfile.NamedTemporaryFile(mode="w", suffix=".rc", delete=False)
        rc_file.write(rc)
        rc_file.close()

        result = self.run_tool("recon-ng", ["-r", rc_file.name], timeout=30)
        try:
            os.unlink(rc_file.name)
        except OSError:
            pass

        self.output_success({
            "workspace": args.workspace,
            "table": args.show,
            "data": result.stdout[:5000],
        })

    @staticmethod
    def _parse_output(output: str) -> list[dict]:
        """Parse recon-ng output for key findings."""
        findings: list[dict] = []
        for line in output.split("\n"):
            line = line.strip()
            if "[*]" in line:
                findings.append({"info": line.replace("[*]", "").strip()[:300]})
        return findings


if __name__ == "__main__":
    OSINTFramework().execute()

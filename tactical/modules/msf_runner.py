#!/usr/bin/env python3
"""
Metasploit Runner Module — msfconsole resource script runner.

Executes Metasploit modules via auto-generated or user-supplied resource
scripts (.rc files). Supports both direct module execution (via --module
with --options) and arbitrary resource file execution (via --resource-file).

Resource script approach is chosen over msfcli (deprecated) and over the
XMLRPC API (heavyweight dependency) for simplicity and auditability.
"""

import argparse
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any

from base_module import TacticalModule


class MsfRunner(TacticalModule):
    """Execute Metasploit modules via msfconsole resource scripts."""

    name: str = "msf_runner"
    description: str = (
        "Run Metasploit modules or resource scripts via msfconsole. "
        "Provide --resource-file for existing .rc files or "
        "--module + --options to auto-generate a resource script."
    )

    def _add_module_args(self) -> None:
        """Register Metasploit runner arguments."""
        source = self.parser.add_mutually_exclusive_group(required=True)
        source.add_argument(
            "--resource-file",
            help="Path to existing Metasploit resource script (.rc)",
        )
        source.add_argument(
            "--module",
            help=(
                "Metasploit module path (e.g. exploit/multi/handler, "
                "auxiliary/scanner/portscan/tcp)"
            ),
        )
        self.parser.add_argument(
            "--options",
            nargs="*",
            default=[],
            metavar="KEY=VALUE",
            help="Module options as KEY=VALUE pairs (e.g. RHOSTS=10.0.0.1 LPORT=4444)",
        )
        self.parser.add_argument(
            "--payload",
            default="",
            help="Payload module to use (e.g. linux/x86/meterpreter/reverse_tcp)",
        )
        self.parser.add_argument(
            "--output-file",
            default="",
            help="Write msfconsole output to this file path",
        )
        self.parser.add_argument(
            "--run-timeout",
            type=int,
            default=120,
            help="Max seconds to wait for msfconsole to complete (default: 120)",
        )
        self.parser.add_argument(
            "--no-save-output",
            action="store_true",
            default=False,
            help="Do not save stdout to output-file even if specified",
        )
        self.parser.add_argument(
            "--extra-commands",
            nargs="*",
            default=[],
            help="Additional msfconsole commands to append to the resource script",
        )

    # ── Validation ───────────────────────────────────────────────────

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate all arguments before execution."""
        if args.resource_file:
            rc_path = Path(args.resource_file)
            if not rc_path.exists():
                self.output_error(f"Resource file not found: {args.resource_file!r}")
            if not rc_path.is_file():
                self.output_error(f"Resource path is not a file: {args.resource_file!r}")

        if args.module:
            # Module paths are alphanumeric with slashes and underscores
            if not re.match(r"^[a-zA-Z0-9_/.-]+$", args.module):
                self.output_error(
                    f"Invalid module path: {args.module!r}. "
                    "Only alphanumeric, slashes, dots, underscores, and dashes allowed."
                )

        if args.output_file:
            output_dir = Path(args.output_file).parent
            if not output_dir.exists():
                self.output_error(
                    f"Output directory does not exist: {output_dir}"
                )

        # Validate KEY=VALUE option format
        for opt in args.options:
            if "=" not in opt:
                self.output_error(
                    f"Invalid option format: {opt!r}. Must be KEY=VALUE."
                )
            key, _ = opt.split("=", 1)
            if not re.match(r"^[A-Z0-9_]{1,32}$", key):
                self.output_error(
                    f"Invalid option key: {key!r}. Must be UPPER_CASE_ALPHANUMERIC."
                )

        if args.run_timeout < 10 or args.run_timeout > 3600:
            self.output_error(
                f"--run-timeout must be 10–3600 seconds, got {args.run_timeout}."
            )

    # ── Resource script generation ───────────────────────────────────

    def _generate_resource_script(self, args: argparse.Namespace) -> str:
        """
        Generate a .rc resource script for the given module and options.

        Returns the path to the generated temporary .rc file.
        """
        lines: list[str] = [
            f"use {args.module}",
        ]

        # Set each KEY=VALUE option
        for opt in args.options:
            key, value = opt.split("=", 1)
            lines.append(f"set {key} {value}")

        # Set payload if provided
        if args.payload:
            lines.append(f"set PAYLOAD {args.payload}")

        # Append extra commands (e.g. 'check', 'run', 'exploit')
        if args.extra_commands:
            lines.extend(args.extra_commands)
        else:
            # Default: run and exit
            lines.append("run -j")
            lines.append("sleep 5")

        # Always exit when done
        lines.append("exit -y")

        script_content = "\n".join(lines) + "\n"

        # Write to temp file
        fd, tmp_path = tempfile.mkstemp(suffix=".rc", prefix="msf_runner_")
        import os
        with os.fdopen(fd, "w") as f:
            f.write(script_content)

        self.logger.info("Generated resource script at %s:\n%s", tmp_path, script_content)
        return tmp_path

    # ── Command builder ──────────────────────────────────────────────

    def _build_msfconsole_args(self, resource_file: str) -> list[str]:
        """Build msfconsole argument list for resource script execution."""
        return [
            "-q",           # quiet (suppress banner)
            "-n",           # no database auto-connect (faster startup)
            "-r", resource_file,
        ]

    # ── Output parsing ───────────────────────────────────────────────

    def _parse_msf_output(self, stdout: str, stderr: str) -> dict[str, Any]:
        """
        Extract key events from msfconsole output.

        Looks for:
        - Session opens/closes
        - Exploit success/failure messages
        - Error messages
        - Module completion indicators
        """
        combined = stdout + "\n" + stderr
        result: dict[str, Any] = {
            "sessions_opened": [],
            "errors": [],
            "warnings": [],
            "module_results": [],
            "raw_line_count": len(combined.splitlines()),
        }

        # Session opened: [*] Meterpreter session 1 opened (192.168.x.x:4444 -> ...)
        session_pattern = re.compile(
            r"\[\*\]\s+(?:Meterpreter|Command shell|session)\s+(\d+)\s+opened\s+"
            r"\(([^)]+)\)",
            re.IGNORECASE,
        )
        for match in session_pattern.finditer(combined):
            result["sessions_opened"].append({
                "session_id": int(match.group(1)),
                "connection": match.group(2),
            })

        # Exploit result lines
        result_pattern = re.compile(
            r"\[([+\-!*])\]\s+(.+)", re.MULTILINE
        )
        for match in result_pattern.finditer(combined):
            marker = match.group(1)
            message = match.group(2).strip()

            if marker == "+":  # Success
                result["module_results"].append({"level": "success", "message": message})
            elif marker == "-":  # Failure/negative
                result["module_results"].append({"level": "failure", "message": message})
            elif marker == "!":  # Error/warning
                result["errors"].append(message)
            # [*] info messages are too noisy — skip

        # Exploit-specific checks
        result["exploit_succeeded"] = any(
            r["level"] == "success" for r in result["module_results"]
        )
        result["session_count"] = len(result["sessions_opened"])

        return result

    # ── Output file handling ─────────────────────────────────────────

    def _save_output(self, content: str, output_file: str) -> None:
        """Write msfconsole stdout to output file if requested."""
        try:
            Path(output_file).write_text(content, encoding="utf-8")
            self.logger.info("Output saved to %s", output_file)
        except OSError as e:
            self.logger.warning("Failed to save output to %s: %s", output_file, e)

    # ── Main run ─────────────────────────────────────────────────────

    def run(self, args: argparse.Namespace) -> None:
        """Execute msfconsole with resource script and parse results."""
        self._validate_args(args)

        # Determine the resource file to use
        tmp_rc_path: str | None = None

        if args.module:
            tmp_rc_path = self._generate_resource_script(args)
            resource_file = tmp_rc_path
        else:
            resource_file = args.resource_file

        self.logger.info("Launching msfconsole with resource file: %s", resource_file)

        msf_args = self._build_msfconsole_args(resource_file)

        try:
            stdout, stderr = self.run_tool_popen(
                "msfconsole",
                msf_args,
                duration=args.run_timeout,
            )
        finally:
            # Always clean up temp file
            if tmp_rc_path:
                try:
                    Path(tmp_rc_path).unlink(missing_ok=True)
                except OSError:
                    pass

        # Optionally save raw output
        if args.output_file and not args.no_save_output:
            self._save_output(stdout, args.output_file)

        parsed = self._parse_msf_output(stdout, stderr)

        self.output_success({
            "module": args.module or "(resource file)",
            "resource_file": args.resource_file or "(generated)",
            "options": dict(opt.split("=", 1) for opt in args.options),
            "payload": args.payload or "(none)",
            "run_timeout_seconds": args.run_timeout,
            "output_file": args.output_file or "(not saved)",
            **parsed,
        })


if __name__ == "__main__":
    MsfRunner().execute()

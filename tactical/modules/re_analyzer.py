#!/usr/bin/env python3
"""
Reverse Engineering Analyzer Module — static analysis via radare2.

Wraps radare2 (r2) in non-interactive batch mode (-q -c "command")
to extract binary intelligence: file info, strings, functions,
imports, section layout, and disassembly at a specific address.
Uses r2's JSON output (aj/aflj/iij/isj/pdj flags) where available.
"""

import argparse
import json
import re
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# r2 commands for each mode (prefer JSON output with j suffix)
_R2_COMMANDS: dict[str, str] = {
    "info":      "ij",        # binary info JSON
    "strings":   "izj",       # strings JSON
    "functions": "aflj",      # function list JSON
    "imports":   "iij",       # imports JSON
    "sections":  "iSj",       # sections JSON
    "disasm":    "",           # set per-run (pdj @ address)
}

# Fallback non-JSON commands when JSON fails
_R2_PLAIN_COMMANDS: dict[str, str] = {
    "info":      "i",
    "strings":   "iz",
    "functions": "afl",
    "imports":   "ii",
    "sections":  "iS",
    "disasm":    "",
}

_HEX_ADDR_RE = re.compile(r"^0x[0-9a-fA-F]+$")


class ReAnalyzer(TacticalModule):
    """Static binary analysis using radare2 (r2) in non-interactive mode."""

    name = "re_analyzer"
    description = (
        "Perform static reverse engineering analysis on a binary using radare2: "
        "info, strings, functions, imports, sections, or disassembly."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--file",
            required=True,
            help="Path to the binary executable or library to analyze.",
        )
        self.parser.add_argument(
            "--mode",
            choices=["info", "strings", "functions", "imports", "sections", "disasm"],
            default="info",
            help="Analysis mode (default: info).",
        )
        self.parser.add_argument(
            "--address",
            default="",
            help=(
                "Hex address for disassembly mode (e.g. 0x401000). "
                "Defaults to entry point if not provided."
            ),
        )
        self.parser.add_argument(
            "--instructions",
            type=int,
            default=32,
            dest="instructions",
            help="Number of instructions to disassemble (default: 32, disasm mode only).",
        )
        self.parser.add_argument(
            "--analyze",
            action="store_true",
            default=True,
            help="Run 'aa' (full analysis) before querying. Required for functions/imports.",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate file existence and address format."""
        if not Path(args.file).exists():
            self.output_error(
                f"File not found: {args.file}",
                {"path": args.file},
            )
        if args.mode == "disasm" and args.address:
            if not _HEX_ADDR_RE.match(args.address):
                self.output_error(
                    f"Invalid address format: {args.address}. Use hex (e.g. 0x401000).",
                    {"address": args.address},
                )
        if args.instructions < 1 or args.instructions > 1000:
            self.output_error(
                "Instructions count must be 1–1000.",
                {"instructions": args.instructions},
            )

    def _build_r2_command(self, args: argparse.Namespace) -> str:
        """Construct the r2 -c command string."""
        pre = "aa;" if args.analyze and args.mode in ("functions", "imports") else ""
        if args.mode == "disasm":
            addr_part = args.address if args.address else "entry0"
            return f"{pre}pdj {args.instructions} @ {addr_part}"
        return f"{pre}{_R2_COMMANDS[args.mode]}"

    def _run_r2(self, args: argparse.Namespace, command: str) -> tuple[str, int]:
        """Execute r2 in batch mode and return (stdout, return_code)."""
        r2_args = [
            "-q",       # quiet (no banner)
            "-e", "scr.color=false",
            "-e", "anal.timeout=60",
            "-c", command,
            args.file,
        ]
        result = self.run_tool("r2", r2_args, timeout=args.timeout)
        return result.stdout, result.returncode

    def _parse_output(
        self, mode: str, raw: str
    ) -> dict[str, Any]:
        """Parse r2 JSON output, falling back to raw text on failure."""
        raw = raw.strip()
        if not raw:
            return {"raw": "", "parsed": False}

        # Try JSON parse
        try:
            data = json.loads(raw)
            return {"data": data, "parsed": True, "count": len(data) if isinstance(data, list) else 1}
        except json.JSONDecodeError:
            pass

        # Fallback: return raw lines as list
        lines = [l for l in raw.splitlines() if l.strip()]
        return {"raw_lines": lines, "parsed": False, "count": len(lines)}

    def _summarize(self, mode: str, parsed: dict[str, Any]) -> dict[str, Any]:
        """Add mode-specific summary fields."""
        if not parsed.get("parsed") or "data" not in parsed:
            return parsed

        data = parsed["data"]
        summary: dict[str, Any] = {"parsed": True}

        if mode == "strings" and isinstance(data, list):
            summary["string_count"] = len(data)
            summary["strings"] = [
                {
                    "offset": s.get("vaddr", s.get("paddr")),
                    "length": s.get("length"),
                    "string": s.get("string", ""),
                    "section": s.get("section", ""),
                }
                for s in data[:200]
            ]
            summary["truncated"] = len(data) > 200

        elif mode == "functions" and isinstance(data, list):
            summary["function_count"] = len(data)
            summary["functions"] = [
                {
                    "offset": f.get("offset"),
                    "name": f.get("name"),
                    "size": f.get("size"),
                    "instructions": f.get("ninstr"),
                    "cyclomatic_complexity": f.get("cc"),
                }
                for f in data[:100]
            ]
            summary["truncated"] = len(data) > 100

        elif mode == "imports" and isinstance(data, list):
            summary["import_count"] = len(data)
            summary["imports"] = [
                {
                    "name": i.get("name"),
                    "type": i.get("type"),
                    "plt": i.get("plt"),
                    "ordinal": i.get("ordinal"),
                }
                for i in data
            ]

        elif mode == "sections" and isinstance(data, list):
            summary["section_count"] = len(data)
            summary["sections"] = [
                {
                    "name": s.get("name"),
                    "size": s.get("size"),
                    "vsize": s.get("vsize"),
                    "perm": s.get("perm"),
                    "paddr": s.get("paddr"),
                    "vaddr": s.get("vaddr"),
                }
                for s in data
            ]

        elif mode == "info" and isinstance(data, dict):
            summary["info"] = data

        elif mode == "disasm" and isinstance(data, list):
            summary["instruction_count"] = len(data)
            summary["instructions"] = [
                {
                    "offset": ins.get("offset"),
                    "opcode": ins.get("opcode"),
                    "type": ins.get("type"),
                    "size": ins.get("size"),
                }
                for ins in data
            ]

        else:
            summary["data"] = data

        return summary

    def run(self, args: argparse.Namespace) -> None:
        """Execute r2 analysis and return structured results."""
        self._validate_args(args)
        command = self._build_r2_command(args)
        file_size = Path(args.file).stat().st_size

        self.logger.info(
            "r2 %s analysis on %s (%.2f MB) — command: %s",
            args.mode,
            args.file,
            file_size / (1024 * 1024),
            command,
        )

        raw_output, return_code = self._run_r2(args, command)

        if not raw_output and return_code != 0:
            self.output_error(
                "r2 produced no output. File may be unsupported or corrupt.",
                {"return_code": return_code, "file": args.file},
            )

        parsed = self._parse_output(args.mode, raw_output)
        summary = self._summarize(args.mode, parsed)

        self.output_success(
            {
                "file": args.file,
                "file_size_bytes": file_size,
                "mode": args.mode,
                "r2_command": command,
                "return_code": return_code,
                **summary,
            }
        )


if __name__ == "__main__":
    ReAnalyzer().execute()

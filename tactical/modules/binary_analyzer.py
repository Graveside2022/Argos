#!/usr/bin/env python3
"""
Binary Analyzer Module — firmware and binary analysis via binwalk.

Wraps binwalk to perform signature scanning, entropy analysis, and
optional extraction on firmware images and binary blobs. Returns a
structured list of found signatures with offsets and descriptions.
"""

import argparse
import re
from pathlib import Path
from typing import Any

from base_module import TacticalModule


# Pattern: "DECIMAL    HEX    DESCRIPTION"
_SIGNATURE_RE = re.compile(
    r"^(?P<decimal>\d+)\s+(?P<hex>0x[0-9A-Fa-f]+)\s+(?P<description>.+)$"
)

# Entropy output: "DECIMAL    HEX    ENTROPY"
_ENTROPY_RE = re.compile(
    r"^(?P<decimal>\d+)\s+(?P<hex>0x[0-9A-Fa-f]+)\s+(?P<entropy>[\d.]+)$"
)


class BinaryAnalyzer(TacticalModule):
    """Firmware and binary analysis using binwalk."""

    name = "binary_analyzer"
    description = (
        "Analyze binary files and firmware images with binwalk: "
        "signature scanning, entropy analysis, and optional extraction."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--file",
            required=True,
            help="Path to the binary or firmware file to analyze.",
        )
        self.parser.add_argument(
            "--extract",
            action="store_true",
            default=False,
            help="Extract identified file systems and data (-e flag).",
        )
        self.parser.add_argument(
            "--signature",
            action="store_true",
            default=True,
            help="Run signature scan (default: True).",
        )
        self.parser.add_argument(
            "--entropy",
            action="store_true",
            default=False,
            help="Run entropy analysis (-E flag).",
        )
        self.parser.add_argument(
            "--output-dir",
            default="",
            dest="output_dir",
            help="Directory for extracted files (default: <file>_extracted/).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate file existence and readability."""
        path = Path(args.file)
        if not path.exists():
            self.output_error(
                f"File not found: {args.file}",
                {"path": args.file},
            )
        if not path.is_file():
            self.output_error(
                f"Path is not a regular file: {args.file}",
                {"path": args.file},
            )
        if path.stat().st_size == 0:
            self.output_error(
                "File is empty — nothing to analyze.",
                {"path": args.file},
            )

    def _build_args(self, args: argparse.Namespace) -> list[str]:
        """Construct binwalk argument list."""
        cmd: list[str] = []
        if args.signature:
            cmd.append("--signature")
        if args.entropy:
            cmd.append("--entropy")
        if args.extract:
            cmd.append("-e")
            cmd.append("--run-as=root")
            if args.output_dir:
                cmd += ["-C", args.output_dir]
        cmd.append(args.file)
        return cmd

    def _parse_signatures(self, output: str) -> list[dict[str, Any]]:
        """Parse signature scan output into structured records."""
        signatures: list[dict[str, Any]] = []
        in_results = False

        for line in output.splitlines():
            line = line.strip()
            if line.startswith("DECIMAL") and "HEX" in line:
                in_results = True
                continue
            if line.startswith("---"):
                continue
            if not in_results or not line:
                continue
            match = _SIGNATURE_RE.match(line)
            if match:
                desc = match.group("description").strip()
                # Extract type hint from description (first word / phrase)
                file_type = desc.split(",")[0].strip()
                signatures.append(
                    {
                        "offset_decimal": int(match.group("decimal")),
                        "offset_hex": match.group("hex"),
                        "type": file_type,
                        "description": desc,
                    }
                )
        return signatures

    def _parse_entropy(self, output: str) -> list[dict[str, Any]]:
        """Parse entropy analysis output into offset/entropy pairs."""
        entries: list[dict[str, Any]] = []
        for line in output.splitlines():
            line = line.strip()
            match = _ENTROPY_RE.match(line)
            if match:
                entropy_val = float(match.group("entropy"))
                entries.append(
                    {
                        "offset_decimal": int(match.group("decimal")),
                        "offset_hex": match.group("hex"),
                        "entropy": entropy_val,
                        "encrypted_or_compressed": entropy_val > 0.9,
                    }
                )
        return entries

    def _find_extracted_files(self, args: argparse.Namespace) -> list[str]:
        """List files extracted by binwalk -e."""
        if not args.extract:
            return []
        if args.output_dir:
            extract_dir = Path(args.output_dir)
        else:
            extract_dir = Path(args.file).parent / f"_{Path(args.file).name}.extracted"

        if not extract_dir.exists():
            return []
        return [str(p) for p in extract_dir.rglob("*") if p.is_file()]

    def run(self, args: argparse.Namespace) -> None:
        """Execute binwalk analysis and parse results."""
        self._validate_args(args)
        cmd_args = self._build_args(args)
        file_size = Path(args.file).stat().st_size

        self.logger.info(
            "Analyzing %s (%.2f MB) with binwalk [sig=%s, entropy=%s, extract=%s]",
            args.file,
            file_size / (1024 * 1024),
            args.signature,
            args.entropy,
            args.extract,
        )

        result = self.run_tool(
            "binwalk",
            cmd_args,
            timeout=args.timeout,
        )

        combined_output = result.stdout + "\n" + result.stderr
        signatures = self._parse_signatures(combined_output) if args.signature else []
        entropy_data = self._parse_entropy(combined_output) if args.entropy else []
        extracted_files = self._find_extracted_files(args)

        high_entropy_regions = [
            e for e in entropy_data if e["encrypted_or_compressed"]
        ]

        self.output_success(
            {
                "file": args.file,
                "file_size_bytes": file_size,
                "file_size_mb": round(file_size / (1024 * 1024), 2),
                "signatures_found": len(signatures),
                "signatures": signatures,
                "entropy_regions": entropy_data,
                "high_entropy_region_count": len(high_entropy_regions),
                "extracted": args.extract,
                "extracted_files": extracted_files,
                "extracted_file_count": len(extracted_files),
                "return_code": result.returncode,
            }
        )


if __name__ == "__main__":
    BinaryAnalyzer().execute()

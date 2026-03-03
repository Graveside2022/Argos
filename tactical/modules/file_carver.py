#!/usr/bin/env python3
"""
File Carver Module — forensic data carving via bulk_extractor.

Runs bulk_extractor against a disk image or directory to carve
forensic artifacts (email addresses, URLs, domains, phone numbers,
credit card numbers, etc.) from raw binary streams without
mounting or parsing the file system.
"""

import argparse
import re
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# Known bulk_extractor feature file names and their artifact type
_SCANNER_TO_FILE: dict[str, str] = {
    "email": "email.txt",
    "url": "url.txt",
    "domain": "domain.txt",
    "telephone": "telephone.txt",
    "credit": "ccn.txt",
    "base64": "base64.txt",
    "zip": "zip.txt",
    "exif": "exif.txt",
    "pdf": "pdf.txt",
    "json": "json.txt",
    "vcard": "vcard.txt",
}

# Feature line pattern: "offset\tfeature\tcontext"
_FEATURE_RE = re.compile(r"^(\d+)\t(.+?)(?:\t(.*))?$")


class FileCarver(TacticalModule):
    """Forensic data carving using bulk_extractor."""

    name = "file_carver"
    description = (
        "Carve forensic artifacts (emails, URLs, credit cards, etc.) "
        "from disk images or directories using bulk_extractor."
    )

    def _add_module_args(self) -> None:
        group = self.parser.add_mutually_exclusive_group(required=True)
        group.add_argument(
            "--input-file",
            dest="input_file",
            help="Disk image or binary file to carve.",
        )
        group.add_argument(
            "--input-dir",
            dest="input_dir",
            help="Directory of files to carve (bulk_extractor -R mode).",
        )
        self.parser.add_argument(
            "--output-dir",
            required=True,
            dest="output_dir",
            help="Directory to write bulk_extractor feature files into.",
        )
        self.parser.add_argument(
            "--scanners",
            default="email,url,domain,telephone",
            help=(
                "Comma-separated list of scanners to enable "
                "(default: email,url,domain,telephone). "
                "Available: email, url, domain, telephone, credit, "
                "base64, zip, exif, pdf, json, vcard"
            ),
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate input path and output directory."""
        if args.input_file and not Path(args.input_file).exists():
            self.output_error(
                f"Input file not found: {args.input_file}",
                {"path": args.input_file},
            )
        if args.input_dir and not Path(args.input_dir).is_dir():
            self.output_error(
                f"Input directory not found: {args.input_dir}",
                {"path": args.input_dir},
            )
        out = Path(args.output_dir)
        out.mkdir(parents=True, exist_ok=True)

    def _build_args(self, args: argparse.Namespace) -> list[str]:
        """Build bulk_extractor argument list."""
        scanners = [s.strip() for s in args.scanners.split(",") if s.strip()]
        cmd: list[str] = ["-o", args.output_dir]

        # Disable all scanners first, then enable only requested ones
        cmd += ["-S", "disable_all_scanners=1"]
        for scanner in scanners:
            cmd += ["-e", scanner]

        if args.input_dir:
            cmd += ["-R", args.input_dir]
        else:
            cmd.append(args.input_file)

        return cmd

    def _read_feature_file(self, feature_file: Path) -> list[dict[str, Any]]:
        """Parse a bulk_extractor feature text file into records."""
        features: list[dict[str, Any]] = []
        if not feature_file.exists():
            return features

        try:
            lines = feature_file.read_text(errors="replace").splitlines()
        except OSError as exc:
            self.logger.warning("Could not read %s: %s", feature_file, exc)
            return features

        for line in lines:
            if line.startswith("#") or not line.strip():
                continue
            match = _FEATURE_RE.match(line)
            if match:
                features.append(
                    {
                        "offset": int(match.group(1)),
                        "feature": match.group(2).strip(),
                        "context": (match.group(3) or "").strip()[:200],
                    }
                )
        return features

    def _collect_results(
        self, args: argparse.Namespace, scanners: list[str]
    ) -> dict[str, list[dict[str, Any]]]:
        """Read feature files for each requested scanner."""
        out_dir = Path(args.output_dir)
        results: dict[str, list[dict[str, Any]]] = {}

        for scanner in scanners:
            file_name = _SCANNER_TO_FILE.get(scanner, f"{scanner}.txt")
            feature_file = out_dir / file_name
            features = self._read_feature_file(feature_file)
            results[scanner] = features

        return results

    def run(self, args: argparse.Namespace) -> None:
        """Execute bulk_extractor and parse feature files."""
        self._validate_args(args)
        scanners = [s.strip() for s in args.scanners.split(",") if s.strip()]
        cmd_args = self._build_args(args)

        input_path = args.input_file or args.input_dir
        self.logger.info(
            "Carving %s with scanners [%s] → %s",
            input_path,
            ", ".join(scanners),
            args.output_dir,
        )

        result = self.run_tool(
            "bulk_extractor",
            cmd_args,
            timeout=args.timeout,
        )

        if result.returncode not in (0, 1):
            self.output_error(
                "bulk_extractor exited with unexpected error.",
                {
                    "return_code": result.returncode,
                    "stderr": result.stderr[-500:],
                },
            )

        artifact_map = self._collect_results(args, scanners)

        # Build per-scanner summary
        summary: list[dict[str, Any]] = []
        total_artifacts = 0
        for scanner, features in artifact_map.items():
            count = len(features)
            total_artifacts += count
            summary.append(
                {
                    "scanner": scanner,
                    "artifact_count": count,
                    "sample": features[:5],
                }
            )

        self.output_success(
            {
                "input": input_path,
                "output_dir": args.output_dir,
                "scanners_run": scanners,
                "total_artifacts": total_artifacts,
                "results_by_scanner": summary,
                "return_code": result.returncode,
            }
        )


if __name__ == "__main__":
    FileCarver().execute()

#!/usr/bin/env python3
"""
Disk Analyzer Module — forensic disk image analysis via SleuthKit.

Wraps the SleuthKit CLI tools (mmls, fls, img_stat, icat) to inspect
disk images without mounting them. Each tool mode parses its own output
into structured JSON records.

Tools:
  mmls      — list partition table entries
  fls       — list files/directories in a file system
  img_stat  — show image metadata (size, type, sector size)
  icat      — extract a file by inode number to stdout or a file
"""

import argparse
import re
import shutil
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# mmls output: "000:  Meta  0000000000  0000000000  0000000001  Primary Table"
_MMLS_RE = re.compile(
    r"^\s*(?P<slot>\d+):\s+"
    r"(?P<tag>\S+)\s+"
    r"(?P<start>\d+)\s+"
    r"(?P<end>\d+)\s+"
    r"(?P<length>\d+)\s+"
    r"(?P<desc>.+)$"
)

# fls output:  "r/r 12:  filename.txt"  or  "d/d 5:  dirname"
_FLS_RE = re.compile(
    r"^(?P<type>[drv])/(?P<subtype>[drv\-])\s+(?P<deleted>\*\s+)?(?P<inode>\d+)(?:-\d+)?:\t(?P<name>.+)$"
)

# img_stat output: "IMAGE FILE INFORMATION" section key-value pairs
_IMGSTAT_KV_RE = re.compile(r"^(?P<key>[A-Za-z][^:]+):\s+(?P<value>.+)$")


class DiskAnalyzer(TacticalModule):
    """Forensic disk image analysis using SleuthKit (mmls, fls, img_stat, icat)."""

    name = "disk_analyzer"
    description = (
        "Inspect disk images without mounting them using SleuthKit tools: "
        "mmls (partitions), fls (files), img_stat (metadata), icat (extract file)."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--image",
            required=True,
            help="Path to the disk image file (.img, .dd, .raw, .E01, etc.).",
        )
        self.parser.add_argument(
            "--tool",
            choices=["mmls", "fls", "img_stat", "icat"],
            required=True,
            help="SleuthKit tool to run.",
        )
        self.parser.add_argument(
            "--offset",
            type=int,
            default=None,
            help="Sector offset of the file system partition (required for fls/icat).",
        )
        self.parser.add_argument(
            "--inode",
            type=int,
            default=None,
            help="Inode number for icat file extraction.",
        )
        self.parser.add_argument(
            "--output-file",
            default="",
            dest="output_file",
            help="Write icat output to this file path (icat mode only).",
        )
        self.parser.add_argument(
            "--recursive",
            action="store_true",
            default=False,
            help="Recurse into subdirectories (fls -r flag).",
        )
        self.parser.add_argument(
            "--deleted-only",
            action="store_true",
            default=False,
            dest="deleted_only",
            help="Show only deleted files (fls -d flag).",
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate image path and tool-specific requirements."""
        if not Path(args.image).exists():
            self.output_error(
                f"Disk image not found: {args.image}",
                {"path": args.image},
            )
        if args.tool == "icat" and args.inode is None:
            self.output_error(
                "icat requires --inode to specify which file to extract.",
                {"tool": "icat"},
            )
        if args.tool in ("fls", "icat") and args.offset is None:
            self.logger.warning(
                "No --offset specified for %s; using image start (offset 0).",
                args.tool,
            )

    # ── Tool runners ────────────────────────────────────────────────

    def _run_mmls(self, args: argparse.Namespace) -> dict[str, Any]:
        """Run mmls to list partition table entries."""
        cmd_args = [args.image]
        result = self.run_tool("mmls", cmd_args, timeout=args.timeout)
        partitions: list[dict[str, Any]] = []
        for line in result.stdout.splitlines():
            match = _MMLS_RE.match(line)
            if match:
                length_sectors = int(match.group("length"))
                start = int(match.group("start"))
                partitions.append(
                    {
                        "slot": int(match.group("slot")),
                        "tag": match.group("tag"),
                        "start_sector": start,
                        "end_sector": int(match.group("end")),
                        "length_sectors": length_sectors,
                        "description": match.group("desc").strip(),
                        "size_mb": round(length_sectors * 512 / (1024 * 1024), 2),
                    }
                )
        return {
            "tool": "mmls",
            "image": args.image,
            "partition_count": len(partitions),
            "partitions": partitions,
            "return_code": result.returncode,
        }

    def _run_fls(self, args: argparse.Namespace) -> dict[str, Any]:
        """Run fls to list file system entries."""
        cmd_args: list[str] = []
        if args.recursive:
            cmd_args.append("-r")
        if args.deleted_only:
            cmd_args.append("-d")
        cmd_args += ["-l"]  # long format with timestamps
        if args.offset is not None:
            cmd_args += ["-o", str(args.offset)]
        cmd_args.append(args.image)

        result = self.run_tool("fls", cmd_args, timeout=args.timeout)
        entries: list[dict[str, Any]] = []
        for line in result.stdout.splitlines():
            match = _FLS_RE.match(line.strip())
            if match:
                entries.append(
                    {
                        "type": "directory" if match.group("type") == "d" else "file",
                        "inode": int(match.group("inode")),
                        "name": match.group("name").strip(),
                        "deleted": match.group("deleted") is not None,
                    }
                )
        deleted_count = sum(1 for e in entries if e["deleted"])
        return {
            "tool": "fls",
            "image": args.image,
            "offset": args.offset,
            "entry_count": len(entries),
            "deleted_count": deleted_count,
            "entries": entries[:500],
            "truncated": len(entries) > 500,
            "return_code": result.returncode,
        }

    def _run_img_stat(self, args: argparse.Namespace) -> dict[str, Any]:
        """Run img_stat to display image metadata."""
        result = self.run_tool("img_stat", [args.image], timeout=args.timeout)
        metadata: dict[str, str] = {}
        for line in result.stdout.splitlines():
            match = _IMGSTAT_KV_RE.match(line.strip())
            if match:
                key = match.group("key").strip().lower().replace(" ", "_")
                metadata[key] = match.group("value").strip()
        return {
            "tool": "img_stat",
            "image": args.image,
            "metadata": metadata,
            "return_code": result.returncode,
        }

    def _run_icat(self, args: argparse.Namespace) -> dict[str, Any]:
        """Run icat to extract a file by inode to stdout or a file."""
        cmd_args: list[str] = []
        if args.offset is not None:
            cmd_args += ["-o", str(args.offset)]
        cmd_args += [args.image, str(args.inode)]

        result = self.run_tool("icat", cmd_args, timeout=args.timeout)

        bytes_extracted = len(result.stdout.encode("latin-1", errors="replace"))
        output_file = None

        if args.output_file and result.returncode == 0:
            out = Path(args.output_file)
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(result.stdout.encode("latin-1", errors="replace"))
            output_file = str(out.resolve())
            self.logger.info("Wrote %d bytes to %s", bytes_extracted, output_file)

        return {
            "tool": "icat",
            "image": args.image,
            "offset": args.offset,
            "inode": args.inode,
            "bytes_extracted": bytes_extracted,
            "output_file": output_file,
            "return_code": result.returncode,
        }

    def run(self, args: argparse.Namespace) -> None:
        """Dispatch to the appropriate SleuthKit tool."""
        self._validate_args(args)

        tool_bin = args.tool
        if not shutil.which(tool_bin):
            self.output_error(
                f"SleuthKit tool not found: {tool_bin}. Install sleuthkit package.",
                {"tool": tool_bin},
            )

        self.logger.info("Running %s on %s", args.tool, args.image)

        dispatch = {
            "mmls": self._run_mmls,
            "fls": self._run_fls,
            "img_stat": self._run_img_stat,
            "icat": self._run_icat,
        }
        tool_result = dispatch[args.tool](args)
        self.output_success(tool_result)


if __name__ == "__main__":
    DiskAnalyzer().execute()

#!/usr/bin/env python3
"""
Android Decompiler Module — APK decompilation via jadx and apktool.

Supports two decompilation strategies:
  jadx    — decompile DEX bytecode to Java source code
  apktool — decode APK resources, smali, and AndroidManifest.xml
  both    — run both tools and collect combined artifacts

Returns decompiled output paths, class counts, and manifest metadata.
"""

import argparse
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from base_module import TacticalModule

# jadx output: "INFO  - done" or class count line
_JADX_CLASS_RE = re.compile(r"classes:\s*(\d+)", re.IGNORECASE)
_JADX_METHOD_RE = re.compile(r"methods:\s*(\d+)", re.IGNORECASE)
_JADX_ERROR_RE = re.compile(r"ERROR\s+-\s+(.+)", re.IGNORECASE)

# apktool output lines
_APKTOOL_DONE_RE = re.compile(r"I: Built in", re.IGNORECASE)


class AndroidDecompiler(TacticalModule):
    """APK decompilation using jadx (Java source) and/or apktool (resources/smali)."""

    name = "android_decompiler"
    description = (
        "Decompile Android APK files using jadx (Java source) and/or "
        "apktool (resources + smali + manifest)."
    )

    def _add_module_args(self) -> None:
        self.parser.add_argument(
            "--apk",
            required=True,
            help="Path to the APK file to decompile.",
        )
        self.parser.add_argument(
            "--tool",
            choices=["jadx", "apktool", "both"],
            default="jadx",
            help="Decompilation tool to use (default: jadx).",
        )
        self.parser.add_argument(
            "--output-dir",
            default="",
            dest="output_dir",
            help=(
                "Base output directory. Defaults to <apk_name>_decompiled/ "
                "next to the APK file."
            ),
        )

    def _validate_args(self, args: argparse.Namespace) -> None:
        """Validate APK path and extension."""
        apk_path = Path(args.apk)
        if not apk_path.exists():
            self.output_error(
                f"APK file not found: {args.apk}",
                {"path": args.apk},
            )
        if apk_path.suffix.lower() not in (".apk", ".xapk", ".zip"):
            self.logger.warning(
                "File extension %s may not be a valid APK.", apk_path.suffix
            )
        if apk_path.stat().st_size == 0:
            self.output_error("APK file is empty.", {"path": args.apk})

    def _resolve_output_dir(self, args: argparse.Namespace) -> Path:
        """Build the base output directory path."""
        if args.output_dir:
            base = Path(args.output_dir)
        else:
            apk_stem = Path(args.apk).stem
            base = Path(args.apk).parent / f"{apk_stem}_decompiled"
        base.mkdir(parents=True, exist_ok=True)
        return base

    def _run_jadx(
        self, args: argparse.Namespace, base_out: Path
    ) -> dict[str, Any]:
        """Run jadx to decompile DEX to Java source."""
        jadx_out = base_out / "jadx"
        jadx_out.mkdir(parents=True, exist_ok=True)

        jadx_args = [
            "--output-dir", str(jadx_out),
            "--threads-count", "2",
            "--log-level", "INFO",
            args.apk,
        ]

        result = self.run_tool("jadx", jadx_args, timeout=args.timeout)

        combined = result.stdout + result.stderr
        class_count = 0
        method_count = 0
        errors: list[str] = []

        for line in combined.splitlines():
            m = _JADX_CLASS_RE.search(line)
            if m:
                class_count = int(m.group(1))
            m = _JADX_METHOD_RE.search(line)
            if m:
                method_count = int(m.group(1))
            m = _JADX_ERROR_RE.search(line)
            if m:
                errors.append(m.group(1).strip())

        # Count output .java files as fallback class count
        if class_count == 0:
            class_count = sum(1 for _ in jadx_out.rglob("*.java"))

        source_files = [str(p) for p in jadx_out.rglob("*.java")]
        packages = sorted(
            {str(p.parent.relative_to(jadx_out)) for p in jadx_out.rglob("*.java")}
        )

        return {
            "tool": "jadx",
            "output_dir": str(jadx_out),
            "class_count": class_count,
            "method_count": method_count,
            "source_file_count": len(source_files),
            "packages": packages[:50],
            "error_count": len(errors),
            "errors": errors[:10],
            "return_code": result.returncode,
        }

    def _parse_manifest(self, manifest_path: Path) -> dict[str, Any]:
        """Extract key fields from AndroidManifest.xml."""
        if not manifest_path.exists():
            return {}
        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()
            ns = "http://schemas.android.com/apk/res/android"
            manifest_info: dict[str, Any] = {
                "package": root.get("package", ""),
                "version_code": root.get(f"{{{ns}}}versionCode", ""),
                "version_name": root.get(f"{{{ns}}}versionName", ""),
                "min_sdk": "",
                "target_sdk": "",
                "permissions": [],
                "activities": [],
                "services": [],
                "receivers": [],
            }
            uses_sdk = root.find("uses-sdk")
            if uses_sdk is not None:
                manifest_info["min_sdk"] = uses_sdk.get(f"{{{ns}}}minSdkVersion", "")
                manifest_info["target_sdk"] = uses_sdk.get(f"{{{ns}}}targetSdkVersion", "")
            for perm in root.findall("uses-permission"):
                name = perm.get(f"{{{ns}}}name", "")
                if name:
                    manifest_info["permissions"].append(name)
            app = root.find("application")
            if app is not None:
                for elem in app.findall("activity"):
                    n = elem.get(f"{{{ns}}}name", "")
                    if n:
                        manifest_info["activities"].append(n)
                for elem in app.findall("service"):
                    n = elem.get(f"{{{ns}}}name", "")
                    if n:
                        manifest_info["services"].append(n)
                for elem in app.findall("receiver"):
                    n = elem.get(f"{{{ns}}}name", "")
                    if n:
                        manifest_info["receivers"].append(n)
            return manifest_info
        except ET.ParseError as exc:
            self.logger.warning("Failed to parse AndroidManifest.xml: %s", exc)
            return {"parse_error": str(exc)}

    def _run_apktool(
        self, args: argparse.Namespace, base_out: Path
    ) -> dict[str, Any]:
        """Run apktool to decode APK resources and smali."""
        apktool_out = base_out / "apktool"

        apktool_args = [
            "d",                    # decode command
            "-f",                   # force overwrite
            "-o", str(apktool_out),
            args.apk,
        ]

        result = self.run_tool("apktool", apktool_args, timeout=args.timeout)

        smali_files = list(apktool_out.rglob("*.smali")) if apktool_out.exists() else []
        resource_files = list(apktool_out.rglob("*.xml")) if apktool_out.exists() else []
        manifest_path = apktool_out / "AndroidManifest.xml"
        manifest = self._parse_manifest(manifest_path)

        return {
            "tool": "apktool",
            "output_dir": str(apktool_out),
            "smali_file_count": len(smali_files),
            "resource_xml_count": len(resource_files),
            "manifest": manifest,
            "return_code": result.returncode,
        }

    def run(self, args: argparse.Namespace) -> None:
        """Execute requested decompilation tool(s) on the APK."""
        self._validate_args(args)
        base_out = self._resolve_output_dir(args)
        apk_size = Path(args.apk).stat().st_size

        self.logger.info(
            "Decompiling %s (%.2f MB) with %s → %s",
            args.apk,
            apk_size / (1024 * 1024),
            args.tool,
            base_out,
        )

        results: dict[str, Any] = {
            "apk": args.apk,
            "apk_size_bytes": apk_size,
            "base_output_dir": str(base_out),
            "tool": args.tool,
        }

        if args.tool in ("jadx", "both"):
            results["jadx"] = self._run_jadx(args, base_out)

        if args.tool in ("apktool", "both"):
            results["apktool"] = self._run_apktool(args, base_out)

        self.output_success(results)


if __name__ == "__main__":
    AndroidDecompiler().execute()

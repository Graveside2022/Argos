#!/usr/bin/env python3
"""Update HackRF imports after feature module migration"""

import re
from pathlib import Path

# Define replacements
REPLACEMENTS = [
    # Types imports
    (r"from\s+['\"](\$lib/types/hackrf)['\"]", "from '$lib/hackrf/types'"),

    # Stores imports
    (r"from\s+['\"](\$lib/stores/hackrf)['\"]", "from '$lib/hackrf/stores'"),

    # WebSocket imports
    (r"from\s+['\"](\$lib/services/websocket/hackrf)['\"]", "from '$lib/hackrf/websocket'"),

    # API imports (from services/api/hackrf)
    (r"from\s+['\"](\$lib/services/api/hackrf)['\"]", "from '$lib/services/api/hackrf'"),

    # Service imports (sweep-manager, time-window-filter, etc.)
    (r"from\s+['\"](\$lib/services/hackrf/time-window-filter)['\"]", "from '$lib/hackrf/spectrum'"),
    (r"from\s+['\"](\$lib/services/hackrf/sweep-manager)['\"]", "from '$lib/hackrf/sweep'"),
    (r"from\s+['\"](\$lib/services/hackrf)['\"]", "from '$lib/services/hackrf'"),  # Keep other hackrf service imports for now
]

def find_all_affected_files():
    """Find all files that import from hackrf-related paths"""
    root = Path("/home/kali/Documents/Argos/Argos/src")
    affected = set()

    for pattern in ["**/*.ts", "**/*.svelte"]:
        for file in root.glob(pattern):
            content = file.read_text()
            if any(re.search(r[0], content) for r in REPLACEMENTS):
                affected.add(file)

    return sorted(affected)

def update_file(filepath: Path) -> int:
    """Update imports in a single file. Returns number of replacements made."""
    content = filepath.read_text()
    original = content
    replacements_made = 0

    for pattern, replacement in REPLACEMENTS:
        content, count = re.subn(pattern, replacement, content)
        if count > 0:
            replacements_made += count
            print(f"✓ {filepath.name}: {count} replacement(s) for pattern {pattern[:40]}...")

    if content != original:
        filepath.write_text(content)
        return replacements_made

    return 0

def main():
    print("Updating HackRF imports after feature module migration...\n")

    files = find_all_affected_files()
    print(f"Found {len(files)} files to update\n")

    total_replacements = 0
    for file_path in files:
        count = update_file(file_path)
        total_replacements += count

    print(f"\n✅ Complete! {total_replacements} total replacements made")

if __name__ == "__main__":
    main()

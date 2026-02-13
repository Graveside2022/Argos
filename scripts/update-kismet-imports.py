#!/usr/bin/env python3
"""Update Kismet imports after feature module migration"""

import re
from pathlib import Path

# Define replacements
REPLACEMENTS = [
    # Types imports
    (r"from\s+['\"](\$lib/types/kismet)['\"]", "from '$lib/kismet/types'"),

    # Stores imports
    (r"from\s+['\"](\$lib/stores/kismet)['\"]", "from '$lib/kismet/stores'"),

    # API imports
    (r"from\s+['\"](\$lib/services/api/kismet)['\"]", "from '$lib/kismet/api'"),

    # WebSocket imports
    (r"from\s+['\"](\$lib/services/websocket/kismet)['\"]", "from '$lib/kismet/websocket'"),
]

# Files to update
files_to_update = [
    "src/lib/stores/tactical-map/kismet-store.ts",
    "src/lib/services/tactical-map/kismet-service.ts",
    "src/lib/kismet/websocket.ts",
    "src/lib/components/dashboard/panels/DevicesPanel.svelte",
    "src/lib/services/kismet/index.ts",
    "src/lib/services/kismet/kismet-service.ts",
    "src/lib/services/kismet/device-manager.ts",
]

def update_file(filepath: Path) -> int:
    """Update imports in a single file. Returns number of replacements made."""
    if not filepath.exists():
        print(f"⚠️  {filepath} does not exist, skipping")
        return 0

    content = filepath.read_text()
    original = content
    replacements_made = 0

    for pattern, replacement in REPLACEMENTS:
        content, count = re.subn(pattern, replacement, content)
        if count > 0:
            replacements_made += count
            print(f"✓ {filepath.name}: {count} replacement(s) for pattern {pattern[:30]}...")

    if content != original:
        filepath.write_text(content)
        return replacements_made

    return 0

def main():
    root = Path("/home/kali/Documents/Argos/Argos")
    total_replacements = 0

    print("Updating Kismet imports after feature module migration...\n")

    for file_path in files_to_update:
        full_path = root / file_path
        count = update_file(full_path)
        total_replacements += count

    print(f"\n✅ Complete! {total_replacements} total replacements made")

if __name__ == "__main__":
    main()

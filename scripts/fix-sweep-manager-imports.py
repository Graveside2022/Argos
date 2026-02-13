#!/usr/bin/env python3
"""Fix internal imports in sweep-manager files"""

import re
from pathlib import Path

# Update internal sweep-manager imports
sweep_manager_dir = Path("/home/kali/Documents/Argos/Argos/src/lib/hackrf/sweep-manager")

for file in sweep_manager_dir.glob("*.ts"):
    content = file.read_text()
    original = content

    # Fix imports from old location to new location
    content = re.sub(
        r"from\s+['\"](\$lib/services/hackrf/sweep-manager/[^'\"]+)['\"]",
        lambda m: f"from '$lib/hackrf/sweep-manager/{m.group(1).split('/')[-1]}'",
        content
    )

    if content != original:
        file.write_text(content)
        print(f"✓ Fixed {file.name}")

# Also fix any files that import time-window-filter or sweep-manager
src_dir = Path("/home/kali/Documents/Argos/Argos/src")
for file in src_dir.rglob("*.ts"):
    if "sweep-manager" in str(file):
        continue  # Already handled

    content = file.read_text()
    original = content

    # Fix time-window-filter imports
    content = re.sub(
        r"from\s+['\"](\./time-window-filter)['\"]",
        "from '$lib/hackrf/spectrum'",
        content
    )

    # Fix sweep-manager imports
    content = re.sub(
        r"from\s+['\"](\./sweep-manager)['\"]",
        "from '$lib/hackrf/sweep'",
        content
    )

    if content != original:
        file.write_text(content)
        print(f"✓ Fixed {file.name}")

print("\n✅ Complete!")

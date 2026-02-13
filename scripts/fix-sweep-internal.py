#!/usr/bin/env python3
"""Fix internal cross-references in sweep-manager"""

import re
from pathlib import Path

sweep_dir = Path("/home/kali/Documents/Argos/Argos/src/lib/hackrf/sweep-manager")

# Pattern: from '$lib/services/hackrf/sweep-manager/FILENAME'
# Replace with: from './FILENAME'

for file in sweep_dir.glob("*.ts"):
    content = file.read_text()
    original = content

    # Replace absolute imports with relative imports within sweep-manager
    content = re.sub(
        r"from ['\"](\$lib/services/hackrf/sweep-manager/([^'\"]+))['\"]",
        r"from './\2'",
        content
    )

    if content != original:
        file.write_text(content)
        print(f"✓ {file.name}")

print("✅ Done!")

#!/usr/bin/env python3
"""Mark tasks T094-T104 as complete in tasks.md"""

from pathlib import Path

def mark_tasks_complete(start: int, end: int):
    tasks_file = Path("/home/kali/Documents/Argos/Argos/specs/001-audit-remediation/tasks.md")
    content = tasks_file.read_text()

    for task_num in range(start, end + 1):
        # Match task pattern: - [ ] T{num}
        old_pattern = f"- [ ] T{task_num:03d}"
        new_pattern = f"- [X] T{task_num:03d}"
        content = content.replace(old_pattern, new_pattern)

    tasks_file.write_text(content)
    print(f"✅ Marked T{start:03d}-T{end:03d} as complete")

if __name__ == "__main__":
    mark_tasks_complete(94, 104)

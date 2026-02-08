#!/usr/bin/env python3
"""
Function Size Auditor for TypeScript/JavaScript/Svelte files.

Scans all .ts, .js, and .svelte files under src/ and finds functions >60 lines.
Uses brace-depth tracking to determine function boundaries.

Handles:
- function declarations: function foo() { ... }
- Arrow functions assigned to const/let/var: const foo = (...) => { ... }
- Class methods: methodName(...) { ... }
- Async variants of all the above
- Object method shorthand: foo(...) { ... } inside objects
- For .svelte files, only scans the <script> section
"""

import os
import re
import sys
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FunctionInfo:
    name: str
    file_path: str
    start_line: int
    end_line: int = 0
    line_count: int = 0
    brace_depth_at_start: int = 0


@dataclass
class ScanResult:
    functions: list = field(default_factory=list)
    errors: list = field(default_factory=list)


# Patterns to detect function starts
# We need to be careful about false positives from if/for/while/switch/try/catch blocks

# Pattern: function keyword declarations
RE_FUNCTION_DECL = re.compile(
    r'^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)?\s*(?:<[^>]*>)?\s*\('
)

# Pattern: arrow functions assigned to variables
RE_ARROW_FUNC = re.compile(
    r'^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*(?::\s*[^=]+)?\s*=>'
)

# Pattern: class method declarations (including get/set)
RE_CLASS_METHOD = re.compile(
    r'^\s*(?:public|private|protected|static|readonly|abstract|override|async|get|set|\s)*\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{'
)

# Pattern: simple class method - name followed by paren then brace
RE_SIMPLE_METHOD = re.compile(
    r'^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{?\s*$'
)

# Pattern: object method shorthand
RE_OBJ_METHOD = re.compile(
    r'^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{'
)

# Control flow keywords that look like functions but aren't
CONTROL_KEYWORDS = {'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally',
                    'with', 'throw', 'return', 'new', 'delete', 'typeof', 'void', 'import',
                    'export', 'class', 'interface', 'type', 'enum', 'namespace', 'module',
                    'declare', 'extends', 'implements'}


def is_inside_string(line: str, pos: int) -> bool:
    """Very basic check - not perfect but handles common cases."""
    in_single = False
    in_double = False
    in_template = False
    i = 0
    while i < pos:
        ch = line[i]
        if ch == '\\' and i + 1 < len(line):
            i += 2
            continue
        if ch == "'" and not in_double and not in_template:
            in_single = not in_single
        elif ch == '"' and not in_single and not in_template:
            in_double = not in_double
        elif ch == '`' and not in_single and not in_double:
            in_template = not in_template
        i += 1
    return in_single or in_double or in_template


def count_braces(line: str) -> tuple:
    """Count opening and closing braces not inside strings or comments."""
    opens = 0
    closes = 0
    in_single = False
    in_double = False
    in_template = False
    in_line_comment = False
    template_depth = 0
    i = 0

    while i < len(line):
        ch = line[i]

        # Handle escape sequences
        if ch == '\\' and (in_single or in_double or in_template):
            i += 2
            continue

        # Line comments
        if not in_single and not in_double and not in_template:
            if ch == '/' and i + 1 < len(line) and line[i + 1] == '/':
                break  # Rest of line is comment

        # String handling
        if ch == "'" and not in_double and not in_template and not in_line_comment:
            in_single = not in_single
        elif ch == '"' and not in_single and not in_template and not in_line_comment:
            in_double = not in_double
        elif ch == '`' and not in_single and not in_double and not in_line_comment:
            in_template = not in_template

        # Only count braces outside strings
        if not in_single and not in_double and not in_template and not in_line_comment:
            if ch == '{':
                opens += 1
            elif ch == '}':
                closes += 1

        i += 1

    return opens, closes


def strip_comments(lines: list) -> list:
    """Remove block comments from lines, preserving line numbers."""
    result = []
    in_block_comment = False
    for line in lines:
        new_line = ""
        i = 0
        while i < len(line):
            if in_block_comment:
                if i + 1 < len(line) and line[i] == '*' and line[i + 1] == '/':
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            # Check for block comment start
            if i + 1 < len(line) and line[i] == '/' and line[i + 1] == '*':
                in_block_comment = True
                i += 2
                continue
            # Check for line comment
            if i + 1 < len(line) and line[i] == '/' and line[i + 1] == '/':
                break  # Skip rest of line
            new_line += line[i]
            i += 1
        result.append(new_line)
    return result


def detect_function_start(line: str, stripped: str) -> Optional[str]:
    """Detect if a line starts a function definition. Returns function name or None."""

    # Skip empty lines
    if not stripped:
        return None

    # Skip lines that are just closing braces, or object/array literals
    if stripped.startswith('}') or stripped.startswith(']'):
        return None

    # Skip decorators
    if stripped.startswith('@'):
        return None

    # Check function declarations
    m = RE_FUNCTION_DECL.match(line)
    if m:
        name = m.group(1) or '<anonymous>'
        if name not in CONTROL_KEYWORDS:
            return name

    # Check arrow functions assigned to variables
    m = RE_ARROW_FUNC.match(line)
    if m:
        name = m.group(1)
        if name not in CONTROL_KEYWORDS:
            return name

    # Check for object methods and class methods
    # Must have opening brace on same line or be followed by one
    m = RE_OBJ_METHOD.match(line)
    if m:
        name = m.group(1)
        if name not in CONTROL_KEYWORDS and name[0].islower():
            return name

    return None


def extract_svelte_script(content: str) -> tuple:
    """Extract script section from svelte file. Returns (lines, start_offset)."""
    lines = content.split('\n')
    script_start = None
    script_end = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if re.match(r'<script\b', stripped) and script_start is None:
            script_start = i + 1  # Line after <script>
        elif stripped == '</script>' and script_start is not None and script_end is None:
            script_end = i

    if script_start is not None and script_end is not None:
        return lines[script_start:script_end], script_start
    elif script_start is not None:
        return lines[script_start:], script_start

    return [], 0


def scan_file(file_path: str, src_root: str) -> list:
    """Scan a single file for functions >60 lines."""
    functions_found = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except (IOError, OSError) as e:
        return []

    is_svelte = file_path.endswith('.svelte')

    if is_svelte:
        lines, line_offset = extract_svelte_script(content)
    else:
        lines = content.split('\n')
        line_offset = 0

    # Strip block comments to avoid false positives
    clean_lines = strip_comments(lines)

    # Track function stack using brace depth
    active_functions = []  # Stack of FunctionInfo
    brace_depth = 0

    for i, (orig_line, clean_line) in enumerate(zip(lines, clean_lines)):
        actual_line_num = i + line_offset + 1  # 1-indexed

        stripped = clean_line.strip()

        # Detect function start BEFORE counting braces on this line
        func_name = detect_function_start(clean_line, stripped)

        opens, closes = count_braces(clean_line)

        if func_name:
            # Check if this line has an opening brace
            has_open_brace = opens > closes  # Net positive braces

            # For arrow functions, the brace might be on next line
            # Check if line contains => and { on same line, or just =>
            is_arrow = '=>' in clean_line

            if has_open_brace or (opens > 0):
                func_info = FunctionInfo(
                    name=func_name,
                    file_path=file_path,
                    start_line=actual_line_num,
                    brace_depth_at_start=brace_depth + 1  # After the opening brace
                )
                active_functions.append(func_info)
            elif is_arrow and opens == 0:
                # Arrow function without brace on this line - might be expression body
                # or brace on next line. We'll look ahead.
                # For now, skip expression-body arrows (no braces = single expression)
                # Check next few lines for opening brace
                for lookahead in range(1, 4):
                    if i + lookahead < len(clean_lines):
                        la_line = clean_lines[i + lookahead].strip()
                        if la_line.startswith('{'):
                            # Found the opening brace - but we'll catch it when we get there
                            # Need to remember this function
                            func_info = FunctionInfo(
                                name=func_name,
                                file_path=file_path,
                                start_line=actual_line_num,
                                brace_depth_at_start=brace_depth + 1
                            )
                            active_functions.append(func_info)
                            break
                        elif la_line and not la_line.startswith('//'):
                            break  # Non-empty, non-comment line without brace = expression body

        # Update brace depth
        brace_depth += opens - closes

        # Check if any active functions have completed
        while active_functions:
            top = active_functions[-1]
            if brace_depth < top.brace_depth_at_start:
                top.end_line = actual_line_num
                top.line_count = top.end_line - top.start_line + 1
                active_functions.pop()
                if top.line_count > 60:
                    rel_path = os.path.relpath(file_path, src_root)
                    functions_found.append(top)
            else:
                break

    # Handle any unclosed functions (shouldn't happen in valid code)
    for func in active_functions:
        func.end_line = len(lines) + line_offset
        func.line_count = func.end_line - func.start_line + 1
        if func.line_count > 60:
            functions_found.append(func)

    return functions_found


def main():
    src_root = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src')
    if len(sys.argv) > 1:
        src_root = sys.argv[1]

    print(f"Scanning: {src_root}")
    print(f"{'='*120}")

    all_functions = []
    file_count = 0
    extensions = {'.ts', '.js', '.svelte'}

    for dirpath, dirnames, filenames in os.walk(src_root):
        # Skip node_modules, .svelte-kit, etc.
        dirnames[:] = [d for d in dirnames if d not in {'node_modules', '.svelte-kit', 'dist', '.git'}]

        for fn in filenames:
            ext = os.path.splitext(fn)[1]
            if ext in extensions:
                file_path = os.path.join(dirpath, fn)
                file_count += 1
                found = scan_file(file_path, src_root)
                all_functions.extend(found)

    # Sort by line count descending
    all_functions.sort(key=lambda f: f.line_count, reverse=True)

    # Print results
    print(f"\nFiles scanned: {file_count}")
    print(f"Functions >60 lines: {len(all_functions)}")
    print(f"\n{'='*120}")
    print(f"{'Lines':>6} | {'File':70} | {'Line':>6} | Function")
    print(f"{'-'*6}-+-{'-'*70}-+-{'-'*6}-+-{'-'*30}")

    # Buckets
    critical = []  # >150
    high = []      # 100-149
    standard = []  # 60-99

    for func in all_functions:
        rel_path = os.path.relpath(func.file_path, src_root)
        print(f"{func.line_count:>6} | {rel_path:70} | {func.start_line:>6} | {func.name}")

        if func.line_count > 150:
            critical.append(func)
        elif func.line_count >= 100:
            high.append(func)
        else:
            standard.append(func)

    print(f"\n{'='*120}")
    print(f"SUMMARY:")
    print(f"  >150 lines (CRITICAL): {len(critical)}")
    print(f"  100-149 lines (HIGH):   {len(high)}")
    print(f"  60-99 lines (STANDARD): {len(standard)}")
    print(f"  TOTAL:                  {len(all_functions)}")

    print(f"\n{'='*120}")
    print("CRITICAL FUNCTIONS (>150 lines):")
    for func in critical:
        rel_path = os.path.relpath(func.file_path, src_root)
        print(f"  {func.line_count:>4} lines | {rel_path}:{func.start_line} | {func.name}")

    print(f"\nHIGH PRIORITY FUNCTIONS (100-149 lines):")
    for func in high:
        rel_path = os.path.relpath(func.file_path, src_root)
        print(f"  {func.line_count:>4} lines | {rel_path}:{func.start_line} | {func.name}")


if __name__ == '__main__':
    main()

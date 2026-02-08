#!/usr/bin/env python3
"""
Function Size Auditor v2 -- more accurate detection.

Key improvements over v1:
- Better class method detection (private/public/protected/static/async)
- Better arrow function detection (multi-line type signatures)
- Handles TypeScript modifiers more robustly
- Better svelte script section extraction
"""

import os
import re
import sys
from dataclasses import dataclass, field
from typing import Optional, List, Tuple


@dataclass
class FunctionInfo:
    name: str
    file_path: str
    start_line: int
    end_line: int = 0
    line_count: int = 0
    brace_depth_at_start: int = 0
    kind: str = ""  # 'function', 'arrow', 'method', 'handler'


CONTROL_FLOW = {
    'if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally',
    'with', 'return', 'throw', 'new', 'delete', 'typeof', 'void',
    'class', 'interface', 'type', 'enum', 'namespace', 'module', 'declare',
    'import', 'export', 'extends', 'implements', 'case', 'default',
}


def count_braces_in_line(line: str) -> Tuple[int, int]:
    """Count { and } outside strings, template literals, and comments."""
    opens = closes = 0
    in_sq = in_dq = in_tl = False
    i = 0
    while i < len(line):
        c = line[i]
        if c == '\\' and (in_sq or in_dq or in_tl):
            i += 2
            continue
        if not in_sq and not in_dq and not in_tl:
            if c == '/' and i + 1 < len(line):
                if line[i + 1] == '/':
                    break  # line comment
                # block comment start handled at higher level
        if c == "'" and not in_dq and not in_tl:
            in_sq = not in_sq
        elif c == '"' and not in_sq and not in_tl:
            in_dq = not in_dq
        elif c == '`' and not in_sq and not in_dq:
            in_tl = not in_tl
        elif not in_sq and not in_dq and not in_tl:
            if c == '{':
                opens += 1
            elif c == '}':
                closes += 1
        i += 1
    return opens, closes


def strip_block_comments(lines: List[str]) -> List[str]:
    """Remove block comments, preserving line count."""
    result = []
    in_bc = False
    for line in lines:
        out = []
        i = 0
        while i < len(line):
            if in_bc:
                if i + 1 < len(line) and line[i] == '*' and line[i + 1] == '/':
                    in_bc = False
                    i += 2
                    continue
                i += 1
                continue
            if i + 1 < len(line) and line[i] == '/' and line[i + 1] == '*':
                in_bc = True
                i += 2
                continue
            if i + 1 < len(line) and line[i] == '/' and line[i + 1] == '/':
                break
            out.append(line[i])
            i += 1
        result.append(''.join(out))
    return result


# Regex patterns for function detection
# 1. function keyword (named or anonymous, export, async)
PAT_FUNC = re.compile(
    r'^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)?\s*'
)

# 2. Arrow function: const/let/var name [: type] = [async] (...) =>
PAT_ARROW = re.compile(
    r'^(\s*)(?:export\s+)?(?:const|let|var)\s+(\w+)'
)

# 3. Class method: [modifiers] name(...) [: type] {
# This is tricky because TypeScript has many modifier combinations
PAT_METHOD = re.compile(
    r'^(\s*)(?:(?:public|private|protected|static|abstract|override|readonly|async|get|set)\s+)*'
    r'(\w+)\s*(?:<[^>]*>)?\s*\('
)

# 4. Object literal method: name(...) {
PAT_OBJ_METHOD = re.compile(
    r'^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+?)?\s*\{'
)

# 5. SvelteKit handler: export const GET/POST/etc: RequestHandler = async ...
PAT_SVELTEKIT = re.compile(
    r'^\s*export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*'
)


def find_opening_brace(lines: List[str], start_idx: int, max_lookahead: int = 15) -> Optional[int]:
    """Find the line with the opening brace for a function starting at start_idx."""
    depth = 0
    for i in range(start_idx, min(start_idx + max_lookahead, len(lines))):
        o, c = count_braces_in_line(lines[i])
        depth += o - c
        if o > 0:
            return i
    return None


def detect_function(line: str, clean_line: str, lines: List[str], idx: int) -> Optional[Tuple[str, str]]:
    """Detect if line starts a function. Returns (name, kind) or None."""
    stripped = clean_line.strip()
    if not stripped or stripped.startswith('}') or stripped.startswith('//'):
        return None

    # SvelteKit handler
    m = PAT_SVELTEKIT.match(clean_line)
    if m:
        return m.group(1), 'handler'

    # function keyword
    m = PAT_FUNC.match(clean_line)
    if m:
        name = m.group(2) or '<anonymous>'
        if name not in CONTROL_FLOW:
            return name, 'function'

    # Arrow function
    m = PAT_ARROW.match(clean_line)
    if m:
        name = m.group(2)
        if name not in CONTROL_FLOW:
            # Verify it's actually an arrow function by checking for => somewhere
            # It could be on this line or within next few lines
            check_text = clean_line
            for la in range(1, min(8, len(lines) - idx)):
                check_text += ' ' + lines[idx + la].strip()
                if '=>' in check_text:
                    break
                if ';' in lines[idx + la] or clean_line.strip().endswith(';'):
                    break
            if '=>' in check_text:
                return name, 'arrow'

    # Class method (with modifiers)
    m = PAT_METHOD.match(clean_line)
    if m:
        indent = m.group(1)
        name = m.group(2)
        if name not in CONTROL_FLOW and name not in ('constructor',):
            # Verify this looks like a method (has reasonable indent, name starts lowercase or is constructor-like)
            if len(indent) >= 1 and (name[0].islower() or name[0] == '_'):
                return name, 'method'

    # Constructor
    if re.match(r'^\s+constructor\s*\(', clean_line):
        return 'constructor', 'method'

    return None


def scan_file(file_path: str) -> List[FunctionInfo]:
    """Scan a file for functions >60 lines."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except (IOError, OSError):
        return []

    is_svelte = file_path.endswith('.svelte')
    all_lines = content.split('\n')

    if is_svelte:
        # Extract <script> section
        script_start = None
        script_end = None
        for i, line in enumerate(all_lines):
            if re.match(r'\s*<script\b', line) and script_start is None:
                script_start = i + 1
            elif re.match(r'\s*</script>', line) and script_start is not None and script_end is None:
                script_end = i
        if script_start is None:
            return []
        if script_end is None:
            script_end = len(all_lines)
        lines = all_lines[script_start:script_end]
        line_offset = script_start
    else:
        lines = all_lines
        line_offset = 0

    clean_lines = strip_block_comments(lines)
    functions = []
    active_stack = []  # Stack of (FunctionInfo, target_depth)
    brace_depth = 0

    for i, (orig, clean) in enumerate(zip(lines, clean_lines)):
        actual_line = i + line_offset + 1

        # Detect function start BEFORE processing braces
        result = detect_function(orig, clean, clean_lines, i)

        o, c = count_braces_in_line(clean)

        if result:
            name, kind = result
            # Check if this line or nearby lines have an opening brace
            if o > 0:
                # Opening brace on this line
                func = FunctionInfo(
                    name=name,
                    file_path=file_path,
                    start_line=actual_line,
                    brace_depth_at_start=brace_depth + 1,
                    kind=kind,
                )
                active_stack.append(func)
            else:
                # Look ahead for opening brace
                brace_line = find_opening_brace(clean_lines, i + 1, 10)
                if brace_line is not None:
                    func = FunctionInfo(
                        name=name,
                        file_path=file_path,
                        start_line=actual_line,
                        brace_depth_at_start=brace_depth + 1,
                        kind=kind,
                    )
                    active_stack.append(func)

        brace_depth += o - c

        # Check if any active functions completed
        while active_stack:
            top = active_stack[-1]
            if brace_depth < top.brace_depth_at_start:
                top.end_line = actual_line
                top.line_count = top.end_line - top.start_line + 1
                active_stack.pop()
                if top.line_count > 60:
                    functions.append(top)
            else:
                break

    # Close any unclosed functions
    for func in active_stack:
        func.end_line = len(lines) + line_offset
        func.line_count = func.end_line - func.start_line + 1
        if func.line_count > 60:
            functions.append(func)

    return functions


def main():
    src_root = '/home/kali/Documents/Argos/Argos/src'
    if len(sys.argv) > 1:
        src_root = sys.argv[1]

    print(f"Scanning: {src_root}")

    all_functions = []
    file_count = 0
    exts = {'.ts', '.js', '.svelte'}
    skip_dirs = {'node_modules', '.svelte-kit', 'dist', '.git'}

    for dp, dns, fns in os.walk(src_root):
        dns[:] = [d for d in dns if d not in skip_dirs]
        for fn in fns:
            ext = os.path.splitext(fn)[1]
            if ext in exts:
                fp = os.path.join(dp, fn)
                file_count += 1
                found = scan_file(fp)
                all_functions.extend(found)

    all_functions.sort(key=lambda f: f.line_count, reverse=True)

    print(f"Files scanned: {file_count}")
    print(f"Functions >60 lines: {len(all_functions)}")
    print(f"\n{'='*130}")
    print(f"{'Lines':>6} | {'Kind':>8} | {'File':68} | {'Line':>6} | Function")
    print(f"{'-'*6}-+-{'-'*8}-+-{'-'*68}-+-{'-'*6}-+-{'-'*30}")

    crit = high = std = 0
    for func in all_functions:
        rel_path = os.path.relpath(func.file_path, src_root)
        print(f"{func.line_count:>6} | {func.kind:>8} | {rel_path:68} | {func.start_line:>6} | {func.name}")
        if func.line_count > 150:
            crit += 1
        elif func.line_count >= 100:
            high += 1
        else:
            std += 1

    print(f"\n{'='*130}")
    print(f"SUMMARY:")
    print(f"  >150 lines (CRITICAL): {crit}")
    print(f"  100-149 lines (HIGH):  {high}")
    print(f"  61-99 lines (STANDARD):{std}")
    print(f"  TOTAL:                 {len(all_functions)}")

    # Output as structured data for comparison
    print(f"\n{'='*130}")
    print("STRUCTURED OUTPUT (for cross-referencing):")
    for func in all_functions:
        rel = os.path.relpath(func.file_path, src_root)
        print(f"  FUNC|{func.line_count}|{rel}|{func.start_line}|{func.name}|{func.kind}")


if __name__ == '__main__':
    main()

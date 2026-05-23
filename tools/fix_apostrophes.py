import os, sys
sys.stdout.reconfigure(encoding='utf-8')

EDGE_FUNCTIONS = [
    r'c:\Users\ghali\Videos\morocco-host-helper-main-main\supabase\functions\issue-guest-link\index.ts',
    r'c:\Users\ghali\Videos\morocco-host-helper-main-main\supabase\functions\submit-guest-info-unified\index.ts',
    r'c:\Users\ghali\Videos\morocco-host-helper-main-main\supabase\functions\extract-document-data\index.ts',
    r'c:\Users\ghali\Videos\morocco-host-helper-main-main\supabase\functions\cleanup-stale-tokens\index.ts',
]

def fix_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    result = []
    i = 0
    n = len(content)
    fixes = 0

    while i < n:
        c = content[i]

        # Line comment — pass through until newline
        if c == '/' and i+1 < n and content[i+1] == '/':
            while i < n and content[i] != '\n':
                result.append(content[i])
                i += 1
            continue

        # Block comment /* ... */
        if c == '/' and i+1 < n and content[i+1] == '*':
            result.append(c); i += 1
            while i < n:
                if content[i] == '*' and i+1 < n and content[i+1] == '/':
                    result.append(content[i]); i += 1
                    result.append(content[i]); i += 1
                    break
                result.append(content[i]); i += 1
            continue

        # Template literal `...`
        if c == '`':
            result.append(c); i += 1
            while i < n:
                tc = content[i]
                if tc == '\\':
                    result.append(tc); i += 1
                    if i < n: result.append(content[i]); i += 1
                elif tc == '`':
                    result.append(tc); i += 1; break
                else:
                    result.append(tc); i += 1
            continue

        # Double-quoted string "..."
        if c == '"':
            result.append(c); i += 1
            while i < n:
                dc = content[i]
                if dc == '\\':
                    result.append(dc); i += 1
                    if i < n: result.append(content[i]); i += 1
                elif dc == '"':
                    result.append(dc); i += 1; break
                elif dc == '\n':
                    result.append(dc); i += 1; break
                else:
                    result.append(dc); i += 1
            continue

        # Single-quoted string '...'
        if c == "'":
            result.append(c); i += 1
            while i < n:
                sc = content[i]
                if sc == '\\':
                    result.append(sc); i += 1
                    if i < n: result.append(content[i]); i += 1
                elif sc == "'":
                    # Check if this is a French apostrophe: letter before AND letter after
                    prev_char = result[-1] if result else ''
                    next_char = content[i+1] if i+1 < n else ''
                    if prev_char.isalpha() and next_char.isalpha():
                        # French apostrophe inside string — escape it
                        result.append("\\'")
                        fixes += 1
                        i += 1
                    else:
                        # End of string
                        result.append(sc); i += 1; break
                elif sc == '\n':
                    # Unterminated string — pass through
                    result.append(sc); i += 1; break
                else:
                    result.append(sc); i += 1
            continue

        # Regular character
        result.append(c); i += 1

    fixed = ''.join(result)

    if fixes > 0:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(fixed)
        print(f'Fixed {fixes} French apostrophes in {os.path.basename(path)}')
    else:
        print(f'OK (no French apostrophes in strings): {os.path.basename(path)}')

for path in EDGE_FUNCTIONS:
    fix_file(path)

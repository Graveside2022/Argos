# Codebase Analysis Guide - Finding What We Actually Need

## The Problem
- 207 shell scripts
- 391 TypeScript/JavaScript files  
- Multiple duplicate functionalities
- No clear understanding of what's actually used

## Step 1: Build a Usage Map

### 1.1 Track Entry Points
First, identify all the ways users interact with the system:

```bash
# Create entry points inventory
cat > ENTRY_POINTS.md << 'EOF'
# System Entry Points

## Web Routes (User-Facing)
EOF

# Find all Svelte pages
find src/routes -name "+page.svelte" | while read page; do
    echo "- $page" >> ENTRY_POINTS.md
done

# Find all API endpoints
echo -e "\n## API Endpoints" >> ENTRY_POINTS.md
find src/routes/api -name "+server.ts" | while read api; do
    echo "- $api" >> ENTRY_POINTS.md
done

# Find systemd services (background processes)
echo -e "\n## System Services" >> ENTRY_POINTS.md
find . -name "*.service" | while read service; do
    echo "- $service" >> ENTRY_POINTS.md
done
```

### 1.2 Trace Dependencies From Entry Points
```bash
#!/bin/bash
# trace-dependencies.sh

# Function to trace imports in TypeScript/JavaScript
trace_imports() {
    local file=$1
    local depth=$2
    
    # Avoid infinite recursion
    if [ $depth -gt 10 ]; then return; fi
    
    # Extract imports
    grep -E "^import|from ['|\"]" "$file" 2>/dev/null | \
    sed -E "s/.*from ['\"]([^'\"]+)['\"].*/\1/" | \
    grep -v "^import" | \
    while read import; do
        echo "$import"
        # Recursively trace
        if [[ $import == ./* || $import == \$lib/* ]]; then
            # Convert import to file path
            # ... continue tracing
        fi
    done
}
```

## Step 2: Identify Actually Used Components

### 2.1 Production Access Logs Analysis
```bash
# If you have web server logs
grep -E "GET|POST" /var/log/nginx/access.log | \
    awk '{print $7}' | \
    sort | uniq -c | sort -nr > ACTUALLY_USED_ENDPOINTS.txt

# Map endpoints to code files
while read count endpoint; do
    echo "Endpoint: $endpoint (used $count times)"
    # Find corresponding route file
    find src/routes -type f -name "*.svelte" -o -name "*.ts" | \
        xargs grep -l "$endpoint" 2>/dev/null
done < ACTUALLY_USED_ENDPOINTS.txt
```

### 2.2 Script Usage Analysis
```bash
#!/bin/bash
# analyze-script-usage.sh

echo "# Script Usage Analysis" > SCRIPT_USAGE.md
echo "Generated: $(date)" >> SCRIPT_USAGE.md
echo "" >> SCRIPT_USAGE.md

# Check which scripts are called by other scripts
for script in scripts/*.sh; do
    script_name=$(basename "$script")
    echo "## $script_name" >> SCRIPT_USAGE.md
    
    # Find references to this script
    echo "### Called by:" >> SCRIPT_USAGE.md
    grep -r "$script_name" . --include="*.sh" --include="*.ts" --include="*.js" \
        --exclude-dir=node_modules 2>/dev/null | \
        grep -v "$script:" | \
        awk -F: '{print "- " $1}' | sort | uniq >> SCRIPT_USAGE.md
    
    # Check if used in systemd services
    echo "### Used in services:" >> SCRIPT_USAGE.md
    grep -r "$script_name" . --include="*.service" 2>/dev/null | \
        awk -F: '{print "- " $1}' >> SCRIPT_USAGE.md
    
    echo "" >> SCRIPT_USAGE.md
done
```

## Step 3: Dead Code Detection

### 3.1 Unused File Detection
```typescript
// tools/find-unused-files.ts
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

async function findUnusedFiles() {
    const allFiles = new Set<string>();
    const referencedFiles = new Set<string>();
    
    // Collect all files
    async function collectFiles(dir: string) {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.includes('node_modules')) {
                await collectFiles(join(dir, entry.name));
            } else if (entry.isFile()) {
                allFiles.add(join(dir, entry.name));
            }
        }
    }
    
    // Find references
    async function findReferences(file: string) {
        const content = await readFile(file, 'utf-8');
        // Extract imports, requires, script calls, etc.
        const importRegex = /from ['"]([^'"]+)['"]/g;
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        const scriptRegex = /\b(\w+\.sh)\b/g;
        
        // ... extract and add to referencedFiles
    }
    
    // Find unused
    const unused = [...allFiles].filter(f => !referencedFiles.has(f));
    console.log('Potentially unused files:', unused);
}
```

### 3.2 Duplicate Functionality Detection
```bash
#!/bin/bash
# find-duplicates.sh

echo "# Duplicate Functionality Analysis" > DUPLICATES.md

# Find similar script names
echo "## Similar Script Names" >> DUPLICATES.md
ls scripts/*.sh | sed 's/.*\///' | sed 's/\.sh$//' | \
    awk -F'-' '{print $1"-"$2}' | sort | uniq -c | \
    awk '$1 > 1 {print $2}' | while read pattern; do
    echo "### Pattern: $pattern*" >> DUPLICATES.md
    ls scripts/${pattern}*.sh 2>/dev/null >> DUPLICATES.md
    echo "" >> DUPLICATES.md
done

# Find files with similar content
echo "## Files with Similar Content" >> DUPLICATES.md
for file1 in scripts/*.sh; do
    for file2 in scripts/*.sh; do
        if [ "$file1" != "$file2" ] && [ "$file1" < "$file2" ]; then
            similarity=$(diff -u "$file1" "$file2" | grep -E "^[+-]" | wc -l)
            total=$(wc -l < "$file1")
            if [ $similarity -lt $((total / 2)) ]; then
                echo "- $file1 and $file2 are very similar" >> DUPLICATES.md
            fi
        fi
    done
done
```

## Step 4: Create Usage Heat Map

### 4.1 Visual Dependency Graph
```python
# tools/create-dependency-graph.py
import os
import re
import networkx as nx
import matplotlib.pyplot as plt

def build_dependency_graph():
    G = nx.DiGraph()
    
    # Add nodes and edges based on imports/calls
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith(('.ts', '.js', '.svelte')):
                filepath = os.path.join(root, file)
                G.add_node(filepath)
                
                # Find dependencies
                with open(filepath, 'r') as f:
                    content = f.read()
                    imports = re.findall(r"from ['\"]([^'\"]+)['\"]", content)
                    for imp in imports:
                        G.add_edge(filepath, imp)
    
    # Identify core nodes (high connectivity)
    core_nodes = [n for n in G.nodes() if G.degree(n) > 10]
    
    # Identify leaf nodes (might be unused)
    leaf_nodes = [n for n in G.nodes() if G.degree(n) == 0]
    
    return G, core_nodes, leaf_nodes
```

## Step 5: Practical Analysis Scripts

### 5.1 The Master Analyzer
```bash
#!/bin/bash
# master-analyzer.sh

echo "Starting Comprehensive Codebase Analysis..."

# 1. Find all entry points
echo "[1/6] Finding entry points..."
./find-entry-points.sh > analysis/entry-points.txt

# 2. Trace critical paths
echo "[2/6] Tracing critical paths..."
for entry in $(cat analysis/entry-points.txt); do
    ./trace-dependencies.sh "$entry" > "analysis/deps-$(basename $entry).txt"
done

# 3. Find unused scripts
echo "[3/6] Finding potentially unused scripts..."
comm -23 <(ls scripts/*.sh | sort) \
         <(grep -r "\.sh" . --include="*.sh" --include="*.ts" | \
           grep -o '[a-zA-Z0-9_-]*\.sh' | sort | uniq) > analysis/unused-scripts.txt

# 4. Find duplicate functionality
echo "[4/6] Finding duplicates..."
./find-duplicates.sh > analysis/duplicates.txt

# 5. Check last modified dates
echo "[5/6] Checking file age..."
find . -name "*.sh" -o -name "*.ts" -o -name "*.js" | \
    xargs ls -la --time-style=long-iso | \
    awk '{print $6, $8}' | sort > analysis/file-ages.txt

# 6. Generate report
echo "[6/6] Generating report..."
./generate-analysis-report.sh
```

### 5.2 Quick Decision Helper
```bash
#!/bin/bash
# can-i-delete-this.sh

FILE=$1

echo "Analyzing: $FILE"
echo "=================="

# Check if referenced anywhere
echo "References to this file:"
grep -r "$(basename $FILE)" . --include="*.sh" --include="*.ts" --include="*.js" \
    --include="*.json" --include="*.service" --exclude-dir=node_modules 2>/dev/null | \
    grep -v "^$FILE:" | head -10

# Check last modified
echo -e "\nLast modified:"
stat -c "%y" "$FILE" 2>/dev/null || stat -f "%Sm" "$FILE"

# Check if it's running
echo -e "\nCurrently running?"
ps aux | grep -v grep | grep "$(basename $FILE)" 

# Check git history
echo -e "\nRecent git activity:"
git log -n 5 --oneline -- "$FILE" 2>/dev/null

# Decision helper
echo -e "\n=== SAFETY ASSESSMENT ==="
ref_count=$(grep -r "$(basename $FILE)" . 2>/dev/null | grep -v "^$FILE:" | wc -l)
if [ $ref_count -eq 0 ]; then
    echo "⚠️  No references found - POSSIBLY SAFE TO DELETE"
else
    echo "❌ Found $ref_count references - DO NOT DELETE"
fi
```

## Step 6: Actionable Cleanup Process

### Phase 1: Safe Cleanup (Week 1)
```bash
# Start with obviously unused files
- Old test files (test-*.sh from 6+ months ago)
- Backup files (*.bak, *.old)
- Duplicate configs (multiple versions)
```

### Phase 2: Script Consolidation (Week 2)
```bash
# Consolidate similar scripts
gsm-evil-simple.sh   \
gsm-evil-fixed.sh     > gsm-evil.sh (with parameters)
gsm-evil-final.sh    /
gsm-evil-working.sh /
```

### Phase 3: Document Everything (Week 3)
```markdown
# scripts/README.md
## Active Scripts
- `start-services.sh` - Main startup script
- `deploy.sh` - Deployment script
  
## Deprecated (Remove after 2024-06-01)
- `old-deploy.sh` - Replaced by deploy.sh
```

## The Key Questions to Ask

For each file/script/component:

1. **Is it referenced anywhere?** (grep for it)
2. **When was it last modified?** (might be abandoned)
3. **Does it have a unique function?** (or duplicate)
4. **Is it in production use?** (check logs/services)
5. **Does it have tests?** (tested = important)
6. **Is it documented?** (documented = intended for use)

## Start Simple

```bash
# The simplest start:
mkdir analysis
grep -r "TODO\|FIXME\|HACK\|DEPRECATED" . > analysis/tech-debt.txt
find . -name "*.old" -o -name "*.bak" -o -name "*-backup*" > analysis/obvious-deletes.txt
ls -la scripts/ | grep -E "(test-|tmp-|old-)" > analysis/test-scripts.txt
```

Remember: **Don't delete anything immediately**. First understand, then mark for deletion, then wait a week, then delete.
#!/bin/bash
# analyze-codebase.sh - Practical codebase analysis tool

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create analysis directory
mkdir -p analysis
cd analysis

echo -e "${GREEN}Starting Codebase Analysis...${NC}"

# 1. Find all entry points
echo -e "\n${YELLOW}[1/8] Finding entry points...${NC}"
cat > entry-points.md << 'EOF'
# System Entry Points

## Web Pages (User Facing)
EOF

find ../src/routes -name "+page.svelte" -type f | while read page; do
    # Extract route from path
    route=$(echo "$page" | sed 's|../src/routes||' | sed 's|/+page.svelte||' | sed 's|^/||')
    [ -z "$route" ] && route="/"
    echo "- \`$route\` - $page" >> entry-points.md
done

echo -e "\n## API Endpoints" >> entry-points.md
find ../src/routes/api -name "+server.ts" -type f | while read api; do
    endpoint=$(echo "$api" | sed 's|../src/routes||' | sed 's|/+server.ts||')
    echo "- \`$endpoint\` - $api" >> entry-points.md
done

# 2. Analyze script usage
echo -e "\n${YELLOW}[2/8] Analyzing script usage...${NC}"
cat > script-usage.md << 'EOF'
# Script Usage Analysis

## Summary
EOF

total_scripts=$(find ../scripts -name "*.sh" -type f | wc -l)
echo "- Total scripts: $total_scripts" >> script-usage.md

# Find unreferenced scripts
echo -e "\n## Potentially Unused Scripts" >> script-usage.md
find ../scripts -name "*.sh" -type f | while read script; do
    script_name=$(basename "$script")
    # Search for references (excluding the script itself)
    ref_count=$(grep -r "$script_name" .. \
        --include="*.sh" --include="*.ts" --include="*.js" --include="*.json" \
        --include="*.service" --include="*.md" \
        --exclude-dir=node_modules 2>/dev/null | \
        grep -v "^$script:" | wc -l)
    
    if [ $ref_count -eq 0 ]; then
        echo "- \`$script_name\` - No references found" >> script-usage.md
    fi
done

# 3. Find duplicate/similar scripts
echo -e "\n${YELLOW}[3/8] Finding duplicate scripts...${NC}"
cat > duplicates.md << 'EOF'
# Duplicate and Similar Scripts

## GSM Evil Variants
EOF

ls ../scripts/gsm-evil-*.sh 2>/dev/null | while read script; do
    echo "- $(basename $script)" >> duplicates.md
done

echo -e "\n## Start/Stop Script Pairs" >> duplicates.md
ls ../scripts/start-*.sh 2>/dev/null | while read start_script; do
    base_name=$(basename "$start_script" | sed 's/^start-//' | sed 's/\.sh$//')
    stop_script="../scripts/stop-${base_name}.sh"
    if [ -f "$stop_script" ]; then
        echo "- start-${base_name}.sh / stop-${base_name}.sh" >> duplicates.md
    fi
done

# 4. Check file ages
echo -e "\n${YELLOW}[4/8] Checking file ages...${NC}"
cat > file-ages.md << 'EOF'
# File Age Analysis

## Oldest Scripts (Potentially Outdated)
EOF

find ../scripts -name "*.sh" -type f -exec stat -c "%Y %n" {} \; | \
    sort -n | head -20 | while read timestamp file; do
    age_days=$(( ($(date +%s) - $timestamp) / 86400 ))
    echo "- $(basename $file) - $age_days days old" >> file-ages.md
done

echo -e "\n## Recently Modified (Active Development)" >> file-ages.md
find ../scripts -name "*.sh" -type f -exec stat -c "%Y %n" {} \; | \
    sort -nr | head -10 | while read timestamp file; do
    age_days=$(( ($(date +%s) - $timestamp) / 86400 ))
    echo "- $(basename $file) - $age_days days ago" >> file-ages.md
done

# 5. Service dependencies
echo -e "\n${YELLOW}[5/8] Analyzing service dependencies...${NC}"
cat > service-dependencies.md << 'EOF'
# Service Dependencies

## SystemD Services and Their Scripts
EOF

find .. -name "*.service" -type f | while read service; do
    echo -e "\n### $(basename $service)" >> service-dependencies.md
    # Extract ExecStart commands
    grep -E "ExecStart|ExecStop|ExecReload" "$service" | while read line; do
        echo "- $line" >> service-dependencies.md
    done
done

# 6. TODO/FIXME Analysis
echo -e "\n${YELLOW}[6/8] Finding technical debt...${NC}"
cat > tech-debt.md << 'EOF'
# Technical Debt Analysis

## TODO/FIXME/HACK Comments
EOF

grep -r "TODO\|FIXME\|HACK\|XXX" .. \
    --include="*.ts" --include="*.js" --include="*.sh" --include="*.py" \
    --exclude-dir=node_modules 2>/dev/null | \
    awk -F: '{print $1}' | sort | uniq -c | sort -nr | \
    head -20 >> tech-debt.md

# 7. Import/Dependency Analysis
echo -e "\n${YELLOW}[7/8] Analyzing code dependencies...${NC}"
cat > import-analysis.md << 'EOF'
# Import Analysis

## Most Imported Modules
EOF

grep -r "^import\|from ['\"]" ../src \
    --include="*.ts" --include="*.js" --include="*.svelte" \
    2>/dev/null | \
    grep -E "from ['\"]" | \
    sed -E "s/.*from ['\"]([^'\"]+)['\"].*/\1/" | \
    grep -E "^\$lib|^@" | \
    sort | uniq -c | sort -nr | \
    head -20 >> import-analysis.md

# 8. Generate summary report
echo -e "\n${YELLOW}[8/8] Generating summary report...${NC}"
cat > ANALYSIS_SUMMARY.md << EOF
# Codebase Analysis Summary
Generated: $(date)

## Quick Stats
- Total TypeScript/JS files: $(find ../src -name "*.ts" -o -name "*.js" -o -name "*.svelte" | wc -l)
- Total Shell scripts: $total_scripts
- Total Python files: $(find .. -name "*.py" | grep -v __pycache__ | wc -l)
- Total documentation files: $(find .. -name "*.md" | wc -l)

## Key Findings

### 1. Entry Points
$(grep -c "^-" entry-points.md) total entry points found
- Web pages: $(grep -c "+page.svelte" entry-points.md)
- API endpoints: $(grep -c "+server.ts" entry-points.md)

### 2. Unused Code
- Potentially unused scripts: $(grep -c "No references found" script-usage.md)
- See \`script-usage.md\` for details

### 3. Duplicates
- GSM Evil variants: $(ls ../scripts/gsm-evil-*.sh 2>/dev/null | wc -l)
- See \`duplicates.md\` for details

### 4. Technical Debt
- Files with TODO/FIXME: $(grep -r "TODO\|FIXME" .. --include="*.ts" --include="*.js" | wc -l)
- See \`tech-debt.md\` for details

## Recommended Actions

1. **Immediate Cleanup** (Safe to do now)
   - Remove unreferenced scripts listed in \`script-usage.md\`
   - Consolidate GSM Evil variants into single parameterized script
   - Delete old backup files (*.bak, *.old)

2. **Short Term** (Next 2 weeks)
   - Review and consolidate duplicate functionality
   - Update or remove scripts older than 6 months
   - Document critical scripts that must be kept

3. **Medium Term** (Next month)
   - Refactor common patterns into shared libraries
   - Implement proper logging instead of scattered console.logs
   - Add tests for critical functionality

## Next Steps

1. Review each analysis file in this directory
2. Create tickets for cleanup tasks
3. Start with safe deletions (unreferenced files)
4. Document anything that seems unclear but is actually needed
EOF

echo -e "\n${GREEN}Analysis complete!${NC}"
echo -e "Results saved in: $(pwd)"
echo -e "\nKey files to review:"
ls -la *.md | awk '{print "  - " $9}'
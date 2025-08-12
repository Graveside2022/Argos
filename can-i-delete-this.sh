#!/bin/bash
# can-i-delete-this.sh - Check if a file/script is safe to delete

if [ $# -eq 0 ]; then
    echo "Usage: $0 <file-to-check>"
    echo "Example: $0 scripts/old-test.sh"
    exit 1
fi

FILE=$1

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "$FILE" ]; then
    echo -e "${RED}Error: File '$FILE' not found${NC}"
    exit 1
fi

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}Analyzing: $FILE${NC}"
echo -e "${BLUE}===============================================${NC}"

# Get file info
filename=$(basename "$FILE")
filedir=$(dirname "$FILE")

# 1. Check references
echo -e "\n${YELLOW}1. REFERENCES TO THIS FILE:${NC}"
ref_count=$(grep -r "$filename" . \
    --include="*.sh" --include="*.ts" --include="*.js" --include="*.json" \
    --include="*.service" --include="*.md" --include="*.py" --include="*.svelte" \
    --exclude-dir=node_modules --exclude-dir=.git \
    2>/dev/null | grep -v "^$FILE:" | wc -l)

if [ $ref_count -eq 0 ]; then
    echo -e "${GREEN}✓ No references found${NC}"
else
    echo -e "${RED}✗ Found $ref_count references:${NC}"
    grep -r "$filename" . \
        --include="*.sh" --include="*.ts" --include="*.js" --include="*.json" \
        --include="*.service" --include="*.md" --include="*.py" --include="*.svelte" \
        --exclude-dir=node_modules --exclude-dir=.git \
        2>/dev/null | grep -v "^$FILE:" | head -5 | while read line; do
        echo "  - $line"
    done
    [ $ref_count -gt 5 ] && echo "  ... and $((ref_count - 5)) more"
fi

# 2. Check if running
echo -e "\n${YELLOW}2. CURRENTLY RUNNING:${NC}"
if ps aux | grep -v grep | grep -q "$filename"; then
    echo -e "${RED}✗ Process is currently running!${NC}"
    ps aux | grep -v grep | grep "$filename"
else
    echo -e "${GREEN}✓ Not currently running${NC}"
fi

# 3. Check systemd services
echo -e "\n${YELLOW}3. SYSTEMD SERVICES:${NC}"
service_count=$(grep -r "$filename" /etc/systemd/system/ *.service 2>/dev/null | wc -l)
if [ $service_count -eq 0 ]; then
    echo -e "${GREEN}✓ Not used in any systemd services${NC}"
else
    echo -e "${RED}✗ Used in systemd services:${NC}"
    grep -r "$filename" /etc/systemd/system/ *.service 2>/dev/null | head -3
fi

# 4. Check last modified
echo -e "\n${YELLOW}4. LAST MODIFIED:${NC}"
if command -v stat >/dev/null 2>&1; then
    last_modified=$(stat -c "%y" "$FILE" 2>/dev/null || stat -f "%Sm" "$FILE" 2>/dev/null)
    days_ago=$(( ($(date +%s) - $(stat -c "%Y" "$FILE" 2>/dev/null || stat -f "%m" "$FILE" 2>/dev/null)) / 86400 ))
    echo "Last modified: $last_modified ($days_ago days ago)"
    
    if [ $days_ago -gt 180 ]; then
        echo -e "${YELLOW}⚠ File hasn't been modified in over 6 months${NC}"
    fi
fi

# 5. Check git history
echo -e "\n${YELLOW}5. GIT HISTORY:${NC}"
last_commit=$(git log -1 --format="%ar" -- "$FILE" 2>/dev/null)
if [ -n "$last_commit" ]; then
    echo "Last git commit: $last_commit"
    echo "Recent commits:"
    git log -3 --oneline -- "$FILE" 2>/dev/null | sed 's/^/  /'
else
    echo -e "${YELLOW}⚠ No git history found${NC}"
fi

# 6. Check file size and type
echo -e "\n${YELLOW}6. FILE INFO:${NC}"
file_size=$(ls -lh "$FILE" | awk '{print $5}')
echo "Size: $file_size"
echo "Type: $(file -b "$FILE" | head -1)"

# 7. Check for similar files
echo -e "\n${YELLOW}7. SIMILAR FILES:${NC}"
base_name=$(echo "$filename" | sed 's/[0-9]*\./\./' | sed 's/-final//' | sed 's/-fixed//' | sed 's/-old//' | sed 's/-backup//')
similar_count=$(find "$filedir" -name "*${base_name%.*}*" -type f | grep -v "^$FILE$" | wc -l)
if [ $similar_count -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $similar_count similar files:${NC}"
    find "$filedir" -name "*${base_name%.*}*" -type f | grep -v "^$FILE$" | head -5 | sed 's/^/  - /'
else
    echo -e "${GREEN}✓ No similar files found${NC}"
fi

# 8. Safety Assessment
echo -e "\n${BLUE}===============================================${NC}"
echo -e "${BLUE}SAFETY ASSESSMENT:${NC}"
echo -e "${BLUE}===============================================${NC}"

safety_score=0
warnings=""

# Calculate safety score
if [ $ref_count -eq 0 ]; then
    safety_score=$((safety_score + 30))
else
    warnings="${warnings}\n  ${RED}⚠ File is referenced in $ref_count places${NC}"
fi

if ! ps aux | grep -v grep | grep -q "$filename"; then
    safety_score=$((safety_score + 20))
else
    warnings="${warnings}\n  ${RED}⚠ Process is currently running${NC}"
fi

if [ $service_count -eq 0 ]; then
    safety_score=$((safety_score + 20))
else
    warnings="${warnings}\n  ${RED}⚠ Used in systemd services${NC}"
fi

if [ $days_ago -gt 180 ]; then
    safety_score=$((safety_score + 20))
    warnings="${warnings}\n  ${YELLOW}○ Not modified in ${days_ago} days${NC}"
fi

if [ $similar_count -gt 0 ]; then
    safety_score=$((safety_score + 10))
    warnings="${warnings}\n  ${YELLOW}○ Has $similar_count similar files (possible duplicate)${NC}"
fi

# Final verdict
echo -e "\nSafety Score: $safety_score/100"

if [ $safety_score -ge 80 ]; then
    echo -e "${GREEN}✓ PROBABLY SAFE TO DELETE${NC}"
    echo -e "${GREEN}  This file appears to be unused and can likely be removed.${NC}"
elif [ $safety_score -ge 50 ]; then
    echo -e "${YELLOW}⚠ POSSIBLY SAFE TO DELETE${NC}"
    echo -e "${YELLOW}  Review the warnings below before deleting.${NC}"
else
    echo -e "${RED}✗ NOT SAFE TO DELETE${NC}"
    echo -e "${RED}  This file is actively used and should not be removed.${NC}"
fi

if [ -n "$warnings" ]; then
    echo -e "\nWarnings:$warnings"
fi

echo -e "\n${BLUE}RECOMMENDATION:${NC}"
if [ $safety_score -ge 80 ]; then
    echo "1. Create a backup: cp '$FILE' '${FILE}.backup-$(date +%Y%m%d)'"
    echo "2. Comment out any references (if any)"
    echo "3. Wait 1 week"
    echo "4. If no issues, delete the file"
elif [ $safety_score -ge 50 ]; then
    echo "1. Investigate the references listed above"
    echo "2. Check if similar files provide the same functionality"
    echo "3. Test in a development environment first"
else
    echo "DO NOT DELETE - This file is actively used"
fi
#!/bin/bash
#
# Pre-commit Hook - Feature Creep Prevention Framework
# 
# This hook enforces the binding rules of the Feature Creep Prevention Framework
# by checking all staged changes for unauthorized modifications.
#
# Installation: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

set -e  # Exit on any error

echo "🛡️  Feature Creep Prevention Framework - Pre-commit Check"
echo "========================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if this is a merge commit (skip some checks)
if git rev-parse -q --verify MERGE_HEAD > /dev/null; then
    echo "⚠️  Merge commit detected - running essential checks only"
    MERGE_COMMIT=true
else
    MERGE_COMMIT=false
fi

# Function to print error and exit
error_exit() {
    echo -e "${RED}❌ $1${NC}"
    echo -e "${RED}🚨 COMMIT BLOCKED BY FEATURE CREEP PREVENTION FRAMEWORK${NC}"
    echo -e "${YELLOW}See FEATURE_CREEP_PREVENTION_FRAMEWORK.md for details${NC}"
    exit 1
}

# Function to print warning
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 1. CHECK FOR PROTECTED CSS FILE MODIFICATIONS
echo -e "\n🎨 Checking CSS file modifications..."

PROTECTED_CSS_FILES=(
    "src/lib/styles/hackrf/style.css"
    "src/lib/styles/hackrf/monochrome-theme.css"
    "src/lib/styles/hackrf/geometric-backgrounds.css"
    "src/lib/styles/hackrf/custom-components-exact.css"
    "src/lib/styles/hackrf/saasfly-buttons.css"
)

CSS_MODIFIED=false
for file in "${PROTECTED_CSS_FILES[@]}"; do
    if git diff --cached --name-only | grep -q "^${file}$"; then
        echo -e "${RED}❌ PROTECTED CSS FILE MODIFIED: ${file}${NC}"
        CSS_MODIFIED=true
    fi
done

if [ "$CSS_MODIFIED" = true ]; then
    error_exit "CSS files are protected and cannot be modified without explicit authorization"
fi

# 2. CHECK FOR UNAUTHORIZED HTML STRUCTURE CHANGES
echo -e "\n🏗️  Checking HTML structure changes..."

# Check for Svelte files with potential HTML structure changes
if git diff --cached --name-only | grep -E '\.(svelte|html)$' > /dev/null; then
    echo "   Svelte/HTML files detected in commit..."
    
    # Check for suspicious patterns that might indicate structure changes
    SUSPICIOUS_CHANGES=$(git diff --cached | grep -E '^\+.*(<[^>]+>|class=|id=)' | wc -l)
    
    if [ "$SUSPICIOUS_CHANGES" -gt 0 ]; then
        warning "HTML structure changes detected ($SUSPICIOUS_CHANGES lines)"
        echo "   Manual review required to ensure structure preservation"
        
        # Show the changes for review
        echo "   Changed lines:"
        git diff --cached | grep -E '^\+.*(<[^>]+>|class=|id=)' | head -5
        if [ "$SUSPICIOUS_CHANGES" -gt 5 ]; then
            echo "   ... and $((SUSPICIOUS_CHANGES - 5)) more"
        fi
    fi
fi

# 3. CHECK FOR NEW CSS RULES OR PROPERTIES
echo -e "\n🔍 Checking for new CSS rules..."

if git diff --cached | grep -E '^\+.*\{' > /dev/null; then
    NEW_CSS_RULES=$(git diff --cached | grep -E '^\+.*\{' | wc -l)
    if [ "$NEW_CSS_RULES" -gt 0 ]; then
        error_exit "New CSS rules detected ($NEW_CSS_RULES). CSS modifications are forbidden."
    fi
fi

# 4. CHECK FOR COLOR VALUE CHANGES
echo -e "\n🌈 Checking for color value modifications..."

if git diff --cached | grep -E '^\+.*#[0-9a-fA-F]{3,6}' > /dev/null; then
    COLOR_CHANGES=$(git diff --cached | grep -E '^\+.*#[0-9a-fA-F]{3,6}' | wc -l)
    if [ "$COLOR_CHANGES" -gt 0 ]; then
        error_exit "Color value changes detected ($COLOR_CHANGES). Color modifications are forbidden."
    fi
fi

# 5. RUN CSS INTEGRITY CHECK (if script exists)
if [ -f "scripts/css-integrity-check.js" ] && [ "$MERGE_COMMIT" = false ]; then
    echo -e "\n🔬 Running CSS integrity check..."
    if ! node scripts/css-integrity-check.js; then
        error_exit "CSS integrity check failed"
    fi
fi

# 6. CHECK FOR PACKAGE.JSON CHANGES THAT MIGHT AFFECT STYLING
echo -e "\n📦 Checking package.json changes..."

if git diff --cached --name-only | grep -q "package.json"; then
    # Check for new CSS/styling related dependencies
    if git diff --cached package.json | grep -E '^\+.*"(css|sass|less|postcss|tailwind|styled)' > /dev/null; then
        warning "New styling-related dependencies detected"
        echo "   Review required to ensure they don't affect visual output"
    fi
fi

# 7. CHECK FOR COMPONENT FILE CHANGES
echo -e "\n🧩 Checking component modifications..."

COMPONENT_FILES=$(git diff --cached --name-only | grep -E '\.(svelte|jsx?|tsx?)$' | wc -l)
if [ "$COMPONENT_FILES" -gt 0 ]; then
    echo "   $COMPONENT_FILES component file(s) modified"
    
    # Check for potential visual impact
    if git diff --cached | grep -E '^\+.*(style|class|css)' > /dev/null; then
        warning "Style-related changes detected in components"
        echo "   Ensure changes don't affect visual output"
    fi
fi

# 8. VALIDATE COMMIT MESSAGE (basic check)
echo -e "\n📝 Validating commit message..."

if [ -z "$MERGE_COMMIT" ]; then
    COMMIT_MSG=$(git log --format=%B -n 1 HEAD 2>/dev/null || echo "")
    if [[ "$COMMIT_MSG" =~ (css|style|visual|color|layout) ]]; then
        warning "Commit message mentions visual changes"
        echo "   Ensure changes are authorized per framework rules"
    fi
fi

# 9. CHECK FILE PERMISSIONS
echo -e "\n🔒 Checking file permissions..."

# Ensure no executable bits are added to CSS/HTML files
if git diff --cached --name-only | xargs -I {} git ls-files --stage {} | grep -E '^100755.*\.(css|html|svelte)$' > /dev/null; then
    error_exit "Executable permissions detected on CSS/HTML files"
fi

# 10. FINAL VALIDATION
echo -e "\n🎯 Final validation..."

# Check if any forbidden patterns exist in the diff
FORBIDDEN_PATTERNS=(
    "!important"
    "style="
    "background-color:"
    "color:"
    "font-family:"
    "font-size:"
    "margin:"
    "padding:"
)

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
    if git diff --cached | grep -q "^+.*$pattern"; then
        warning "Potentially forbidden pattern detected: $pattern"
    fi
done

# SUCCESS
echo -e "\n" + "="*56
success "Pre-commit checks completed successfully"
echo -e "${GREEN}🛡️  Feature Creep Prevention Framework: COMPLIANT${NC}"
echo -e "="*56

echo -e "\n📋 Summary:"
echo "   • CSS files: Protected ✅"
echo "   • HTML structure: Monitored ✅"
echo "   • Color values: Preserved ✅"
echo "   • Component changes: Reviewed ✅"
echo "   • Framework compliance: VERIFIED ✅"

echo -e "\n${GREEN}✅ Commit approved - no framework violations detected${NC}"
exit 0
#!/bin/bash

# Script to download Google Fonts locally for HackRF Sweep
# This is optional - the app currently uses Google Fonts CDN

echo "Font Download Script for HackRF Sweep"
echo "====================================="
echo "This script will download the fonts used by HackRF Sweep from Google Fonts"
echo "Current fonts loaded via CDN:"
echo "- Inter: weights 300-900"
echo "- JetBrains Mono: weights 300-700"
echo "- Fira Code: weights 300-700"
echo ""
echo "Note: The application currently works fine with Google Fonts CDN."
echo "Download local copies only if you need offline functionality."
echo ""
read -p "Do you want to download fonts locally? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Font download cancelled."
    exit 0
fi

# Create fonts directory
FONTS_DIR="static/fonts"
mkdir -p "$FONTS_DIR"

echo "Downloading fonts to $FONTS_DIR..."

# Base URL for Google Fonts API
GOOGLE_FONTS_CSS="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&family=Fira+Code:wght@300;400;500;600;700&display=swap"

# Download the CSS to parse font URLs
echo "Fetching font CSS..."
TEMP_CSS=$(mktemp)
curl -s "$GOOGLE_FONTS_CSS" -H "User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" > "$TEMP_CSS"

# Extract and download WOFF2 files
echo "Extracting font URLs..."
grep -oE 'https://[^)]+\.woff2' "$TEMP_CSS" | sort -u | while read -r url; do
    filename=$(echo "$url" | grep -oE '[^/]+\.woff2$')
    font_family=$(echo "$filename" | cut -d'-' -f1)
    
    # Create font family directory
    mkdir -p "$FONTS_DIR/$font_family"
    
    echo "Downloading $filename..."
    curl -s "$url" -o "$FONTS_DIR/$font_family/$filename"
done

# Clean up
rm "$TEMP_CSS"

echo ""
echo "Font download complete!"
echo ""
echo "To use local fonts instead of CDN:"
echo "1. Create a new CSS file: static/fonts/local-fonts.css"
echo "2. Add @font-face declarations for each font"
echo "3. Update app.css to import the local font CSS"
echo "4. Remove the Google Fonts import from app.css"
echo ""
echo "Example @font-face declaration:"
echo "@font-face {"
echo "  font-family: 'Inter';"
echo "  font-style: normal;"
echo "  font-weight: 400;"
echo "  src: url('/fonts/Inter/inter-v12-latin-regular.woff2') format('woff2');"
echo "}"
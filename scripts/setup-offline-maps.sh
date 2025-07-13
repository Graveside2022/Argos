#!/bin/bash

# Setup script for offline map tiles
set -e

echo "🗺️  Argos Offline Maps Setup"
echo "=========================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Create directories
echo "📁 Creating map data directories..."
mkdir -p map-data/{tiles,config,styles,fonts}

# Function to download map tiles
download_tiles() {
    local REGION=$1
    local OUTPUT=$2
    
    echo "📥 Downloading $REGION tiles..."
    
    # Option 1: Download from Geofabrik (OSM extracts)
    # Smaller regions available: https://download.geofabrik.de/
    case $REGION in
        "world")
            echo "⚠️  World map is very large (~50GB). Consider downloading a specific region instead."
            echo "Available regions:"
            echo "  - north-america"
            echo "  - europe"
            echo "  - asia"
            echo "  - your-country (e.g., united-states, great-britain)"
            ;;
        "test")
            # Download a small test region (e.g., Luxembourg)
            wget -O map-data/tiles/test.osm.pbf https://download.geofabrik.de/europe/luxembourg-latest.osm.pbf
            ;;
        *)
            # Try to download from Geofabrik
            wget -O map-data/tiles/${REGION}.osm.pbf https://download.geofabrik.de/${REGION}-latest.osm.pbf
            ;;
    esac
}

# Function to convert OSM data to MBTiles
convert_to_mbtiles() {
    local INPUT=$1
    local OUTPUT=$2
    
    echo "🔄 Converting to MBTiles format..."
    
    # Use tippecanoe in Docker
    docker run --rm \
        -v $(pwd)/map-data:/data \
        klokantech/tippecanoe \
        tippecanoe \
        -o /data/tiles/${OUTPUT}.mbtiles \
        --maximum-zoom=16 \
        --drop-densest-as-needed \
        /data/tiles/${INPUT}
}

# Function to download pre-made MBTiles
download_premade_mbtiles() {
    echo "📥 Downloading pre-made MBTiles..."
    echo ""
    echo "Option 1: OpenMapTiles (Commercial, has free tier)"
    echo "  Visit: https://data.maptiler.com/downloads/"
    echo "  Download your region and place in: map-data/tiles/"
    echo ""
    echo "Option 2: Natural Earth (Free, lower detail)"
    echo "  wget -O map-data/tiles/natural-earth.mbtiles https://github.com/lukasmartinelli/naturalearthtiles/releases/download/v1.0/natural_earth.mbtiles"
    echo ""
    echo "Option 3: Use tile scraper (for small areas only)"
    echo "  We can create a custom scraper for your specific area"
}

# Main menu
echo ""
echo "Choose an option:"
echo "1) Download test region (Luxembourg, ~50MB)"
echo "2) Download specific region from Geofabrik"
echo "3) Get instructions for pre-made MBTiles"
echo "4) Setup tile server only (I have my own tiles)"
echo ""

read -p "Enter choice (1-4): " choice

case $choice in
    1)
        download_tiles "test" "luxembourg"
        echo "✅ Test tiles downloaded"
        ;;
    2)
        echo "Enter region (e.g., 'europe/germany', 'north-america/us/california'):"
        read -p "Region: " region
        download_tiles "$region" "$region"
        ;;
    3)
        download_premade_mbtiles
        echo ""
        echo "After downloading, continue with option 4 to setup the server"
        exit 0
        ;;
    4)
        echo "📋 Assuming you have tiles in map-data/tiles/"
        ;;
esac

# Download styles
echo "🎨 Downloading map styles..."
mkdir -p map-data/styles/{osm-bright,dark-matter}

# Download OSM Bright style
wget -O map-data/styles/osm-bright-style.zip https://github.com/openmaptiles/osm-bright-gl-style/releases/latest/download/style.zip
unzip -o map-data/styles/osm-bright-style.zip -d map-data/styles/osm-bright/
rm map-data/styles/osm-bright-style.zip

# Download Dark Matter style
wget -O map-data/styles/dark-matter-style.zip https://github.com/openmaptiles/dark-matter-gl-style/releases/latest/download/style.zip
unzip -o map-data/styles/dark-matter-style.zip -d map-data/styles/dark-matter/
rm map-data/styles/dark-matter-style.zip

# Download fonts
echo "🔤 Downloading fonts..."
wget -O map-data/fonts/fonts.zip https://github.com/openmaptiles/fonts/releases/latest/download/v2.0.zip
unzip -o map-data/fonts/fonts.zip -d map-data/fonts/
rm map-data/fonts/fonts.zip

# Update tactical map to use local tiles
echo "🔧 Updating tactical map configuration..."
cat > src/lib/config/mapConfig.ts << 'EOF'
// Map configuration for offline tiles
export const MAP_CONFIG = {
  // Tile server URL - change this based on your setup
  tileServerUrl: process.env.PUBLIC_TILE_SERVER_URL || 'http://localhost:8088',
  
  // Available tile sources
  tileSources: {
    osmBright: '/styles/osm-bright/{z}/{x}/{y}.png',
    darkMatter: '/styles/dark-matter/{z}/{x}/{y}.png',
    satellite: null // Add if you have satellite tiles
  },
  
  // Default map settings
  defaultCenter: [0, 0], // Will be overridden by GPS
  defaultZoom: 15,
  maxZoom: 19,
  minZoom: 2,
  
  // Attribution
  attribution: '© OpenStreetMap contributors'
};
EOF

# Start tile server
echo ""
echo "🚀 Starting tile server..."
docker-compose -f docker-compose.tiles.yml up -d

echo ""
echo "✅ Setup complete!"
echo ""
echo "📍 Tile server running at: http://localhost:8088"
echo "🗺️  View available styles at: http://localhost:8088/styles"
echo ""
echo "Next steps:"
echo "1. If you need more map data, download MBTiles for your region"
echo "2. Place .mbtiles files in: map-data/tiles/"
echo "3. Update map-data/config/config.json with your tile names"
echo "4. Restart the tile server: docker-compose -f docker-compose.tiles.yml restart"
echo ""
echo "To view the tactical map: http://localhost:5173/tactical-map"
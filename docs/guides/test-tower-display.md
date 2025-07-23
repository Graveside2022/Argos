# Test Tower Display on Tactical Map

## Steps to Test:

1. Open http://100.79.154.94:5173/tactical-map-simple
2. Open browser developer console (F12)
3. Click the "Towers" button in the bottom footer
4. Watch the console for these messages:
   - "Fetched X towers from GSM Evil" 
   - "Adding tower..." messages
   - "showCellTowers: true, map exists: true"
   - "Added tower X to map"

## Expected Result:
- Tower markers should appear on the map at the locations specified in the GSM Evil database
- The towers button should show a count (e.g., "2 Towers")
- Clicking on a tower marker should show a popup with tower details including IMSI count

## API Test:
You can also test the API directly:
```bash
curl http://localhost:5173/api/tactical-map/gsm-evil-towers | jq
```

This should return tower data with lat/lon coordinates.
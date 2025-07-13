# How to Check if the Database is Working

## Chrome/Chromium Browser:

1. **Open the Tactical Map**
    - Go to: http://localhost:5173/tactical-map

2. **Open Developer Tools**
    - Press `F12` on your keyboard
    - OR right-click anywhere on the page and select "Inspect"

3. **Find the Database**
    - Look at the top menu bar in DevTools
    - Click on "Application" tab (might be hidden under >> if window is small)
    - In the left sidebar, you'll see:
        ```
        Application
        ├── Storage
        │   ├── Local Storage
        │   ├── Session Storage
        │   ├── IndexedDB         <-- Click this
        │   │   ├── RFSignalsDB   <-- This is our database!
        │   │   │   ├── signals   <-- Stored RF signals
        │   │   │   ├── devices   <-- Detected devices
        │   │   │   ├── relationships
        │   │   │   └── patterns
        ```

4. **What You Should See**
    - Click on "signals" under RFSignalsDB
    - You'll see a table with columns like: id, lat, lon, power, frequency
    - Each row is a stored signal from HackRF
    - New signals appear here automatically

## Firefox Browser:

1. **Open Developer Tools** (F12)
2. Click "Storage" tab instead of "Application"
3. Expand "Indexed DB" in the left sidebar
4. Look for "RFSignalsDB"

## Quick Test:

Visit this URL to run a test:
http://localhost:5173/test-db-client

This will:

- Store 10 test signals
- Query them back
- Show you the results on screen

## What This Means:

When I said "Go to Application > IndexedDB > RFSignalsDB", I meant:

- Your browser has a built-in database (IndexedDB)
- Our app stores all RF signals there automatically
- You can inspect this database using browser DevTools
- It's like looking at a spreadsheet of all captured signals

Think of it as the browser's version of a SQLite database viewer - you're literally looking at the stored RF signal data in real-time.

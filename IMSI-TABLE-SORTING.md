# IMSI Capture Table - Sortable Columns

## Features Added

### 1. **Sortable Column Headers**

All columns in the IMSI Capture table are now clickable and sortable:

- **Carrier** - Alphabetical sort
- **Country** - Alphabetical by country name
- **Cell Tower Location** - Sort by whether location exists, then by distance
- **LAC/CI** - Numeric sort by LAC value
- **MCC-MNC** - Alphanumeric sort
- **Devices** - Numeric sort by device count (default sort)
- **Last Seen** - Chronological sort by timestamp

### 2. **Visual Sort Indicators**

- **▲** (up arrow) = Ascending sort
- **▼** (down arrow) = Descending sort
- Arrows appear next to the active sort column
- Headers highlight on hover (blue glow)

### 3. **Smart Default Sorting**

- **Device Count** (descending) - Shows towers with most devices first
- Click any column to re-sort
- Click again to reverse direction

### 4. **Improved Column Alignment**

- Fixed column widths for consistent alignment
- Headers and data rows now perfectly aligned
- Proper text alignment (centered for most columns)

## How to Use

1. **Sort by any column**: Click the column header
2. **Reverse sort**: Click the same header again
3. **Switch columns**: Click a different header

## Default Behavior

When you start IMSI capture, the table defaults to:

- **Sort by**: Devices (count)
- **Direction**: Descending (most devices first)

This shows the most active cell towers at the top.

## Technical Details

### Sort Functions

**Carrier/Country**: Case-insensitive alphabetical
**Location**: Prioritizes towers with known locations, then sorts by distance
**LAC/CI**: Numeric by LAC value
**MCC-MNC**: String comparison
**Devices**: Numeric by count
**Last Seen**: Chronological by Unix timestamp

### Column Widths

```
Carrier:    140px
Country:    120px
Location:   160px
LAC/CI:      80px
MCC-MNC:     70px
Devices:     90px
Last Seen:  120px
```

## Files Modified

1. `src/routes/gsm-evil/+page.svelte`
    - Lines 36-39: Added sort state variables
    - Lines 44-45: Updated groupedTowers reactive statement
    - Lines 981-1039: Added sortTowers() and handleSort() functions
    - Lines 1595-1666: Updated header HTML with sortable buttons
    - Lines 2717-2745: Added sortable header CSS styles

## Testing

1. **Start IMSI capture**
2. **Capture some IMSIs** (at least 3-4 towers for best test)
3. **Click column headers** - table should re-sort immediately
4. **Check alignment** - columns should line up perfectly
5. **Look for arrows** - active sort column shows ▲ or ▼

## Expected Behavior

- **Single click**: Sort by that column (ascending for text, descending for numbers)
- **Second click**: Reverse sort direction
- **Different column**: Switch to that column with appropriate default direction
- **Smooth transition**: Re-sorting happens instantly (reactive)

## Example Scenarios

### Scenario 1: Find Most Active Tower

**Action**: Default sort (Devices, descending)
**Result**: Tower with most captured devices at top

### Scenario 2: Find Newest Activity

**Action**: Click "Last Seen" header
**Result**: Most recently seen towers at top (descending)

### Scenario 3: Group by Country

**Action**: Click "Country" header
**Result**: Towers sorted alphabetically by country

### Scenario 4: Find Specific LAC

**Action**: Click "LAC/CI" header
**Result**: Towers sorted numerically by LAC value

## CSS Classes Added

- `.header-sortable` - Base style for clickable headers
- `.sort-indicator` - Style for ▲/▼ arrows
- Hover effect: Blue glow on header buttons
- Active state: Arrow indicator next to text

## Keyboard Accessibility

All header buttons are keyboard-accessible:

- **Tab**: Navigate between headers
- **Enter/Space**: Activate sort

## Performance

Sorting is reactive and instant:

- Uses JavaScript `.sort()` with custom comparators
- O(n log n) complexity
- Handles 100+ towers without lag
- No network requests needed (client-side only)

## Future Enhancements

Potential improvements for future versions:

1. Multi-column sort (Shift+Click)
2. Filter/search within table
3. Export sorted data to CSV
4. Remember sort preferences in localStorage
5. Column visibility toggles

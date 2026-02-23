# Lunaris UI Design Specification

> **Status:** Final — Approved 2026-02-23
> **Source:** `pencil-lunaris.pen` (Pencil mockup file)
> **Theme:** Dark mode only (Mode: Dark)

---

## 1. Design System Variables

All design tokens are defined as CSS custom properties. Only the **Dark** theme values apply.

### 1.1 Core Palette

| Token                    | Hex       | Usage                            |
| ------------------------ | --------- | -------------------------------- |
| `--background`           | `#111111` | Page/app background              |
| `--foreground`           | `#FFFFFF` | Primary text on dark backgrounds |
| `--card`                 | `#1A1A1A` | Card/panel background            |
| `--card-foreground`      | `#FFFFFF` | Text on cards                    |
| `--border`               | `#2E2E2E` | All borders and dividers         |
| `--input`                | `#2E2E2E` | Input field borders              |
| `--muted`                | `#2E2E2E` | Muted/disabled backgrounds       |
| `--muted-foreground`     | `#B8B9B6` | Muted/secondary text             |
| `--primary`              | `#FF8400` | Primary brand accent (orange)    |
| `--primary-foreground`   | `#111111` | Text on primary accent           |
| `--secondary`            | `#2E2E2E` | Secondary backgrounds            |
| `--secondary-foreground` | `#FFFFFF` | Text on secondary                |
| `--accent`               | `#111111` | Accent backgrounds               |
| `--accent-foreground`    | `#F2F3F0` | On accent backgrounds            |
| `--destructive`          | `#FF5C33` | Destructive/error actions        |
| `--ring`                 | `#666666` | Focus ring color                 |
| `--black`                | `#000000` | Absolute black                   |
| `--white`                | `#FFFFFF` | Absolute white                   |

### 1.2 Semantic Colors

| Token                        | Dark Hex  | Usage              |
| ---------------------------- | --------- | ------------------ |
| `--color-success`            | `#222924` | Success background |
| `--color-success-foreground` | `#B6FFCE` | Success text       |
| `--color-warning`            | `#291C0F` | Warning background |
| `--color-warning-foreground` | `#FF8400` | Warning text       |
| `--color-error`              | `#24100B` | Error background   |
| `--color-error-foreground`   | `#FF5C33` | Error text/icons   |
| `--color-info`               | `#222229` | Info background    |
| `--color-info-foreground`    | `#B2B2FF` | Info text          |

### 1.3 Sidebar Colors

| Token                          | Dark Hex    |
| ------------------------------ | ----------- |
| `--sidebar`                    | `#18181b`   |
| `--sidebar-foreground`         | `#808080`   |
| `--sidebar-accent`             | `#2a2a30`   |
| `--sidebar-accent-foreground`  | `#fafafa`   |
| `--sidebar-border`             | `#ffffff1a` |
| `--sidebar-primary`            | `#18181b`   |
| `--sidebar-primary-foreground` | `#fafafa`   |

---

## 2. Functional Color Palette (In-Use)

These are the exact hex values used across all mockup panels. **Only these colors may be used.**

### 2.1 Surface / Fill Colors

| Hex       | Name          | Usage                             |
| --------- | ------------- | --------------------------------- |
| `#0a0a0a` | Deepest Black | Terminal backgrounds              |
| `#0d0d0d` | Near Black    | Console backgrounds               |
| `#111111` | Background    | App background, `--background`    |
| `#141414` | Surface-1     | Slightly elevated surfaces        |
| `#151515` | Surface-2     | Panel inner sections              |
| `#181818` | Surface-3     | Alternate panel areas             |
| `#18181b` | Sidebar       | Sidebar background                |
| `#1a1a1a` | Card          | Cards, panels, `--card`           |
| `#1a2030` | Chat Bubble   | AI assistant response bubble      |
| `#1a2333` | Chat Header   | Assistant panel header            |
| `#1d283a` | Active Tab    | Selected tab indicator background |
| `#2a2a2a` | Elevated      | Raised elements, toggle off-state |
| `#2e2e2e` | Border        | All borders, `--border`           |

### 2.2 Text Colors (Hierarchy)

| Hex       | Name      | Usage                                |
| --------- | --------- | ------------------------------------ |
| `#FFFFFF` | Primary   | Labels, headings, primary values     |
| `#bbbbbb` | Secondary | Body text, descriptions              |
| `#888888` | Tertiary  | Section headers, labels              |
| `#666666` | Muted     | Row data, disabled items, sub-labels |
| `#555555` | Dim       | Placeholder text, inactive items     |

### 2.3 Status & Accent Colors

| Hex       | Name             | Usage                                                          |
| --------- | ---------------- | -------------------------------------------------------------- |
| `#809AD0` | Brand Accent     | Toggle on-state, interactive highlights, links                 |
| `#4a8af4` | Interactive Blue | Active badges, chat send button, selected imports              |
| `#8bbfa0` | System Green     | Start Scan button, "Fair" RSSI indicator, toggle active accent |
| `#d4a054` | Amber/Yellow     | "Strong" RSSI indicator, "Unknown" GSM table rows              |
| `#c4a84a` | Gold             | "Good" RSSI indicator                                          |
| `#c45b4a` | System Red       | Stop Scan button, "Very Strong" RSSI dot, hostile indicators   |
| `#d05a55` | Error Light      | Error text in expanded states                                  |
| `#ff5c33` | Destructive      | Error messages, `--destructive`                                |
| `#a8b8e0` | Light Accent     | Subtle accent text                                             |

### 2.4 RSSI Signal Strength Color Scale

| Level             | Dot Color | Text Color |
| ----------------- | --------- | ---------- |
| Very Strong (25m) | `#c45b4a` | `#FFFFFF`  |
| Strong (60m)      | `#d4a054` | `#FFFFFF`  |
| Good (100m)       | `#c4a84a` | `#FFFFFF`  |
| Fair (175m)       | `#8bbfa0` | `#FFFFFF`  |
| Weak (300m)       | `#809AD0` | `#FFFFFF`  |
| No RSSI           | `#555555` | `#FFFFFF`  |

---

## 3. Typography

### 3.1 Font Families

| Token              | Font          | Usage                                                                   |
| ------------------ | ------------- | ----------------------------------------------------------------------- |
| `--font-secondary` | **Geist**     | All UI text — headings, labels, body text, buttons                      |
| `--font-primary`   | **Fira Code** | Monospace — terminal, console, data values, section headers, table data |

> **Rule:** Every text element uses either `Geist` or `Fira Code`. No other fonts are permitted.

### 3.2 Font Size Scale

| Size     | Usage                                                                       |
| -------- | --------------------------------------------------------------------------- |
| **10px** | Section subheaders (e.g., `MAP LAYERS`, `SIGNAL STRENGTH`), small labels    |
| **12px** | Standard body text, table data, form labels, toggle labels, dropdown values |
| **14px** | Panel headings, card titles, button text, primary labels                    |
| **16px** | Page titles, major headings                                                 |
| **24px** | Large stat values (CPU %, memory), hero numbers                             |

> **Rule:** Only these 5 sizes are permitted: `10`, `12`, `14`, `16`, `24`.

### 3.3 Font Weights

| Weight            | Usage                                |
| ----------------- | ------------------------------------ |
| `normal` (400)    | Body text, values, descriptions      |
| `600` (Semi-bold) | Section headers, labels, status text |
| `bold` (700)      | Headings, emphasis                   |

### 3.4 Letter Spacing

| Value         | Usage                                                            |
| ------------- | ---------------------------------------------------------------- |
| `1.2px`       | All-caps section headers (e.g., `MAP LAYERS`, `SIGNAL STRENGTH`) |
| `0` (default) | Everything else                                                  |

---

## 4. Spacing System (4px Grid)

### 4.1 Padding

| Value  | Usage                                            |
| ------ | ------------------------------------------------ |
| `4px`  | Tight internal padding (badges, chips)           |
| `8px`  | Standard internal padding (rows, small elements) |
| `12px` | Section padding (vertical)                       |
| `16px` | Section padding (horizontal), panel padding      |
| `24px` | Large content area padding                       |

### 4.2 Gap

| Value  | Usage                                              |
| ------ | -------------------------------------------------- |
| `0px`  | No gap (tightly packed elements)                   |
| `4px`  | Tight stacking (sub-elements)                      |
| `8px`  | Standard gap between rows, list items, form fields |
| `12px` | Section gaps                                       |
| `16px` | Major section separation                           |
| `24px` | Top-level content separation                       |

> **Rule:** All padding and gap values must sit on the 4px grid: `0, 4, 8, 12, 16, 24`.

---

## 5. Corner Radius

| Value   | Usage                                                           |
| ------- | --------------------------------------------------------------- |
| `0px`   | Panels, cards, containers — all rectangular                     |
| `4px`   | Interactive elements: buttons, inputs, badges, chips, dropdowns |
| `10px`  | Toggle switch tracks (pill shape)                               |
| `999px` | Fully round elements (toggle thumbs/ellipses)                   |

> **Rule:** Panels and content containers always have `cornerRadius: 0`. Only interactive elements get `4px`. Toggles use `10px` for the track.

---

## 6. Borders & Strokes

| Property  | Value                       |
| --------- | --------------------------- |
| Color     | `#2E2E2E` (single standard) |
| Thickness | `1px`                       |
| Alignment | `inside`                    |

> **Rule:** All borders use `#2E2E2E`, `1px`, aligned `inside`. No other stroke colors.

---

## 7. Component Specifications

### 7.1 Toggle Switch

The standard toggle used throughout the application.

**Track (On State):**
| Property | Value |
|----------|-------|
| Width | `36px` |
| Height | `20px` |
| Corner Radius | `10px` (pill) |
| Fill | `#809AD0` (accent blue) |
| Layout | `none` (absolute positioning for thumb) |

**Track (Off State):**
| Property | Value |
|----------|-------|
| Width | `36px` |
| Height | `20px` |
| Corner Radius | `10px` (pill) |
| Fill | `#2A2A2A` (muted) |

**Thumb (On State):**
| Property | Value |
|----------|-------|
| Type | `ellipse` |
| Width | `14px` |
| Height | `14px` |
| Fill | `#FFFFFF` |
| Position | `x: 19, y: 3` |

**Thumb (Off State):**
| Property | Value |
|----------|-------|
| Type | `ellipse` |
| Width | `14px` |
| Height | `14px` |
| Fill | `#888888` |
| Position | `x: 2, y: 3` |

### 7.2 Buttons

#### Primary Action Button (Start Scan)

| Property      | Value                      |
| ------------- | -------------------------- |
| Fill          | `#8bbfa0` (system green)   |
| Text Color    | `#000000`                  |
| Font          | `Fira Code`, `14px`, `600` |
| Corner Radius | `4px`                      |
| Padding       | `8px 16px`                 |

#### Destructive Button (Stop Scan)

| Property      | Value                      |
| ------------- | -------------------------- |
| Fill          | `#c45b4a` (system red)     |
| Text Color    | `#FFFFFF`                  |
| Font          | `Fira Code`, `14px`, `600` |
| Corner Radius | `4px`                      |
| Padding       | `8px 16px`                 |

#### Ghost/Secondary Button (Disconnect, Test)

| Property      | Value                         |
| ------------- | ----------------------------- |
| Fill          | `transparent` or `#2e2e2e`    |
| Stroke        | `#2e2e2e`, `1px`, `inside`    |
| Text Color    | `#FFFFFF`                     |
| Font          | `Fira Code`, `12px`, `normal` |
| Corner Radius | `4px`                         |

#### Interactive Link Button (e.g., Kismet, Argos Engine)

| Property        | Value                         |
| --------------- | ----------------------------- |
| Fill            | `none`                        |
| Text Color      | `#8bbfa0` (system green)      |
| Font            | `Fira Code`, `12px`, `normal` |
| Text Decoration | Underline (implied by color)  |

### 7.3 Input Fields

| Property          | Value                         |
| ----------------- | ----------------------------- |
| Fill              | `#151515` or `#141414`        |
| Stroke            | `#2e2e2e`, `1px`, `inside`    |
| Corner Radius     | `4px`                         |
| Text Color        | `#FFFFFF`                     |
| Placeholder Color | `#555555`                     |
| Font              | `Fira Code`, `12px`, `normal` |
| Height            | `32–36px`                     |
| Padding           | `8px 12px`                    |

### 7.4 Dropdown / Select

| Property       | Value                           |
| -------------- | ------------------------------- |
| Same as Input  | See 7.3                         |
| Chevron        | Small arrow indicator on right  |
| Selected Value | `#FFFFFF`                       |
| Label (left)   | `#888888`, `12px`               |
| Value (right)  | `#FFFFFF`, `12px`               |
| Row Layout     | `justifyContent: space_between` |

### 7.5 Status Badge / Chip

| Property       | Value                                |
| -------------- | ------------------------------------ |
| Fill           | `#1a3a2a` (success bg) or contextual |
| Text Color     | `#8bbfa0` (status green)             |
| Dot            | `8px` ellipse, same color as text    |
| Font           | `Fira Code`, `10px`, `600`           |
| Corner Radius  | `4px`                                |
| Letter Spacing | `1.2px` (caps)                       |
| Padding        | `4px 8px`                            |

### 7.6 Data Panel (WiFi Adapter, SDR, GPS)

| Property      | Value                                                        |
| ------------- | ------------------------------------------------------------ |
| Background    | `#1a1a1a`                                                    |
| Corner Radius | `0px`                                                        |
| Border        | `#2e2e2e`, `1px`, `inside`                                   |
| Title         | `Fira Code`, `10px`, `600`, `#888888`, `letter-spacing: 1.2` |
| Row Layout    | Horizontal, `justifyContent: space_between`                  |
| Label         | `Fira Code`, `12px`, `normal`, `#666666`                     |
| Value         | `Fira Code`, `12px`, `normal`, `#FFFFFF`                     |
| Row Gap       | `8px`                                                        |
| Padding       | `12px 16px`                                                  |
| Separator     | Bottom stroke `#2e2e2e`, `1px`                               |

### 7.7 Table (GSM Evil)

| Property                 | Value                                 |
| ------------------------ | ------------------------------------- |
| Header Row               | `Fira Code`, `10px`, `600`, `#888888` |
| Data Cell                | `Fira Code`, `12px`, `normal`         |
| Known Carrier Text       | `#FFFFFF`                             |
| Unknown Carrier Text     | `#d4a054` (amber)                     |
| Error/Alert Text         | `#ff5c33`                             |
| Row Hover                | Subtle highlight (optional)           |
| Expandable Row Indicator | `>` chevron, `#666666`                |
| Expanded Row Background  | `#151515`                             |
| Border                   | `#2e2e2e`, `1px` bottom per row       |

### 7.8 Section Header (All-Caps Label)

| Property       | Value       |
| -------------- | ----------- |
| Font           | `Fira Code` |
| Size           | `10px`      |
| Weight         | `600`       |
| Color          | `#888888`   |
| Letter Spacing | `1.2px`     |
| Text Transform | `uppercase` |
| Margin Bottom  | `8px`       |

### 7.9 Chat / Assistant Panel

| Property             | Value                                    |
| -------------------- | ---------------------------------------- |
| Panel Background     | `#111111`                                |
| Header Background    | `#1a2333`                                |
| User Bubble Fill     | `#1d283a`                                |
| AI Bubble Fill       | `#1a2030`                                |
| Bubble Corner Radius | `4px`                                    |
| Bubble Text          | `Fira Code`, `12px`, `normal`, `#FFFFFF` |
| Input Field          | Same as 7.3, positioned at bottom        |
| Send Button          | `#4a8af4` fill, `4px` radius             |

### 7.10 Terminal / Console

| Property       | Value                         |
| -------------- | ----------------------------- |
| Background     | `#0a0a0a` or `#0d0d0d`        |
| Text           | `Fira Code`, `12px`, `normal` |
| INFO Prefix    | `#888888`                     |
| WARN Prefix    | `#d4a054` (amber)             |
| ERROR Prefix   | `#ff5c33` (red)               |
| SUCCESS Prefix | `#8bbfa0` (green)             |
| Timestamp      | `#666666`                     |

---

## 8. Layout Rules

### 8.1 Sidebar

| Property      | Value              |
| ------------- | ------------------ |
| Width         | `240px`            |
| Background    | `#18181b`          |
| Icon Size     | `16–20px`          |
| Active Icon   | `#809AD0`          |
| Inactive Icon | `#808080`          |
| Dividers      | `#ffffff1a`, `1px` |

### 8.2 Header Bar

| Property    | Value                                    |
| ----------- | ---------------------------------------- |
| Height      | `40px`                                   |
| Background  | `#111111` or `#0e1116e6`                 |
| Logo Text   | `Fira Code`, `14px`, `bold`, `#FFFFFF`   |
| Status Dots | `8px` ellipses with semantic colors      |
| Right Info  | `Fira Code`, `12px`, `normal`, `#888888` |

### 8.3 Content Area

| Property                | Value                               |
| ----------------------- | ----------------------------------- |
| Panel Layout            | Vertical stack within column        |
| Panel Gap               | `0px` (flush) or `16px` (separated) |
| Panel Padding           | `12px 16px`                         |
| Max Sidebar Panel Width | `240–280px`                         |

### 8.4 Tab Bar

| Property              | Value                         |
| --------------------- | ----------------------------- |
| Background            | Transparent                   |
| Tab Text              | `Fira Code`, `12px`, `normal` |
| Active Tab Background | `#1d283a`                     |
| Active Tab Text       | `#FFFFFF`                     |
| Inactive Tab Text     | `#888888`                     |
| Tab Gap               | `0px`                         |
| Tab Padding           | `8px 16px`                    |

---

## 9. Mockup Panel Index

The finalized mockups are stored in `pencil-lunaris.pen`. Below is the complete index of all panels with their node IDs.

| #   | Panel Name                             | Node ID |
| --- | -------------------------------------- | ------- |
| 1   | System Overview (Dashboard)            | `ZQUdr` |
| 2   | Agent Tools — Default                  | `TWcPt` |
| 3   | Agent Tools — Ghost Mode               | `mVkzP` |
| 4   | Map Sidebar (Layers + Signal Strength) | `P6QFn` |
| 5   | Settings — Appearance                  | `1AY5e` |
| 6   | Settings — Hardware                    | `4ZHnB` |
| 7   | TAK Server Configuration               | `D4cfM` |
| 8   | GSM Evil — Empty State                 | `OtC27` |
| 9   | GSM Evil — Scan Active                 | `HBkK9` |
| 10  | GSM Evil — Expanded Rows               | `zFCMo` |
| 11  | Speed Test Widget                      | `WODyP` |
| 12  | Network Latency Widget                 | `Ci2wq` |
| 13  | Weather Widget                         | `i6sXJ` |
| 14  | Node Mesh Widget                       | `anGPm` |
| 15  | WiFi Adapter Info                      | `kOTKu` |
| 16  | Software Defined Radio Info            | `E5ylj` |
| 17  | GPS Receiver Info                      | `EOA6K` |
| 18  | Device List (WiFi Scanner)             | `LFDvo` |
| 19  | Agent Chat Panel                       | `j0YYx` |
| 20  | Terminal Unavailable State             | `hKXlP` |

---

## 10. Design Principles

1. **No rounded panels.** All containers, cards, and panels use `cornerRadius: 0`.
2. **Uniform border language.** Single color `#2E2E2E`, single weight `1px`, always `inside`.
3. **Strict color discipline.** Only use colors from Sections 2.1–2.4. No ad-hoc hex values.
4. **Two-font system.** `Geist` for UI elements, `Fira Code` for data and monospace.
5. **Five-step type scale.** `10 / 12 / 14 / 16 / 24`. Nothing else.
6. **4px spacing grid.** All padding and gaps are multiples: `0, 4, 8, 12, 16, 24`.
7. **Semantic status colors.** Green (`#8bbfa0`), Amber (`#d4a054`), Red (`#c45b4a`). One of each.
8. **Accent consistency.** `#809AD0` is the single interactive accent (toggles, active states, links).
9. **Dark-first design.** All surfaces descend from `#111111`. Lighter surfaces create hierarchy through subtle luminance shifts, never through color.
10. **No drop shadows on panels.** Elevation is communicated through fill value changes only.

# Plan 1: Tactical UI Overhaul

> **STATUS: DISCUSSION ONLY — DO NOT EXECUTE. This is a proposal to be reviewed and discussed before any implementation begins.**

## Overview

Six recommendations for making the Argos tactical display military-grade. Focuses on standard military symbology, consistent color systems, map engine consolidation, and visual intelligence displays.

**Total effort**: ~16-21 days
**New packages needed**: `milsymbol`, `sigma`, `graphology`
**Dependencies**: Independent — can start anytime after cleanup

---

## Current UI Architecture

| Component                  | Library        | Rendering             | FPS               | Status                                   |
| -------------------------- | -------------- | --------------------- | ----------------- | ---------------------------------------- |
| Spectrum display           | Custom code    | Canvas 2D             | 30 FPS cap        | Well-optimized, pixel-level manipulation |
| Waterfall plot             | Custom code    | Canvas 2D + ImageData | 30 FPS cap        | Direct typed-array memory, buffer reuse  |
| Tactical map (dashboard)   | MapLibre GL JS | WebGL vector tiles    | Uncapped          | GPU-accelerated, already good            |
| Tactical map (kismet page) | Leaflet        | DOM/Canvas            | N/A               | Sluggish with many markers               |
| Signal heatmap overlay     | Custom code    | WebGL shaders         | 5-20 FPS adaptive | Exists but under-utilized                |
| Network topology           | Nothing        | N/A                   | N/A               | Kismet devices shown as flat lists only  |
| Spectrum charts            | Custom code    | Canvas 2D             | 30 FPS cap        | Gradient caching, batched grid lines     |
| AI agent chat              | Custom SSE     | Text streaming        | N/A               | Basic but functional                     |

---

## 1. MIL-STD-2525 Military Symbology (milsymbol)

**In plain English**: Right now, the tactical map shows generic colored dots for devices and towers. Every soldier is trained to read a specific set of military map symbols (the same ones used in CPCE, JBC-P, and every operations order). This replaces the generic dots with those real military symbols. A hostile jammer shows up as a red diamond with the EW icon. A friendly radio shows as a blue rectangle with the comms icon. Any trained operator can read the map instantly without learning Argos-specific icons.

`milsymbol` is a free, open-source library on npm. It doesn't contain image files — it draws the official DoD symbols mathematically as SVG on-the-fly. You tell it "hostile electronic warfare jammer" and it draws the correct MIL-STD-2525E symbol. 80KB, zero dependencies, generates 1,000 symbols in under 20 milliseconds.

**Integration with Argos**:

- Replace generic map markers with proper military symbols on the tactical map
- WiFi APs → communications equipment symbols
- Detected cellular → mobile subscriber symbols
- HackRF transmissions → EW jammer symbols
- Unknown devices → unknown equipment symbols with "?" indicator
- GPS-tracked assets → platform symbols with direction-of-movement indicators

**Operator benefit**: The map looks and reads like a real Common Operating Picture (COP). Any soldier can glance at it and understand the electromagnetic battlespace without training on Argos-specific iconography.

**Effort**: Low (2 days). Outputs SVG that drops directly into map markers.

---

## 2. Tactical Color System (NATO Standard Colors)

**In plain English**: Right now, colors in Argos are inconsistent. A red dot might mean "strong signal" on one page and "error" on another page. An operator under stress shouldn't have to think about what a color means — it should be automatic.

This fix is simple: **pick one meaning for each color and use it the same way on every page.**

- **Red** = hostile / critical / danger — always
- **Blue** = friendly / your own equipment — always
- **Yellow** = unknown / warning — always
- **Green** = neutral / good / nominal — always

These are the same colors used in MIL-STD-2525 military symbols (recommendation #1), so the map symbols and the UI panels all match.

Plus an optional **night mode** that turns everything green/amber so it doesn't ruin your night vision if you're operating in the dark with NVGs.

This is just changing color settings in one CSS file — no new software, no new code logic, no new packages.

**Operator benefit**: Colors mean the same thing everywhere. Red is always bad. Green is always good. Night mode preserves dark adaptation.

**Effort**: Low (1-2 days). Pure CSS changes in one file (`design-system.css`).

---

## 3. Consolidate to MapLibre GL JS (Drop Leaflet)

**In plain English**: Argos currently uses two different map engines. The dashboard page uses MapLibre (fast, uses the GPU graphics chip) and the tactical/kismet pages use Leaflet (slow, uses only the CPU). This means half the app has smooth maps and half has sluggish maps. The fix: use MapLibre everywhere. Same map images, faster engine on every page.

**What changes**:

- Migrate all Leaflet-based map views to MapLibre GL JS
- Replace `leaflet.heat` with MapLibre's built-in heatmap layer (GPU-rendered)
- Replace `leaflet.markercluster` with MapLibre's built-in clustering
- One map engine, one look and feel, consistent across all pages

**Operator benefit**: Smoother map interaction on every page. No more lag when hundreds of devices are on screen.

**Effort**: Medium (3-4 days). The existing `DashboardMap.svelte` is the template.

---

## 4. WebGL Spectrum Waterfall (OffscreenCanvas + Web Worker)

**In plain English**: The waterfall display is the scrolling color chart that shows radio frequencies over time. Right now, the RPi's main processor draws this waterfall AND handles all your button clicks, device lists, and menus at the same time on one core. When you click around the UI while scanning, the waterfall can stutter.

This fix gives the waterfall its own dedicated worker — like assigning a second employee to handle only the waterfall drawing. The main processor handles the UI, and the worker handles only the waterfall. They work at the same time instead of taking turns. The RPi 5 has 4 CPU cores — this spreads the work across two.

No new software packages needed — just reorganizing existing code.

**Operator benefit**: Spectrum display stays smooth even when the UI is busy.

**Effort**: Medium (3-4 days). Zero new dependencies.

---

## 5. Network Topology View (Sigma.js)

**In plain English**: Right now, Kismet detects WiFi devices and shows them as a long scrollable list — a table of names, MAC addresses, and signal strengths. If there are 200 routers and 800 phones/laptops, you're scrolling through a 1,000-row spreadsheet.

A network topology view replaces that spreadsheet with a **visual web**:

- Big circles = WiFi routers (access points)
- Small circles = phones, laptops, IoT devices
- Lines between them = "this device is connected to this router"
- Green lines = encrypted (secure), red lines = open/unencrypted (dangerous)
- Bigger circle = stronger signal

You can instantly SEE clusters of devices, spot a rogue access point, or find a device suspiciously probing many networks. It's the difference between reading a phonebook and looking at a relationship diagram.

Sigma.js uses the GPU and handles 10,000+ items smoothly. Adds 2 small packages (`sigma` + `graphology`).

**Operator benefit**: "Show me the network" becomes a single visual picture.

**Effort**: Medium (4-5 days).

---

## 6. Unified Signal Timeline (Custom Canvas)

**In plain English**: Imagine a bar chart turned on its side. The horizontal axis is time (start of your operation → now). Each detected device gets a horizontal bar showing when it appeared and when it disappeared.

Example: You run a 2-hour training exercise. Afterward, you look at the timeline and see:

- "Unknown WiFi device appeared at 14:22, disappeared at 14:45, reappeared at 15:10"
- "Jamming signal detected at 14:30, lasted 8 minutes"
- "New cell tower appeared at 15:00 that wasn't there before"

Right now Argos shows you what's happening _right now_ but has no way to show the history of an operation visually. This answers: **"When did things happen?"**

No new packages needed. Built using the same drawing code already used for the spectrum display.

**Operator benefit**: See exactly when each device appeared, how long it stayed, and when it left. Critical for after-action review.

**Effort**: Low-Medium (2-3 days). Zero new dependencies.

---

## Priority Matrix

| Rank  | Feature                    | New Packages               | Effort   | Operator Impact                           |
| ----- | -------------------------- | -------------------------- | -------- | ----------------------------------------- |
| **1** | MIL-STD-2525 symbology     | `milsymbol` (80KB, 0 deps) | 2 days   | **Critical** — standard military symbols  |
| **2** | Tactical color system      | None                       | 1-2 days | **High** — NATO colors + night mode       |
| **3** | Consolidate to MapLibre GL | None                       | 3-4 days | **High** — one fast map engine everywhere |
| **4** | WebGL waterfall            | None                       | 3-4 days | **High** — smooth spectrum under load     |
| **5** | Network topology view      | `sigma` + `graphology`     | 4-5 days | **Medium-High** — visual network map      |
| **6** | Signal timeline            | None                       | 2-3 days | **Medium** — operation history view       |

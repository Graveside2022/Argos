# Tasks: Lunaris Design Parity

**Input**: Design documents from `/specs/019-design-parity/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md
**Design Reference**: `pencil-lunaris.pen` frame `ZQUdr` ("Dashboard — System Overview")
**Codebase Reference**: [`docs/CODEBASE_MAP.md`](file:///home/kali/Documents/Argos/Argos/docs/CODEBASE_MAP.md) — canonical file path index

**Methodology**: **Strictly sequential** visual parity. Each phase targets one UI region. Each task executes one at a time. After each phase, a **REVIEW GATE** halts all work for visual comparison against the Pencil frame. **No phase starts until the previous gate is explicitly approved by the user.** No parallel task execution. No parallel agent dispatch. One task → verify → next task.

**Tests**: Unit tests included for store defaults and component rendering.

## Format: `[ID] [P?] [Story] Description`

- ~~**[P]**: Can run in parallel~~ — **REMOVED**: All tasks execute sequentially. See "Execution Rules" below.
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- **[GATE]**: Review checkpoint — take live screenshot, compare to Pencil frame, prompt user for approval
- Include exact file paths in descriptions

## Design Asset Map

The Pencil mockup `ZQUdr` (1440x900px) breaks into 6 reviewable regions. Below is the **exact spatial specification** extracted from the `.pen` file's computed layout — every position, dimension, orientation, color, font, gap, and padding value.

### Full Dashboard Layout (`ZQUdr`)

```
┌──────────────────────────────────────────────────────────────┐
│ 1440 x 900 px — background: #111111 — clip: true            │
│                                                              │
│ ┌─────────┬──────────────────────────────────────────────────┤
│ │ Icon    │ Right Area (uVrtV) — 1396 x 908 — layout:vertical│
│ │ Rail    │ x:48, y:0                                        │
│ │ (NHlPD) ├──────────────────────────────────────────────────┤
│ │ 48x900  │ Command Bar (nsKH5) — 1396 x 40                 │
│ │ x:0,y:0 │ x:48, y:0                                       │
│ │         ├──────────────────────────────────────────────────┤
│ │         │ Content Area (06PN1) — 1396 x 862                │
│ │         │ x:48, y:40                                       │
│ │         │ ┌──────────┬─────────────────────────────────────┤
│ │         │ │ Overview │ Main Right (ZRutI) — 1116 x 862    │
│ │         │ │ Panel    │ x:328, y:40                         │
│ │         │ │ (SydG2)  │ ┌───────────────────────────────────┤
│ │         │ │ 280x862  │ │ Map Area (gpiRi) — 1116 x 622   │
│ │         │ │ x:48,y:40│ │ x:328, y:40                      │
│ │         │ │          │ ├───────────────────────────────────┤
│ │         │ │          │ │ Bottom Panel (sEDB5) — 1116 x 240│
│ │         │ │          │ │ x:328, y:662                      │
│ └─────────┴─┴──────────┴─┴───────────────────────────────────┘
```

### Region 1: Icon Rail (`NHlPD`) — VERTICAL

| Property         | Value                                          |
|------------------|------------------------------------------------|
| **Position**     | x:0, y:0 (absolute left edge of dashboard)     |
| **Dimensions**   | 48px wide × 900px tall (fill_container height)  |
| **Orientation**  | `layout: vertical` — icons stacked top-to-bottom |
| **Background**   | `#18181b`                                       |
| **Border**       | Right edge: 1px solid `#2e2e2e` (inside)        |
| **Padding**      | 10px top/bottom, 0px left/right                 |
| **Gap**          | 4px between items                               |
| **Alignment**    | `alignItems: center` (icons centered horizontally) |

**Children (top to bottom with computed Y positions):**

| Y   | Node ID | Name              | Icon (Lucide)  | Size   | Fill      | Active? | Notes                          |
|-----|---------|-------------------|----------------|--------|-----------|---------|--------------------------------|
| 10  | 7pSFX   | Overview Hit Zone | `house`        | 18x18  | `#809AD0` | **YES** | Active state: bg `#ffffff14`, cornerRadius 4 |
| 46  | yZGvZ   | Devices Hit Zone  | `list`         | 18x18  | `#808080` | no      | Inactive: no bg fill            |
| 82  | 2kmCM   | Tools Hit Zone    | `zap`          | 18x18  | `#808080` | no      | Inactive                        |
| 118 | 3NTrK   | Rail Spacer       | —              | 1x659  | —         | —       | Flex spacer (fill_container height) |
| 781 | ilPqX   | Logo Hit Zone     | `waypoints`    | 20x20  | `#ffffff` | no      | White icon, larger than others (20px) |
| 817 | HaJ2V   | Layers Hit Zone   | `layers`       | 18x18  | `#808080` | no      | Inactive                        |
| 853 | NWgc0   | Separator         | —              | 24x1   | `#ffffff1a` | — | Horizontal divider line          |
| 858 | wBgxF   | Settings Hit Zone | `settings`     | 18x18  | `#808080` | no      | Inactive                        |

**Hit zone dimensions**: Each = 48px wide (fill_container) × 32px tall, cornerRadius: 4px, centered content.

**Key structural note**: Top group has 3 icons (Overview, Devices, Tools), then a flex spacer pushes bottom group down. Bottom group: Logo, Layers, separator line, Settings. The spacer is 659px tall — it fills all remaining vertical space.

---

### Region 2: Command Bar (`nsKH5`) — HORIZONTAL

| Property         | Value                                          |
|------------------|------------------------------------------------|
| **Position**     | x:48, y:0 (right of Icon Rail, top of Right Area) |
| **Dimensions**   | 1396px wide × 40px tall                         |
| **Orientation**  | `layout: horizontal` (implicit, default flex row) |
| **Background**   | `#1A1A1A`                                       |
| **Border**       | Bottom edge: 1px solid `#2E2E2E` (inside)       |
| **Padding**      | 0px top/bottom, 16px left/right                 |
| **Gap**          | 12px between items                              |
| **Alignment**    | `alignItems: center` (vertically centered)       |

**Children (left to right with computed X positions):**

| X    | Width | Node ID | Name              | Content / Details                                                                 |
|------|-------|---------|-------------------|-----------------------------------------------------------------------------------|
| 16   | 52    | fIlwl   | brandLabel        | "ARGOS" — Fira Code 14px, weight 600, fill `#809AD0`, letter-spacing 2px          |
| 80   | 32    | w5dJw   | Collection Status | Red dot (6px `#FF5C33` ellipse) + "REC" text (Fira Code 10px, `#FF5C33`, ls:1)    |
| 124  | 99    | xeBEB   | nodeLabel         | "NODE VIPER-6" — Fira Code 12px, weight 500, fill `#FFFFFF`, letter-spacing 1px   |
| 235  | 762   | mtavz   | Spacer            | 1px tall flex spacer (fill_container width) — pushes right group to far right      |
| 1009 | 45    | sf9KV   | Network Latency   | Signal icon (Lucide `signal`, 12px, `#8BBFA0`) + "47ms" (Fira Code 12px, `#666666`) — gap:4 |
| 1066 | 48    | vRRMN   | Node Mesh         | Network icon (Lucide `network`, 12px, `#8BBFA0`) + "3/4" (mixed: `#555555`/`#666666`/`#809AD0` bold) — gap:4 |
| 1126 | 102   | Dn6K0   | Weather           | Cloud-sun icon (Lucide `cloud-sun`, 14px, `#BBBBBB`) + "72°F  Clear" (Fira Code 12px, `#BBBBBB`) — gap:8 |
| 1240 | 78    | 6G0yP   | milDate           | "2026-02-20" — Fira Code 12px, normal weight, fill `#666666`, letter-spacing 0.5  |
| 1330 | 50    | ey07u   | milTime           | "20:45Z" — Fira Code 12px, weight 600, fill `#FFFFFF`, letter-spacing 1px         |

**Critical design detail**: Collection Status is "REC" (not "LIVE" as originally specced). The dot is `#FF5C33` (error/recording red) and the text reads "REC" at 10px. This differs from the spec's assumption of "LIVE" — the design shows active *recording* state. Update implementation accordingly.

---

### Region 3: Overview Panel (`SydG2`) — VERTICAL

| Property         | Value                                          |
|------------------|------------------------------------------------|
| **Position**     | x:48, y:40 (below command bar, right of icon rail) |
| **Dimensions**   | 280px wide × 862px tall (fill_container height)  |
| **Orientation**  | `layout: vertical`                               |
| **Background**   | `#1A1A1A`                                        |
| **Border**       | Right edge: 1px solid `#2E2E2E` (inside)         |
| **Clip**         | `true` (overflow hidden)                         |
| **Structure**    | Header (40px) + Content scroll area (fill)        |

**Header**: "SYSTEM OVERVIEW" — `#BBBBBB`, Fira Code 12px, weight 600, letter-spacing 1.5. Height 40px, padding 0 16px, border-bottom 1px `#2E2E2E`.

**Content tiles** (inside scrollable area, padding 8px, gap 4px):
- Each tile: `#151515` background, border-bottom 1px `#2E2E2E`, padding 8px 12px
- Section headers: Fira Code 10px, `#888888`, weight 600, letter-spacing 1.2, uppercase

| Tile           | Node ID | Height | Key Content                                        |
|----------------|---------|--------|----------------------------------------------------|
| CPU            | VixZx   | 72px   | "CPU" header, "47%" hero metric, progress bar, "52°C" temp |
| Disk           | E6dwu   | 72px   | "DISK" header, "127 GB" hero, "/ 500 GB" secondary  |
| Memory         | 4G8YQ   | 72px   | "MEMORY" header, "5.2 GB" hero, "2.8 GB free"       |
| Power          | 0AnD3   | 72px   | "POWER" header, "78%" hero, "3h 42m remaining"      |
| Network Status | p0F7b   | auto   | "NETWORK STATUS" + "Connected" badge, IP rows, speed test btn |
| Hardware       | XCNOt   | auto   | "HARDWARE" header, HackRF + wlan1 status rows        |
| Tools          | AheBY   | auto   | "TOOLS" header, bettercap/gsm-evil/kismet/openwebrx rows |
| Services       | 04ZwT   | auto   | "SERVICES" header, gpsd row                          |
| Logs           | fVAKT   | 118px  | Event count table: Events, Warnings, Errors, Alerts rows |

---

### Region 4: Map Area (`gpiRi`) — ABSOLUTE POSITIONING

| Property         | Value                                          |
|------------------|------------------------------------------------|
| **Position**     | x:328, y:40 (right of overview panel, below command bar) |
| **Dimensions**   | 1116px wide × 622px tall (fill_container both)  |
| **Orientation**  | `layout: none` (absolute/free positioning)       |
| **Background**   | `#111111`                                        |

**Key overlay elements:**

| Element         | Position        | Details                                          |
|-----------------|-----------------|--------------------------------------------------|
| Grid lines (H)  | y:155, 310, 465 | 1px `#1A1A1A`, full width                        |
| Grid lines (V)  | x:278, 556, 834 | 1px `#1A1A1A`, full height                       |
| AP Markers       | scattered       | 6px `#A8B8E0` ellipses (5 total)                |
| Target Marker    | x:720, y:160    | 6px `#FF5C33` ellipse                            |
| Node Marker      | x:540, y:296    | Blue diamond 12px + range ring 40px + "VIPER-6" label |
| Map Legend        | x:12, y:558     | Rounded `#111111cc` overlay, GPS + coords info   |
| Zoom In          | x:1074, y:520   | 28x28 btn, `#1A1A1A` bg, `#2E2E2E` border       |
| Zoom Out         | x:1074, y:550   | 28x28 btn, same style                            |
| Center On Me     | x:1074, y:580   | 28x28 btn, `mouse-pointer-2` icon `#809AD0`     |

---

### Region 5: Bottom Panel (`sEDB5`) — VERTICAL

| Property         | Value                                          |
|------------------|------------------------------------------------|
| **Position**     | x:328, y:662 (below map area)                   |
| **Dimensions**   | 1116px wide × 240px tall                         |
| **Orientation**  | `layout: vertical` — Tab bar on top, terminal body below |
| **Background**   | `#1A1A1A`                                        |
| **Border**       | Top edge: 1px solid `#2E2E2E` (inside)          |
| **Clip**         | `true`                                           |

**Tab Bar (`HODkG`)**: 1116px × 40px, border-bottom 1px `#2E2E2E`, padding 4px 12px, gap 4px

| X   | Width | Node ID | Label      | Font                        | Fill      | Active?                              |
|-----|-------|---------|------------|-----------------------------|-----------|--------------------------------------|
| 12  | 80    | Zm8rf   | Terminal   | Geist 14px, weight 500      | `#809AD0` | **YES** — border-bottom 2px `#809AD0` |
| 96  | 56    | r8N6y   | Chat       | Geist 14px, weight 500      | `#BBBBBB` | no                                   |
| 156 | 56    | RBt5O   | Logs       | Geist 14px, weight 500      | `#BBBBBB` | no                                   |
| 216 | 85    | xcS78   | Captures   | Geist 14px, weight 500      | `#BBBBBB` | no                                   |
| 305 | 77    | hpv1a   | Devices    | Geist 14px, weight 500      | `#BBBBBB` | no                                   |
| 386 | 24    | bzxmV   | + (new tab)| Lucide `plus` 12px          | `#666666` | —                                    |
| 414 | 670   | HE7Yy   | Spacer     | — (flex fill)               | —         | —                                    |
| 1088| 16    | Qpgb7   | Collapse   | Material Symbols Sharp `keyboard_arrow_down` 16px | `#BBBBBB` | — Caret icon, not X |

**Tab padding**: Active tab = `[6, 12, 4, 12]` (top, right, bottom, left). Inactive = `[6, 12]` uniform.

**Terminal Body (`gQ4Ff`)**: 1116px × 200px, `#151515` bg, padding 12px, gap 2px, Fira Code 12px, line-height 1.6.

---

### Region 6: Default State Behavior

Not a visual region — this is the behavioral requirement that **all 5 visual regions above are visible simultaneously** when the dashboard first loads. No icon clicks needed.

---

## Live Code Asset Map

Extracted via CDP (`getBoundingClientRect()` + `getComputedStyle()`) from the running dashboard at `localhost:5173/dashboard` on 2026-02-25. This is the **current state** of the live code that will be modified to match the Pencil design above.

### Full Dashboard Layout (Live)

```
┌──────────────────────────────────────────────────────────────┐
│ 1440 x 900 px — background: #111111 — flex: row              │
│                                                              │
│ ┌─────────┬──────────────────────────────────────────────────┤
│ │ Icon    │ Shell Right — 1392 x 900 — flex: column          │
│ │ Rail    │ x:48, y:0                                        │
│ │ 48x900  ├──────────────────────────────────────────────────┤
│ │ x:0,y:0 │ Command Bar — 1392 x 40                         │
│ │ pad:8,0 │ x:48, y:0                                       │
│ │         ├──────────────────────────────────────────────────┤
│ │         │ Content Area — 1392 x 560 — flex: row            │
│ │         │ x:48, y:40                                       │
│ │         │ ┌──────────┬─────────────────────────────────────┤
│ │         │ │ Panel    │ Map Area — 1112 x **0** ⚠️          │
│ │         │ │ Container│ x:328, y:40                         │
│ │         │ │ 280x1848 │ (collapsed — parent overflow!)      │
│ │         │ │ x:48,y:40│ Canvas: 1112x300 (behind overflow)  │
│ │         │ │ (scrolls)│                                      │
│ │         │ └──────────┴─────────────────────────────────────┤
│ │         │ Bottom Area — **1392** x **300** ⚠️              │
│ │         │ x:48, y:600 (spans full width, not just right!)  │
│ └─────────┴──────────────────────────────────────────────────┘
```

### Live Region 1: Icon Rail

| Property         | Live Value                                     | Design Value                | Delta |
|------------------|-------------------------------------------------|-----------------------------|-------|
| **Position**     | x:0, y:0                                       | x:0, y:0                   | ✅ Match |
| **Dimensions**   | 48px × 900px                                    | 48px × 900px               | ✅ Match |
| **Orientation**  | `flex-direction: column`                        | `layout: vertical`          | ✅ Match |
| **Background**   | `#111111` (rgb 17,17,17)                        | `#18181b`                   | ⚠️ Slightly darker |
| **Padding**      | 8px 0px                                         | 10px 0px                   | ⚠️ 2px less top/bottom |
| **Gap**          | normal (0)                                      | 4px                         | ⚠️ Missing gap |

**Live Rail Buttons (top to bottom):**

| Y    | Title         | Size  | Active? | Design Equivalent        | Delta |
|------|---------------|-------|---------|--------------------------|-------|
| 8    | Overview      | 40x40 | **YES** | Overview (house) y:10    | ⚠️ Hit zone 40x40 vs design 48x32. y:8 vs y:10 |
| 52   | Devices       | 40x40 | no      | Devices (list) y:46      | ⚠️ Same size diff. y:52 vs y:46 |
| 96   | Tools         | 40x40 | no      | Tools (zap) y:82         | ⚠️ y:96 vs y:82 (gap accumulation) |
| 720  | **Terminal**  | 40x40 | **YES** | **Logo (waypoints) y:781** | 🔴 Different icon! Terminal vs Logo |
| 764  | **Agent Chat**| 40x40 | no      | **Layers y:817**         | 🔴 Different icon! Chat vs Layers |
| 808  | Layers        | 40x40 | no      | Separator y:853          | 🔴 Misaligned — live has Layers where design has separator |
| 852  | Settings      | 40x40 | no      | Settings y:858           | ⚠️ Close but shifted due to above |

**Critical differences**: Live bottom group = [Terminal, Agent Chat, Layers, Settings]. Design bottom group = [Logo(waypoints), Layers, Separator, Settings]. The live rail has 2 extra navigation buttons (Terminal, Agent Chat) replacing the Logo icon, and is missing the separator line.

---

### Live Region 2: Command Bar

| Property         | Live Value                                     | Design Value                | Delta |
|------------------|-------------------------------------------------|-----------------------------|-------|
| **Position**     | x:48, y:0                                      | x:48, y:0                  | ✅ Match |
| **Dimensions**   | 1392px × 40px                                   | 1396px × 40px              | ⚠️ 4px narrower |
| **Background**   | `#1A1A1A` (rgb 26,26,26)                        | `#1A1A1A`                  | ✅ Match |
| **Padding**      | 0px 16px                                        | 0px 16px                   | ✅ Match |
| **Gap**          | 12px                                            | 12px                       | ✅ Match |

**Live Command Bar Children (left to right):**

| X    | Width | Class/Element    | Text Content                                   | Design Equivalent              | Delta |
|------|-------|------------------|-------------------------------------------------|--------------------------------|-------|
| 64   | 716   | `.left-group`    | "ARGOS  Wiesbaden, DE   WiFi Adapter   Software Defined Radio" | Brand + REC + Node label (183px total) | 🔴 Full text labels consume ~716px vs design 235px |
| 792  | 138   | `.bar-spacer`    | (empty)                                         | Spacer                         | ⚠️ Much smaller — left group pushed it |
| 942  | 482   | `.right-group`   | GPS coords, 1/1, 11°C, date, time              | Latency + Mesh + Weather + Date + Time | ⚠️ Missing latency indicator |

**Live Hardware Indicators (within left-group):**

| X    | Width | Element          | Text               | Design Equivalent  | Delta |
|------|-------|------------------|---------------------|--------------------|-------|
| 283  | 118   | WiFi Adapter     | "WiFi Adapter"      | Compact dot only   | 🔴 Full text label (118px vs ~8px dot) |
| 413  | 196   | SDR              | "Software Defined Radio" | Compact dot only | 🔴 Full text label (196px vs ~8px dot) |
| 621  | 100   | GPS              | "GPS 13 SAT"        | Compact dot only   | 🔴 Full text + sat count (100px vs ~8px dot) |

**Missing from live**: REC badge, Network Latency indicator, proper callsign (shows "Wiesbaden, DE" instead of "NODE VIPER-6")

---

### Live Region 3: Overview Panel

| Property         | Live Value                                     | Design Value                | Delta |
|------------------|-------------------------------------------------|-----------------------------|-------|
| **Position**     | x:48, y:40                                     | x:48, y:40                 | ✅ Match |
| **Width**        | 280px                                           | 280px                      | ✅ Match |
| **Height**       | 1848px (scrollable content)                     | 862px (fill_container)     | ⚠️ Content overflows — scrolls within 560px viewport |
| **Background**   | `#151515` (rgb 21,21,21)                        | `#1A1A1A`                  | ⚠️ Slightly darker |
| **Visible Height** | 560px (content-area height)                   | 862px                      | 🔴 302px shorter — bottom panel steals space |

---

### Live Region 4: Map Area

| Property         | Live Value                                     | Design Value                | Delta |
|------------------|-------------------------------------------------|-----------------------------|-------|
| **Position**     | x:328, y:40                                    | x:328, y:40                | ✅ Match |
| **Width**        | 1112px                                          | 1116px                     | ⚠️ 4px narrower |
| **Height**       | **0px** ⚠️                                      | 622px                      | 🔴 COLLAPSED — Map area is not visible |
| **Canvas size**  | 1112px × 300px (rendered but hidden)            | N/A                        | Canvas exists but parent clip hides it |

**Root cause**: The live app has a major layout bug where the Map Area collapses to zero height, likely due to flex-box constraints between the Overview Panel and the full-width Bottom Panel forcing the map out of the viewport.

---

### Live Region 5: Bottom Panel

| Property         | Live Value                                     | Design Value                | Delta |
|------------------|-------------------------------------------------|-----------------------------|-------|
| **Position**     | x:48, y:600                                    | x:328, y:662               | 🔴 Starts at x:48 (full width) vs x:328 (right of overview) |
| **Width**        | **1392px**                                      | 1116px                     | 🔴 276px too wide — spans below overview panel |
| **Height**       | **300px**                                       | 240px                      | ⚠️ 60px taller than design |
| **Tab bar height** | ~32px (tabs at y:607, h:31)                   | 40px                       | ⚠️ 8px shorter |

**Live Bottom Tabs (left to right):**

| X    | Width | Text      | Active? | Design Equivalent  | Delta |
|------|-------|-----------|---------|--------------------|-------|
| 56   | 99    | Terminal  | no      | Terminal           | ⚠️ Terminal is active in design |
| 155  | 75    | Chat      | no      | Chat               | ✅ Match |
| 230  | 75    | Logs      | **YES** | Logs               | 🔴 Logs is active in live, Terminal in design |
| 305  | 104   | Captures  | no      | Captures           | ✅ Match |
| 409  | 95    | Devices   | no      | Devices            | ✅ Match |
| 1408 | 24    | X (close) | —       | ▼ (chevron-down)   | 🔴 X icon vs chevron-down caret |

**Additional live elements not in design**: Terminal has an internal toolbar, but we currently see the System Event Logs view because the Logs tab is active. The live implementation has the Log content directly in the bottom panel instead of Terminal holding it.

---

### Summary: Design vs Live Discrepancy Matrix

| Region          | Position | Dimensions | Background | Children/Content | Severity |
|-----------------|----------|------------|------------|------------------|----------|
| Icon Rail       | ✅       | ✅         | ⚠️ Minor   | 🔴 Different bottom group icons | Medium |
| Command Bar     | ✅       | ✅         | ✅         | 🔴 Text labels, missing REC/latency | **High** |
| Overview Panel  | ✅       | ⚠️ Height  | ⚠️ Minor   | Needs visual comparison | Low |
| Map Area        | ✅       | 🔴 Height 0 | ✅        | 🔴 Invisible/collapsed | **High** |
| Bottom Panel    | 🔴 X pos | 🔴 Too wide | ✅        | 🔴 X instead of caret | **High** |
| Default State   | N/A      | N/A        | N/A        | ⚠️ Panels open but layout broken | **High** |

---

## Phase 1: Setup & Cache Fix

**Purpose**: Clean environment, prevent the stale-cache issue discovered during audit

- [x] T001 Clear Vite compilation cache by removing `node_modules/.vite/` directory to prevent stale component output
- [x] T002 Touch `src/lib/components/dashboard/TopStatusBar.svelte` to force HMR recompile and verify compiled output is > 20KB (not the 970-byte empty shell found during audit)
- [x] T003 Write unit test for store defaults in `tests/unit/components/dashboard-store-defaults.test.ts` — verify `activePanel` initial value is `'overview'` and `activeBottomTab` initial value is `'terminal'` (tests should FAIL before implementation)

---

## Phase 2: Region 1 — Icon Rail (Pencil frame `NHlPD`)

**Goal**: Verify the 48px vertical icon rail matches the Pencil mockup — icon order, spacing, active states, separator placement.

**Pencil spec**: 48px wide, `#18181b` background, border-right `#2e2e2e`, 7 items: Overview (house), Devices (list), Tools (zap), [spacer], Logo (waypoints), Layers (layers), [separator line], Settings (settings). Padding 10px vertical, 4px gap between items.

- [x] T004 [US1] Compare live Icon Rail (`src/lib/components/dashboard/IconRail.svelte`) against Pencil frame `NHlPD` — document any differences in icon order, icon types, or missing elements
- [x] T005 [US1] Verify Icon Rail icon order matches design: Top group = Overview (house), Devices (list), Tools (zap). Bottom group = Logo (waypoints) is missing from live — the live has Terminal (prompt), Chat (message), Layers, Settings. Note: the design has a Logo icon between spacer and bottom group that the live app doesn't have. Document in gate review whether this Logo icon should be added or if the live rail's Terminal/Chat icons are the intentional replacement.

### Implementation

- [x] T005a [US5] Remove Terminal and Chat buttons from `src/lib/components/dashboard/IconRail.svelte` — these functions move to the Bottom Panel fixed tab bar. Add Logo (`waypoints`) icon between the flex spacer and Layers icon. Add a horizontal separator line (24×1px, `var(--separator)` = `#ffffff1a`) between Layers and Settings.
- [x] T005b [US5] Resize Icon Rail hit zones in `src/lib/components/dashboard/IconRail.svelte` + `src/lib/components/dashboard/icon-rail.css` — change from 40×40px to 48×32px (48px wide = fill container, 32px tall). Set `border-radius: 4px` on all hit zones.
- [x] T005c [US5] Fix Icon Rail active state in `src/lib/components/dashboard/IconRail.svelte` + `icon-rail.css` — replace the `::before` left-bar pseudo-element with a background fill `var(--hover-tint)` (`#ffffff14`). Active icon color: `var(--primary)` (`#A8B8E0` for Blue palette — see Accent Color Decision in Notes). Inactive icon color: `#808080`.
- [x] T005d [US5] Replace inline SVG icon strings in `src/lib/components/dashboard/IconRail.svelte` with `@lucide/svelte` component imports (already installed, v0.561.0) at 18×18px. Import: `import { House, List, Zap, Waypoints, Layers, Settings } from '@lucide/svelte'`. Icons: `House` (Overview), `List` (Devices), `Zap` (Tools), `Waypoints` (Logo, 20×20px, white), `Layers` (Layers), `Settings` (Settings). No new dependency needed.
- [x] T005e [US5] Update Icon Rail layout in `icon-rail.css` — set background to `var(--sidebar)` (`#18181b`), border-right to `1px solid var(--border)`, padding to `10px 0`, gap to `4px`, `align-items: center`.

### 🚦 GATE 1: Icon Rail Review

> **Action**: Take screenshot of live Icon Rail. Compare to Pencil frame `NHlPD`.
> **Compare**: Icon order, icon styling, active state indicator, separator, background color, width.
> **Pencil reference**: `mcp__pencil__get_screenshot(nodeId="NHlPD")`
> **Prompt user**: "Does the Icon Rail match the design? Should we add the Logo (waypoints) icon, or keep Terminal/Chat in the rail? Approve or request changes."

---

## Phase 3: Region 2 — Command Bar (Pencil frame `nsKH5`)

**Goal**: Make the top command bar match the Pencil design — compact hardware dots, REC badge, tactical callsign, latency/mesh/weather/date/time segments.

**Pencil spec**: 40px height, `#1A1A1A` background, border-bottom `#2E2E2E`. Left group: "ARGOS" brand (`var(--primary)` = `#A8B8E0`, Fira Code 14px, letter-spacing 2), red collection dot, red "REC" text (`#FF5C33`), "ARGOS-1" callsign (white, Fira Code 12px). Right group: GPS coords, latency, mesh "3/4", weather icon + temp, date, Zulu time. (Note: Pencil uses `#809AD0` for brand — we use `var(--primary)` for palette switching. See Accent Color Decision in Notes.)

### Implementation

- [x] T006 [US2] Remove text label `<span class="status-label">WiFi Adapter</span>` from `src/lib/components/dashboard/status/WifiDropdown.svelte` — keep only the status dot (this will recover ~110px of the 716px width problem). Add `title="WiFi Adapter"` to the `.device-btn` div for hover tooltip accessibility.
- [x] T007 [US2] Remove text label `<span class="status-label">Software Defined Radio</span>` from `src/lib/components/dashboard/status/SdrDropdown.svelte` — keep only the status dot (recovers ~188px). Add `title="Software Defined Radio"` tooltip.
- [x] T008 [US2] Remove text label from `src/lib/components/dashboard/status/GpsDropdown.svelte` — currently shows "GPS {sats} SAT". Change to dot-only with `title="GPS {sats} SAT"` tooltip. Keep the sat count visible as a small superscript badge next to the dot (recovers ~92px).
- [x] T009 [US2] Add "REC" badge to `src/lib/components/dashboard/TopStatusBar.svelte` — after the `.collection-dot` element, add `{#if isCollecting}<span class="rec-badge">REC</span>{/if}` where `isCollecting` is derived from `wifiState === 'active' || sdrState === 'active' || gpsState === 'active'`.
- [x] T010 [US2] Change callsign display in `src/lib/components/dashboard/TopStatusBar.svelte` — replace `{locationName || 'ARGOS-1'}` with `{'ARGOS-1'}` in the `.callsign` span. Remove the `locationName` state variable, `lastGeocodeLat/Lon` variables, and the `reverseGeocode()` call from the GPS effect. (Default "ARGOS-1"; configurable via Settings in future spec.)
- [x] T011 [US2] Add network latency indicator to `src/lib/components/dashboard/TopStatusBar.svelte` — add `let latencyMs = $state<number | null>(null)` and measure RTT of the existing `fetchHardwareStatus()` call by wrapping it with `Date.now()` before/after. Display `{latencyMs ?? '--'}ms` in the right group between coordinates and mesh count.
- [x] T012 [US2] Add CSS styles to `src/lib/components/dashboard/command-bar.css` — add `.rec-badge` class (color: `var(--destructive)` which resolves to `#FF5C33`, font-family: `var(--font-mono)`, font-size: 10px, font-weight: 600, letter-spacing: 1px, text-transform: uppercase). Add `.segment-latency` class matching `.segment` base with `font-variant-numeric: tabular-nums`.
- [x] T013 [US2] Write unit test in `tests/unit/components/command-bar-compact.test.ts` — mount `WifiDropdown` with `deviceState='active'`, verify no `.status-label` element exists, verify `.status-dot.dot-active` is rendered. Test `SdrDropdown` similarly.

### 🚦 GATE 2: Command Bar Review

> **Action**: Take screenshot of live Command Bar (top 40px). Compare to Pencil frame `nsKH5`.
> **Compare**: Brand text, collection dot + REC badge, callsign, hardware dot indicators (compact, no text), spacer, right group (coords, latency, mesh, weather, date, time).
> **Pencil reference**: `mcp__pencil__get_screenshot(nodeId="nsKH5")`
> **Prompt user**: "Does the Command Bar match the design? Check: compact dots (no text labels), REC badge (red #FF5C33), callsign shows 'ARGOS-1', latency indicator present, date/time format. Approve or request changes."

---

## Phase 4: Region 3 — Overview Panel (Pencil frame `SydG2`)

**Goal**: Make the Overview Panel default to open and verify its content tiles match the design.

**Pencil spec**: 280px width, `#1A1A1A` background, border-right `#2E2E2E`. Header: "SYSTEM OVERVIEW" (#BBBBBB, Fira Code 12px, letter-spacing 1.5). Content: 8px padding, 4px gap between tiles. Tiles: CPU (47%, progress bar, temp), Disk (127 GB, bar), Memory (5.2 GB, bar), Power (78%, remaining), Network Status (IP, VM, TAK, speed test), Hardware (HackRF, wlan1), Tools (bettercap, gsm-evil, kismet, openwebrx), Services (gpsd), Logs (event count table).

### Implementation

- [x] T014 [US1] Change `activePanel` default in `src/lib/stores/dashboard/dashboard-store.ts` line 7 — change `writable<string | null>(null)` to `writable<string | null>('overview')` so the Overview panel opens on load.
- [x] T015 [US1] Verify Overview Panel content in `src/lib/components/dashboard/panels/OverviewPanel.svelte` matches Pencil frame `SydG2` — compare tile order (CPU, Disk, Memory, Power, Network, Hardware, Tools, Services, Logs), section headers (uppercase, Fira Code 10px, #888888, letter-spacing 1.2), and data layout. Document discrepancies found during visual comparison. **Result**: Tile order matches design (CPU→Disk→Memory→Power→Network→Hardware→Services). Extra sections (GPS, WiFi Interfaces, Widgets) are bonus content not in Pencil but not harmful. Section headers correctly use Fira Code 9px/600/1.2px/uppercase/#888888. No blocking changes needed.
- [x] T016 [US1] Compare `src/lib/components/dashboard/panels/overview/SystemInfoCard.svelte` tile structure against Pencil CPU/Disk/Memory/Power tiles — verify progress bar colors match design tokens (CPU red when >90%, memory amber when >70%, disk blue default), metric font sizes (hero 24px value, 12px secondary), and tile background (`#151515` with border-bottom `#2E2E2E`). **Result**: Hero metric 24px/600, section headers 9px/600/uppercase, meter bars 4px with color thresholds (>80 error, >50 warning, default primary), section detail 10px, border-bottom var(--border). All match Pencil spec.

### 🚦 GATE 3: Overview Panel Review

> **Action**: Take screenshot of live Overview Panel (280px left sidebar). Compare to Pencil frame `SydG2`.
> **Compare**: Panel header, tile order, tile content (CPU/Disk/Memory/Power), Network Status section, Hardware/Tools/Services sections, Logs section, progress bar colors, typography.
> **Pencil reference**: `mcp__pencil__get_screenshot(nodeId="SydG2")`
> **Prompt user**: "Does the Overview Panel match the design? Check: panel opens by default, all 9 sections visible, tile structure matches, progress bar colors correct. Approve or request changes."

---

## Phase 5: Region 4 — Map Area (Pencil frame `gpiRi`)

**Goal**: Verify the map area matches the design — dark background, grid lines, marker styles, zoom controls, GPS legend.

**Pencil spec**: `#111111` background, subtle grid lines at 1/4 intervals (#1A1A1A), AP markers as 6px steel blue (#A8B8E0) dots, one red target marker (#FF5C33), node marker group (blue diamond + range ring + label), GPS legend overlay bottom-left, custom zoom controls bottom-right.

- [x] T017 [US1] Fix `height: 0` map collapse bug in `src/lib/components/dashboard/DashboardMap.svelte` or its parent layout containers. Compare live map rendering against Pencil frame `gpiRi` — document differences in: map background color, presence of grid overlay, marker styles, zoom control styling, GPS legend overlay. Note: the live app uses MapLibre GL with real tile data, while the design shows a stylized dark canvas. Map tiles are expected to differ — focus on overlay elements (markers, controls, legend). **Fix**: Added `display: flex; flex-direction: column; min-height: 0` to `.main-content` in DashboardShell.svelte. Root cause: missing `min-height: 0` prevented flex from distributing space to the map area.
- [x] T018 [US1] Verify MapLibre dark theme background is close to `#111111` — check the map style configuration in `src/lib/components/dashboard/DashboardMap.svelte` or its map setup module. Verify AP dot markers use `--primary` (#A8B8E0) color. **Verified**: `MAP_UI_COLORS.background.fallback` = `#111111`, `MAP_UI_COLORS.primary.fallback` = `#a8b8e0`. Map uses `alidade_smooth_dark.json` dark tile style. No changes needed.

### 🚦 GATE 4: Map Area Review

> **Action**: Take screenshot of the map area (center region between overview panel and bottom panel). Compare to Pencil frame `gpiRi`.
> **Compare**: Background darkness, AP marker colors, node marker style, zoom controls, GPS legend overlay.
> **Pencil reference**: `mcp__pencil__get_screenshot(nodeId="gpiRi")`
> **Prompt user**: "Does the Map Area match the design intent? Note: real map tiles will differ from the flat mockup. Focus on overlay elements — marker colors, zoom controls, legend. Approve or note items for future work."

---

## Phase 6: Region 5 — Bottom Panel (Pencil frame `sEDB5`)

**Goal**: Make the bottom panel default to open with Terminal tab, and match the design's tab bar styling and collapse caret.

**Pencil spec**: 240px height, `#1A1A1A` background, border-top `#2E2E2E`. Tab bar: 40px height, tabs = Terminal (active, steel blue underline), Chat, Logs, Captures, Devices, "+" new tab button, spacer, Material Symbols `keyboard_arrow_down` collapse caret. Terminal body: `#151515`, Fira Code 12px, line-height 1.6.

### Implementation

- [x] T019 [US1] Change `activeBottomTab` default in `src/lib/stores/dashboard/dashboard-store.ts` line 14 — change `persistedWritable<BottomTab>('activeBottomTab', null, ...)` to `persistedWritable<BottomTab>('activeBottomTab', 'terminal', ...)` so the Terminal tab opens on load.
- [x] T020 [US3] Replace X close icon with chevron-down caret in `src/routes/dashboard/BottomPanelTabs.svelte` lines 66-76 — replace the two `<line>` SVG elements with `<polyline points="6 9 12 15 18 9" />`. Change `title` from "Close panel" to "Collapse panel".
- [x] T021 [US1] Verify bottom panel tab bar matches design — compare tab order (Terminal, Chat, Logs, Captures, Devices), active tab indicator (steel blue bottom border), tab font (Geist, 14px), icon sizing (14px), and overall tab bar height (32-40px range). Updated height from 32px to 40px, gap to 4px, padding to 4px 12px.
- [x] T021a [US6] Remove drag-to-resize handle from `src/lib/components/dashboard/ResizableBottomPanel.svelte` — delete the resize handle element and all resize event handlers. Fix the panel height to 240px (`height: 240px; min-height: 240px; max-height: 240px`). Remove any CSS for `.resize-handle` or `.drag-handle`.
- [x] T021b [US6] Replace dynamic terminal session tabs with fixed named tabs in `src/routes/dashboard/BottomPanelTabs.svelte` and/or `src/lib/components/dashboard/TerminalTabBar.svelte` — the tab bar MUST show exactly: Terminal, Chat, Logs, Captures, Devices, "+" (new tab), [spacer], collapse caret. Active tab indicator: 2px bottom border in `var(--primary)` (`#A8B8E0` for Blue palette). Tab font: Geist 14px weight 500. Active color: `var(--primary)`. Inactive color: `var(--foreground-muted)` (`#BBBBBB`).
- [x] T021c [US6] Set bottom panel tab bar height to 40px in CSS. Tab padding: active = `6px 12px 4px 12px`, inactive = `6px 12px`. Gap between tabs: 4px. Tab bar padding: `4px 12px`.
- [x] T021d [US6] Fix bottom panel width — currently spans full width (1392px from x:48). Per Pencil design it should span from x:328 (right of Overview Panel) to x:1444, making it 1116px wide. Verify the flex layout in `src/lib/components/dashboard/DashboardShell.svelte` places the bottom panel inside the main-right area, not as a full-width child. Fixed: moved bottomPanel snippet inside new `.main-right` flex column column (alongside map content).

### 🚦 GATE 5: Bottom Panel Review

> **Action**: Take screenshot of the bottom panel (tab bar + terminal area). Compare to Pencil frame `sEDB5`.
> **Compare**: Tab order, active tab indicator color/style, collapse icon (caret vs X), terminal body background, tab bar height.
> **Pencil reference**: `mcp__pencil__get_screenshot(nodeId="sEDB5")`
> **Prompt user**: "Does the Bottom Panel match the design? Check: panel opens by default, Terminal tab active, chevron-down caret, tab styling. Approve or request changes."

---

## Phase 6b: CSS Variable Namespace Elimination (FR-009, FR-009a–c, FR-015–FR-019)

**Goal**: Eliminate the entire `--palantir-*` CSS variable namespace. Replace every `var(--palantir-*)` reference with the direct Lunaris token. Safely migrate non-palantir tokens. Delete the bridge file. Zero `--palantir-*` references should remain anywhere in the codebase.

> **CORRECTED SCOPE**: 231 `var(--palantir-*)` refs across 32 consumer files + 61 bridge-internal refs = **292 `var(--palantir-*)` total across 33 files**. Total "palantir" mentions (including class names, imports, comments): **295 across 36 files**. Additionally, 274 non-palantir token refs (`--space-*`, `--text-*`, `--font-weight-*`, `--letter-spacing-*`, `--radius-*`) across 40+ files would break if the `:root` block is deleted without pre-migration.

**Migration mapping**: See plan.md Phase 7 for the complete `--palantir-*` → Lunaris token mapping table.

### Pre-Migration: Non-Palantir Token Safety (Commit 7a — MUST complete first)

- [ ] T021-pre-a [US4] **BLOCKING** — Copy non-palantir token definitions from `src/lib/styles/palantir-design-system.css` lines 66-99 (`--space-*`, `--text-*`, `--font-weight-*`, `--letter-spacing-*`) into `src/app.css` `:root` block. These tokens are used by 244 references across 40+ files and would break if lost.
- [ ] T021-pre-b [US4] **BLOCKING** — Fix `--radius-*` conflict: copy the fixed-value definitions from `palantir-design-system.css` lines 101-105 (`--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-xl: 12px`) into `src/app.css` `:root` block, REPLACING the conflicting `calc()` definitions at lines 223-226 in `@theme inline`. Components were built against the fixed values.
- [ ] T021-pre-c [US4] Add `--accent-muted: color-mix(in srgb, var(--primary) 15%, transparent)` to `src/app.css` `:root` block. This is needed because `--palantir-accent-muted` uses a `color-mix()` expression that cannot be a simple variable swap.
- [ ] T021-pre-d [US4] Run `npm run build` to verify no visual regressions from the token migration. The pre-migration should be purely additive (duplicate definitions temporarily exist in both files).

### Palantir Variable Migration (Commit 7b)

- [ ] T021e [US4] Migrate all `var(--palantir-*)` references in `src/lib/components/dashboard/` `.svelte` files to direct Lunaris tokens per the mapping table in plan.md Phase 7. Files: TerminalPanel.svelte, IconRail.svelte, TerminalTabBar.svelte, ResizableBottomPanel.svelte, LogsPanel.svelte, DashboardMap.svelte, TerminalToolbar.svelte, and all files under `panels/`, `status/`, `shared/`, `views/`, `map/` subdirectories. (~170 replacements across 27 `.svelte` files.) **Note**: `--palantir-accent-muted` → `var(--accent-muted)` (new token, not `color-mix()` inline).
- [ ] T021e-tak [US4] Migrate all 12 `var(--palantir-*)` references in `src/lib/components/status/TAKIndicator.svelte` to direct Lunaris tokens. This file is OUTSIDE the `dashboard/` directory and was missing from the original scope.
- [ ] T021f [US4] Migrate all `var(--palantir-*)` references in `src/lib/components/dashboard/` `.css` files to direct Lunaris tokens. Files: `icon-rail.css`, `command-bar.css`, `status/dropdown.css`, `panels/devices/device-table-cells.css`, `map/map-overrides.css`. (~36 replacements across 5 `.css` files.)
- [ ] T021f-route [US4] Migrate 1 `var(--palantir-*)` reference in `src/routes/dashboard/dashboard-page.css` to direct Lunaris token.
- [ ] T021g [US4] Migrate all `var(--palantir-*)` references in `src/lib/styles/dashboard.css` to direct Lunaris tokens. (12 replacements.)
- [ ] T021g-popup [US4] Rename `class="palantir-popup"` to `class="map-popup"` in `src/lib/components/dashboard/DashboardMap.svelte` line 257 (FR-019).
- [ ] T021g-import [US4] Remove duplicate import `import '$lib/styles/palantir-design-system.css'` from `src/routes/dashboard/+page.svelte` line 3. This import is redundant because `app.css` already imports the file globally.

### Bridge File Deletion (Commit 7c — the revertable deletion)

- [ ] T021h [US4] Migrate utility classes in `src/lib/styles/palantir-design-system.css` (`.map-popup`, `.status-dot-*`, `.bg-surface`, `.text-tertiary`, `.tactical-sidebar`, etc.) from `var(--palantir-*)` to direct Lunaris tokens. Delete the `:root` variable definition block (lines 12-106) — **safe because non-palantir tokens were migrated to `app.css` in T021-pre-a/b/c**. Rename file to `src/lib/styles/dashboard-utilities.css`.
- [ ] T021i [US4] Update `src/app.css` line 3: change `@import './lib/styles/palantir-design-system.css'` to `@import './lib/styles/dashboard-utilities.css'`.
- [ ] T021j-comment [US4] Clean comment reference in `src/lib/map/layers/symbol-layer.ts` line 44 — replace `--palantir-text-primary` with `--foreground` in the comment text. This file was not in the original scope but would cause the T021j verification grep to fail.
- [ ] T021j [US4] Verify zero `palantir` references remain: `grep -r 'palantir' src/ --include='*.svelte' --include='*.css' --include='*.ts' -l` must return empty output. This catches `var(--palantir-*)`, class names like `palantir-popup`, import paths, and comments. Must run AFTER T021i (import path change) and T021j-comment (comment cleanup).
- [ ] T021k [US4] Verify `--font-sans` resolves to `Geist` and `--font-mono` resolves to `Fira Code` in `src/lib/styles/dashboard.css` (already correct — confirm no changes needed).

### 🚦 GATE 5b: CSS Token Review

> **Action**: Run `grep -r 'palantir' src/ --include='*.svelte' --include='*.css' --include='*.ts' -c` and verify zero results.
> **Compare**: Inspect 3 representative components in browser DevTools — verify computed colors match Lunaris tokens (background `#111111`/`#1A1A1A`, border `#2E2E2E`, text `#FFFFFF`/`#BBBBBB`).
> **Prompt user**: "All --palantir-* references eliminated. Do computed colors match expected Lunaris values? Approve or request changes."

---

## Phase 7: Region 6 — Default State & Full Layout

**Goal**: Verify the complete dashboard loads with all regions visible — no user interaction required.

- [ ] T022 [US1] Clear browser localStorage and reload `/dashboard` — verify all 4 zones visible: Command Bar (top), Overview Panel (left), Map (center), Bottom Panel (bottom/terminal). Take full-page screenshot for comparison against Pencil frame `ZQUdr`.
- [ ] T023 [US1] Run unit tests: `npx vitest run tests/unit/components/dashboard-store-defaults.test.ts` — verify tests pass (activePanel = 'overview', activeBottomTab = 'terminal').
- [ ] T024 [US2] Run unit tests: `npx vitest run tests/unit/components/command-bar-compact.test.ts` — verify compact indicator tests pass.

### 🚦 GATE 6: Full Dashboard Review (FINAL)

> **Action**: Take full-page screenshot of live dashboard at 1440x900. Compare side-by-side with Pencil frame `ZQUdr`.
> **Compare**: All 6 regions simultaneously — Icon Rail, Command Bar, Overview Panel, Map Area, Bottom Panel, and the overall composition/proportions.
> **Pencil reference**: `mcp__pencil__get_screenshot(nodeId="ZQUdr")`
> **Prompt user**: "Does the complete dashboard match the Lunaris design? Final approval before merge. Note any remaining discrepancies for future work."

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T025 Run full typecheck: `npm run typecheck` — verify no type errors introduced
- [ ] T026 Run linter: `npm run lint` — verify no lint violations
- [ ] T027 Run build: `npm run build` — verify production build succeeds
- [ ] T028 Update spec task status — mark all completed tasks in this file
- [ ] T029 Run quickstart.md validation — follow the verification steps in `specs/019-design-parity/quickstart.md`
- [ ] T030 Update `docs/CODEBASE_MAP.md` to reflect all file changes: `palantir-design-system.css` renamed to `dashboard-utilities.css`, import path change in `app.css`, any new/removed components from Icon Rail or Bottom Panel restructuring. Verify all paths referenced in CODEBASE_MAP still exist.

---

## Dependencies & Execution Order

### Execution Rules (NON-NEGOTIABLE)

> **STRICT SEQUENTIAL EXECUTION**: Every phase runs one at a time. Every task within a phase runs one at a time. No parallel work. No "starting the next phase while waiting for review." No agent parallelism.
>
> **HARD STOP AT GATES**: When a gate is reached, ALL work stops. The implementer presents the gate deliverables and waits for explicit user approval before touching any file in the next phase. "Approved" is the only word that unlocks the next phase.
>
> **ONE TASK, ONE VERIFY**: After each task, verify the change works (build still passes, no visual regression in the targeted region). Do not batch multiple tasks and verify at the end.

### Execution Sequence (strictly ordered)

```
Phase 1: T001 → T002 → T003
  ↓
GATE 1 (Icon Rail):
  T004 → T005 → T005a → T005b → T005c → T005d → T005e
  → 🚦 STOP — screenshot + compare + user approval
  ↓
GATE 2 (Command Bar):
  T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013
  → 🚦 STOP — screenshot + compare + user approval
  ↓
GATE 3 (Overview Panel):
  T014 → T015 → T016
  → 🚦 STOP — screenshot + compare + user approval
  ↓
GATE 4 (Map Area):
  T017 → T018
  → 🚦 STOP — screenshot + compare + user approval
  ↓
GATE 5 (Bottom Panel):
  T019 → T020 → T021 → T021a → T021b → T021c → T021d
  → 🚦 STOP — screenshot + compare + user approval
  ↓
GATE 5b (CSS Elimination):
  T021-pre-a → T021-pre-b → T021-pre-c → T021-pre-d
  → T021e → T021e-tak → T021f → T021f-route → T021g → T021g-popup → T021g-import
  → T021h → T021i → T021j-comment → T021j → T021k
  → 🚦 STOP — grep verification + computed color inspection + user approval
  ↓
GATE 6 (Full Dashboard — FINAL):
  T022 → T023 → T024
  → 🚦 STOP — full-page screenshot + side-by-side compare + user approval
  ↓
Phase 8 (Polish):
  T025 → T026 → T027 → T028 → T029 → T030
```

### Why No Parallelism

Even though some tasks touch different files, parallel execution:
1. **Masks regressions** — if T006 breaks the command bar layout, T007 and T008 pile on before you notice
2. **Prevents clean rollback** — reverting one task's commit is easy; untangling three interleaved changes is not
3. **Defeats the gate purpose** — gates exist to catch problems early, not to rubber-stamp batched work

The time cost of sequential execution (~15 min longer than parallel) is trivial compared to the cost of debugging a regression buried under 5 simultaneous changes.

### Gate Deliverables (same for every gate)

Each gate MUST produce these before requesting approval:
1. A live screenshot of the targeted region (via CDP on port 9224)
2. A Pencil frame screenshot of the same region (via `mcp__pencil__get_screenshot`)
3. A concise diff summary: what matches, what doesn't, what was deferred
4. A prompt to the user: **"Approve / Request changes / Defer to future work"**

**No work beyond the gate until the user says "Approved."**

---

## Notes

- Total tasks: **52** (T001–T030 + T005a-T005e + T021-pre-a/b/c/d + T021a-T021k + T021e-tak + T021f-route + T021g-popup + T021g-import)
- Tasks by user story: US1 = 10, US2 = 8, US3 = 1, US4 = 15 (CSS — expanded with pre-migration + new scope files), US5 = 5 (Icon Rail), US6 = 4 (Bottom Panel), Shared = 9
- Review gates: **8** (one per UI region + CSS elimination + full dashboard final)
- No new npm dependencies required
- No new files created except 2 test files; 1 file deleted + renamed (`palantir-design-system.css` → `dashboard-utilities.css`)
- **~39 files modified total** (33 palantir migration + 6 feature changes) — corrected from original 35 estimate
- **292 `--palantir-*` refs across 33 files** (231 consumer + 61 bridge) — corrected from original 206/29 estimate
- **274 non-palantir token refs across 40+ files** — must be migrated to `app.css` BEFORE `:root` deletion
- Phase 7 uses **3 atomic commits** (7a: token pre-migration, 7b: palantir find-replace, 7c: `:root` deletion + rename) for rollback safety
- CODEBASE_MAP.md must be updated in Phase 8 to reflect renamed/deleted files
- Pencil design node IDs for screenshot comparison: `NHlPD` (rail), `nsKH5` (command bar), `SydG2` (overview), `gpiRi` (map), `sEDB5` (bottom panel), `ZQUdr` (full dashboard)

### Accent Color Decision

The Pencil design uses `#809AD0` for brand mark and active indicators. However, in the codebase `#809AD0` maps to `--signal-weak` / `--feature-drone`, NOT `--primary` (`#A8B8E0`). **Decision: Use `var(--primary)` (`#A8B8E0` for Blue palette)** so the accent responds to palette switching. The Pencil design value was likely picked from a different palette context or is a secondary blue — the token-based approach is authoritative.

### Deferred Items

These items were identified during review but are explicitly OUT OF SCOPE:
- Widget extraction from Overview Panel (Phase 10 — widgets remain in sidebar)
- Terminal Unavailable overlay (Pencil frame `hKXlP`)
- Agent Chat panel content (Pencil frame `j0YYx`)
- Device Manager table content (Pencil frame `LFDvo`)
- Custom map zoom controls (28x28px buttons)
- Map grid overlay (4×4 subtle lines)
- Bottom panel "Network Map" tab variant (tab set is fixed: Terminal, Chat, Logs, Captures, Devices)
- GPS legend overlay styling verification
- Node Mesh tri-color value rendering ("3/4" with three different colors)

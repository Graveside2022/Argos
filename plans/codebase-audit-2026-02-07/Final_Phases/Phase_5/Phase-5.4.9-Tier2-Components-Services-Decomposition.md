# Phase 5.4.9 -- Tier 2: Components and Services Decomposition (Items 5.4.2-07 through 5.4.2-15)

```
Document ID:    ARGOS-AUDIT-P5.4.9-TIER2-COMPONENTS-SERVICES
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.9 -- Decompose 8 Tier 2 component/service files (500-999 lines)
Risk Level:     LOW-MEDIUM
Prerequisites:  Phase 5.4.8 (Tier 2 server cluster) COMPLETE
Files Touched:  9 source files -> ~38 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Scope

This sub-task covers Tier 2 items 5.4.2-07 through 5.4.2-15 -- UI components, pages,
and the MCP server.

| Item         | File                                                       | Lines   | Execution Order                                                               |
| ------------ | ---------------------------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| 5.4.2-07     | `src/lib/components/map/SignalFilterControls.svelte`       | 784     | 14                                                                            |
| ~~5.4.2-08~~ | ~~`src/routes/+page.svelte`~~                              | ~~753~~ | **EXCLUDED** -- file deleted in Phase 4.1.7 (deprecated landing page removal) |
| 5.4.2-09     | `src/lib/components/dashboard/panels/OverviewPanel.svelte` | 751     | 16                                                                            |
| 5.4.2-10     | `src/routes/kismet/+page.svelte`                           | 744     | 17                                                                            |
| 5.4.2-11     | `src/routes/wifite/+page.svelte`                           | 698     | 18                                                                            |
| 5.4.2-12     | `src/lib/components/dashboard/TerminalPanel.svelte`        | 691     | 19                                                                            |
| 5.4.2-13     | `src/lib/server/mcp/dynamic-server.ts`                     | 646     | 20                                                                            |
| 5.4.2-14     | `src/lib/services/recovery/errorRecovery.ts`               | 624     | 21                                                                            |
| 5.4.2-15     | `src/lib/components/dashboard/AgentChatPanel.svelte`       | 623     | 22                                                                            |

---

## 2. Item 5.4.2-07: SignalFilterControls.svelte (784 lines)

### Content Analysis

Complex filter UI with frequency range slider, signal type checkboxes, time
window selector, custom filter presets with save/load, and filter combination logic.

### Decomposition Strategy

Extract preset management, frequency range slider, and signal type filter into dedicated
subcomponents. Parent composes filters and emits combined filter predicate.

### New File Manifest

| New File                                                   | Content                                          | Est. Lines |
| ---------------------------------------------------------- | ------------------------------------------------ | ---------- |
| `components/map/signal-filter/SignalFilterControls.svelte` | Orchestrator, combined filter predicate emission | ~200       |
| `components/map/signal-filter/FilterPresets.svelte`        | Preset management UI (save/load/delete)          | ~200       |
| `components/map/signal-filter/FrequencyRangeSlider.svelte` | Dual-thumb range slider                          | ~180       |
| `components/map/signal-filter/SignalTypeFilter.svelte`     | Checkbox groups by signal type                   | ~150       |

### Verification

```bash
wc -l src/lib/components/map/signal-filter/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

## 3. ~~Item 5.4.2-08: +page.svelte (753 lines) -- Landing Page~~

**EXCLUDED**: This item has been removed from Phase 5.4 scope. The deprecated landing page
(`src/routes/+page.svelte`, 753 lines) is deleted in **Phase 4.1.7** (Remove Deprecated
Landing Page). The `/dashboard` route replaces it as the primary interface. A 301 redirect
from `/` to `/dashboard` is installed in its place.

See: `plans/codebase-audit-2026-02-07/Final_Phases/Phase_4/Phase-4.1.7-Remove-Deprecated-Landing-Page.md`

---

## 4. Item 5.4.2-09: OverviewPanel.svelte (751 lines)

### Content Analysis

Dashboard overview tab. Metrics grid (4-6 KPI cards), activity feed (scrolling
event log), quick action buttons, service health summary, and mini charts.

### Decomposition Strategy

Extract each visual section into a dedicated subcomponent. Parent orchestrates data
subscriptions and layout.

### New File Manifest

| New File                                                           | Content                                  | Est. Lines |
| ------------------------------------------------------------------ | ---------------------------------------- | ---------- |
| `components/dashboard/panels/overview/OverviewPanel.svelte`        | Orchestrator, data subscriptions, layout | ~100       |
| `components/dashboard/panels/overview/MetricsGrid.svelte`          | KPI cards grid                           | ~200       |
| `components/dashboard/panels/overview/ActivityFeed.svelte`         | Scrolling event log                      | ~180       |
| `components/dashboard/panels/overview/QuickActions.svelte`         | Quick action button set                  | ~120       |
| `components/dashboard/panels/overview/ServiceHealthSummary.svelte` | Service health indicators                | ~150       |

### Verification

```bash
wc -l src/lib/components/dashboard/panels/overview/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

## 5. Item 5.4.2-10: kismet/+page.svelte (744 lines)

### Content Analysis

Kismet WiFi scanner page. Device table with sorting/filtering, Kismet service
controls (start/stop/configure), channel hopping controls, alert display.

### Decomposition Strategy

Extract device table, service controls, and channel controls as subcomponents.

### New File Manifest

| New File                               | Content                                      | Est. Lines |
| -------------------------------------- | -------------------------------------------- | ---------- |
| `routes/kismet/+page.svelte`           | Page shell, store wiring, layout             | ~150       |
| `routes/kismet/DeviceTable.svelte`     | Sortable device list with filtering          | ~250       |
| `routes/kismet/KismetControls.svelte`  | Service management UI (start/stop/configure) | ~200       |
| `routes/kismet/ChannelControls.svelte` | Channel hopping configuration                | ~120       |

### Verification

```bash
wc -l src/routes/kismet/*.svelte
npm run build 2>&1 | tail -5
```

---

## 6. Item 5.4.2-11: wifite/+page.svelte (698 lines)

### Content Analysis

Wifite automated WiFi attack tool page. Target network list, attack
configuration panel, progress display, results table.

### Decomposition Strategy

Extract three major UI sections as subcomponents.

### New File Manifest

| New File                              | Content                                   | Est. Lines |
| ------------------------------------- | ----------------------------------------- | ---------- |
| `routes/wifite/+page.svelte`          | Page shell, WebSocket connection, layout  | ~140       |
| `routes/wifite/TargetList.svelte`     | Network selection table with scan results | ~200       |
| `routes/wifite/AttackConfig.svelte`   | Attack type selector + parameter inputs   | ~180       |
| `routes/wifite/AttackProgress.svelte` | Progress bars + log output                | ~150       |

### Verification

```bash
wc -l src/routes/wifite/*.svelte
npm run build 2>&1 | tail -5
```

---

## 7. Item 5.4.2-12: TerminalPanel.svelte (691 lines)

### Content Analysis

Embedded terminal emulator component. Tab management for multiple terminal
sessions, command input with history, output rendering with ANSI color support, terminal
resize handling.

### Decomposition Strategy

Extract tab management, command input, and output rendering into dedicated subcomponents.

### New File Manifest

| New File                                              | Content                                 | Est. Lines |
| ----------------------------------------------------- | --------------------------------------- | ---------- |
| `components/dashboard/terminal/TerminalPanel.svelte`  | Orchestrator, tab state, I/O routing    | ~150       |
| `components/dashboard/terminal/TerminalTabs.svelte`   | Tab bar + new/close controls            | ~150       |
| `components/dashboard/terminal/CommandInput.svelte`   | Input line + command history navigation | ~180       |
| `components/dashboard/terminal/TerminalOutput.svelte` | ANSI-parsed output display              | ~200       |

### Key Constraints

- Command history state (`string[]`) stays in parent, passed to CommandInput as prop.
- ANSI color parsing may use an external library (e.g., `ansi-to-html`). The import stays with TerminalOutput.
- Terminal resize handling binds a ResizeObserver. This stays with the orchestrator (it affects the terminal container dimensions).

### Verification

```bash
wc -l src/lib/components/dashboard/terminal/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
```

---

## 8. Item 5.4.2-13: dynamic-server.ts (646 lines) -- MCP Server

### Content Analysis

MCP (Model Context Protocol) server with 12 tool handlers inline. Each handler
contains HTTP fetch logic, response parsing, and error handling. The tool registration
and dispatch boilerplate is interspersed with business logic.

### Decomposition Strategy

Extract each tool handler into a separate file under `mcp/tools/`. Keep server
bootstrap, tool registration, and transport setup in `dynamic-server.ts`. Create
a barrel `mcp/tools/index.ts` that exports a `ToolHandler[]` array.

### New File Manifest

| New File                                       | Content                        | Est. Lines |
| ---------------------------------------------- | ------------------------------ | ---------- |
| `server/mcp/dynamic-server.ts`                 | Server bootstrap, registration | ~120       |
| `server/mcp/tools/index.ts`                    | Barrel exports ToolHandler[]   | ~30        |
| `server/mcp/tools/get-active-devices.ts`       | Tool handler                   | ~40        |
| `server/mcp/tools/get-device-details.ts`       | Tool handler                   | ~40        |
| `server/mcp/tools/get-nearby-signals.ts`       | Tool handler                   | ~40        |
| `server/mcp/tools/analyze-network-security.ts` | Tool handler                   | ~40        |
| `server/mcp/tools/get-spectrum-data.ts`        | Tool handler                   | ~40        |
| `server/mcp/tools/get-cell-towers.ts`          | Tool handler                   | ~40        |
| `server/mcp/tools/query-signal-history.ts`     | Tool handler                   | ~40        |
| `server/mcp/tools/get-system-stats.ts`         | Tool handler                   | ~40        |
| `server/mcp/tools/get-kismet-status.ts`        | Tool handler                   | ~40        |
| `server/mcp/tools/get-gsm-status.ts`           | Tool handler                   | ~40        |
| `server/mcp/tools/scan-installed-tools.ts`     | Tool handler                   | ~40        |
| `server/mcp/tools/scan-hardware.ts`            | Tool handler                   | ~40        |

### CRITICAL CONSTRAINT

Per project memory: MCP server CANNOT import SvelteKit internals. Must use HTTP API only
(localhost:5173). Preserve this pattern during decomposition. Each tool handler makes HTTP
fetch calls to the Argos API; it does NOT import from `$lib/server/`.

### Verification

```bash
wc -l src/lib/server/mcp/dynamic-server.ts src/lib/server/mcp/tools/*.ts
npx tsc --noEmit 2>&1 | grep -c "error"
# Verify no SvelteKit imports leaked into tool handlers
grep -r "from '\$lib" src/lib/server/mcp/tools/ --include="*.ts"
# Expected: zero matches
```

---

## 9. Item 5.4.2-14: errorRecovery.ts (624 lines)

### Content Analysis

Error recovery service. Contains recovery strategy definitions for each service
type (Kismet, HackRF, GPS, WebSocket), retry logic with exponential backoff, circuit
breaker implementation, health check orchestration.

### Decomposition Strategy

Extract recovery strategies into per-service files. Extract circuit breaker as a
reusable pattern module. Keep orchestration engine in main file.

### New File Manifest

| New File                                               | Content                            | Est. Lines |
| ------------------------------------------------------ | ---------------------------------- | ---------- |
| `services/recovery/errorRecovery/index.ts`             | Barrel re-export                   | ~30        |
| `services/recovery/errorRecovery/engine.ts`            | Orchestration + retry logic        | ~150       |
| `services/recovery/errorRecovery/circuitBreaker.ts`    | Circuit breaker pattern (reusable) | ~100       |
| `services/recovery/errorRecovery/kismetRecovery.ts`    | Kismet recovery strategy           | ~80        |
| `services/recovery/errorRecovery/hackrfRecovery.ts`    | HackRF recovery strategy           | ~80        |
| `services/recovery/errorRecovery/gpsRecovery.ts`       | GPS recovery strategy              | ~80        |
| `services/recovery/errorRecovery/websocketRecovery.ts` | WebSocket recovery strategy        | ~80        |

### CAUTION (per AC-5)

Verify this file's live callers are outside the dead serviceInitializer island before
decomposing. If all callers are dead, defer to Phase 4 deletion instead.

**Verification command:**

```bash
grep -r "errorRecovery" src/ --include="*.ts" --include="*.svelte" -l | \
  grep -v "serviceInitializer"
# If results are non-empty, file has live callers -> proceed with decomposition
# If empty, file is dead -> defer to Phase 4
```

### Verification

```bash
wc -l src/lib/services/recovery/errorRecovery/*.ts
npx tsc --noEmit
npx madge --circular src/lib/services/recovery/errorRecovery/
```

---

## 10. Item 5.4.2-15: AgentChatPanel.svelte (623 lines)

### Content Analysis

AI agent chat interface. Message list with markdown rendering, input area with
tool approval UI, streaming response display, conversation history management.

### Decomposition Strategy

Extract message rendering, input area, and streaming display as subcomponents.

### New File Manifest

| New File                                                   | Content                                     | Est. Lines |
| ---------------------------------------------------------- | ------------------------------------------- | ---------- |
| `components/dashboard/agent-chat/AgentChatPanel.svelte`    | Orchestrator, conversation state, API calls | ~130       |
| `components/dashboard/agent-chat/MessageList.svelte`       | Message rendering + markdown                | ~200       |
| `components/dashboard/agent-chat/ChatInputArea.svelte`     | Input + send button + tool approval         | ~180       |
| `components/dashboard/agent-chat/StreamingResponse.svelte` | Typing indicator + streaming text           | ~100       |

### Key Constraints

- Markdown rendering may use a library (e.g., `marked` or `svelte-markdown`). The library import stays with MessageList.
- Tool approval UI (approve/deny buttons for agent tool calls) is part of ChatInputArea.
- Streaming response display subscribes to an SSE or WebSocket stream. The subscription setup stays in the parent; StreamingResponse receives text updates as props.

### Verification

```bash
wc -l src/lib/components/dashboard/agent-chat/*.svelte
npx tsc --noEmit 2>&1 | grep -c "error"
npm run build 2>&1 | tail -5
```

---

## 11. Execution Order Within This Sub-Task

| Order  | Item         | File                       | Commit Message                                                     |
| ------ | ------------ | -------------------------- | ------------------------------------------------------------------ |
| 14     | 5.4.2-07     | SignalFilterControls       | `refactor(map): decompose SignalFilterControls into subcomponents` |
| ~~15~~ | ~~5.4.2-08~~ | ~~+page.svelte (landing)~~ | **EXCLUDED -- deleted in Phase 4.1.7**                             |
| 16     | 5.4.2-09     | OverviewPanel              | `refactor(dashboard): decompose OverviewPanel into subcomponents`  |
| 17     | 5.4.2-10     | kismet/+page               | `refactor: decompose kismet page into components`                  |
| 18     | 5.4.2-11     | wifite/+page               | `refactor: decompose wifite page into components`                  |
| 19     | 5.4.2-12     | TerminalPanel              | `refactor(dashboard): decompose TerminalPanel into subcomponents`  |
| 20     | 5.4.2-13     | dynamic-server.ts          | `refactor(mcp): extract tool handlers into individual files`       |
| 21     | 5.4.2-14     | errorRecovery.ts           | `refactor(recovery): extract recovery strategies`                  |
| 22     | 5.4.2-15     | AgentChatPanel             | `refactor(dashboard): decompose AgentChatPanel into subcomponents` |

**One commit per file.** Each commit must pass `npx tsc --noEmit` and `npm run build`.

---

## 12. Standards Compliance

| Standard             | Compliance                                        |
| -------------------- | ------------------------------------------------- |
| Barr Group Rule 1.3  | All files <300 lines post-split                   |
| NASA/JPL Rule 2.4    | Business logic extracted into testable modules    |
| CERT C MEM00         | Circuit breaker allocation/cleanup in same module |
| CERT C MSC41         | No secrets; MCP server uses HTTP API only         |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files                |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.9 -- Tier 2: Components and Services Decomposition
```

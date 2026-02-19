# 008 — Codebase Hardening

## Goal

Eliminate all remaining CLAUDE.md and Constitution violations discovered in the
2026-02-19 codebase convention audit. This branch covers Phase 4 (file
decomposition) and the remaining unsafe shell call migration that was
outside Phase 1 scope.

## Non-Goals

- No new features.
- No UI redesign — only component extraction to reduce file size.
- No changes to pure data files (tool-hierarchy.ts, carrier-mappings.ts, types.ts).

## Success Criteria

1. Zero files importing the unsafe shell function from child_process (all converted to execFile/spawn).
2. All component/logic files under 300 lines (data files exempt).
3. All existing tests continue to pass.
4. No new console.log, .subscribe(), barrel files, or `as any` introduced.

---

## Workstream A: Unsafe Shell Call Migration (18 files, ~66 call sites)

**Pattern to eliminate:** `promisify(unsafeShellFn)` replaced with `execFile` + explicit arg arrays.

### Priority 1 — API Routes (user-facing, highest injection risk)

| #   | File                                           | Calls | Notes                                             |
| --- | ---------------------------------------------- | ----: | ------------------------------------------------- |
| A1  | `routes/api/system/metrics/+server.ts`         |     4 | CPU/disk/network stats — use os module + execFile |
| A2  | `routes/api/system/docker/[action]/+server.ts` |     3 | Docker control — execFile with explicit args      |
| A3  | `routes/api/system/docker/+server.ts`          |     2 | Docker status — execFile                          |
| A4  | `routes/api/system/services/+server.ts`        |     2 | systemctl queries — execFile                      |
| A5  | `routes/api/system/memory-pressure/+server.ts` |     3 | Memory stats — use os module + execFile           |
| A6  | `routes/api/kismet/stop/+server.ts`            |     7 | Process kill chain — execFile pkill/kill          |
| A7  | `routes/api/rf/status/+server.ts`              |     1 | RF device query — execFile                        |

### Priority 2 — Server Libraries (internal, lower risk but pattern must go)

| #   | File                                                       | Calls | Notes                                   |
| --- | ---------------------------------------------------------- | ----: | --------------------------------------- |
| A8  | `lib/server/kismet/service-manager.ts`                     |    19 | Heaviest user — USB reset, process mgmt |
| A9  | `lib/server/services/kismet/kismet-control-service.ts`     |     8 | Kismet start/stop/restart               |
| A10 | `lib/server/hardware/hackrf-manager.ts`                    |     8 | HackRF device control                   |
| A11 | `lib/server/hardware/alfa-manager.ts`                      |     3 | Alfa adapter monitor mode               |
| A12 | `lib/server/hardware/detection/network-detector.ts`        |     1 | Network interface scan                  |
| A13 | `lib/server/services/hardware/hardware-details-service.ts` |     1 | lsusb/lspci queries                     |
| A14 | `lib/server/mcp/servers/test-runner.ts`                    |     3 | MCP test execution                      |
| A15 | `lib/constitution/git-categorizer.ts`                      |     3 | git log/diff queries                    |

### Priority 3 — Dead Imports (import but never call)

| #   | File                                               | Notes                |
| --- | -------------------------------------------------- | -------------------- |
| A16 | `lib/server/hardware/detection/serial-detector.ts` | Remove unused import |
| A17 | `lib/server/hardware/detection/usb-detector.ts`    | Remove unused import |
| A18 | `lib/server/kismet/alfa-detector.ts`               | Remove unused import |

---

## Workstream B: File Decomposition (54 actionable files > 300 lines)

### Tier 1 — Critical (>1000 lines, highest ROI)

| #   | File                                              | Lines | Target | Strategy                                                            |
| --- | ------------------------------------------------- | ----: | ------ | ------------------------------------------------------------------- |
| B1  | `components/dashboard/DashboardMap.svelte`        |  1794 | <300   | Extract: MapCore, MapLayers, MapControls, MapOverlays, MapPopups    |
| B2  | `server/hackrf/sweep-manager.ts`                  |  1417 | <300   | Extract: health-checker, cleanup-manager, memory-monitor            |
| B3  | `components/dashboard/TopStatusBar.svelte`        |  1203 | <300   | Extract: StatusIndicators, NetworkInfo, SystemMonitor, ModalDialogs |
| B4  | `components/dashboard/panels/DevicesPanel.svelte` |  1047 | <300   | Extract: DeviceList, DeviceControls, DeviceFilters, DeviceDetails   |

### Tier 2 — High (500-999 lines)

| #   | File                                                       | Lines | Strategy                                                    |
| --- | ---------------------------------------------------------- | ----: | ----------------------------------------------------------- |
| B5  | `components/dashboard/panels/OverviewPanel.svelte`         |   769 | Extract chart/stats widgets                                 |
| B6  | `components/dashboard/TerminalPanel.svelte`                |   742 | Extract TerminalOutput, TerminalInput, SessionManager       |
| B7  | `server/mcp/dynamic-server.ts`                             |   716 | Extract tool factories                                      |
| B8  | `components/dashboard/AgentChatPanel.svelte`               |   619 | Extract MessageList, InputBar, ToolResults                  |
| B9  | `server/kismet/web-socket-manager.ts`                      |   611 | Extract message handlers                                    |
| B10 | `server/services/gsm-evil/gsm-intelligent-scan-service.ts` |   558 | Extract state machine                                       |
| B11 | `server/mcp/servers/hardware-debugger.ts`                  |   554 | Extract tool definitions                                    |
| B12 | `server/kismet/kismet-proxy.ts`                            |   543 | Extract request handlers                                    |
| B13 | `routes/gsm-evil/+page.svelte`                             |   537 | Extract ScanPanel, CapturePanel, FrameViewer                |
| B14 | `server/db/db-optimizer.ts`                                |   520 | Extract analysis functions                                  |
| B15 | `server/db/cleanup-service.ts`                             |   509 | Extract retention policies                                  |
| B16 | `hackrf/api-legacy.ts`                                     |   509 | Extract or deprecate                                        |
| B17 | `hackrf/sweep-manager/buffer-manager.ts`                   |   505 | Extract ring buffer logic                                   |
| B18 | `hooks.server.ts`                                          |   501 | Extract auth, rate-limit, CORS into middleware modules      |
| B19 | `server/mcp/servers/streaming-inspector.ts`                |   498 | Extract tool definitions                                    |
| B20 | `hackrf/spectrum.ts`                                       |   492 | Extract FFT, waterfall, power modules                       |
| B21 | `hackrf/sweep-manager/error-tracker.ts`                    |   485 | Extract recovery strategies                                 |
| B22 | `constitution/validators/article-ii-code-quality.ts`       |   483 | Extract rule validators                                     |
| B23 | `server/websocket-server.ts`                               |   469 | Extract session management                                  |
| B24 | `components/dashboard/panels/LayersPanel.svelte`           |   467 | Extract MapProviderSelector, VisibilityFilter, LayerToggles |

### Tier 3 — Moderate (300-500 lines, tackle after Tier 1-2)

| #   | File                                                   | Lines |
| --- | ------------------------------------------------------ | ----: |
| B25 | `server/mcp/servers/system-inspector.ts`               |   445 |
| B26 | `kismet/websocket.ts`                                  |   434 |
| B27 | `hackrf/sweep-manager/frequency-cycler.ts`             |   434 |
| B28 | `constitution/master-report-generator.ts`              |   433 |
| B29 | `routes/dashboard/+page.svelte`                        |   432 |
| B30 | `kismet/api.ts`                                        |   429 |
| B31 | `constitution/analysis-generator.ts`                   |   422 |
| B32 | `server/mcp/servers/database-inspector.ts`             |   420 |
| B33 | `server/services/gps/gps-position-service.ts`          |   419 |
| B34 | `stores/gsm-evil-store.ts`                             |   415 |
| B35 | `hackrf/sweep-manager/process-manager.ts`              |   405 |
| B36 | `server/hardware/detection/usb-detector.ts`            |   401 |
| B37 | `server/gsm/l3-decoder.ts`                             |   392 |
| B38 | `components/dashboard/TerminalTabContent.svelte`       |   382 |
| B39 | `websocket/base.ts`                                    |   380 |
| B40 | `server/services/kismet.service.ts`                    |   380 |
| B41 | `constitution/constitution-parser.ts`                  |   380 |
| B42 | `server/agent/frontend-tools.ts`                       |   369 |
| B43 | `server/services/hardware/hardware-details-service.ts` |   363 |
| B44 | `stores/dashboard/terminal-store.ts`                   |   362 |
| B45 | `server/db/database.ts`                                |   359 |
| B46 | `constitution/validators/article-iii-testing.ts`       |   341 |
| B47 | `constitution/auditor.ts`                              |   341 |
| B48 | `server/mcp/servers/api-debugger.ts`                   |   332 |
| B49 | `components/dashboard/IconRail.svelte`                 |   331 |
| B50 | `server/services/gsm-evil/gsm-scan-service.ts`         |   324 |
| B51 | `components/dashboard/PanelContainer.svelte`           |   317 |
| B52 | `server/hardware/resource-manager.ts`                  |   315 |
| B53 | `hackrf/stores.ts`                                     |   310 |
| B54 | `server/services/gps/gps-satellite-service.ts`         |   307 |

---

## Workstream C: Remaining Convention Fixes

### C1. Raw button elements to shadcn Button (~15 instances, 10 files)

| File                             | Instances | Notes                        |
| -------------------------------- | --------: | ---------------------------- |
| `panels/LayersPanel.svelte`      |         1 | apply-btn                    |
| `dashboard/+page.svelte`         |         1 | tab-close-btn                |
| `panels/DevicesPanel.svelte`     |         1 | whitelist-remove             |
| `panels/OverviewPanel.svelte`    |         6 | scan-row buttons             |
| `status/TAKIndicator.svelte`     |         2 | tak-indicator, configure-btn |
| `TerminalPanel.svelte`           |         2 | dropdown-item, create-btn    |
| `AgentChatPanel.svelte`          |         1 | toolbar-btn                  |
| `panels/ToolsPanelHeader.svelte` |         1 | back-btn                     |
| `shared/ToolCategoryCard.svelte` |         1 | category-card                |

**Note:** Some may be intentionally raw (MapLibre overlays, terminal UI). Evaluate case-by-case.

### C2. Type assertion cleanup

| File                | Line | Notes                                                      |
| ------------------- | ---- | ---------------------------------------------------------- |
| `websocket/base.ts` | 72   | WebSocket constructor compat — use `as unknown as` pattern |

---

## Exempt Files (no action needed)

| File                       | Lines | Reason                     |
| -------------------------- | ----: | -------------------------- |
| `data/tool-hierarchy.ts`   |  1491 | Pure static data tree      |
| `data/carrier-mappings.ts` |   809 | Pure MCC-MNC lookup tables |
| `constitution/types.ts`    |   315 | Type definitions only      |

---

## Execution Strategy

1. **Workstream A first** (shell call migration) — mechanical, low risk, high security value.
2. **Workstream B Tier 1** next — the 4 largest files yield the biggest improvement.
3. **Workstream C** alongside B — small fixes bundled with decomposition commits.
4. **Workstream B Tiers 2-3** — batch by subsystem (hackrf, kismet, mcp, dashboard).

Each decomposition should be a separate commit for easy review and revert.

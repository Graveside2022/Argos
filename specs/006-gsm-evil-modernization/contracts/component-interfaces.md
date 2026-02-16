# Component Interface Contracts

**Date**: 2026-02-16 | **Feature**: 006-gsm-evil-modernization

## Overview

This feature is frontend-only — no API changes. The "contracts" are the component prop interfaces that define the boundary between the parent orchestrator (`+page.svelte`) and its sub-components.

All API endpoints under `/api/gsm-evil/` remain unchanged. See `research.md` RQ-7 for the full API surface.

**Canonical source**: `data-model.md` contains the full TypeScript interfaces, data flow diagram, and existing type definitions. This file provides a quick-reference summary in table format.

## Component Contracts (Quick Reference)

### GsmHeader

| Prop                | Type         | Direction      | Description                   |
| ------------------- | ------------ | -------------- | ----------------------------- |
| `isActive`          | `boolean`    | Parent → Child | Scan or capture is active     |
| `buttonText`        | `string`     | Parent → Child | Start/Stop button label       |
| `imsiCaptureActive` | `boolean`    | Parent → Child | IMSI capture badge visibility |
| `onscanbutton`      | `() => void` | Child → Parent | Start/Stop button click       |

### TowerTable

| Prop                   | Type                            | Direction      | Description          |
| ---------------------- | ------------------------------- | -------------- | -------------------- |
| `groupedTowers`        | `TowerGroup[]`                  | Parent → Child | Sorted tower groups  |
| `towerLocations`       | `Record<string, TowerLocation>` | Parent → Child | Tower geo data       |
| `towerLookupAttempted` | `Record<string, boolean>`       | Parent → Child | Lookup attempt flags |
| `selectedFrequency`    | `string`                        | Parent → Child | Current frequency    |

### ScanResultsTable

| Prop                | Type                          | Direction      | Description             |
| ------------------- | ----------------------------- | -------------- | ----------------------- |
| `scanResults`       | `ScanResult[]`                | Parent → Child | Scan frequency results  |
| `selectedFrequency` | `string`                      | Parent → Child | Currently selected freq |
| `onselect`          | `(frequency: string) => void` | Child → Parent | Frequency selection     |

### ScanConsole

| Prop           | Type       | Direction      | Description       |
| -------------- | ---------- | -------------- | ----------------- |
| `scanProgress` | `string[]` | Parent → Child | Console log lines |
| `isScanning`   | `boolean`  | Parent → Child | Scanning state    |

### LiveFramesConsole

| Prop                | Type             | Direction      | Description              |
| ------------------- | ---------------- | -------------- | ------------------------ |
| `gsmFrames`         | `string[]`       | Parent → Child | Decoded frame strings    |
| `activityStatus`    | `ActivityStatus` | Parent → Child | Packet/freq status       |
| `capturedIMSIs`     | `IMSICapture[]`  | Parent → Child | For device count display |
| `selectedFrequency` | `string`         | Parent → Child | Current frequency        |

### ErrorDialog

| Prop      | Type      | Direction                   | Description        |
| --------- | --------- | --------------------------- | ------------------ |
| `open`    | `boolean` | Bidirectional (`$bindable`) | Dialog open state  |
| `message` | `string`  | Parent → Child              | Error message text |

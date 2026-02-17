# Research: TAK Server Integration Phase 2

## Research Task 0: Unified TAK Library

- **Decision**: Install `@tak-ps/node-tak` via `npm install https://github.com/dfpc-coe/node-tak`.
- **Rationale**: 
  - Industry-standard library for Node.js TAK integrations.
  - Supports modern Protobuf and legacy CoT XML seamlessly.
  - Handles complex connection states, retries, and REST API interactions (Enrollment/Data Packages).
- **Impact**: **DELETE** `src/lib/server/tak/TakClient.ts`. All logic moves to `TakService.ts` wrapping the library.

## Research Task 1: Data Package & Config Parsing

- **Strategy**: Use `node-tak`'s internal XML utilities to parse `preference.pref` and `manifest.xml`.
- **Enrollment**: Use library's API classes to hit `/Marti/api/tls/signClient/v2`.
- **Native Unzip**: Continue using native `unzip` for raw file extraction to `data/certs/` to avoid JS-based zip overhead.

## Research Task 2: Truststore Validation

- **Decision**: Use `openssl pkcs12 -info -in <path> -passin pass:<password> -noout`.
- **Rationale**: 
  - Most reliable way to verify PKCS#12 integrity and password correctness on Linux.
  - `openssl` is a core dependency of Argos for certificate management.
- **Workflow**:
  1. User provides path/file.
  2. Argos runs validation command.
  3. If exit code is 0, file is valid. If non-zero, show "Invalid truststore or password" error.

## Research Task 3: Dashboard Navigation Pattern

- **Pattern**: Inline view using `activeView` store.
- **File**: `src/lib/stores/dashboard/dashboard-store.ts`.
- **Implementation**:
  - Add `tak-config` to `activeView` type.
  - Update `src/routes/dashboard/+page.svelte` to include `TakConfigView`.
  - Use `ToolViewWrapper` for consistent UI (Back button, Title).

## Research Task 4: UI Components & Placement

- **TopStatusBar Indicator**: Positioned after GPS indicator. Uses a dot (green/grey) and label.
- **Overview Panel Section**: Positioned after Kismet section. Displays:
  - Server Name (Description)
  - Connection Status
  - Address (IP/Host)
  - Message Count
- **Reactive Updates**: Use existing `takStatus` store in `$lib/stores/tak-store.ts`, extended with new fields.

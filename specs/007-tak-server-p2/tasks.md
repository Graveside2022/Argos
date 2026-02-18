# Tasks: TAK Server Integration Phase 2

**Input**: Design documents from `/specs/007-tak-server-p2/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Integration Notes (from node-tak library audit)

> These findings were identified by auditing the actual `@tak-ps/node-tak` source code at
> [github.com/dfpc-coe/node-tak](https://github.com/dfpc-coe/node-tak) (v11.27.0, last updated 2026-02-11).

1. **Peer dependency required**: `@tak-ps/node-cot ^14.20.0` must be installed alongside node-tak. It provides CoT message parsing/serialization (`CoTParser.from_xml()`, `CoTParser.to_xml()`, `CoT.ping()`).
2. **SSL-only**: node-tak only supports `ssl:` protocol. `TAK.connect()` throws on non-SSL. Our config type allows `'tcp' | 'tls'` — **TCP support is dropped**. This is acceptable: TAK servers in field operations always use TLS. The UI should default protocol to SSL and hide the TCP option.
3. **Enrollment returns PEM, not P12**: `credentials.generate()` calls `/Marti/api/tls/signClient/v2` and returns `{ ca: string[], cert: string, key: string }` as PEM strings. CertManager must handle writing PEM files directly (not just P12 extraction).
4. **`@xmldom/xmldom` still needed**: node-tak uses `xml-js` internally but does NOT expose XML parsing for `preference.pref` files. Our `TakPackageParser.ts` needs its own XML parser for data package import.
5. **DB column naming**: Existing `tak_configs` schema uses `snake_case` columns (`cert_path`, `key_path`, `ca_path`) but TypeScript type uses `camelCase` (`certPath`, `keyPath`, `caPath`). The `saveConfig()` SQL uses `@paramName` bindings that must match the TS object keys. **T004 and T014 must ensure consistent mapping** (either rename DB columns to camelCase, or add a mapping layer).
6. **`rejectUnauthorized` defaults to `false`** in node-tak. Our security requirement (FR-012) mandates `true`. Must explicitly pass `rejectUnauthorized: true` in the TAKAuth object when connecting.
7. **node-tak includes `p12-pem` dependency**: Can convert P12 → PEM natively. Consider using this instead of shelling out to `openssl` for truststore extraction in CertManager (simpler, no child process).

## Document Reference Map

| Document | What It Contains | Used By Tasks |
|----------|-----------------|---------------|
| **data-model.md** | Column types, defaults, full TAKConfiguration interface, TAKStatus interface | T004, T005, T010 |
| **contracts/api.md** | Request/response shapes for all API endpoints | T014, T016, T020, T024 |
| **research.md § Task 0** | node-tak rationale, what TakClient.ts replaces | T006, T007 |
| **research.md § Task 1** | Data package strategy: native `unzip` + node-tak XML utils | T009, T026 |
| **research.md § Task 2** | Truststore validation via `openssl pkcs12` command | T008, T018 |
| **research.md § Task 3** | Dashboard navigation pattern: `activeView` + `ToolViewWrapper` | T003, T011, T012 |
| **research.md § Task 4** | TopStatusBar indicator placement, Overview panel section layout | T028, T029, T031 |
| **spec.md § Constraints** | ALTER TABLE migration pattern, column defaults, CHECK constraints | T004 |
| **spec.md § Reference: ATAK Connection Form Fields** | Full form field table with types and defaults | T011, T017, T021, T025 |
| **spec.md § Edge Cases** | All 10 error scenarios with exact error messages | T036 |

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US2B, US2C, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Install dependencies: `npm install @tak-ps/node-tak @tak-ps/node-cot @xmldom/xmldom`. **Note**: `@tak-ps/node-cot` is a required peer dependency of node-tak (CoT parsing/serialization). `@xmldom/xmldom` is needed for TakPackageParser (preference.pref XML). Verify `node --version` >= 22 (node-tak requirement). → See **Integration Notes § 1, 4**
- [x] T002 Create directory `src/lib/components/dashboard/tak/` for inline TAK components
- [x] T003 [P] Add `'tak-config'` to `activeView` union type in `src/lib/stores/dashboard/dashboard-store.ts`. **Current state**: untyped `writable<string>`. Existing view values: `'map'`, `'kismet'`, `'openwebrx'`, `'bettercap'`, `'gsm-evil'`. Create a union type and add `'tak-config'`. → See **research.md § Task 3**

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T004 Create DB migration to ALTER TABLE `tak_configs` adding columns: `truststore_path TEXT`, `truststore_pass TEXT DEFAULT 'atakatak'`, `cert_pass TEXT DEFAULT 'atakatak'`, `auth_method TEXT CHECK(auth_method IN ('enroll','import'))`, `enrollment_user TEXT`, `enrollment_pass TEXT`, `enrollment_port INTEGER DEFAULT 8446`. **Migration format**: Use `.ts` file matching existing pattern at `src/lib/server/db/migrations/20260217_create_tak_configs.ts`. New file: `src/lib/server/db/migrations/20260218_extend_tak_configs.ts`. **Column naming**: Existing schema uses `snake_case` (`cert_path`, `key_path`, `ca_path`) but the TypeScript type uses `camelCase` (`certPath`). The current `saveConfig()` in TakService.ts uses `@paramName` bindings that map to TS object keys — this only works if SQLite column names match (SQLite is case-insensitive for column matching in INSERT/UPDATE with `@` bindings, but SELECT returns the column name as defined). **Decision**: Keep `snake_case` for new columns (consistent with existing schema). T014 must add a mapping layer in the API to convert between DB snake_case and TS camelCase. → See **data-model.md** (TAKConfiguration table) + **spec.md § Constraints** + **Integration Notes § 5**
- [x] T005 [P] Update `TakServerConfig` type in `src/lib/types/tak.ts` with new fields: `authMethod: 'enroll' | 'import'`, `truststorePath?: string`, `truststorePass: string`, `certPass: string`, `enrollmentUser?: string`, `enrollmentPass?: string`, `enrollmentPort: number`. **Change protocol type** from `'tcp' | 'tls'` to just `'tls'` (node-tak is SSL-only — see Integration Notes § 2). Also add `TakStatus` interface with `serverName`, `serverHost`, `uptime`, `messageCount` fields. → See **data-model.md** for full field definitions, **Integration Notes § 2**
- [x] T006 Refactor `src/lib/server/tak/TakService.ts` (231 lines) to wrap `@tak-ps/node-tak` instead of the custom `TakClient.ts`. **Preserve**: singleton pattern, EventEmitter, CoT throttling (1 msg/sec per UID), WebSocket broadcast via `WebSocketManager`. **Replace**: `TakClient` instantiation in `connect()` with `TAK.connect(url, auth, opts)`. **node-tak API**: `const tak = await TAK.connect(new URL('ssl://<host>:<port>'), { cert, key, ca, rejectUnauthorized: true })`. Events: `'cot'` (parsed CoT object), `'end'`, `'timeout'`, `'error'`, `'ping'`. Write via `tak.write([cot])` or `tak.write_xml(xml)`. **CRITICAL**: Must pass `rejectUnauthorized: true` (node-tak defaults to `false`). **CRITICAL**: node-tak only supports SSL — remove TCP fallback path from connect(). The `cot` event now emits parsed `CoT` objects (from node-cot), not raw XML strings — update the WebSocket broadcast accordingly. **Implementation Detail**: Initialize a `messageCount = 0` property in the service and increment it inside the `'cot'` event listener before broadcasting status (library does not track this). → See **research.md § Task 0**, **Integration Notes § 2, 6**
- [x] T007 [P] DELETE deprecated `src/lib/server/tak/TakClient.ts` (201 lines) and remove all imports referencing it. **Depends on**: T006 completing the refactor first. → See **research.md § Task 0** for rationale
- [x] T008 Update `src/lib/server/tak/CertManager.ts` (135 lines) to support truststore validation and PEM file storage. **Existing method to extend**: `saveAndExtract()` uses `execFile` for P12→PEM via openssl. **Add**: `validateTruststore(path, password)` using `openssl pkcs12 -info -in <path> -passin pass:<password> -noout`. **Add**: `savePemCerts(configId, cert, key, ca[])` to write PEM strings directly to `data/certs/<configId>/` — needed because enrollment (T022) returns PEM, not P12. **Implementation Detail**: Ensure `savePemCerts` creates the directory using `fs.mkdirSync(dir, { recursive: true, mode: 0o700 })` to match existing security patterns. **Consider**: node-tak ships with `p12-pem` dependency — could use it instead of shelling out to `openssl` for truststore extraction (simpler, no child process). → See **research.md § Task 2**, **Integration Notes § 3, 7**
- [x] T009 Create `src/lib/server/tak/TakPackageParser.ts` (NEW) for ZIP extraction, manifest.xml validation, preference.pref XML parsing, and cert file extraction. **Strategy**: Use native `unzip` for file extraction (avoid JS zip libs), `@xmldom/xmldom` for XML parsing. Must extract `connectString` entries in format `<host>:<port>:<protocol>` from preference.pref. → See **research.md § Task 1**
- [x] T010 [P] Extend `takStatus` store in `src/lib/stores/tak-store.ts` (41 lines) with `serverName`, `serverHost`, `uptime`, `messageCount` fields. **Current shape**: `{ status: 'connected' | 'disconnected' | 'error', lastMessage?: string }`. Import and use the `TakStatus` interface from T005. → See **data-model.md** (TAKStatus interface)
- [x] T010B Update WebSocket broadcast shape in `TakService.ts` to include the new status fields (`serverName`, `serverHost`, `uptime`, `messageCount`) so the frontend store receives them. **Depends on**: T006 + T010

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Configure TAK Server Without Leaving Dashboard (Priority: P1)

**Goal**: Load TAK configuration inline in the dashboard using ToolViewWrapper

**Independent Test**: Clicking Settings > TAK Server opens the config form inside the dashboard with a working back button, no page navigation.

- [ ] T011 [P] [US1] Create `TakConfigView.svelte` using `ToolViewWrapper` in `src/lib/components/dashboard/tak/`. **ToolViewWrapper** (78 lines at `src/lib/components/dashboard/views/ToolViewWrapper.svelte`) accepts: `title` prop, `children` snippet, optional status badge. **Migrate from**: `src/lib/components/dashboard/settings/TakSettingsForm.svelte` (308 lines) — convert Svelte 4 `onMount` to Svelte 5 `$effect`, use `$state()` for form fields. **Include the Description field (FR-015) for server labeling**. → See **research.md § Task 3** for pattern, **spec.md § Reference: ATAK Connection Form Fields** for full field list
- [ ] T012 [US1] Update `src/routes/dashboard/+page.svelte` (430 lines) to add `{:else if $activeView === 'tak-config'}` branch rendering `TakConfigView`. **Pattern to follow**: existing `'gsm-evil'` and `'bettercap'` branches that use `ToolViewWrapper`. → See **research.md § Task 3**
- [ ] T013 [US1] Update `src/lib/components/dashboard/panels/SettingsPanel.svelte` (135 lines) to trigger `activeView = 'tak-config'` instead of the current broken `href="/settings/tak"` link (no route exists for that path). Import `activeView` from dashboard store.
- [ ] T014 [US1] Update existing `GET/POST /api/tak/config` in `src/routes/api/tak/config/+server.ts` (45 lines) to support new fields: `authMethod`, `truststorePath`, `truststorePass`, `certPass`, `enrollmentUser`, `enrollmentPass`, `enrollmentPort`. **Must add DB↔TS mapping**: GET should convert `snake_case` DB rows to `camelCase` TS objects (e.g., `cert_path` → `certPath`). POST should convert incoming `camelCase` JSON to `snake_case` for SQL. Also update `TakService.saveConfig()` SQL statements to include the new columns. → See **contracts/api.md § Configuration API**, **Integration Notes § 5**
- [ ] T015 [US1] Write unit tests for config API endpoint in `src/routes/api/tak/config/+server.test.ts`
- [ ] T011B [US1] DELETE `src/lib/components/dashboard/settings/TakSettingsForm.svelte` (308 lines) and remove all imports referencing it. **Depends on**: T011 (replacement) + T012 (routing) + T013 (settings link) all complete

---

## Phase 4: User Story 2 — Import Trust Store (Priority: P1)

**Goal**: Support importing .p12 truststores with password validation

**Independent Test**: Upload a .p12 truststore via the config form and verify it is copied to `data/certs/` and validated.

- [ ] T016 [US2] Implement `POST /api/tak/truststore` in `src/routes/api/tak/truststore/+server.ts`. → See **contracts/api.md § Certificate & Truststore API** for request/response shape
- [ ] T017 [US2] Add Trust Store import UI (file picker, path field, password defaulting to `atakatak`) to `TakConfigView.svelte`. → See **spec.md § Reference: ATAK Connection Form Fields** (Import Trust Store row)
- [ ] T018 [US2] Implement truststore validation (PKCS#12 unlock + extract) in `src/lib/server/tak/CertManager.ts`. **Method**: `validateTruststore(path, password)` using `openssl pkcs12 -info`. → See **research.md § Task 2** for the exact openssl command
- [ ] T019 [US2] Write unit tests for CertManager truststore validation in `src/lib/server/tak/CertManager.test.ts`

---

## Phase 5: User Story 2B — Enroll for Client Certificate (Priority: P1)

**Goal**: Automated certificate enrollment via TAK Server API

**Independent Test**: Enter enrollment credentials and verify a client certificate is obtained and stored in `data/certs/`.

**Note**: T018 (truststore validation) should be complete before T022 — the enrollment TLS connection to `https://<host>:8446/Marti/api/tls/signClient/v2` requires the truststore to verify the server's certificate.

- [ ] T020 [US2B] Implement `POST /api/tak/enroll` in `src/routes/api/tak/enroll/+server.ts`. → See **contracts/api.md § Enrollment API** for request/response shape
- [ ] T021 [US2B] Add Enrollment UI fields (username, password, port defaulting to `8446`) and auth method toggle (radio: "Enroll for Certificate" / "Import Certificate") to `TakConfigView.svelte`. → See **spec.md § Reference: ATAK Connection Form Fields**
- [ ] T022 [US2B] Implement enrollment logic in `src/lib/server/tak/CertManager.ts`. **Strategy**: Use node-tak's `TAKAPI` + `APIAuthPassword` + `Credentials.generate()` which handles CSR creation, POST to `/Marti/api/tls/signClient/v2`, and returns `{ ca: string[], cert: string, key: string }` as PEM strings. Store PEM files via `savePemCerts()` (from T008). **Fallback**: If node-tak's Credentials class doesn't work for our flow (it requires `APIAuthPassword` init which calls OAuth), implement manually: `pem.createCSR()` → POST CSR with HTTP Basic Auth → parse response `signedCert` + `ca0`/`ca1`. **Requires**: truststore loaded (T018) for TLS verification of the enrollment endpoint. → See **Integration Notes § 3**, **contracts/api.md § Enrollment API**
- [ ] T023 [US2B] Write unit tests for enrollment logic in `src/lib/server/tak/CertManager.test.ts`

---

## Phase 6: User Story 2C — Import Data Package (Priority: P1)

**Goal**: Auto-populate configuration from TAK data package .zip

**Independent Test**: Import a sample .zip package and verify hostname, port, and certs are auto-filled.

- [ ] T024 [US2C] Implement `POST /api/tak/import-package` in `src/routes/api/tak/import-package/+server.ts`. → See **contracts/api.md § Data Package API** for request/response shape
- [ ] T025 [US2C] Add "Import Data Package" button and handler to `TakConfigView.svelte`. → See **spec.md § Reference: ATAK Connection Form Fields**
- [ ] T026 [US2C] Integrate `TakPackageParser.ts` (from T009) into the import-package API endpoint. Wire: upload → parse → extract certs to `data/certs/` → return auto-filled config. → See **research.md § Task 1**
- [ ] T027 [US2C] Write unit tests for TakPackageParser (ZIP extraction, manifest validation, pref parsing) in `src/lib/server/tak/TakPackageParser.test.ts`

---

## Phase 7: User Story 3 — TAK Status in TopStatusBar (Priority: P2)

**Goal**: Visibility of TAK connection state in the top status bar

**Independent Test**: Verify the TAK indicator dot changes color based on connection and shows a dropdown on click.

- [ ] T028 [P] [US3] Create `TAKIndicator.svelte` component in `src/lib/components/status/`. **Placement**: After GPS indicator in TopStatusBar. **Pattern**: Green dot (connected) / grey dot (disconnected) + server name label. Dropdown on click. → See **research.md § Task 4** for layout spec
- [ ] T029 [US3] Integrate `TAKIndicator.svelte` into `src/lib/components/dashboard/TopStatusBar.svelte` (1200 lines). **Insert after**: GPS indicator section. **Reactive source**: `takStatus` store from `$lib/stores/tak-store.ts`. → See **research.md § Task 4**
- [ ] T030 [US3] Implement dropdown in `TAKIndicator.svelte` with: server name, IP address, connection uptime, message count (when connected) OR "Not connected" + "Configure" button (when disconnected). "Configure" button sets `activeView = 'tak-config'`.

---

## Phase 8: User Story 4 — TAK Status in Overview Panel (Priority: P2)

**Goal**: Display TAK connection status in the central Overview panel

**Independent Test**: Open Overview panel and verify the TAK SERVER section reflects current state.

- [ ] T031 [US4] Add TAK SERVER section to `src/lib/components/dashboard/panels/OverviewPanel.svelte` (755 lines). **Position**: After the existing services section (Kismet WiFi, GPS). **Display**: Server name, IP, status indicator (green/grey), message count. → See **research.md § Task 4** for section layout
- [ ] T032 [US4] Ensure the "Configure" link in Overview sets `activeView = 'tak-config'` (import from dashboard store, same pattern as T013)

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T033 Audit all new files for "Max 300 lines" constraint from plan.md
- [ ] T034 Verify dark mode styling across all new TAK components (project is dark mode only)
- [ ] T035 Ensure no barrel files (index.ts) were introduced
- [ ] T036 Final check of error messages for all 10 edge cases. → See **spec.md § Edge Cases** for exact error message strings: "File not found at [path]", "Invalid truststore file", "Trust store required...", "Authentication failed...", "Enrollment server unreachable at...", "No certificates found in data package...", "Invalid data package — no manifest.xml found"
- [ ] T037 Remove broken `/settings/tak` href from SettingsPanel (already fixed by T013) and delete any orphaned `/settings/tak` route files if they exist. Add a code comment noting the TAK config is now accessed via `activeView = 'tak-config'`.

## Dependencies

### Strict Sequential Dependencies (task B cannot start until task A is done)

```
T001 → T006 (node-tak must be installed before TakService refactor)
T006 → T007 (TakClient.ts can only be deleted after TakService no longer imports it)
T004 → T014 (DB columns must exist before API reads/writes them)
T005 → T010 (TakStatus interface must exist before store uses it)
T006 + T010 → T010B (broadcast shape update needs both service refactor and store extension)
T011 → T011B (old TakSettingsForm deleted only after replacement is wired up)
T011 + T012 + T013 → T011B (all routing must work before removing old component)
T009 → T026 (TakPackageParser must exist before API integrates it)
T018 → T022 (truststore validation needed before enrollment can use truststore for TLS)
```

### Phase-Level Dependencies

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundation) — all tasks must complete before user stories begin
  ↓
Phase 3 (US1) — provides base UI (TakConfigView) that US2/US2B/US2C extend
  ↓
Phase 4 (US2), Phase 5 (US2B), Phase 6 (US2C) — can run in parallel after US1
  ↓
Phase 7 (US3), Phase 8 (US4) — depend on T010 (status store) + US1 (Configure navigation)
  ↓
Final Phase (Polish)
```

### Cross-Phase Dependencies

- US2 (T016-T019) depends on: Phase 2 complete + T011 (base config UI)
- US2B (T020-T023) depends on: Phase 2 complete + T011 (base config UI) + T018 (truststore validation)
- US2C (T024-T027) depends on: Phase 2 complete + T009 (TakPackageParser) + T011 (base config UI)
- US3 (T028-T030) depends on: T010 (extended status store) + US1 complete (for "Configure" nav)
- US4 (T031-T032) depends on: T010 (extended status store) + US1 complete (for "Configure" nav)

## Parallel Execution Examples

- T003 (Dashboard store), T005 (types), and T010 (store extension) can run in parallel (different files)
- T004 (DB migration) and T005 (types) can run in parallel
- T011 (UI) and T014 (API) within US1 can run in parallel
- US2, US2B, and US2C can be developed in parallel once T011 (base config UI) is ready
- T028 (TAKIndicator) can start alongside US2 tasks (once T010 is done)
- T031 (Overview panel) and T028 (TopStatusBar indicator) can run in parallel

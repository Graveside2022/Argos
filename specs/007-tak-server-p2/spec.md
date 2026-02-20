# Feature Specification: TAK Server Integration Phase 2

**Feature Branch**: `007-tak-server-p2`
**Created**: 2026-02-17
**Status**: Draft
**Input**: User description: "TAK server integration p2 — fix navigation pattern, add truststore import, add connection status to Overview and TopStatusBar"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configure TAK Server Without Leaving Dashboard (Priority: P1)

The user clicks the gear icon on the dashboard, sees the "TAK Server" connectivity option in the Settings panel, and clicks it. Instead of navigating to a separate page, the TAK configuration view opens inside the dashboard (using the same pattern as GSM Evil and Kismet), with a back button to return to the map. The user configures hostname, port, protocol, and certificates, then clicks back to return to the map view.

**Why this priority**: This is the core navigation fix — currently the TAK config page breaks the dashboard's single-page experience by navigating to `/settings/tak`. All other tools load inline, and TAK should too.

**Independent Test**: Can be fully tested by clicking Settings > TAK Server and verifying the config form opens inside the dashboard with a back button, without any page navigation.

**Acceptance Scenarios**:

1. **Given** the user is on the dashboard map view, **When** they click Settings > TAK Server, **Then** the TAK configuration form loads inside the dashboard using the ToolViewWrapper pattern (with a back button and title bar).
2. **Given** the TAK config view is open inside the dashboard, **When** the user clicks the Back button, **Then** the map view is restored.
3. **Given** the TAK config view is open, **When** the user presses Escape, **Then** the view returns to the map.
4. **Given** the TAK config is open, **When** the user edits hostname/port/protocol and clicks Save, **Then** the configuration is persisted successfully.

---

### User Story 2 - Import Trust Store (Priority: P1)

The user needs to import a trust store file (e.g., `truststore-TAK-ID-CA-01.p12`) to establish trust with the TAK Server's certificate authority. On the TAK configuration form, there is a "Trust Store" section with an "Import Trust Store" button. The user can either:

- Click "Import Trust Store" to open a file picker and select the `.p12` file, OR
- Type/paste the full file path into a text field

A password field (defaulting to `atakatak`) accompanies the import. After importing, the system validates the PKCS#12 file and shows confirmation that the trust store is loaded, displaying the file name.

**Why this priority**: Without a trust store, the client cannot verify the TAK server's TLS certificate, so mutual TLS connections cannot be established. This is a prerequisite for actual connectivity.

**Independent Test**: Can be tested by importing a trust store `.p12` file and confirming the system acknowledges it as loaded.

**Acceptance Scenarios**:

1. **Given** the TAK config form is open, **When** the user sees the Trust Store section, **Then** there is a single "Import Trust Store" row with a file picker, text path input, and password field (defaulting to `atakatak`).
2. **Given** the user clicks "Import Trust Store", **When** they select a `.p12` file from the file picker, **Then** the file is copied to `data/certs/`, the path is shown, and a confirmation appears.
3. **Given** the user types a file path into the trust store text field, **When** they click "Import", **Then** the system validates the PKCS#12 file using the provided password and confirms it is loaded.
4. **Given** a trust store is loaded, **When** the user views the Trust Store section, **Then** a visual indicator shows the file is present with its file name and a green checkmark.

---

### User Story 2B - Enroll for Client Certificate (Priority: P1)

The user selects "Enroll for Certificate" as the client authentication method (instead of manual `.p12` import). The form reveals enrollment fields: username, password, and enrollment port (defaulting to `8446`). The user enters their TAK server enrollment credentials and clicks "Enroll". Argos connects to the TAK server's certificate enrollment API (`https://<server>:<enrollmentPort>/Marti/api/tls/signClient/v2`) using HTTP Basic Auth, receives a signed client certificate `.p12` bundle, and stores it in `data/certs/`. The UI confirms enrollment success and the client cert is automatically configured.

**Why this priority**: Certificate enrollment is how most TAK users obtain their client certificate in the field. Without it, users must rely on an admin pre-generating and distributing `.p12` files — which is not always practical during operations.

**Independent Test**: Can be tested by entering enrollment credentials for a reachable TAK server and verifying the system obtains and stores a client certificate.

**Acceptance Scenarios**:

1. **Given** the TAK config form is open with protocol set to SSL, **When** the user selects "Enroll for Certificate" as the authentication method, **Then** username, password, and enrollment port fields appear.
2. **Given** enrollment fields are filled in, **When** the user clicks "Enroll", **Then** the system calls the TAK server enrollment API and receives a signed client certificate.
3. **Given** enrollment succeeds, **When** the certificate is received, **Then** it is stored in `data/certs/` and the config is updated with the cert path automatically.
4. **Given** enrollment fails (bad credentials, unreachable server), **When** the error occurs, **Then** a clear error message is shown (e.g., "Authentication failed" or "Enrollment server unreachable at <host>:8446").
5. **Given** the user prefers manual import instead, **When** they select "Import Certificate", **Then** the file picker and password field for a `.p12` file appear (same as existing behavior).

---

### User Story 2C - Import Data Package (Priority: P1)

The user has received a TAK data package (`.zip` file) from their TAK server admin. On the TAK configuration form, there is an "Import Data Package" button at the top. The user clicks it, selects the `.zip` file, and the system extracts and auto-populates the configuration:

- **Trust store** (`.p12` file) — extracted, copied to `data/certs/`, and configured
- **Client certificate** (`.p12` file, if present) — extracted, copied to `data/certs/`, and configured
- **Connection preferences** (`preference.pref` XML) — parsed to auto-fill Description, Address, Port, and Protocol fields

After import, the form is fully populated and the user only needs to review and click "Save" (or "Connect").

**Why this priority**: Data packages are the standard TAK distribution method. In field operations, an admin generates a package per user and distributes it. Importing a single `.zip` is dramatically faster than manually entering all fields + importing certs individually.

**Independent Test**: Can be tested by creating a sample data package `.zip` with a trust store, client cert, and `preference.pref`, importing it, and verifying all form fields are auto-populated.

**Acceptance Scenarios**:

1. **Given** the TAK config form is open, **When** the user clicks "Import Data Package", **Then** a file picker opens filtered to `.zip` files.
2. **Given** the user selects a valid TAK data package `.zip`, **When** the system processes it, **Then** the trust store `.p12` is extracted to `data/certs/` and the Trust Store field is populated.
3. **Given** the data package contains a client certificate `.p12`, **When** the system processes it, **Then** the client cert is extracted to `data/certs/` and the Client Certificate field is populated.
4. **Given** the data package contains a `preference.pref` XML, **When** the system parses it, **Then** the Description, Address, Port, and Protocol fields are auto-filled from the XML `connectString` entries.
5. **Given** the data package is missing a `preference.pref` (certs only), **When** the system processes it, **Then** the certs are imported and the user is prompted to fill in the connection fields manually.
6. **Given** the `.zip` file is not a valid TAK data package (no `manifest.xml`), **When** the system tries to process it, **Then** an error is shown: "Invalid data package — no manifest.xml found".

---

### User Story 3 - TAK Status in TopStatusBar (Priority: P2)

Next to the GPS indicator in the top status bar, a new "TAK Server" indicator appears. When connected, it shows a green dot and the server name. When disconnected, it shows a grey dot. Clicking the indicator opens a dropdown with connection details (when connected) or a "Configure" button (when disconnected) that takes the user to the TAK config view.

**Why this priority**: Quick visibility of TAK connection state is essential during field operations. However, the system works without this — configuration and Overview panel status are sufficient for basic use.

**Independent Test**: Can be tested by checking the top bar for the TAK indicator, verifying it reflects connection state, and testing the dropdown menu with its Configure button.

**Acceptance Scenarios**:

1. **Given** the user is on the dashboard, **When** they look at the top status bar (next to GPS/SATs), **Then** a TAK Server indicator is visible with a status dot.
2. **Given** the TAK client is connected, **When** the user clicks the TAK indicator, **Then** a dropdown shows: server name, IP address, connection uptime, and message count.
3. **Given** the TAK client is disconnected, **When** the user clicks the TAK indicator (grey dot), **Then** a dropdown shows "Not connected" status and a "Configure" button in the middle.
4. **Given** the user clicks "Configure" in the TAK dropdown, **When** the dropdown closes, **Then** the TAK configuration view opens inside the dashboard.

---

### User Story 4 - TAK Status in Overview Panel (Priority: P2)

When the user clicks the Home (Overview) icon on the icon rail, the Overview panel shows a new "TAK SERVER" section. When connected, it displays the server name, IP address, and basic connection statistics. When disconnected, it shows "Not connected" with a button to configure.

**Why this priority**: The Overview panel is the central status hub. Adding TAK status here completes the at-a-glance picture. However, this is supplementary to the TopStatusBar indicator.

**Independent Test**: Can be tested by opening the Overview panel and verifying TAK connection status is displayed correctly in both connected and disconnected states.

**Acceptance Scenarios**:

1. **Given** the TAK client is connected, **When** the user opens the Overview panel, **Then** a "TAK SERVER" section shows: server name, IP, and status "Connected" with a green indicator.
2. **Given** the TAK client is disconnected, **When** the user opens the Overview panel, **Then** the "TAK SERVER" section shows "Not connected" with a grey indicator.
3. **Given** the TAK client is disconnected in Overview, **When** the user clicks the row or a "Configure" link, **Then** the TAK configuration view opens inside the dashboard.

---

### Edge Cases

- What happens when the user types an invalid file path for a truststore? System should show a clear error: "File not found at [path]".
- What happens when a .p12 file is corrupted or not a valid PKCS#12? System should show: "Invalid truststore file".
- What happens when the TAK connection drops mid-session? The TopStatusBar and Overview indicators should update to disconnected state within 5 seconds.
- What happens when the user tries to connect without importing a trust store? The system should show: "Trust store required — import a trust store .p12 file to connect via SSL".
- What happens on a fresh install with no TAK configuration at all? All indicators show "Not configured" and the Configure button is accessible.
- What happens when enrollment credentials are wrong? System shows "Authentication failed — check username and password" and does not retry automatically.
- What happens when the enrollment port (8446) is unreachable? System shows "Enrollment server unreachable at <host>:8446 — verify the server address and that port 8446 is accessible".
- What happens when connecting via Tailscale vs direct? The server address is simply the Tailscale IP (`100.x.y.z`) or MagicDNS hostname instead of a LAN/WAN IP — no protocol or port changes needed.
- What happens when a data package `.zip` contains no `.p12` files? System imports whatever preferences are available and warns: "No certificates found in data package — import trust store and client certificate manually".
- What happens when a data package `.zip` is not a TAK package (random `.zip`)? System checks for `manifest.xml` and shows: "Invalid data package — no manifest.xml found".

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render the TAK configuration form inside the dashboard using the ToolViewWrapper component (same pattern as GSM Evil and Kismet), not as a separate page navigation.
- **FR-002**: The Settings panel "TAK Server" link MUST open the TAK config as an inline dashboard view (setting `activeView` to `'tak-config'`) instead of navigating to `/settings/tak`.
- **FR-003**: System MUST provide a single "Import Trust Store" row with a file picker (Browse button), a text field for typing/pasting the file path, and a password field defaulting to `atakatak`. (TAK Server generates one trust store file per CA — e.g., `truststore-TAK-ID-CA-01.p12`.)
- **FR-004**: System MUST validate that the imported trust store file exists at the specified path and is a valid PKCS#12 (using the provided password) before confirming.
- **FR-005**: System MUST copy the imported trust store file into the Argos-managed `data/certs/` directory and store the copied file path in the TAK configuration so it persists across restarts (original source path is not retained).
- **FR-006**: System MUST display a TAK Server status indicator in the TopStatusBar, positioned after the GPS/SATs indicator.
- **FR-007**: The TAK indicator MUST show a dropdown on click with connection details (when connected) or a "Configure" button (when disconnected).
- **FR-008**: System MUST display TAK connection status in the Overview panel as a new section.
- **FR-009**: The TAK status (connected/disconnected) MUST update reactively from the existing `takStatus` store without additional polling. When the WebSocket connection to TakService drops, indicators MUST reflect disconnected state within 5 seconds.
- **FR-010**: The "Configure" button in both the TopStatusBar dropdown and Overview panel MUST open the TAK config view inside the dashboard.
- **FR-011**: System MUST provide two client authentication methods: "Enroll for Certificate" and "Import Certificate", selectable via radio buttons or toggle. (Note: Protocol is always SSL as per `node-tak` library constraints).
- **FR-012**: When "Enroll for Certificate" is selected, system MUST show username, password, and enrollment port (default `8446`) fields.
- **FR-013**: System MUST call the TAK server enrollment API (`POST https://<host>:<enrollmentPort>/Marti/api/tls/signClient/v2`) with HTTP Basic Auth using the provided username/password.
- **FR-014**: On successful enrollment, system MUST store the received client certificate `.p12` in `data/certs/` and automatically configure it in the TAK connection settings.
- **FR-015**: The TAK configuration form MUST include a "Description" field (user-defined server label) displayed in status indicators.
- **FR-016**: Each client certificate import row (manual mode) MUST include a password field defaulting to `atakatak`.
- **FR-017**: System MUST provide an "Import Data Package" button that accepts a TAK data package `.zip` file.
- **FR-018**: System MUST extract `.p12` files (trust store and client cert) from the data package, copy them to `data/certs/`, and configure them automatically.
- **FR-019**: System MUST parse `preference.pref` XML from the data package to auto-fill Description, Address, Port, and Protocol fields (extracting `connectString` entries in format `<host>:<port>:<protocol>`).
- **FR-020**: System MUST validate the data package contains a `manifest.xml` before processing; if missing, show an error.

### Key Entities

- **TAK Configuration**: Description (user label), hostname/IP, port (default 8089), protocol (SSL), client cert path + password (default `atakatak`), trust store path + password (default `atakatak`), connect-on-startup flag, auth method (enroll/import), enrollment credentials (username, password, enrollment port 8446) when using certificate enrollment.
- **TAK Connection Status**: Connected/disconnected/error state, server name, server IP, uptime, message statistics. Sourced from existing `takStatus` store.
- **Trust Store File**: A single PKCS#12 (.p12) file (e.g., `truststore-TAK-ID-CA-01.p12`) containing the CA certificate chain needed to verify the TAK Server's TLS certificate. TAK Server generates one trust store per CA. On import, the file is copied into `data/certs/` and the managed copy path is stored in configuration.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can access TAK configuration from the dashboard without any page navigation — the view loads inline with a working back button.
- **SC-002**: Users can import a trust store `.p12` file using either file picker or text path input, and the system validates and confirms the import.
- **SC-003**: TAK connection status is visible in the top status bar at all times, updating within 5 seconds of connection state changes.
- **SC-004**: Users can reach the TAK configuration from 3 entry points: Settings panel, TopStatusBar dropdown, and Overview panel — all opening the same inline view.
- **SC-005**: The entire TAK configuration workflow (open form, import truststores, save config) can be completed without ever leaving the dashboard.
- **SC-006**: Users can enroll for a client certificate by entering username/password against the TAK server's enrollment API, and the certificate is automatically stored and configured.
- **SC-007**: Users can import a TAK data package `.zip` and have all connection fields + certificates auto-populated, requiring only a review and "Save" click.

## Clarifications

### Session 2026-02-17

- Q: Should Argos copy truststore files into a managed directory or just store the original path? → A: Copy file into Argos-managed `data/certs/` directory and reference the copy.
- Q: Do PKCS#12 truststore files require a password, and should the UI include a password field? → A: Yes, password field with default `atakatak` (standard TAK ecosystem default). Same default applies to client cert `.p12` files.
- Q: Should Phase 2 include client certificate enrollment or only manual import? → A: Both — full ATAK-like experience with "Enroll for Certificate" toggle and "Import Certificate" fallback, matching ATAK/WinTAK workflow.
- Q: Should the UI distinguish between Direct vs Tailscale connection modes? → A: No — single address field. The user knows which IP/hostname to use for their network (LAN, Tailscale, WAN).
- Q: Should the DB migration add columns to the existing `tak_configs` table or drop/recreate? → A: Add columns (ALTER TABLE). Consistent with project migration pattern (`002_add_altitude_column.sql`), migration runner gracefully handles duplicate columns, and preserves any existing config data.
- **Research correction**: Original spec assumed two separate truststore files (intermediate + root). Verified via TAK Server 5.2 docs, OpenTAKServer docs, and community guides that TAK Server generates **one trust store file** per CA (e.g., `truststore-TAK-ID-CA-01.p12`). ATAK has a single "Import Trust Store" button. Spec corrected to single trust store import.

## Constraints

- **DB Migration**: Use additive `ALTER TABLE ADD COLUMN` migration (new TypeScript migration file e.g. `src/lib/server/db/migrations/20260218_extend_tak_configs.ts`) to add: `truststore_path`, `truststore_password` (default 'atakatak'), `client_cert_password` (default 'atakatak'), `auth_method` (CHECK: 'enroll'/'import'), `enrollment_username`, `enrollment_password`, `enrollment_port` (default 8446). Do NOT drop/recreate the table.
- **Single Address Field**: One text input for server hostname/IP. No Tailscale vs Direct mode selector.

## Reference: ATAK Connection Form Fields (Verified)

The Argos TAK configuration form should mirror the standard ATAK/WinTAK connection UI:

| Field                         | Type            | Default              | Notes                                            |
| ----------------------------- | --------------- | -------------------- | ------------------------------------------------ |
| Description                   | text            | —                    | User-defined label (e.g., "Unit TAK Server")     |
| Address                       | text            | —                    | IP or hostname (LAN, Tailscale, WAN)             |
| Use Authentication            | checkbox        | unchecked            | Reveals username/password for enrollment         |
| Enroll for Client Certificate | checkbox        | unchecked            | Triggers enrollment via port 8446                |
| Streaming Protocol            | dropdown        | SSL                  | SSL only (TCP deprecated)                         |
| Server Port                   | number          | 8089                 | Primary CoT streaming port                       |
| Import Trust Store            | file + password | password: `atakatak` | Single `.p12` file for CA chain                  |
| Import Client Certificate     | file + password | password: `atakatak` | Manual `.p12` import (alternative to enrollment) |
| Connect on Startup            | checkbox        | unchecked            | Auto-connect when Argos starts                   |

**TAK Server Ports** (for reference):

- `8089` — TLS streaming (primary client connection)
- `8443` — Web UI / WebTAK (HTTPS)
- `8446` — Certificate enrollment API (HTTPS)

**Sources**: [OpenTAKServer Docs](https://docs.opentakserver.io/certificate_enrollment.html), [MordeKyle ATAK Guide](https://www.mordekyle.com/tak-server/atak), [myTeckNet TAK Server Guide](https://mytecknet.com/lets-build-a-tak-server/), [TAK Server Config Guide v5.2](https://static1.squarespace.com/static/5404b7d2e4b0feb6e5d9636b/t/6756e17b053bbe305668a08f/1733747077204/TAK_Server_Configuration_Guide_5.2.pdf)

## Assumptions

- The existing `/api/tak/config` and `/api/tak/certs` API endpoints will be extended (not replaced) to support truststore imports alongside client certificates.
- The existing `takStatus` Svelte store already receives connection state updates via WebSocket broadcast from TakService — no new status mechanism is needed.
- Truststore files are standard PKCS#12 format and can be validated using the existing `openssl` toolchain in CertManager.
- The separate `/settings/tak` page route will be kept but deprioritized (it may be removed or redirected in a future cleanup).

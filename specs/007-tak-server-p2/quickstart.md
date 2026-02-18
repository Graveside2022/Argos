# Quickstart: TAK Server Integration Phase 2

## For Users

1.  **Dashboard Configuration**: Open the **Settings** panel from the dashboard and click **TAK Server**. The configuration form will open inline without a page reload.
2.  **Truststore Setup**: If your server uses a custom CA, click **Import Truststore** and select the `.p12` file provided by your admin. Use the password (default: `atakatak`).
3.  **Authentication**: 
    -   **Manual**: Choose **Import Certificate** to upload a client `.p12`.
    -   **Automated**: Choose **Enroll for Certificate**, enter your username and password, and click **Enroll**. Argos will fetch the certificate automatically.
4.  **One-Click Import**: If you have a TAK Data Package (`.zip`), click **Import Data Package** at the top of the form. Argos will extract everything and auto-fill the form.
5.  **Status Monitoring**: 
    -   Check the **TopStatusBar** (next to GPS) for real-time connection status.
    -   Click the indicator to see details (uptime, messages).
    -   Use the **Overview** panel (Home icon) for a summary of the TAK connection.

## For Developers

### Setup
Run the following to install the unified TAK library:
```bash
npm install https://github.com/dfpc-coe/node-tak
```

### New Components
- `src/lib/components/dashboard/tak/TakConfigForm.svelte`: The main configuration UI.
- `src/lib/components/dashboard/views/TakConfigView.svelte`: The wrapper for inline dashboard display.
- `src/lib/components/status/TAKIndicator.svelte`: Top bar widget.

### Logic Changes
- **DELETED**: `src/lib/server/tak/TakClient.ts` (replaced by node-tak).
- `TakService.ts`: Now leverages `@tak-ps/node-tak` for connection management.

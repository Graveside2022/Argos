# Quickstart: MIL-STD-2525 & TAK Integration

## Prerequisites

- Node.js 22.x
- Argos dev environment (`npm install`)
- Access to a TAK Server (or mock)
- A valid `.p12` certificate for the TAK Server

## Installation

1.  **Install Dependencies**:
    ```bash
    npm install @missioncommand/mil-sym-ts @tak-ps/node-tak
    ```
2.  **Create Cert Directory**:
    ```bash
    mkdir -p data/certs
    chmod 700 data/certs
    ```

## Configuration

1.  **Start Development Server**:
    ```bash
    npm run dev
    ```
2.  **Navigate to Settings**:
    - Open `http://localhost:5173/settings/tak`.
3.  **Upload Certificate**:
    - Select your `.p12` file.
    - Enter the password.
    - Click "Upload & Verify".
4.  **Configure Server**:
    - Host: `tak-server.example.com`
    - Port: `8089` (default for TLS)
    - Protocol: `TLS`
    - Click "Save & Connect".

## Verification

### 1. Symbol Rendering

- Go to the **Map** tab.
- Ensure "Military Symbols" layer is enabled.
- Simulate a WiFi detection (or wait for one).
- **Verify**: The dot is replaced by a MIL-STD-2525 symbol (e.g., Sensor/Antenna icon).

### 2. TAK Connectivity

- Check the status indicator in the top right. It should say "TAK: Connected" (Green).
- **Outbound**: When a new WiFi network is found, check your ATAK/WebTAK client. A marker should appear.
- **Inbound**: Create a "Hostile" point in ATAK.
- **Verify**: The point appears on the Argos map as a Red Diamond.

### 3. Satellite Map

- Open Map Settings (Gear Icon).
- Select "Satellite Hybrid".
- **Verify**: The background changes to Google Maps imagery.

## Troubleshooting

- **Connection Refused**: Check if the TAK server allows your IP.
- **Certificate Error**: Verify the `.p12` password and that the CA is trusted.
- **Symbols Missing**: Check browser console for `@missioncommand/mil-sym-ts` errors.

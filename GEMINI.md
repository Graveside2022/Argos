# Project: Argos Console

## Project Overview

Argos is a comprehensive application designed for real-time spectrum analysis, WiFi intelligence, GPS tracking, and tactical mapping. It is primarily intended to run on a Raspberry Pi 5 (8GB RAM recommended) or other Linux x86_64 systems, utilizing Kali Linux or Parrot OS.

The core of Argos is a SvelteKit application that runs natively on the host system. It integrates with various native RF tools like Kismet (for WiFi scanning), HackRF (for spectrum analysis), and gpsd (for GPS data). For third-party tools with complex dependencies, such as OpenWebRX (SDR web interface) and Bettercap (network reconnaissance), Argos leverages Docker containers.

The project emphasizes a native-first approach for core functionalities while using Docker strategically for isolated and on-demand tools.

## Building and Running

### Prerequisites

- **Hardware:** Raspberry Pi 5 (8GB RAM recommended) or Linux x86_64. A USB 3.0 powered hub is required for multiple RF devices (HackRF, Alfa WiFi adapter, GPS dongle).
- **Operating System:** Kali Linux 2025.4 or Parrot OS 7.1 (Debian-based).
- **Software:**
    - Node.js 22.x (LTS)
    - npm 10.x
    - Git

### Initial Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd Argos
    ```
2.  **Automated Host Setup (Recommended):**
    This script installs Node.js, Kismet, gpsd, Docker, udev rules, npm dependencies, and generates the `.env` file.
    ```bash
    sudo bash scripts/ops/setup-host.sh
    ```
3.  **Manual Host Setup (Alternative):**
    ```bash
    npm ci
    cp .env.example .env
    # Edit .env to set ARGOS_API_KEY (min 32 chars) and service passwords.
    ```
4.  **Database Migration:**
    ```bash
    npm run db:migrate
    ```

### Development Server

To start the development server:

```bash
npm run dev
# Access the application at: http://localhost:5173/
```

To clean up previous development processes and restart:

```bash
npm run dev:clean
```

### Production Deployment

1.  **Build for Production:**
    ```bash
    npm run build
    node build
    ```
2.  **Install Systemd Services:**
    ```bash
    sudo bash scripts/ops/install-services.sh
    ```
3.  **Start Services:**
    ```bash
    sudo systemctl start argos-final
    sudo systemctl start argos-kismet
    ```
4.  **Access:** The application will be accessible at `http://<your-device-ip>:5173/`.
    Ensure production `.env` variables are correctly configured, including `NODE_ENV=production` and `ARGOS_API_KEY`.

### Dockerized Third-Party Tools

To start specific Docker-based tools:

- **OpenWebRX:**
    ```bash
    docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d openwebrx
    ```
- **Bettercap:**
    ```bash
    docker compose -f docker/docker-compose.portainer-dev.yml --profile tools up -d bettercap
    ```
    These services can be managed via Portainer at `https://<your-pi-ip>:9443`.

## Development Conventions

### Code Quality

- **Linting:**
    - Check for linting errors: `npm run lint`
    - Automatically fix linting errors: `npm run lint:fix`
    - Uses ESLint configured via `config/eslint.config.js`.
- **Type Checking:**
    - Validate TypeScript: `npm run typecheck`
    - Uses SvelteKit's `svelte-check`.
- **Formatting:**
    - Format code: `npm run format`
    - Check formatting: `npm run format:check`
    - Uses Prettier.

### Testing

- **All Tests:** `npm run test` (runs Vitest)
- **Unit Tests:** `npm run test:unit`
- **Integration Tests:** `npm run test:integration`
- **Security Tests:** `npm run test:security`
- **End-to-End (E2E) Tests:** `npm run test:e2e` (runs Playwright tests)
- **Visual Tests:** `npm run test:visual`
- **Performance Tests:** `npm run test:performance`
- **Test Coverage:** `npm run test:coverage`
- **Watch Mode:** `npm run test:watch`
- **UI Mode:** `npm run test:ui`

### Pre-commit Hooks

The project utilizes Husky for Git pre-commit hooks, likely enforcing code quality checks on staged files via `lint-staged`. Run `npm install` and `npm prepare` to ensure hooks are installed.

### Database

- **Run Migrations:** `npm run db:migrate`
- **Rollback Migrations:** `npm run db:rollback`
- **Reset Database:** `rm rf_signals.db && npm run db:migrate`

## Active Technologies
- SQLite (`rf_signals.db`) - `tak_configs` table. (007-tak-server-p2)
- TypeScript 5.x (Strict Mode) + SvelteKit, Tailwind CSS, SQLite (better-sqlite3), `@tak-ps/node-tak` (via GitHub), `@xmldom/xmldom`, `openssl` (system) (007-tak-server-p2)

- TypeScript 5.x (Strict Mode) (005-milsymbol-tak-integration)

## Recent Changes

- 005-milsymbol-tak-integration: Added TypeScript 5.x (Strict Mode)

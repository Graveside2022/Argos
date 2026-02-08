# GEMINI Reference: Argos Project

This document provides a comprehensive overview of the Argos project, its architecture, and development practices, intended to serve as a guide for AI-driven development.

## 1. Project Overview

Argos is a real-time spectrum analysis, WiFi intelligence, GPS tracking, and tactical mapping console designed to run on a Raspberry Pi. It provides a web-based user interface to control and visualize data from various software-defined radio (SDR) and network analysis tools.

**Core Technologies:**

- **Frontend:** SvelteKit with Svelte 5, styled with Tailwind CSS.
- **Build Tool:** Vite.js.
- **Language:** TypeScript.
- **Backend Services:** A mix of Node.js (within SvelteKit) and a Python/Flask backend for HackRF control.
- **Containerization:** Docker and Docker Compose, managed via Portainer.
- **AI Agent:** A natural language interface (AG-UI) using either online (Anthropic Claude) or offline (Ollama) large language models to control the system's tools.

**Key Features:**

- **Web UI:** A dashboard for real-time data visualization, including maps, spectrum analysis, and network device lists.
- **Hardware Integration:** Connects to and controls hardware like the HackRF One (SDR), Alfa WiFi adapters, and USB GPS dongles.
- **Toolchain:** Integrates with tools like Kismet (WiFi scanning), Bettercap (network recon), and custom scripts for GSM analysis.
- **AI Control:** Allows operators to use natural language commands (e.g., "Scan for WiFi networks") to execute complex tasks.

## 2. Architecture

Argos uses a multi-container architecture managed by Docker Compose.

- **`argos` service:** The main SvelteKit application. It runs in `network_mode: host` to directly access network interfaces on the host machine for tools like Kismet. It also has access to the Docker socket to manage other containers.
- **`hackrf-backend` service:** A Python/Flask API that directly controls the HackRF One SDR for spectrum analysis.
- **`openwebrx` & `bettercap` services:** On-demand containers that can be started by the Argos UI for specific tasks. These are defined with `profiles: ["tools"]` so they don't start by default.

A critical design pattern is the interaction between the `argos` container and the host Raspberry Pi. The frontend container executes commands on the host OS using `nsenter` to run tools like `aircrack-ng` or `gr-gsm` that are installed on the host, not inside the container.

## 3. Development Environment

### Quick Start

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Graveside2022/Argos.git
    cd Argos
    ```
2.  **Install Host Dependencies:** The `scripts/setup-host.sh` script installs Docker, Portainer, and configures `gpsd`. It only needs to be run once.
    ```bash
    sudo bash scripts/setup-host.sh
    ```
3.  **Install Node.js Dependencies:**
    ```bash
    npm install
    ```
4.  **Configure Environment:** Copy the example `.env` file. You may need to add API keys for the AI agent feature.
    ```bash
    cp .env.example .env
    ```
5.  **Run the Dev Server:**
    ```bash
    npm run dev
    ```
6.  **Access the Application:** The UI is available at `http://<your-pi-ip>:5173`.

### Key Scripts (`package.json`)

- `npm run dev`: Starts the full development server, including auto-start scripts for hardware services.
- `npm run dev:simple`: Starts the dev server without auto-starting hardware services.
- `npm run build`: Creates a production build of the SvelteKit application.
- `npm run test`: Runs the full test suite (Vitest and Playwright).
- `npm run lint`: Checks for code style issues with ESLint.
- `npm run format`: Formats the codebase with Prettier.
- `npm run db:migrate`: Applies database migrations (the project uses SQLite).

### Docker Deployment

For a production-like environment, the system is deployed as a "Stack" in Portainer using the `docker/docker-compose.portainer-dev.yml` file. The `scripts/setup-host.sh` script handles the initial setup of Portainer and the required Docker images.

## 4. Development Conventions

- **Code Style:** The project enforces a consistent code style using **ESLint** and **Prettier**. A pre-commit hook is configured via Husky and `lint-staged` to automatically format and lint files before committing.
- **Testing:**
    - **Unit & Integration Tests:** Written using **Vitest**. Test files are located in the `tests/` directory.
    - **End-to-End (E2E) Tests:** Written using **Playwright**.
- **AI Agent (AG-UI):** The agent-based control system is a core feature.
    - It uses the Model-Context-Protocol (MCP) to define and execute tools.
    - It supports both an online mode (Anthropic Claude API) for high-quality responses and an offline mode (Ollama with a local model like Llama 3.2) for disconnected environments.
    - Safety is handled through a "human-in-the-loop" approval flow for any tools categorized as disruptive or attack-related.

This `GEMINI.md` provides the necessary context to understand and contribute to the Argos project.

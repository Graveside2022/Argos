# KasmVNC / Kasm Workspaces — Technical Evaluation for Argos

**Date**: 2026-04-12
**Target**: Raspberry Pi 5 (8GB RAM, ARM64/aarch64, Kali Linux)
**Use case**: Embedding an isolated browser session in SvelteKit dashboard, LAN-only military training

---

## 1. System Requirements and ARM64 Support

### KasmVNC (standalone VNC server)

- Lightweight native binary; .deb packages published for Debian, Ubuntu, **and Kali Linux** (ARM64)
- Runs on any Linux with X11; no Docker required
- Minimal overhead — it is just a VNC server process

### Kasm Workspaces (full platform)

- **Minimum**: 2 CPU cores, 4GB RAM, 50GB SSD
- **Officially supports**: Raspberry Pi OS (Debian) 11/12 (arm64) — RPi is a first-class target
- Also supports Ubuntu 22.04/24.04, Debian 11/12, RHEL 8/9, AlmaLinux, Rocky (all arm64)
- Kali Linux is NOT in the official supported OS list for the platform installer, but the underlying Docker images and KasmVNC itself do support Kali
- Requires Docker for session containers

### Verdict for RPi 5 (8GB)

The platform infrastructure (API server, PostgreSQL, Redis, manager) consumes ~2GB RAM baseline. That leaves ~6GB for sessions plus the rest of the system. Running the full Kasm Workspaces platform on an RPi 5 that already hosts Argos (baseline ~4.5GB) is **not feasible** — there is not enough headroom. Standalone KasmVNC or a single standalone container is the realistic path.

---

## 2. Embedding in a Web Page

### Kasm Workspaces Platform (full)

- **Developer API**: REST API to programmatically create/destroy sessions, get session URLs
- **Casting**: Generate authenticated or unauthenticated session URLs accessible via simple link or iframe
- **Embedding**: "Simply drop in an iframe or a link to a streamed app" (official docs)
- Provides a Flask example app showing backend integration
- SSO via SAML, group-based policies, web filtering, shared sessions

### KasmVNC Standalone / Docker Standalone

- Each standalone container exposes a web client on port 6901 (HTTPS)
- Embed via iframe: `<iframe src="https://host:6901" />`
- No orchestration API — you manage the Docker container lifecycle yourself
- The web client is a full-page HTML5 app; works in iframe but no JS embedding API
- CSP considerations: KasmVNC serves its own pages, so your SvelteKit CSP must allow `frame-src` for the KasmVNC origin

### Recommended approach for Argos

Run a single standalone Kasm container (e.g., `kasmweb/chromium`) and embed via iframe. Manage its lifecycle with Docker commands from Node.js (start/stop/restart). No need for the full Workspaces platform.

---

## 3. KasmVNC (Open Source) vs Kasm Workspaces (Platform)

| Aspect            | KasmVNC                                                     | Kasm Workspaces                                                                                                         |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **What it is**    | VNC server binary (fork of TigerVNC)                        | Full container streaming platform                                                                                       |
| **License**       | GPLv2 (truly open source)                                   | Proprietary (Community/Pro/Enterprise)                                                                                  |
| **Components**    | VNC server + built-in HTML5 web client                      | API server, manager, PostgreSQL, Redis, agents, proxy, session containers                                               |
| **Orchestration** | None — single server/session                                | Multi-user, multi-session, auto-scaling, load balancing                                                                 |
| **Features**      | WebP/JPEG encoding, WebRTC, clipboard, DLP, dynamic quality | All KasmVNC features + user management, SSO, web filtering, casting, session recording, persistent profiles, S3 storage |
| **Docker images** | Used inside workspace images as the display server          | Orchestrates workspace images with KasmVNC inside                                                                       |
| **Deployment**    | Install .deb or run standalone Docker container             | Full installer script (`kasm_release.tar.gz`)                                                                           |

### Key insight

KasmVNC is the rendering engine inside every Kasm Workspaces container. You can use it independently. The workspace Docker images (kasmweb/chromium, kasmweb/firefox, etc.) are open-source and can run standalone without the Workspaces platform.

---

## 4. Memory Footprint of a Single Browser Container

### From Kasm sizing guide (platform defaults)

- Default workspace allocation: **2 CPUs, 4GB RAM** per session (browser workspace)
- This is configurable — administrators can lower it
- Oversubscription is supported (e.g., 4x CPU oversubscription for typical office workloads)

### Realistic standalone measurement

- A standalone Chromium container with `--shm-size=512m` typically uses:
    - **Idle**: ~350-500MB RSS (Chromium + Xvfb + KasmVNC + window manager)
    - **Active browsing**: ~600MB-1.2GB depending on page complexity
    - **Heavy pages**: Can spike to 1.5GB+
- Firefox tends to use slightly less than Chromium

### For RPi 5 with Argos

Given Argos baseline of ~4.5GB, you have ~3.5GB free. A single browser container at 512MB-1GB is feasible but tight. You would need to:

- Set `--memory=1g` hard limit on the container
- Use `--shm-size=256m` (minimum for Chromium)
- Kill Chromium debug instance (408MB) and any non-essential processes first
- Consider Firefox over Chrome (lower memory)

---

## 5. Auto-Launching a Specific URL

**Yes, fully supported.** Environment variable at container launch:

```bash
docker run --rm -it --shm-size=512m -p 6901:6901 \
  -e VNC_PW=password \
  -e LAUNCH_URL=https://your-target-url.local \
  kasmweb/chromium:1.16.0
```

Additional env vars:

- `APP_ARGS` — extra browser CLI arguments
- `KASM_RESTRICTED_FILE_CHOOSER` — confine file dialogs to ~/Desktop (on by default)

This means Argos can launch a container pre-configured to open WebTAK, OpenWebRX, or any other LAN service automatically.

---

## 6. Offline / LAN-Only Operation

### KasmVNC standalone and Docker images

- **Fully offline-capable** once Docker images are pre-pulled
- No license server, no phone-home, no cloud dependency
- All rendering happens locally — just WebSocket/WebRTC between browser and server

### Kasm Workspaces platform

- **Installation requires Docker registry access** (pulls platform containers during install)
- Once installed, operates offline — no ongoing internet requirement
- Community Edition has no license server or activation requirement
- For air-gapped deployment: pre-pull all images on an internet-connected machine, `docker save` them, transfer to the target, `docker load`

### Deployment strategy for Argos

1. Pre-pull `kasmweb/chromium:aarch64-1.16.0` on an internet-connected ARM64 machine (or cross-pull)
2. `docker save kasmweb/chromium:aarch64-1.16.0 > chromium-arm64.tar`
3. Transfer to RPi 5 via USB/SCP
4. `docker load < chromium-arm64.tar`
5. Fully operational on LAN with zero internet

---

## 7. Docker Image Sizes for ARM64

From Docker Hub (compressed sizes):

| Image                     | ARM64 Compressed | AMD64 Compressed | Notes                           |
| ------------------------- | ---------------- | ---------------- | ------------------------------- |
| `kasmweb/chromium:1.16.0` | **1.1 GB**       | 1.24 GB          | Multi-arch manifest available   |
| `kasmweb/chromium:1.17.0` | **1.05 GB**      | 1.19 GB          | Newer, slightly smaller         |
| `kasmweb/chrome`          | **amd64 only**   | 1.27 GB          | Google Chrome — NO ARM64 builds |
| `kasmweb/firefox`         | ~1.0 GB (est.)   | ~1.1 GB          | ARM64 available for some tags   |

**Critical finding**: Google Chrome (`kasmweb/chrome`) is **amd64 only** — no ARM64 builds. You must use **Chromium** (`kasmweb/chromium`) on RPi 5, which does have ARM64 builds.

Decompressed image size will be ~2.5-3GB on disk. With the 500GB NVMe this is not a concern.

Many desktop images (Ubuntu, Kali, etc.) also have ARM64 builds. The custom images documentation has a full support matrix.

---

## 8. Latency and User Experience

### Encoding pipeline

- **WebP** (default): 30% better compression than JPEG; good for static content
- **JPEG** (via libjpeg-turbo, statically linked): fast encoding, used when CPU is constrained
- **Dynamic mixing**: Automatically switches between WebP and JPEG based on server CPU load
- **Dynamic quality**: Adjusts compression quality based on screen change rate (motion = lower quality, static = higher quality)
- **QOI (Quite OK Image)**: Lossless format specifically for LAN use — best quality when bandwidth is not a constraint
- **Full-screen video mode**: Detects full-screen video playback and switches to optimized video encoding

### Transport

- **WebRTC (UDP)**: Lower latency, preferred when available
- **WebSocket (TCP)**: Fallback, always works
- **Multi-threaded encoding**: Scales with available CPU cores

### H.264

- KasmVNC does NOT use H.264 encoding — it uses WebP/JPEG/QOI frame-based encoding
- This is actually better for RPi 5 since there is no hardware H.264 encoder on the VideoCore VII that KasmVNC could use anyway
- The CPU-based WebP/JPEG encoding is well-optimized and works on ARM64

### Performance on RPi 5

- Cortex-A76 cores are capable — multi-threaded encoding will use all 4 cores
- LAN scenario with QOI lossless mode will give excellent visual quality
- Expect 20-30fps for typical desktop use, dropping during heavy page reflows
- Latency: typically <50ms on LAN (WebRTC), <100ms (WebSocket)

---

## 9. Project Activity

### KasmVNC (kasmtech/KasmVNC)

- **Stars**: 4,900+
- **Forks**: 420+
- **Commits**: 1,442 on master
- **Last activity**: Active — rolling daily images pushed within the last 14 hours
- **Releases**: Regular cadence (1.16.0, 1.17.0, 1.18.0 all have recent rolling builds)

### Kasm Workspaces Images (kasmtech/workspaces-images)

- **Stars**: 1,100+
- **Forks**: 327
- **Commits**: 535 on develop
- **Docker Hub**: 10M+ pulls for Chrome image, 1M+ for Chromium
- **Daily builds**: `kasmdockerbot` pushes rolling-daily images every day

### Assessment

Very active project backed by a commercial company (Kasm Technologies, McLean VA). Not a hobbyist project — this is their core product. Strong community adoption.

---

## 10. Licensing

### KasmVNC

- **GPLv2** — fully open source, free for any use including commercial/military
- No restrictions on deployment, modification, or distribution (under GPL terms)
- No CLA or dual-licensing concerns

### Kasm Workspaces Community Edition

- **Free** for individuals and non-profit organizations
- Businesses can use it to "test the platform" (evaluation)
- "Nearly all the same features as paid versions"
- Community-based support only (no SLA)
- **No explicit statement** that CE is free for commercial/production use by businesses
- Professional and Enterprise editions are paid with commercial support

### Workspace Docker Images

- Source code on GitHub under open-source license
- Images on Docker Hub are freely pullable
- Can be used standalone without the Workspaces platform

### For military training (Argos)

- **KasmVNC itself**: GPLv2, no licensing concern whatsoever
- **Standalone Docker images**: Open source, freely usable
- **Kasm Workspaces CE**: Ambiguous for government/military production use — would need clarification from Kasm Technologies if using the full platform
- **Recommendation**: Use standalone Docker images (not the platform) to avoid any licensing ambiguity

---

## 11. Standalone KasmVNC Without Full Platform

### Option A: Standalone Docker Container (RECOMMENDED for Argos)

The simplest and lightest approach. No platform infrastructure needed.

```bash
# Pull ARM64 Chromium image (do this on internet-connected machine)
docker pull kasmweb/chromium:aarch64-1.16.0-rolling-daily

# Run standalone — auto-launches a URL
docker run -d --name kasm-browser \
  --shm-size=256m \
  --memory=1g \
  --cpus=2 \
  -p 6901:6901 \
  -e VNC_PW=argos \
  -e LAUNCH_URL=https://webtak.local:8443 \
  kasmweb/chromium:aarch64-1.16.0-rolling-daily

# Access at https://rpi5:6901 (or embed in iframe)
```

**Pros**: Simple, low overhead (~350-500MB idle), no platform services, fully offline, open source
**Cons**: No orchestration API, no multi-user management, no session recording, manual container lifecycle

### Option B: KasmVNC Native (without Docker)

Install KasmVNC directly on the RPi 5 and run a browser natively.

```bash
# Install KasmVNC .deb for Kali (arm64)
sudo dpkg -i kasmvncserver_*.deb

# Start VNC server
kasmvncserver :1 -geometry 1280x720

# Opens a VNC session on port 8443 by default
# Run chromium inside the VNC session
DISPLAY=:1 chromium --no-sandbox --start-maximized https://webtak.local:8443
```

**Pros**: Zero Docker overhead, smallest footprint, direct hardware access
**Cons**: No container isolation, browser crashes affect host, more manual setup, no LAUNCH_URL env var (must script it)

### Option C: Full Kasm Workspaces CE

NOT recommended for RPi 5 with Argos. Platform overhead (~2GB) plus session container (~1GB) would consume nearly all available RAM alongside Argos.

---

## 12. Recommendation for Argos

**Use Option A (Standalone Docker Container)** with `kasmweb/chromium` ARM64 image.

### Integration plan

1. Pre-pull and save the ARM64 Chromium image for air-gapped deployment
2. Add a SvelteKit API route (`/api/kasm/`) to manage the container lifecycle (start/stop/status)
3. Embed via iframe in the dashboard with `LAUNCH_URL` pointing to WebTAK or target service
4. Set `--memory=1g --cpus=2 --shm-size=256m` resource limits
5. Use the existing Docker socket (already used for OpenWebRX and Bettercap)
6. Authentication: use VNC_PW or put behind Argos auth proxy

### Resource budget

| Component               | RAM             |
| ----------------------- | --------------- |
| Argos baseline          | ~4.5 GB         |
| Kasm Chromium container | ~0.5-1.0 GB     |
| System/kernel           | ~0.5 GB         |
| **Total**               | **~5.5-6.0 GB** |
| **Headroom**            | **~2.0-2.5 GB** |

This is workable but not generous. Consider stopping the container when not actively needed.

### Alternatives worth noting

- **n.eko** (m1k1o/neko): Similar concept, WebRTC-based, lighter weight, has ARM64 support, Apache 2.0 license. Better for shared viewing scenarios.
- **noVNC + headless Chromium**: Even lighter but no built-in DLP, clipboard, or dynamic encoding features.

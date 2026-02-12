# Tmux Terminal Profiles

## Overview

Argos provides 4 independent tmux sessions for parallel terminal workflows. Each profile creates an isolated, persistent shell session that survives WebSocket reconnections and maintains command history.

## Architecture

- **Location**: `scripts/tmux/`
- **Shell**: ZSH with Oh My Zsh + Powerlevel10k theme
- **Terminal Support**: 256-color, UTF-8 enabled
- **Session Persistence**: Tmux sessions persist across browser refreshes
- **Container Integration**: Works in both Docker container (`/app`) and host environment

## Available Profiles

### Profile 0: Default Session (`tmux-0`)

```bash
scripts/tmux/tmux-0.sh
```

- **Session Name**: `tmux-0`
- **Purpose**: Primary development work
- **VS Code Integration**: Default terminal profile
- **Legacy Compatibility**: Replaces `argos-claude` session from `tmux-zsh-wrapper.sh`

### Profile 1: Secondary Session (`tmux-1`)

```bash
scripts/tmux/tmux-1.sh
```

- **Session Name**: `tmux-1`
- **Purpose**: Application monitoring, log viewing, or parallel task execution
- **Note**: Application-use profile (do not modify)

### Profile 2: Testing Session (`tmux-2`)

```bash
scripts/tmux/tmux-2.sh
```

- **Session Name**: `tmux-2`
- **Purpose**: Running tests, benchmarks, or continuous integration tasks

### Profile 3: Hardware Session (`tmux-3`)

```bash
scripts/tmux/tmux-3.sh
```

- **Session Name**: `tmux-3`
- **Purpose**: Hardware operations (HackRF, Kismet, GSM Evil), device diagnostics

## Common Features

All profiles share the following configuration:

```bash
TMUX_SESSION="tmux-X"  # X = 0, 1, 2, or 3

# Auto-detect environment and set working directory
if [ -d "/app" ]; then
    cd /app || exit 1              # Inside Docker container
else
    cd /home/kali/Documents/Argos/Argos || exit 1  # On host
fi

# Terminal capabilities
export TERM=xterm-256color
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# Launch tmux with:
# -A: Attach to existing session if it exists, create new if it doesn't
# -s: Session name (tmux-X)
# -2: Force 256-color support
# -u: Force UTF-8 support
exec tmux -2 -u new-session -A -s "${TMUX_SESSION}" zsh
```

## Usage

### VS Code Terminal Profiles

Configure in `.vscode/settings.json`:

```json
{
	"terminal.integrated.profiles.linux": {
		"Tmux 0 (Default)": {
			"path": "/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-0.sh"
		},
		"Tmux 1": {
			"path": "/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-1.sh"
		},
		"Tmux 2": {
			"path": "/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-2.sh"
		},
		"Tmux 3": {
			"path": "/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-3.sh"
		}
	},
	"terminal.integrated.defaultProfile.linux": "Tmux 0 (Default)"
}
```

### Dashboard Terminal (Port 3001)

The Argos dashboard uses `tmux-zsh-wrapper.sh` by default via the terminal store:

```typescript
// src/lib/stores/terminal-store.ts
const defaultShell = '/home/kali/Documents/Argos/Argos/scripts/tmux/tmux-zsh-wrapper.sh';
```

This creates the `argos-claude` session for browser-based terminal access.

### Manual Session Management

```bash
# List all tmux sessions
tmux ls

# Attach to specific session
tmux attach -t tmux-0
tmux attach -t tmux-1
tmux attach -t tmux-2
tmux attach -t tmux-3

# Kill specific session
tmux kill-session -t tmux-0

# Kill all tmux sessions
tmux kill-server
```

## Tmux Keybindings (Quick Reference)

- **Prefix Key**: `Ctrl+B` (default tmux prefix)
- **Detach Session**: `Ctrl+B` → `D`
- **List Windows**: `Ctrl+B` → `W`
- **New Window**: `Ctrl+B` → `C`
- **Next Window**: `Ctrl+B` → `N`
- **Previous Window**: `Ctrl+B` → `P`
- **Split Horizontal**: `Ctrl+B` → `%`
- **Split Vertical**: `Ctrl+B` → `"`
- **Navigate Panes**: `Ctrl+B` → Arrow keys
- **Kill Window**: `Ctrl+B` → `&`
- **Rename Window**: `Ctrl+B` → `,`

## Integration with Argos

### Terminal Store (`src/lib/stores/terminal-store.ts`)

The terminal store manages 4 independent PTY sessions corresponding to the tmux profiles:

```typescript
export interface TerminalSession {
	id: string; // 'terminal-0' through 'terminal-3'
	name: string; // Display name
	pid: number; // Node-pty process ID
	isConnected: boolean; // WebSocket connection status
	buffer: string[]; // Scroll-back buffer (max 1000 lines)
}
```

### Vite Plugin (`config/vite-plugin-terminal.ts`)

The terminal plugin runs inside Docker via:

- **Port**: 3001
- **PTY Backend**: `node-pty` (must be rebuilt after `npm install`: `docker exec argos-dev npm rebuild node-pty`)
- **WebSocket Server**: Manages connection lifecycle and PTY process spawning

## Troubleshooting

### Session Conflicts

If profiles fail to start or attach incorrectly:

```bash
# Check existing sessions
tmux ls

# Kill conflicting session
tmux kill-session -t tmux-0

# Restart profile
./scripts/tmux/tmux-0.sh
```

### Terminal Color Issues

If colors don't render correctly:

```bash
# Verify TERM variable
echo $TERM  # Should be: xterm-256color

# Test 256-color support
for i in {0..255}; do printf "\x1b[48;5;${i}m%03d " "$i"; done; echo
```

### Container vs Host Context

Profiles auto-detect environment by checking for `/app`:

- **Container**: `cd /app` (Docker mount point)
- **Host**: `cd /home/kali/Documents/Argos/Argos` (project root)

If working directory is incorrect, verify Docker volume mount in `docker/docker-compose.portainer-dev.yml`:

```yaml
volumes:
    - /home/kali/Documents/Argos/Argos:/app
```

### Node-pty Binary Mismatch

If dashboard terminal fails to load with "Cannot find module" error:

```bash
# Rebuild node-pty for container architecture
docker exec argos-dev npm rebuild node-pty

# Restart dev server
npm run dev
```

This issue occurs after `npm install` on host because the compiled binary is for host (aarch64) but needs to run in container (also aarch64, but different libc).

## Best Practices

1. **Isolate Tasks**: Use separate profiles for dev, testing, monitoring, and hardware ops
2. **Persist Sessions**: Let tmux sessions run — they survive disconnections
3. **Name Windows**: Use `Ctrl+B` → `,` to name tmux windows for clarity
4. **Detach, Don't Kill**: Use `Ctrl+B` → `D` to detach instead of closing
5. **Check Sessions**: Run `tmux ls` periodically to clean up unused sessions

## Security Considerations

- **No Password Required**: Tmux profiles run as current user (no sudo)
- **Session Isolation**: Each tmux session is independent (no shared state)
- **Container Safety**: Profiles respect Docker filesystem boundaries (`/app` mount)
- **No Remote Access**: Tmux sessions are localhost-only (no network exposure)

## Related Files

- **Profile Scripts**: `scripts/tmux/tmux-*.sh`
- **Terminal Store**: `src/lib/stores/terminal-store.ts`
- **Vite Plugin**: `config/vite-plugin-terminal.ts`
- **Terminal UI**: `src/lib/components/dashboard/TerminalPanel.svelte`
- **WebSocket Handler**: `src/lib/server/websocket-server.ts` (port 3001)

## Further Reading

- [Tmux Manual](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [Node-pty Documentation](https://github.com/microsoft/node-pty)
- [Oh My Zsh Guide](https://github.com/ohmyzsh/ohmyzsh)
- [Powerlevel10k Configuration](https://github.com/romkatv/powerlevel10k)

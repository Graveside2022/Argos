#!/bin/bash
# Docker + tmux persistent terminal wrapper
# Automatically connects to argos-dev container with persistent tmux session

CONTAINER_NAME="argos-dev"
TMUX_SESSION="argos-claude"

# Check if Docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[ERROR] Error: Docker container '${CONTAINER_NAME}' is not running"
    echo "Start it with: docker compose -f docker/docker-compose.portainer-dev.yml up -d"
    exit 1
fi

# Check if tmux is installed in container
if ! docker exec "${CONTAINER_NAME}" which tmux &>/dev/null; then
    echo "[WARN]  Installing tmux in container..."
    docker exec "${CONTAINER_NAME}" bash -c "apt-get update -qq && apt-get install -y -qq tmux" || {
        echo "[ERROR] Failed to install tmux"
        exit 1
    }
fi

# Connect to persistent tmux session in /app with zsh
# -A: Attach if exists, create if doesn't
# -s: Session name
# -c: Working directory
exec docker exec -it "${CONTAINER_NAME}" tmux new-session -A -s "${TMUX_SESSION}" -c /app zsh

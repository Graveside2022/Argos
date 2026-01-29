# HackRF Backend Dockerfile
# Python Flask application for HackRF control and RF workflows

FROM python:3.11-slim

# Prevent Python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies including HackRF tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    hackrf \
    libhackrf-dev \
    libusb-1.0-0-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r hackrf && useradd -r -g hackrf hackrf

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Change ownership to non-root user
RUN chown -R hackrf:hackrf /app

# Switch to non-root user
USER hackrf

# Expose the API port
EXPOSE 8092

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8092/api/health')" || exit 1

# Start with gunicorn for production
# Using eventlet worker for WebSocket support
CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "-b", "0.0.0.0:8092", "app:app"]

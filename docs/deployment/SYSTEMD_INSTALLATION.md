# ArgosFinal Systemd Service Installation

## Installation Steps

1. **Build the production version first:**

    ```bash
    npm run build
    ```

2. **Copy the service file to systemd directory:**

    ```bash
    sudo cp argos-final.service /etc/systemd/system/
    ```

3. **Reload systemd to recognize the new service:**

    ```bash
    sudo systemctl daemon-reload
    ```

4. **Enable the service to start on boot:**

    ```bash
    sudo systemctl enable argos-final.service
    ```

5. **Start the service:**
    ```bash
    sudo systemctl start argos-final.service
    ```

## Service Management Commands

- **Check service status:**

    ```bash
    sudo systemctl status argos-final.service
    ```

- **View logs:**

    ```bash
    sudo journalctl -u argos-final.service -f
    ```

- **Stop the service:**

    ```bash
    sudo systemctl stop argos-final.service
    ```

- **Restart the service:**

    ```bash
    sudo systemctl restart argos-final.service
    ```

- **Disable auto-start:**
    ```bash
    sudo systemctl disable argos-final.service
    ```

## Environment Variables

The service sets these production environment variables:

- `NODE_ENV=production`
- `PORT=4173` (default Vite preview port)
- `HOST=0.0.0.0` (accessible from network)

To add more environment variables, edit the service file and add more `Environment=` lines in the `[Service]` section.

## Troubleshooting

If the service fails to start:

1. Check the logs:

    ```bash
    sudo journalctl -u argos-final.service -n 50
    ```

2. Verify npm is in the expected path:

    ```bash
    which npm
    ```

3. Ensure the build directory exists:

    ```bash
    ls -la /home/pi/projects/ArgosFinal/build/
    ```

4. Test the preview command manually:
    ```bash
    cd /home/pi/projects/ArgosFinal
    npm run preview
    ```

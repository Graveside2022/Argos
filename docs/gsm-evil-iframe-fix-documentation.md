# GSM Evil Iframe Socket.IO Fix Documentation

## Problem Description

The GSM Evil iframe was experiencing two critical issues after page refresh:

1. **Connection Error**: "localhost refused to connect" when accessing from remote IPs
2. **Data Loss**: IMSI data not loading in iframe after refresh (while IMSI Capture Box continued working)

## Root Cause Analysis

### Issue 1: Hardcoded Localhost

The iframe URL was hardcoded to use `localhost:8080`, which failed when accessing from any IP other than 127.0.0.1.

### Issue 2: Socket.IO Race Condition

The original IMSI template immediately called `socket.emit('imsi_data', 'get')` before the Socket.IO connection was established, causing the request to be lost.

## Solution Implementation

### 1. Dynamic Hostname Resolution

**File**: `/home/ubuntu/projects/Argos/src/routes/gsm-evil/+page.svelte`

```javascript
// OLD (broken)
const host = 'localhost';

// NEW (fixed)
const host = window.location.hostname || 'localhost';
iframeUrl = `http://${host}:8080/imsi/?t=${Date.now()}`;
```

### 2. Prevent Unnecessary Iframe Reloads

**File**: `/home/ubuntu/projects/Argos/src/routes/gsm-evil/+page.svelte`

```javascript
// Added check to prevent reload if URL already set
if (!iframeUrl || iframeUrl === '') {
	iframeUrl = `http://${host}:8080/imsi/?t=${Date.now()}`;
}
```

### 3. Fixed IMSI Template with Connection Handling

**File**: `/home/ubuntu/gsmevil-user/templates/imsi_fixed.html`

Key improvements:

- Wait for Socket.IO 'connect' event before requesting data
- Add connection status logging for debugging
- Include disconnect and error handlers
- Implement backup retry mechanism

```javascript
socket.on('connect', function () {
	console.log('[GSM-IMSI] Socket.IO connected successfully');
	// Request IMSI data AFTER connection is established
	socket.emit('imsi_data', 'get');
});

// Backup: If no data after 2 seconds, request again
setTimeout(function () {
	if ($('#fresh-table tbody tr').length === 0) {
		console.log('[GSM-IMSI] No data received, requesting again...');
		socket.emit('imsi_data', 'get');
	}
}, 2000);
```

### 4. Modified GSM Evil Python to Use Fixed Template

**File**: `/home/ubuntu/gsmevil-user/GsmEvil_auto.py`

```python
@app.route('/imsi/')
def imsi():
    # Use fixed template that properly waits for Socket.IO connection
    import os
    if os.path.exists('templates/imsi_fixed.html'):
        return render_template('imsi_fixed.html')
    return render_template('imsi.html')
```

## Testing Instructions

### Verify the Fix

1. Start GSM Evil service:

    ```bash
    cd /home/ubuntu/projects/Argos
    ./scripts/gsm-evil-start-no-sudo.sh
    ```

2. Navigate to GSM Evil page:

    ```
    http://[YOUR_IP]:5173/gsm-evil
    ```

3. Click "Start GSM Evil" button

4. Verify IMSI data appears in:
    - GSM Evil iframe (bottom section)
    - IMSI Capture Box (right sidebar)

5. **Critical Test**: Refresh the page (Cmd+R or F5)
    - GSM Evil iframe should reload and show historical IMSI data
    - New IMSI captures should continue appearing
    - No "localhost refused to connect" error

### Debugging

Check browser console for Socket.IO connection status:

```
[GSM-IMSI] Initializing Socket.IO connection...
[GSM-IMSI] Socket.IO connected successfully
[GSM-IMSI] Requesting historical IMSI data...
[GSM-IMSI] Received X historical IMSI records
[GSM-IMSI] New IMSI captured: [IMSI_NUMBER]
```

## Technical Details

### Port Configuration

- **8080**: GSM Evil web interface (non-root alternative to port 80)
- **4729**: GSMTAP UDP traffic from GRGSM
- **5173**: Main Argos application

### CORS Configuration

GSM Evil Flask app configured with:

```python
socketio = SocketIO(app, cors_allowed_origins="*")
```

This allows cross-origin requests from the Argos main application.

### Socket.IO Events

#### Client → Server

- `imsi_data`: Request historical IMSI data ('get')
- `imsi_sniffer`: Toggle IMSI sniffer ('on'/'off')
- `sms_sniffer`: Toggle SMS sniffer ('on'/'off')

#### Server → Client

- `imsi_data`: Array of historical IMSI records
- `imsi`: Single new IMSI capture
- `sniffers`: Current sniffer status

## Files Modified

1. **Argos Application**:
    - `/home/ubuntu/projects/Argos/src/routes/gsm-evil/+page.svelte`
    - `/home/ubuntu/projects/Argos/scripts/gsm-evil-stop.sh` (bulletproof stop mechanism)

2. **GSM Evil Service**:
    - `/home/ubuntu/gsmevil-user/GsmEvil_auto.py`
    - `/home/ubuntu/gsmevil-user/templates/imsi_fixed.html` (new)

## Troubleshooting

### Iframe Still Shows "Connection Refused"

1. Verify GSM Evil is running on port 8080:

    ```bash
    lsof -i:8080
    ```

2. Check firewall allows port 8080:
    ```bash
    sudo ufw status
    ```

### No IMSI Data After Refresh

1. Check browser console for Socket.IO errors
2. Verify GSM Evil database has data:

    ```bash
    sqlite3 /home/ubuntu/gsmevil-user/database/imsi.db "SELECT COUNT(*) FROM imsi_data;"
    ```

3. Restart GSM Evil service:
    ```bash
    ./scripts/gsm-evil-stop.sh
    ./scripts/gsm-evil-start-no-sudo.sh
    ```

## Future Improvements

1. **WebSocket Reconnection**: Implement automatic reconnection with exponential backoff
2. **Data Persistence**: Store IMSI data in browser localStorage for offline viewing
3. **Performance**: Implement virtual scrolling for large IMSI datasets
4. **Security**: Add authentication to GSM Evil web interface
5. **HTTPS**: Implement SSL/TLS for secure communication

## Related Documentation

- [GSM Evil Complete Solution](./GSM-EVIL-COMPLETE-SOLUTION.md)
- [GSM Evil Quick Reference](./gsm-evil-quick-reference.md)
- [GSM Evil Architecture Diagnosis](./gsm-evil-architecture-diagnosis.md)

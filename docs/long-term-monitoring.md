# Long-Term HackRF Monitoring Guide

## System Requirements for 4+ Hour Sessions

### Resource Considerations

1. **Memory Usage**
    - HackRF sweep typically uses 50-100MB RAM
    - Data buffering in Node.js adds ~50-100MB
    - SQLite database grows ~1MB per hour with signal data
    - Total: ~200-300MB RAM for extended sessions

2. **CPU Usage**
    - HackRF sweep: ~5-10% CPU on Pi 4
    - Node.js server: ~5-10% CPU
    - Web interface: ~5% CPU
    - Total: ~20-25% CPU usage

3. **Storage**
    - Signal data: ~1MB per hour
    - 4-hour session: ~4MB database growth
    - 24-hour session: ~24MB database growth

### Raspberry Pi Capabilities

The Raspberry Pi 4 can easily handle 4+ hour monitoring sessions:

- 2-8GB RAM available (only need 300MB)
- Quad-core CPU (only using 25%)
- SD card storage (minimal growth)

### Configuration Changes Made

1. **Data Timeout**: Increased from 2 minutes to 2 hours
    - Prevents false positives during quiet periods
    - Allows for long gaps between signals

2. **Runtime Limit**: Disabled entirely
    - Was killing process after 3 minutes
    - Now can run indefinitely

3. **Database Retention**: 1-hour cleanup cycle
    - Automatically removes old data
    - Prevents unlimited database growth

### Best Practices for Long Sessions

1. **Power Supply**
    - Use official Pi power supply (3A recommended)
    - Consider UPS for critical monitoring

2. **Cooling**
    - Ensure adequate ventilation
    - Consider heatsinks or fan for 24/7 operation

3. **Network Stability**
    - Use ethernet if possible
    - Configure WiFi power management off:

    ```bash
    sudo iw wlan0 set power_save off
    ```

4. **Browser Considerations**
    - Modern browsers handle long WebSocket connections well
    - Chrome/Firefox can run for days without issues
    - Mobile browsers may disconnect on sleep

### Monitoring Health

Check system resources during long sessions:

```bash
# CPU and memory
htop

# Temperature
vcgencmd measure_temp

# Disk space
df -h

# Process status
ps aux | grep hackrf
```

### Automatic Recovery

The system includes automatic recovery features:

- Process monitoring every 30 seconds
- Automatic restart on crash (3 attempts)
- WebSocket reconnection with exponential backoff
- Database cleanup every hour

### Expected Performance

For a 4-hour session:

- Stable CPU usage around 20-25%
- Memory usage under 300MB
- Database growth ~4MB
- No thermal throttling (temp < 70°C)
- Continuous data flow with no interruptions

The system is now configured for reliable long-term monitoring sessions of 4+ hours or even 24/7 operation.

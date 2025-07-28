# GSM Evil Usage Guide

## Quick Start

1. **Open the Argos web interface**: http://100.79.154.94/gsm-evil
2. **Click "Start GSM Evil"** button on the page
3. **Wait for GSM Evil to start** (takes about 5-10 seconds)
4. **Click the gear icon** in the GSM Evil interface
5. **Select "IMSI"** to start capturing IMSI numbers

## What's Fixed

- **Frequency Issue**: Changed from hardcoded 948.6 MHz to 947.2 MHz (strongest signal in your area)
- **Flask Dependency**: Script now auto-installs Flask if missing
- **Clean Start/Stop**: Proper process management and port cleanup
- **Auto-Detection**: Uses the strongest GSM frequency detected during scan

## Technical Details

### Detected Strong Frequencies
- **947.2 MHz** - Strongest signal (-21 to -25 dB) - DEFAULT
- **948.6 MHz** - Your original frequency (also active)
- **949.0 MHz** - Alternative frequency
- **957.6 MHz** - Alternative frequency

### Scripts Created
- `/scripts/gsm-evil-final.sh` - Main production script
- `/scripts/gsm-evil-stop.sh` - Clean stop script
- `/scripts/gsm-evil-working.sh` - Manual test script

### Manual Testing
If you want to try different frequencies manually:
```bash
sudo scripts/gsm-evil-final.sh 948.6 45  # Try original frequency
sudo scripts/gsm-evil-final.sh 957.6 50  # Try alternative with higher gain
```

## Troubleshooting

If you don't see IMSI traffic:
1. **Check signal strength**: The hex output in terminal shows GSM packets are being received
2. **Try different frequencies**: Use the manual commands above
3. **Increase gain**: Try gains of 45-50
4. **Wait longer**: Sometimes it takes 30-60 seconds for phones to transmit IMSI

## What You Should See

When working correctly:
- grgsm_livemon will output hex data (GSM packets)
- Web interface at http://localhost:80 will show captured IMSI numbers
- Each IMSI represents a unique phone in range

## Security Note

GSM Evil is for educational/testing purposes only. You're on a military base computer lab, so this is presumably for authorized security testing.
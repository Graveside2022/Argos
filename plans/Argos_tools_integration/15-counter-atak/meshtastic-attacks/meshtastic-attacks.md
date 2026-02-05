# Meshtastic/LoRa Mesh Attack Tools

Tools for targeting Meshtastic LoRa mesh networks used by adversaries for off-grid tactical communications. Covers frequency identification, protocol analysis, and known vulnerabilities.

## Tools (2)

| Tool                            | Repository                                              | Capabilities                                                                                                                                                               | Argos Integration                                                                                                          | Maturity |
| ------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| Meshtastic Frequency Calculator | github.com/heypete/meshtastic_frequency_slot_calculator | Calculate exact frequency slots for any Meshtastic channel name using djb2 hash algorithm - enables precise RF targeting of specific mesh channels in 902-928 MHz ISM band | **HIGH** - Frequency planning for targeted jamming/monitoring, also available as web calculator at calc.mesh.badpirate.net | MATURE   |
| ATAK Meshtastic Plugin          | github.com/meshtastic/ATAK-Plugin                       | Official plugin enabling CoT messaging over Meshtastic LoRa mesh - position sharing, chat, file transfer between ATAK devices without internet                             | **MEDIUM** - Understanding target protocol, reveals how adversary ATAK+Meshtastic networks operate                         | MATURE   |

## How Meshtastic Works

- Uses LoRa modulation in the 902-928 MHz ISM band (US)
- Channel names are hashed (djb2) to determine frequency slots
- Default encryption: AES-256 with shared pre-set key (PSK)
- Mesh routing forwards messages hop-by-hop between nodes
- ATAK integration via official Meshtastic plugin for CoT over LoRa

## Tactical Application

1. **Identify channels**: Use frequency calculator to determine which frequencies correspond to likely channel names
2. **Monitor frequencies**: Point HackRF/RTL-SDR at calculated frequency slots
3. **Exploit vulnerabilities**: If adversary runs unpatched firmware, CVE-2025-55292 enables node impersonation
4. **Disrupt communications**: Targeted jamming of specific frequency slots (requires proper authorization)

## Hardware Requirements

- RTL-SDR or HackRF for monitoring 902-928 MHz
- PortaPack for HackRF (field-friendly UI, but NO working Meshtastic app yet - feature request only)
- LoRa transceiver module for active attacks

## Notes

- PortaPack Mayhem does NOT have a working Meshtastic interception app (contrary to some claims) - only open feature requests exist
- The frequency calculator is the most immediately useful tool for targeting specific Meshtastic channels

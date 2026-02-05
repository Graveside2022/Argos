# Known Vulnerabilities (TAK/Meshtastic)

Documented CVEs and security advisories affecting Meshtastic mesh networking firmware. Relevant for exploiting adversary mesh communications or understanding defensive requirements.

## Meshtastic Vulnerabilities (4 CVE references)

| CVE                 | Affected Versions    | Description                                                                                                                            | Tactical Relevance                                                                                           |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **CVE-2025-55292**  | Meshtastic < v2.7.6  | HAM mode authentication bypass via NodeID forging - enables message interception and node impersonation on any Meshtastic mesh network | If adversary runs unpatched firmware, allows passive interception and active injection into their mesh comms |
| CVE-2025-55293      | Meshtastic < v2.7.6  | Additional authentication bypass variant                                                                                               | Same tactical relevance as above                                                                             |
| CVE-2025-24797      | Meshtastic < v2.6.11 | Low-entropy key generation, repeated public/private keypairs on some platforms                                                         | Cryptographic weakness enabling traffic decryption                                                           |
| GHSA-gq7v-jr8c-mfr7 | Meshtastic < v2.6.11 | MQTT impersonation and PKC decoding vulnerabilities                                                                                    | Network-level compromise of mesh communications via MQTT bridge                                              |

## Exploitation Requirements

### CVE-2025-55292 (Authentication Bypass)

- **Target**: Any Meshtastic network running firmware < v2.7.6
- **Method**: Forge NodeInfo messages to impersonate legitimate nodes
- **Capability**: Intercept messages, inject false data, persistent network compromise
- **Hardware**: LoRa transceiver compatible with Meshtastic (SX1262, SX1276, etc.)
- **Patch**: Firmware v2.7.6.834c3c5 and later

### CVE-2025-24797 (Weak Key Generation)

- **Target**: Devices with low-entropy PRNG (specific hardware platforms)
- **Method**: Predict or brute-force encryption keys from limited entropy pool
- **Capability**: Decrypt captured mesh traffic offline
- **Patch**: Firmware v2.6.11 and later

## Defensive Notes

- If running your OWN Meshtastic network, ensure firmware is v2.7.6+
- Enable channel encryption with strong custom PSK (not default)
- Monitor for unexpected NodeInfo messages (potential impersonation)
- Consider MQTT bridge security if using Meshtastic with internet uplink

## References

- NVD: https://nvd.nist.gov/vuln/detail/CVE-2025-55292
- Meshtastic Security Advisories: https://github.com/meshtastic/firmware/security
- Patch Release: Meshtastic firmware v2.7.6

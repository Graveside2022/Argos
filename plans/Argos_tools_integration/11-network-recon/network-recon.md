# Network Recon

Passive and active network analysis tools for device identification, protocol detection, credential harvesting, and man-in-the-middle operations.

---

## Installed on Argos (1)

| Tool          | Type                | Description                                                                                                         |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **BetterCAP** | Multi-Protocol MITM | Network attack and monitoring framework - ARP/DNS spoofing, WiFi deauth, BLE recon, HTTP proxy, credential sniffing |

---

## Available for Integration (6)

| Tool        | Repository                     | Capabilities                                                                                                | Argos Integration                         | Maturity      |
| ----------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------- |
| nDPI        | github.com/ntop/nDPI           | Deep packet inspection library - identifies 300+ protocols and applications from network traffic            | **HIGH** - C library with Python bindings | MATURE (ntop) |
| p0f         | github.com/p0f/p0f             | Passive OS fingerprinting - identifies operating systems from TCP/IP stack behavior without active scanning | **HIGH** - Passive, no detection risk     | MATURE        |
| Satori      | github.com/xnih/satori         | Device fingerprinting via DHCP, CDP, mDNS, UPnP - identifies device type, OS, manufacturer                  | **MEDIUM** - Python-based                 | ACTIVE        |
| CryptoLyzer | github.com/c0r0n3r/cryptolyzer | TLS/SSL analysis tool - identifies cipher suites, vulnerabilities, misconfigurations                        | **MEDIUM** - Python library               | ACTIVE        |
| Responder   | github.com/lgandx/Responder    | LLMNR/NBT-NS/mDNS poisoner + credential harvester - captures NTLMv2 hashes on network                       | **HIGH** - Python, field-deployable       | MATURE        |
| Ettercap    | github.com/Ettercap/ettercap   | Network MITM framework - ARP spoofing, DNS spoofing, credential sniffing, plugin system                     | **MEDIUM** - CLI mode available           | MATURE        |

## Hardware Requirements

- Standard network interface (all tools)
- WiFi adapter (installed - for wireless network recon)

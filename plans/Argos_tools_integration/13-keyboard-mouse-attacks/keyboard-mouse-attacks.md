# Wireless Peripheral Attacks

Tools for exploiting non-Bluetooth wireless keyboards, mice, and presenters that use proprietary 2.4 GHz protocols vulnerable to injection and sniffing attacks.

## Tools (1)

| Tool               | Repository                            | Capabilities                                                                                            | Argos Integration             | Maturity                   |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------- |
| MouseJack / JackIt | github.com/BastilleResearch/mousejack | Exploit non-Bluetooth wireless keyboards/mice - keystroke injection, mouse spoofing using CrazyRadio PA | **HIGH** - Python, USB dongle | MATURE (Bastille Research) |

## Hardware Requirements

- CrazyRadio PA USB dongle (~$30) with custom firmware
- nRF24LU1+ based dongle (alternative)

## Affected Devices

MouseJack vulnerabilities affect wireless peripherals from:

- Microsoft, Logitech, Dell, HP, Lenovo, Amazon Basics, and others
- Devices using nRF24L-series transceivers with proprietary (non-Bluetooth) protocols
- Does NOT affect Bluetooth or Bluetooth LE peripherals

## Notes

- Unique attack vector - most organizations don't consider wireless keyboard/mouse security
- Keystroke injection allows remote command execution on target workstations
- Effective range up to ~100m with directional antenna
- Bastille Research published the original vulnerability disclosure in 2016

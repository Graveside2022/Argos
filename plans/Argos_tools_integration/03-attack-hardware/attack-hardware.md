# Hardware Attack Platforms

Portable, field-deployable hardware devices (ESP32, Flipper Zero, Raspberry Pi, LoRa modules) with attack firmware for WiFi, Bluetooth, Sub-GHz, and IoT exploitation.

## Tools (8)

| Tool                        | Repository                                 | Capabilities                                                                                                                     | Argos Integration                          | Maturity                 |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------ |
| ESP32 Marauder              | github.com/justcallmekoko/ESP32Marauder    | WiFi/BT attack suite - deauth, beacon spam, packet sniffing, BLE attacks, EAPOL/PMKID scanning, Evil Portal, Flipper integration | **HIGH** - Serial/USB control from Argos   | MATURE (large community) |
| Flipper Zero (Unleashed FW) | github.com/DarkFlippers/unleashed-firmware | Extended firmware - unlocked SubGHz TX (315/433/868/915 MHz), NFC emulation, infrared, BadUSB                                    | **MEDIUM** - Can be controlled via CLI     | MATURE                   |
| M5Stack WiFi Toolkit        | github.com/M5Stack (various)               | ESP32 modular attack platform - deauth, captive portal, packet monitor, LCD display, battery powered, SD logging                 | **HIGH** - Similar to ESP32 Marauder       | ACTIVE                   |
| Pwnagotchi                  | github.com/evilsocket/pwnagotchi           | AI-powered RPi Zero W - deep reinforcement learning for autonomous handshake capture, mesh networking                            | **LOW** - Standalone (can share captures)  | MATURE                   |
| Minigotchi                  | github.com/dj1ch/minigotchi                | Pwnagotchi companion on ESP8266/ESP32 - smaller, cheaper, deauths for Pwnagotchi handshake capture                               | **MEDIUM** - Can be coordinated with Argos | ACTIVE                   |
| WiFi Pineapple Pi Ports     | github.com/hak5 (community forks)          | WiFi Pineapple attacks on RPi - rogue AP, MITM, captive portal, credential harvesting, PineAP client tracking                    | **HIGH** - Can integrate with Argos        | BETA                     |
| ESP8266 Deauther            | github.com/SpacehuhnTech/esp8266_deauther  | $3 WiFi deauth device - beacon flood, probe spam, deauth attacks, web UI, portable                                               | **HIGH** - Serial/web API control          | MATURE                   |
| LoRa Attack Toolkit (RAK)   | github.com/ioactive/laf                    | LoRaWAN security testing - packet injection, replay, DevAddr spoofing, frame counter bypass, gateway impersonation               | **MEDIUM** - Requires LoRa hardware module | RESEARCH                 |

## Hardware Requirements

- ESP32 dev board (Marauder, M5Stack)
- ESP8266 ($3 for Deauther)
- Flipper Zero (~$170)
- Raspberry Pi Zero W (Pwnagotchi)
- RAK LoRa module (LoRa Attack Toolkit)

## Priority Note

**ESP32 Marauder** is a top-10 priority tool - multi-attack hardware with serial control, compact form factor, field-proven by large community. Can be controlled directly from Argos via USB serial.

# Tool Documentation Audit Report

**Date:** 2026-02-05
**Target:** RPi 5 Model B Rev 1.0 | aarch64 | Kali 2025.4 | Docker v27.5.1

## Results: 55 PASS / 65 NEEDS FIX across 120 tool files

---

## CRITICAL: Dead/Invalid Repos (5 files)

These repos return 404 or have no usable code:

| File                                 | Documented URL                           | Status                    |
| ------------------------------------ | ---------------------------------------- | ------------------------- |
| 05-bluetooth/bluefang.md             | github.com/koutto/bluefang               | 404 - repo does not exist |
| 05-bluetooth/butterfly.md            | github.com/whid-injector/ButteRFly       | 404 - repo does not exist |
| 05-bluetooth/nrf52-attack-toolkit.md | github.com/nccgroup/nrf52-attack-toolkit | 404 - repo does not exist |
| 06-wifi/bl0ck.md                     | github.com/MS-WinCrypt/bl0ck             | 404 - repo deleted        |
| 06-wifi/wifi-injection-tester.md     | github.com/rpp0/wifi-injection           | 404 - repo deleted        |

## CRITICAL: Proposal-Only / No Working Code (1 file)

| File                                        | Issue                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| 15-counter-atak/rf-fingerprinting/atakrr.md | Repo contains only README + design diagrams. Project in proposal stage. |

---

## Wrong Repo URLs (8 files)

| File                                         | Wrong URL                          | Correct URL                                |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| 02-cellular/imsi-defense/rayhunter.md        | github.com/EFF/rayhunter           | github.com/EFForg/rayhunter                |
| 02-cellular/imsi-defense/crocodile-hunter.md | github.com/EFF/crocodilehunter     | github.com/EFForg/crocodilehunter          |
| 04-iot/mqtt-pwn.md                           | github.com/akamai/mqtt-pwn         | github.com/akamai-threat-research/mqtt-pwn |
| 05-bluetooth/bluesnarfer.md                  | github.com/niceworm/bluesnarfer    | github.com/kimbo/bluesnarfer               |
| 05-bluetooth/bluetoolkit.md                  | github.com/AresValley/BlueToolkit  | github.com/sgxgsx/BlueToolkit              |
| 05-bluetooth/bsniffhub.md                    | github.com/nickelc/bsniffhub       | github.com/homewsn/bsniffhub               |
| 09-aircraft/dump1090.md                      | github.com/flightaware/dump1090-fa | github.com/flightaware/dump1090            |
| 14-wardriving/wigletotak.md                  | github.com/cemaxecuter/WigleToTAK  | github.com/canaryradio/WigleToTAK          |

---

## Wrong Script Names / Entry Points (12 files)

| File                                                                  | Documented                              | Actual                                   |
| --------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| 01-counter-uas/dronesecurity.md                                       | src/main.py                             | src/droneid_receiver_offline.py          |
| 01-counter-uas/dronerf.md                                             | classify.py                             | Classification.py                        |
| 01-counter-uas/droneid-spoofer.md                                     | spoofer.py                              | main.py                                  |
| 10-rfid-subghz/cleverjam.md                                           | cleverjam.py                            | jam.py / clever.py                       |
| 10-rfid-subghz/jamrf.md                                               | jamrf.py                                | HackRF/jamRF_v1.py                       |
| 15-counter-atak/meshtastic-attacks/meshtastic-frequency-calculator.md | meshtastic_frequency_slot_calculator.py | frequency_slot.py                        |
| 15-counter-atak/rf-fingerprinting/find-lf.md                          | scanner/scanner.py                      | node/scan.py                             |
| 15-counter-atak/tak-protocol-tools/push-cursor-on-target.md           | push_cot.py                             | CoT.py (Django library, not CLI)         |
| 05-bluetooth/zigdiggity.md                                            | discover.py, sniff.py                   | scan.py, listen.py                       |
| 14-wardriving/sparrow-wifi.md                                         | sparrow-agent.py                        | sparrowwifiagent.py                      |
| 06-wifi/eaphammer.md                                                  | requirements.txt                        | pip.req                                  |
| 07-rf-geolocation/krakensdr.md                                        | kraken_doa_start.py                     | gui_run.sh / \_ui/\_web_interface/app.py |

---

## Wrong Build System / Install Method (8 files)

| File                                        | Documented                 | Actual                         |
| ------------------------------------------- | -------------------------- | ------------------------------ |
| 03-attack-hardware/esp32-marauder.md        | ESP-IDF                    | Arduino (PlatformIO)           |
| 01-counter-uas/esp32-wifi-drone-disabler.md | ESP-IDF                    | PlatformIO (Arduino framework) |
| 06-wifi/eaphammer.md                        | python3 setup.py install   | ./kali-setup                   |
| 06-wifi/wef.md                              | bash setup.sh              | bash wef                       |
| 05-bluetooth/bsniffhub.md                   | Rust / cargo build         | C/C++ / make                   |
| 05-bluetooth/braktooth.md                   | Source build               | Pre-built release binaries     |
| 01-counter-uas/rf-drone-detection.md        | pip / requirements.txt     | pipenv / Pipfile               |
| 02-cellular/qcsuper.md                      | pip install qcsuper (PyPI) | pip install . (from clone)     |

---

## Wrong Dependencies (14 files)

| File                               | Issue                                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 11-network-recon/satori.md         | Lists scapy/lxml/dpkt; actual deps are pypacker/pcapyplus/untangle/requests               |
| 11-network-recon/responder.md      | Lists pycryptodome; actual dep is aioquic                                                 |
| 10-rfid-subghz/rfcrack.md          | Lists numpy/scipy; actual deps are rfcat/matplotlib/bitstring/pyusb/numpy                 |
| 10-rfid-subghz/rfcat.md            | Missing numpy from pip deps                                                               |
| 01-counter-uas/droneid-spoofer.md  | Missing inputs==0.5 package                                                               |
| 02-cellular/qcsuper.md             | Claims requirements.txt exists; it doesn't. Actual deps: crcmod, pycrate, pyserial, pyusb |
| 14-wardriving/sparrow-wifi.md      | Missing QScintilla, numpy, matplotlib, python3-tk                                         |
| 06-wifi/fragattacks.md             | apt package "scapy" doesn't exist; should be python3-scapy                                |
| 02-cellular/imsi-catcher-oros42.md | Missing python3-scipy, python3-scapy from Dockerfile                                      |
| 04-iot/attify-zigbee.md            | Python 2 / PyQt4 deps (non-functional on modern systems)                                  |
| 04-iot/z3sec.md                    | Missing GNU Radio, scapy-radio, gr-foo, gr-ieee802-15-4 (Python 2 era)                    |
| 08-sdr/rfsec-toolkit.md            | Documented directory structure completely wrong                                           |
| 07-rf-geolocation/df-aggregator.md | df_aggregator.py does not exist in referenced repo                                        |
| 12-em-surveillance/tempestsdr.md   | Non-existent plugins, wrong build tool, wrong deps                                        |

---

## Other Issues (18 files)

| File                                             | Issue                                                          |
| ------------------------------------------------ | -------------------------------------------------------------- |
| 01-counter-uas/rf-drone-detection.md             | CMD entry point wrong; repo uses Pipfile not pip               |
| 01-counter-uas/sdr-based-attacks-gps-spoofing.md | SDR-Based-Attacks repo is docs-only                            |
| 01-counter-uas/gnss-uav-spoofing-jamming.md      | Repo is capstone screenshots, no deployable code               |
| 02-cellular/open5gs.md                           | Docker images open5gs/open5gs:latest don't exist on Docker Hub |
| 03-attack-hardware/lora-attack-toolkit.md        | Missing Go dependency; fabricated script names                 |
| 03-attack-hardware/m5stack-wifi-toolkit.md       | Bruce firmware needs PlatformIO, not Arduino CLI               |
| 03-attack-hardware/minigotchi.md                 | ESP32 is a separate repo; this is ESP8266-only                 |
| 04-iot/laf-lora.md                               | Duplicate of lora-attack-toolkit; same issues                  |
| 04-iot/sdr-lora.md                               | May need SoapySDR/Pothos deps                                  |
| 05-bluetooth/ble-ctf-framework.md                | ESP32 build should use ESP-IDF, not Arduino CLI                |
| 06-wifi/airgeddon.md                             | Docker volume path wrong, entrypoint wrong                     |
| 06-wifi/wifi-pumpkin3.md                         | apt availability unverified; missing pyqt5 dep                 |
| 07-rf-geolocation/rtl-coherent.md                | Dockerfile fallback gcc references non-existent single file    |
| 08-sdr/fissure.md                                | Understates ARM64 support; wrong default branch                |
| 09-aircraft/ais-catcher.md                       | Wrong license (EUPL-1.2 should be GPL-3.0)                     |
| 09-aircraft/dump1090.md                          | Invalid PLUTOSDR=no make flag                                  |
| 13-keyboard/mousejack.md                         | Firmware flash paths need verification                         |
| 14-wardriving/kismet.md                          | Redundant -p with --net=host in Docker                         |

---

## PASS (55 files)

01: drone-id, sniffletotak, dronesploit, gps-sdr-sim
02: gr-gsm, gsm-evil, kalibrate-hackrf, lte-cell-scanner, modmobmap, srsran
03: pwnagotchi (minor), flipper-zero-unleashed (minor), wifi-pineapple-pi (minor), esp8266-deauther (minor)
04: killerbee, rtl-433, zigator
05: bluing, btlejack, btle-scanner, mirage-framework, nrf-sniffer, sniffle
06: aireplay-ng, fluxion, hashcat, hcxdumptool, mdk4, scapy-80211, wifiphisher, wifite2
07: (none fully pass)
08: hackrf-spectrum, rf-emitter, usrp-sweep, openwebrx, universal-radio-hacker, inspectrum, qspectrumanalyzer
09: tar1090, readsb
10: proxmark3
11: bettercap, cryptolyzer, ettercap, p0f
12-15: wigle, adsbcot, aiscot, aprscot, djicot, dronecot, inrcot, spotcot, trackerjacker, takproto, pytak, cotproxy, wireshark-tak-dissector

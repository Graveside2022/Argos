# GSM Evil Alternatives - Research Results

## Executive Summary

Based on deep search using Octocode MCP server, here are the **best alternatives** to GSM Evil 2:

### 🏆 Top Recommendation: **LTESniffer** (for modern networks)

**GitHub**: https://github.com/SysSec-KAIST/LTESniffer
**Stars**: 2,129 ⭐
**Last Updated**: October 2024
**Status**: ✅ Actively maintained

### 🥈 Best GSM Alternative: **Oros42/IMSI-catcher**

**GitHub**: https://github.com/Oros42/IMSI-catcher
**Stars**: 3,760 ⭐
**Last Updated**: December 2025
**Status**: ✅ Actively maintained

---

## 1. LTESniffer (BEST - Modern 4G/LTE)

### Why It's Better

- **LTE/4G support** - GSM Evil only does 2G (outdated)
- **Real-time decoding** of uplink AND downlink traffic
- **IMSI collection** built-in (like GSM Evil)
- **Identity mapping** - correlates RNTI ↔ TMSI ↔ IMSI
- **Capability profiling** - detects device capabilities (64QAM, 256QAM, etc.)
- **Academic backing** - Published research paper from KAIST

### Capabilities

**Channels Decoded:**

- PDCCH (Physical Downlink Control Channel)
- PDSCH (Physical Downlink Shared Channel)
- PUSCH (Physical Uplink Shared Channel)

**Features:**

- Real-time decoding of 150+ active users
- Supports LTE Advanced/Pro (up to 256QAM)
- Multiple transmission modes (1, 2, 3, 4)
- Up to 20 MHz bandwidth
- Offline decoding from recorded IQ files
- Security API for research

### Hardware Requirements

**Minimum:**

- Intel i7 (8+ physical cores recommended)
- 16GB RAM minimum
- 256GB SSD storage
- **USRP B-series** or BladeRF (NOT HackRF - needs higher bandwidth)
- 2x RX antennas for MIMO

**Supported SDRs:**

- ✅ USRP B200/B210 (recommended)
- ✅ BladeRF 2.0
- ❌ HackRF One (insufficient bandwidth for LTE)

### Limitations

- **Cannot decrypt encrypted traffic** (only analyzes unencrypted headers)
- More complex setup than GSM Evil
- Higher computational requirements
- Requires USRP (HackRF won't work)
- FDD only (no TDD support)

### Raspberry Pi 5 Compatibility

⚠️ **NOT RECOMMENDED** for RPi5:

- Requires high-performance x86 CPU (Intel i7+)
- 16GB RAM (RPi5 only has 8GB)
- Real-time LTE decoding is CPU-intensive
- Would need USRP, not HackRF

---

## 2. Oros42/IMSI-catcher (BEST GSM Alternative)

### Why It's Better Than GSM Evil

- **Simpler architecture** - 2 Python scripts vs complex GsmEvil2 pipeline
- **Better maintained** - Last update December 2025
- **More popular** - 3,760 stars vs GSM Evil's ~200
- **Multiple database backends** - SQLite, MySQL, TXT file
- **Better documentation** - Clear, concise README
- **Supports more SDRs** - RTL-SDR, OsmocomBB, HackRF, BladeRF

### Features

- IMSI capture and display
- TMSI tracking
- Country/operator detection (MCC/MNC lookup)
- Real-time Wireshark integration
- Frequency scanning with kalibrate-hackrf
- Docker support

### Architecture

```
Terminal 1: python3 simple_IMSI-catcher.py -s
Terminal 2: grgsm_livemon -f 925.4M
```

Simple 2-process model vs GSM Evil's 4+ processes.

### Hardware Requirements

**SDR Support:**

- ✅ RTL-SDR ($15 USB dongle) - **CHEAPEST option**
- ✅ OsmocomBB phone
- ✅ HackRF One
- ✅ BladeRF

### Raspberry Pi 5 Compatibility

✅ **HIGHLY COMPATIBLE**

- Tested on ARM (Kali 2025+)
- Low CPU requirements (grgsm + Python)
- Works with HackRF One
- Similar resource footprint to GSM Evil

### Advantages Over GSM Evil

1. **Simpler** - No complex GSMTAP pipeline, no web UI overhead
2. **More flexible** - SQLite, MySQL, or flat file storage
3. **Better community** - 3.7k stars, 812 forks, active issues
4. **Easier to debug** - 2 processes vs 4+ in GSM Evil
5. **Better docs** - Step-by-step setup guide

---

## 3. Other Notable Tools

### gr-gsm (Foundation Library)

**GitHub**: https://github.com/ptrkrysik/gr-gsm
**Stars**: 1,471 ⭐
**Status**: Core library used by BOTH GSM Evil and IMSI-catcher

- Not a standalone tool, it's the underlying library
- Both GSM Evil and Oros42/IMSI-catcher use `grgsm_livemon`
- Maintained by original author

### Cellular-Security-Papers

**GitHub**: https://github.com/onehouwong/Cellular-Security-Papers
**Stars**: 177 ⭐

- Academic paper collection
- Lists cutting-edge research tools
- Good for discovering new techniques

### Atalaya

**GitHub**: https://github.com/aeri/Atalaya
**Stars**: 42 ⭐
**Status**: Recently created (August 2024)

- Monitors nearby cell towers (GSM, 3G, LTE, 5G)
- Uses Android device APIs (no SDR required)
- Good for tower enumeration, not IMSI capture

---

## Comparison Matrix

| Feature              | GSM Evil 2        | Oros42/IMSI-catcher | LTESniffer         |
| -------------------- | ----------------- | ------------------- | ------------------ |
| **Technology**       | 2G/GSM only       | 2G/GSM only         | 4G/LTE             |
| **IMSI Capture**     | ✅ Yes            | ✅ Yes              | ✅ Yes             |
| **TMSI Tracking**    | ✅ Yes            | ✅ Yes              | ✅ Yes             |
| **Uplink Sniffing**  | ❌ No             | ❌ No               | ✅ Yes             |
| **Complexity**       | High              | **Low**             | Very High          |
| **Web UI**           | ✅ Yes (built-in) | ❌ No (CLI only)    | ❌ No (CLI only)   |
| **Database**         | SQLite only       | SQLite/MySQL/TXT    | Custom             |
| **RPi5 Compatible**  | ✅ Yes            | ✅ Yes              | ❌ No (x86 only)   |
| **HackRF Support**   | ✅ Yes            | ✅ Yes              | ❌ No (needs USRP) |
| **GitHub Stars**     | ~200              | **3,760**           | **2,129**          |
| **Last Update**      | 2023              | **Dec 2025**        | **Oct 2024**       |
| **Documentation**    | Sparse            | **Excellent**       | Excellent          |
| **Setup Difficulty** | Hard              | **Easy**            | Very Hard          |

---

## Recommendations

### For Your Argos Project (RPi5 + HackRF)

**Option 1: Stick with GSM Evil 2** ✅ Current choice

- Already integrated
- Web UI matches your dashboard
- Works on RPi5 with HackRF
- You've already solved the bugs

**Option 2: Switch to Oros42/IMSI-catcher** 🔄 Simpler alternative

- Same hardware (HackRF)
- Simpler architecture (easier to debug)
- Better community support
- More reliable updates
- **Trade-off**: Lose the web UI, gain simplicity

**Option 3: Add LTESniffer (future upgrade)** 🚀 For 4G monitoring

- Requires USRP B-series (~$700-$1200)
- Requires x86 server (not RPi5)
- Captures modern LTE traffic
- Professional-grade capabilities
- **Deploy separately** from Argos (different hardware)

### Reality Check: GSM is Dead

**Important**: GSM (2G) networks are being shut down globally:

- **USA**: T-Mobile shut down 2G in 2022, AT&T in 2017
- **Europe**: Most carriers shutting down by 2025-2026
- **Asia**: Transitioning to 4G/5G

**For tactical/training use:**

- **GSM Evil** still works where 2G exists (developing countries, military networks)
- **LTESniffer** is the future for 4G monitoring
- **5G** monitoring is still academic research (no mature tools)

### Best Path Forward

**Short-term (now):**

- Keep GSM Evil 2 - it's working now
- You've already integrated it and fixed the bugs
- Good for training on legacy networks

**Mid-term (6 months):**

- Consider Oros42/IMSI-catcher as a simpler alternative
- Easier to maintain, better community
- Can run in parallel with GSM Evil for comparison

**Long-term (1-2 years):**

- Plan LTESniffer deployment on separate x86 server
- Requires USRP B-series investment
- Captures modern 4G LTE traffic
- Position Argos as multi-spectrum platform (GSM + LTE)

---

## Integration Difficulty

### GSM Evil → Oros42/IMSI-catcher Migration

**Difficulty**: ⭐⭐☆☆☆ (Easy)

**Required changes:**

1. Replace GsmEvil2 Python script with simple_IMSI-catcher.py
2. Update API endpoint to query SQLite database directly
3. Remove web UI server (use Argos UI instead)
4. Keep grgsm_livemon (same command)

**Estimated time**: 4-6 hours

### Adding LTESniffer

**Difficulty**: ⭐⭐⭐⭐⭐ (Very Hard)

**Requirements:**

- Separate x86 server (Intel i7+)
- USRP B-series SDR (~$700-$1200)
- Complete rewrite of capture pipeline
- Different API structure

**Estimated time**: 2-3 weeks + hardware cost

---

## Conclusion

### Direct Answer: "Is there anything better?"

**For GSM (2G) monitoring:**

- **Oros42/IMSI-catcher is simpler** and better maintained than GSM Evil 2
- But GSM Evil 2 has the advantage of being already integrated into your system

**For Modern Networks (4G LTE):**

- **LTESniffer is THE best open-source option**
- But it requires expensive hardware (USRP) and powerful CPU (x86)
- Not compatible with your RPi5 + HackRF setup

**For 5G:**

- No mature open-source tools exist yet
- Still academic research territory
- Commercial tools cost $100k+

### Bottom Line

**GSM Evil 2 isn't "bad"** - it does what it's designed to do. The main limitations are:

1. **GSM is outdated** (2G networks shutting down)
2. **Architecture complexity** (4+ processes, GSMTAP pipeline)
3. **Maintenance** (last major update 2023)

**If you want to upgrade within your current hardware constraints**, switch to **Oros42/IMSI-catcher** for:

- Simpler architecture
- Better community support
- Active maintenance (Dec 2025 update)
- Same capabilities, less complexity

**If you want to monitor modern networks**, plan a **separate LTESniffer deployment** on x86 hardware with USRP.

---

## References

- LTESniffer Paper: https://syssec.kaist.ac.kr/pub/2023/kim_sec_23.pdf
- Oros42/IMSI-catcher: https://github.com/Oros42/IMSI-catcher
- gr-gsm Wiki: https://osmocom.org/projects/gr-gsm/wiki
- Cellular Security Papers: https://github.com/onehouwong/Cellular-Security-Papers

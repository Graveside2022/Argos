# Jetson Port Notes — Argos on NVIDIA Jetson AGX Orin

This document captures the Jetson-specific install decisions and fixes applied
when porting Argos from its original target (Kali Linux on Raspberry Pi 5) to
NVIDIA Jetson AGX Orin Developer Kit running Ubuntu 22.04 LTS with kernel
`5.15.185-tegra`.

If you're re-running the port from scratch, pair this file with the approved
install plan at `~/.claude/plans/*.md` (outside the repo).

## Hardware inventory

| Component                | Model                                               | Notes                                                   |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------- |
| Compute                  | Jetson AGX Orin Developer Kit                       | aarch64, 64 GB RAM, 30 GB swap                          |
| OS                       | Ubuntu 22.04.5 LTS (jammy)                          | L4T 36.5.0                                              |
| Kernel                   | `5.15.185-tegra`                                    | NVIDIA defconfig — `pl2303`, `mt7921u` stripped         |
| SDR                      | HackRF One                                          | firmware `2024.02.1 (API:1.08)`                         |
| GPS                      | u-blox 7 USB (`1546:01a7`)                          | binds `cdc_acm` → `/dev/ttyACM0` — works out of the box |
| WiFi (internet, `wlan0`) | Onboard Realtek `rtl8822ce` (PCIe)                  | phy#0, stays NetworkManager-managed                     |
| WiFi (Kismet, `wlan1`)   | Alfa AWUS036AAXML — MediaTek MT7921AU (`0e8d:7961`) | phy#1, NM-unmanaged                                     |

A PL2303-based GPS (`067b:23a3`, PL2303GC / HXN) was tried first — driver
stripped from Tegra kernel, would have required a custom build. Swapped for
the u-blox 7 USB which uses in-tree `cdc_acm`. **Prefer CDC-ACM GPS on Jetson.**

## Interface naming (udev MAC rename)

Jetson uses systemd predictable names (`wlP1p1s0`), which break the repo's
hardcoded `wlan0` / `wlan1` conventions in `scripts/ops/argos-wifi-resilience.sh`,
`scripts/ops/install-dragonsync.sh`, and the sudoers drop-in from
`scripts/ops/setup-host-functions.sh`.

Fix: `/etc/udev/rules.d/70-argos-wifi-names.rules` (not installed by the repo;
added during the Jetson port). Renames are MAC-matched so they survive
re-enumeration:

```
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="rtl8822ce", ATTR{address}=="<onboard-mac>", NAME="wlan0"
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="mt7921u", ATTR{address}=="<alfa-mac>",   NAME="wlan1"
```

Before the rename takes effect on reboot, bind the active NetworkManager
profile to the onboard MAC (not the name) so the profile survives the
`wlP1p1s0` → `wlan0` transition without a reconnect:

```bash
sudo nmcli connection modify "<profile>" 802-11-wireless.mac-address <onboard-mac>
sudo nmcli connection modify "<profile>" connection.interface-name ""
# Do NOT call `nmcli device reapply` — modify only writes the profile file,
# no live disconnect.
```

Rollback (re-bind by name): `sudo nmcli connection modify "<profile>"
connection.interface-name wlP1p1s0 && ... mac-address ""`.

## mt7921u driver build (Alfa card)

The repo assumes `mt7921u` is in the kernel — true on Kali 6.x, not on
Tegra 5.15. Mainline added `mt7921u` USB support in kernel 5.16.

Build procedure (one-time; modules land in `/lib/modules/<kver>/extra/`):

```bash
# Prereqs already satisfied by nvidia-l4t-kernel-{headers,oot-headers}:
#   /lib/modules/5.15.185-tegra/build → kernel source with Module.symvers + .config

mkdir -p ~/argos-rollback/phase-9/build
cd ~/argos-rollback/phase-9/build
git clone https://github.com/openwrt/mt76.git
cd mt76

# Last upstream commit before cfg80211 API skew blocks the build on 5.15.
# Adds mt7921u USB support; predates `mbssid_max_interfaces` (kernel 5.16)
# and `mtk_wed.h` (kernel 6.x).
git checkout b0c60d52    # "mt76: mt7921: add mt7921u driver" (2022-03-15)

KSRC=/lib/modules/$(uname -r)/build
make -C "$KSRC" M=$PWD modules \
  CONFIG_MT76_USB=m CONFIG_MT76_CONNAC_LIB=m \
  CONFIG_MT7921_COMMON=m CONFIG_MT7921U=m CONFIG_MT7921E=n CONFIG_MT7921S=n
```

Expected output in `mt76/`:
`mt76.ko mt76-usb.ko mt76-connac-lib.ko mt7921/mt7921-common.ko mt7921/mt7921u.ko`

Install + load:

```bash
sudo mkdir -p /lib/modules/$(uname -r)/extra
sudo install -m 644 mt76.ko mt76-usb.ko mt76-connac-lib.ko \
                    mt7921/mt7921-common.ko mt7921/mt7921u.ko \
                    /lib/modules/$(uname -r)/extra/
sudo depmod -a
sudo modprobe mt7921u

# Boot persistence
echo mt7921u | sudo tee /etc/modules-load.d/mt7921u.conf
```

Firmware is provided by Ubuntu's `firmware-misc-nonfree` (pre-installed on
L4T base image): `WIFI_MT7922_patch_mcu_1_1_hdr.bin` + `WIFI_RAM_CODE_MT7922_1.bin`
at `/lib/firmware/mediatek/`.

Caveat: the mt76/mt7921u driver has known active-monitor-mode instability
(see `morrownr/USB-WiFi#387`, `openwrt/mt76#839`). Kismet passive scanning
works; packet injection / deauth are unreliable. Acceptable for the passive
reconnaissance use case Argos targets.

## NetworkManager unmanage (Alfa)

Mirrors the rule produced by `scripts/ops/setup-host-functions.sh:410-420`
but installed manually since we skipped `setup-host.sh`:

`/etc/udev/rules.d/99-argos-wifi-unmanaged.rules`:

```
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="0e8d", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="0bda", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="148f", ENV{NM_UNMANAGED}="1"
SUBSYSTEM=="net", ACTION=="add", DEVTYPE=="wlan", ATTRS{idVendor}=="0cf3", ENV{NM_UNMANAGED}="1"
```

## Kismet configuration (`/etc/kismet/kismet_site.conf`)

```
httpd_username=admin
httpd_password=<sync with $KISMET_PASSWORD from .env>
source=wlan1:type=linuxwifi,name=alfa_awus036aaxml
gps=gpsd:host=localhost,port=2947
```

Kismet runs as the unprivileged invoking user; `kismet_cap_linux_wifi` has
file capabilities `cap_net_admin,cap_net_raw=eip`, so `sudo` is not
required. The user must be in the `kismet` group (created by the
`kismet-capture-common` package, added via `usermod -aG kismet <user>`).

If Kismet fails with "Could not acquire the interface lockfile (Operation
not permitted)" after a prior root-launched test: `sudo rm
/tmp/.kismet_cap_linux_wifi_interface_lock*` to clear stale root-owned
lockfiles, then retry as the regular user.

## Jetson-specific repo patches (Phase 8)

Committed on `install/jetson-port`:

- `src/routes/api/system/metrics/+server.ts` — read
  `/sys/class/thermal/thermal_zone0/temp` first, fall back to `vcgencmd`
  (absent on Tegra). Matches order already used by `info/+server.ts`.
- `src/lib/server/env.ts` — `CLOUDRF_API_KEY` preprocessed so an empty
  string in `.env` coerces to `undefined`, honoring the `optional()`
  intent instead of tripping `.min(1)`.
- `.nvmrc` / `.node-version` — bumped 20 → 22 to match `package.json`
  `engines` (TAK deps require Node ≥ 22).

## SSH fallback (Phase 9.0)

The Jetson's default shell is `/usr/bin/zsh`. `claude` is at
`~/.local/bin/claude`. Zsh login shells do not source `~/.zshrc` for PATH
updates, so `~/.profile` is not automatically included; `~/.local/bin`
gets dropped when logging in via SSH.

Fix: `~/.zprofile` (added during the port):

```zsh
if [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
fi
```

Primary SSH recovery paths if WiFi misbehaves:

1. **Tailscale**: `ssh jetson2@<tailscale-ip>` — most reliable; survives
   WiFi reconfig since `tailscale0` is a userspace tunnel.
2. **Wired Ethernet (`eno1`)**: plug a cable before touching WiFi.
3. **LAN WiFi**: `ssh jetson2@<lan-ip>` — only works until an interface
   rename or NM reconfig briefly drops it.

## Reboot recovery

After the next reboot, confirm:

```bash
ip -br link           # should show wlan0 UP + wlan1 DOWN (Kismet-ready)
lsmod | grep mt7921u  # module auto-loaded via /etc/modules-load.d/
nmcli -t device status | grep wlan0   # should be 'connected'
```

If `wlan0` is `disconnected` (profile didn't match), the MAC-binding may
have been dropped by a NetworkManager upgrade — reapply with the Phase 9a
`nmcli connection modify` commands above. Then `sudo nmcli connection up
"<profile>"`.

## Things NOT done (and why)

- **`scripts/ops/setup-host.sh`** — intentionally skipped. Its CORE
  `mem_hardening` step appends to `/boot/firmware/cmdline.txt`
  (RPi u-boot path); Jetson uses `/boot/extlinux/extlinux.conf`. Script is
  not platform-aware. The individual pieces we needed (Kismet apt repo,
  gpsd config, NM unmanage rule) were installed by hand.
- **`install-services.sh`** — deferred. Hardcodes UID 1000 (ours matches,
  safe), `brcmfmac` NM dispatcher (RPi-specific, harmless on Jetson),
  and `mem_hardening` cmdline edits. Review + patch before running.
- **zram-swap unit** — Jetson ships its own `nvzramconfig`; don't fight it.
- **earlyoom** — Jetson has 64 GB RAM + 30 GB swap; memory pressure
  profile is radically different from RPi 5 8 GB. Leave the default
  kernel OOM + `nvzramconfig` alone for now.
- **gr-gsm / GSM-Evil** — not packaged for Ubuntu arm64; source build
  deferred. Repo code handles missing `grgsm_livemon_headless` gracefully
  already (`gsm-evil-control-helpers.ts`, `gsm-scan-prerequisites.ts`).

## References

- `scripts/ops/setup-host-functions.sh:410-420` — original NM unmanage
  udev rule (we cloned the pattern).
- `scripts/ops/argos-wifi-resilience.sh:3-9` — wlan0/wlan1 convention,
  hardcoded to `wlan0` for the internet link.
- `scripts/ops/install-dragonsync.sh:9` — `WIFI_IFACE="wlan1"` hardcode.
- `plans/Deployment_Architecture/Deployment_Architecture_*.md` — the repo
  originally assumed AWUS036AXML (single-A, same MT7921AU chipset).
- morrownr/USB-WiFi discussion #260 (AWUS036AXML + mt7921au chipset table).
- morrownr/USB-WiFi issue #387 (mt7921u active-monitor-mode bug).
- openwrt/mt76 issue #839 (active-monitor driver reset).
- cateee.net/lkddb/web-lkddb/MT7921U.html (in-kernel driver matrix).
- shengliangd.github.io/2023/01/01/mt76-backport/ (backport method).

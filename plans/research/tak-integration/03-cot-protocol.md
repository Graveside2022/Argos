# Cursor-on-Target (CoT) Protocol Research

Research document for Argos TAK integration. Covers the CoT XML schema, type system,
EW/SIGINT-relevant type codes, and practical parsing/generation patterns for representing
WiFi devices, RF signals, GSM towers, and GPS position as CoT events.

---

## 1. CoT XML Structure

Cursor-on-Target is an XML-based machine-to-machine messaging schema created by MITRE
Corporation and the US Air Force. It encodes **what** (type), **where** (coordinates),
and **when** (time) for any geolocated entity. The schema is registered in the DISA DoD
XML Registry (original spec at cot.mitre.org). Current schema version is **2.0**.

### 1.1 The Event Element

The `<event>` element is the root of every CoT message.

**Required attributes:**

| Attribute | Type             | Description                                                                                                                                            |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `version` | decimal (>= 2.0) | Schema version. Always `"2.0"` today.                                                                                                                  |
| `uid`     | string           | Globally unique identifier for this entity. Latest event by timestamp for a given UID overwrites the previous. Convention: `DEVICE-hexstring` or UUID. |
| `type`    | string           | Hierarchical event classification. Hyphen-delimited (see Section 2). Pattern: `\w+(-\w+)*(;[^;]*)?`                                                    |
| `time`    | ISO 8601         | Timestamp when the event was generated. Format: `CCYY-MM-DDThh:mm:ss.ssZ`                                                                              |
| `start`   | ISO 8601         | Beginning of the event's validity interval. Usually equals `time`.                                                                                     |
| `stale`   | ISO 8601         | End of the event's validity interval. After this, clients dim/remove the icon.                                                                         |
| `how`     | string           | Hint about how coordinates were generated (see Section 1.5). Pattern: `\w(-\w+)*`                                                                      |

**Optional attributes:**

| Attribute | Type               | Description                                                                                                                                             |
| --------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------ |
| `access`  | string             | Access control hint: `"Unrestricted"`, `"NATO"`, `"Army"`, etc.                                                                                         |
| `qos`     | pattern `\d-\w-\w` | Quality of Service. Three components: priority (0-9), overtaking (r=replace, f=FIFO, i=insert), assurance (g=guaranteed, d=degraded, c=connectionless). |
| `opex`    | string             | Operational context: `o` (operations), `e` (exercise), `s` (simulation). Format: `[o                                                                    | e   | s][-<name>]` |

### 1.2 The Point Element

The `<point>` element is a **required** child of `<event>`. It defines the geographic
location with error bounds.

| Attribute | Type    | Range        | Description                                                                                                      |
| --------- | ------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `lat`     | decimal | [-90, +90]   | WGS-84 latitude in signed degree-decimal.                                                                        |
| `lon`     | decimal | [-180, +180] | WGS-84 longitude in signed degree-decimal.                                                                       |
| `hae`     | decimal | meters       | Height Above WGS-84 Ellipsoid. Use `9999999.0` for unknown.                                                      |
| `ce`      | decimal | meters       | Circular Error: radius of the horizontal error circle around lat/lon. Use `9999999.0` for unknown.               |
| `le`      | decimal | meters       | Linear Error: vertical error associated with hae. Together with ce, defines a cylindrical volume of uncertainty. |

### 1.3 The Detail Element

The `<detail>` element is an **optional** child of `<event>`. It is an open container
that accepts arbitrary XML sub-elements (`xs:any` with lax processing). This is where
domain-specific metadata lives.

The detail element can be omitted during bandwidth-constrained transmission without
losing the core what/where/when information.

### 1.4 Common Detail Sub-Elements

These are the de-facto standard sub-elements used by ATAK/WinTAK/iTAK:

#### `<contact>`

Communications parameters for reaching the entity.

```xml
<contact callsign="ARGOS-01"
         endpoint="192.168.1.50:4242:tcp"
         phone="555-0100"
         email="ew@example.mil"
         xmppUsername="argos01@xmpp.tak.mil"/>
```

Key attributes: `callsign` (display name), `endpoint` (IP:port:protocol),
`phone`, `email`, `xmppUsername`, `freq` (radio frequency), `modulation` (AM/FM).

#### `<remarks>`

Freetext annotations for human consumption.

```xml
<remarks source="ARGOS-01" time="2026-02-16T14:30:00Z"
         to="TEAM-EW" keywords="wifi,sigint">
  Rogue AP detected on channel 6, SSID "FREE_WIFI"
</remarks>
```

Attributes: `source` (UID of originator), `time`, `to` (intended recipient UID),
`keywords` (comma-separated topic tags).

#### `<track>`

Direction and speed of travel.

```xml
<track course="127.5" speed="0.0"/>
```

Required attributes: `course` (degrees from true north, 0-360), `speed` (meters/second).
Optional: `eCourse` (course error), `eSpeed` (speed error), `slope` (vertical component).

#### `<precisionlocation>`

Indicates the source of altitude and geopoint data.

```xml
<precisionlocation altsrc="DTED0" geopointsrc="GPS"/>
```

Attributes: `altsrc` (altitude source: DTED0, DTED1, DTED2, GPS, USER, etc.),
`geopointsrc` (position source: GPS, USER, CALC, etc.).

#### `<sensor>`

Describes a steerable sensor (EO, IR, radar) with orientation and field of view.
All orientation values are normalized to a geodetic reference frame.

```xml
<sensor azimuth="045.0" elevation="0.0" fov="120.0" vfov="90.0"
        range="5000" type="r-e" model="HackRF"/>
```

| Attribute   | Range       | Description                                                   |
| ----------- | ----------- | ------------------------------------------------------------- |
| `azimuth`   | [0, 360)    | Sensor pointing direction, degrees from true north            |
| `elevation` | [-90, 90]   | Vertical tilt; 0 = horizon, positive = above horizon          |
| `roll`      | (-180, 180] | Sensor roll; positive = right-side down                       |
| `fov`       | [0, 360)    | Horizontal field of view (beam width), edge to edge           |
| `vfov`      | [0, 360)    | Vertical field of view, edge to edge                          |
| `range`     | [0, inf)    | Distance to target in meters                                  |
| `type`      | string      | Sensor type hierarchy (e.g., `r` = raster, `r-e` = raster EO) |
| `model`     | string      | Sensor model designation                                      |

#### `<__group>`

Team/organization affiliation.

```xml
<__group name="Yellow" role="Team Member"/>
```

Attributes: `name` (team color/name), `role` (Team Lead, Team Member, etc.).

#### `<status>`

Device status information.

```xml
<status battery="85" readiness="true"/>
```

#### `<takv>`

TAK client identification.

```xml
<takv os="Linux" version="1.0.0" device="RPi5" platform="Argos"/>
```

#### `<link>`

Unidirectional relationship to another CoT entity or resource.

```xml
<link uid="TOWER-001" relation="p-p" type="a-f-G-I-U-T-com-tow"
      production_time="2026-02-16T14:00:00Z"/>
```

Attributes: `uid`, `relation`, `type`, `production_time`, `url` (optional external resource).

#### `<__video>`

Video stream association (ATAK extension).

```xml
<__video url="rtsp://192.168.1.50:8554/stream1"/>
```

### 1.5 The `how` Attribute Hierarchy

The `how` attribute is a hierarchical hint about the coordinate generation method.
It uses a hyphen-delimited tree, similar to the `type` attribute.

**Top-level categories:**

| Code | Meaning                   |
| ---- | ------------------------- |
| `h`  | **Human** entered/derived |
| `m`  | **Machine** generated     |

**Second-level refinements:**

| Code  | Meaning                                    |
| ----- | ------------------------------------------ |
| `h-e` | Human estimated                            |
| `h-g` | Human entered via GPS (person reading GPS) |
| `h-t` | Human transcribed                          |
| `h-c` | Human calculated                           |
| `m-g` | Machine GPS (direct GPS receiver output)   |
| `m-s` | Machine sensor (non-GPS sensor derived)    |
| `m-r` | Machine radar                              |
| `m-f` | Machine fused (multiple sources combined)  |
| `m-c` | Machine calculated                         |
| `m-p` | Machine predicted/extrapolated             |
| `m-a` | Machine assisted (human-machine hybrid)    |

**Deeper refinements (examples):**

| Code        | Meaning                        |
| ----------- | ------------------------------ |
| `h-g-i-g-o` | Human, GPS, internal, GPS only |
| `m-g-n`     | Machine, GPS, NMEA             |

**Argos usage recommendations:**

| Argos Source                       | `how` Value | Rationale                                |
| ---------------------------------- | ----------- | ---------------------------------------- |
| GPS module (direct)                | `m-g`       | Machine-generated GPS fix                |
| WiFi device (Kismet triangulation) | `m-s`       | Machine sensor-derived position          |
| HackRF signal (operator-placed)    | `h-e`       | Human estimated placement                |
| GSM tower (database lookup)        | `m-c`       | Machine calculated from cell ID database |
| Operator-entered position          | `h-e`       | Human estimated                          |

### 1.6 Complete Annotated Example

```xml
<?xml version="1.0" encoding="UTF-8"?>
<event version="2.0"
       uid="ARGOS-RPi5-01"
       type="a-f-G-E-S"
       time="2026-02-16T14:30:00.000Z"
       start="2026-02-16T14:30:00.000Z"
       stale="2026-02-16T14:35:00.000Z"
       how="m-g"
       access="Unrestricted"
       opex="e-NTC26">
  <!--
    uid:   Unique device identifier for this Argos console
    type:  a(atom)-f(friendly)-G(ground)-E(equipment)-S(sensor)
    time:  When this message was generated
    start: Validity window start (same as time for live events)
    stale: Client removes icon after this time (5 min window)
    how:   m-g = machine GPS (Argos has a GPS receiver)
    opex:  e-NTC26 = exercise, NTC rotation 2026
  -->
  <point lat="35.2828"
         lon="-116.6906"
         hae="615.0"
         ce="5.0"
         le="10.0"/>
  <!--
    Position at NTC/Fort Irwin
    ce=5m horizontal accuracy, le=10m vertical accuracy
  -->
  <detail>
    <contact callsign="ARGOS-01" endpoint="192.168.1.50:4242:tcp"/>
    <__group name="Yellow" role="Team Lead"/>
    <precisionlocation altsrc="GPS" geopointsrc="GPS"/>
    <track course="0.0" speed="0.0"/>
    <status battery="92"/>
    <takv os="Linux" version="1.0.0" device="RPi5" platform="Argos"/>
    <remarks source="ARGOS-RPi5-01"
             time="2026-02-16T14:30:00Z">
      EW sensor platform operational. HackRF + Kismet active.
    </remarks>
  </detail>
</event>
```

---

## 2. CoT Type System (MIL-STD-2525B/C)

### 2.1 Type String Format

The `type` attribute is a hyphen-delimited string that identifies a node in a
hierarchical type tree. The structure for "atom" types follows MIL-STD-2525:

```
a - F - G - U - C
|   |   |   |   |
|   |   |   |   +-- Function code (from 2525, positions 5-10)
|   |   |   +------ Function code continued
|   |   +---------- Battle Dimension (2525 position 3)
|   +-------------- Affiliation (2525 position 2)
|
+------------------ Root: "a" = atom (a real thing)
```

**Conventions:**

- **Uppercase** characters come directly from MIL-STD-2525
- **Lowercase** characters are CoT-specific extensions to the 2525 hierarchy
- The dot character `.` acts as a wildcard placeholder for affiliation when it varies

### 2.2 Root Categories

The type tree root (first character) has these categories:

| Root | Name             | Description                                                                           |
| ---- | ---------------- | ------------------------------------------------------------------------------------- |
| `a`  | **Atoms**        | Physical entities ("things") -- units, equipment, installations. Uses 2525 hierarchy. |
| `b`  | **Bits**         | Non-physical information: alerts, reports, sensor data, imagery, messages.            |
| `t`  | **Tasking**      | Orders, requests, control messages between systems.                                   |
| `r`  | **Reservations** | Airspace, frequency, or area reservations.                                            |
| `c`  | **Capability**   | Descriptions of system/unit capabilities.                                             |
| `u`  | **User-defined** | Drawings, shapes, routes, range lines.                                                |

### 2.3 Affiliation Codes (Position 2 of atom types)

These indicate the operational identity/disposition of the entity:

| Code | Affiliation          | Usage in Argos                                 |
| ---- | -------------------- | ---------------------------------------------- |
| `f`  | **Friendly**         | Own devices, known-friendly infrastructure     |
| `h`  | **Hostile**          | Confirmed threat emitters, hostile networks    |
| `u`  | **Unknown**          | Unidentified signals, first-contact APs        |
| `n`  | **Neutral**          | Non-participant infrastructure                 |
| `s`  | **Suspect**          | Possibly hostile, pending confirmation         |
| `p`  | **Pending**          | Identity not yet assessed                      |
| `a`  | **Assumed Friendly** | Likely friendly but unconfirmed                |
| `j`  | **Joker**            | Friendly entity acting as hostile for exercise |
| `k`  | **Faker**            | Friendly entity simulating hostile (exercise)  |
| `o`  | **None Specified**   | No affiliation applicable                      |
| `x`  | **Other**            | Outside standard categories                    |

**Argos convention:** Detected WiFi APs and RF signals default to `u` (unknown).
Operators can reclassify to `h` (hostile) or `f` (friendly) based on analysis.

### 2.4 Battle Dimension Codes (Position 3)

Derived from MIL-STD-2525 "Battle Dimension":

| Code | Dimension      | Description                                |
| ---- | -------------- | ------------------------------------------ |
| `P`  | Space          | Satellites, space-based assets             |
| `A`  | Air            | Aircraft, UAVs, airborne platforms         |
| `G`  | Ground         | Land-based units, equipment, installations |
| `S`  | Sea Surface    | Ships, surface vessels                     |
| `U`  | Sea Subsurface | Submarines                                 |
| `SF` | SOF            | Special Operations Forces                  |
| `X`  | Other          | Entities not fitting standard dimensions   |

For Argos, nearly everything is `G` (ground). RF emitters are ground-based
equipment/installations.

### 2.5 Function Codes (Positions 4+)

Function codes come from MIL-STD-2525 Symbol ID positions 5-10. In the standard,
these are "three groups of two characters." In CoT, they are flattened into a
hyphen-delimited list.

**Key ground function codes relevant to Argos:**

| CoT Type Fragment | 2525 Function   | Description                             |
| ----------------- | --------------- | --------------------------------------- |
| `G-U`             | Unit            | Generic unit                            |
| `G-U-C`           | Combat          | Ground combat unit                      |
| `G-U-C-I`         | Infantry        | Ground infantry                         |
| `G-E`             | Equipment       | Ground equipment                        |
| `G-E-S`           | Sensor          | Sensor equipment                        |
| `G-E-S-R`         | Radar           | Radar equipment                         |
| `G-E-S-E`         | Emplaced Sensor | Fixed sensor position                   |
| `G-E-W`           | Weapon          | Weapon system                           |
| `G-E-W-J`         | ECM/Jammer      | Electronic countermeasures              |
| `G-E-V`           | Vehicle         | Ground vehicle                          |
| `G-I`             | Installation    | Fixed installation                      |
| `G-I-U`           | Utility         | Utility facility                        |
| `G-I-U-T`         | Telecom         | Telecommunications facility             |
| `G-I-U-T-com`     | Communications  | Communications facility (CoT extension) |
| `G-I-U-T-com-tow` | Comm Tower      | Communications tower (CoT extension)    |
| `G-I-U-T-r`       | Radio           | Radio facility                          |

### 2.6 MIL-STD-2525 SIGINT Scheme

MIL-STD-2525C includes a dedicated **Signals Intelligence** scheme (Appendix D,
Table D-I, page 964). This is a separate coding scheme from the warfighting scheme,
with its own SIDC format:

```
SIDC Position:  1    2    3    4    5-10    11-12   13-14
                |    |    |    |      |       |       |
Scheme:    Intelligence  Identity  Dimension  Status  Function  Country  OoB
```

The SIGINT scheme includes battle dimensions for Space, Air, Ground, and Sea,
with function codes specifically for:

- Communications intelligence (COMINT)
- Electronic intelligence (ELINT)
- Foreign instrumentation signals intelligence (FISINT)

However, in practice, **TAK clients primarily use the warfighting scheme** (atom `a-`
types) for displaying entities on the map. The SIGINT scheme SIDCs do not map directly
to CoT type strings. Instead, the community uses combinations of warfighting atom types
with custom detail extensions for SIGINT-specific metadata.

---

## 3. EW/SIGINT-Relevant CoT Types

### 3.1 Standard Atom Types for EW Entities

These are standard MIL-STD-2525 derived types available in the CoT type tree:

**Ground Equipment:**

| Full CoT Type | Description               | Argos Use                 |
| ------------- | ------------------------- | ------------------------- |
| `a-u-G-E-S`   | Unknown ground sensor     | Generic detected sensor   |
| `a-u-G-E-S-R` | Unknown ground radar      | Detected radar emitter    |
| `a-u-G-E-S-E` | Unknown emplaced sensor   | Fixed RF sensor           |
| `a-h-G-E-W-J` | Hostile ground ECM/jammer | Detected jammer           |
| `a-f-G-E-S`   | Friendly ground sensor    | Argos own sensor position |
| `a-f-G-E-S-R` | Friendly ground radar     | Argos radar mode          |

**Air Electronic Warfare:**

| Full CoT Type   | Description                              | Argos Use                |
| --------------- | ---------------------------------------- | ------------------------ |
| `a-u-A-M-F-J`   | Unknown airborne ECM/jammer              | Detected airborne jammer |
| `a-u-A-M-F-R-Z` | Unknown electronic surveillance measures | Detected ESM platform    |

**Communications Infrastructure:**

| Full CoT Type         | Description              | Argos Use                |
| --------------------- | ------------------------ | ------------------------ |
| `a-u-G-I-U-T`         | Unknown telecom facility | Detected cell tower      |
| `a-u-G-I-U-T-com`     | Unknown communications   | Generic comms facility   |
| `a-u-G-I-U-T-com-tow` | Unknown comm tower       | Cell/radio tower         |
| `a-u-G-I-U-T-r`       | Unknown radio            | Radio transmitter        |
| `a-n-G-I-U-T-com-tow` | Neutral comm tower       | Known commercial tower   |
| `a-h-G-I-U-T-r`       | Hostile radio            | Threat radio transmitter |

### 3.2 CoT Extension Types for SIGINT

When no standard 2525 type fits precisely, CoT allows lowercase extensions appended
to the type string. These are community conventions used in the TAK ecosystem:

**WiFi/Network types (proposed for Argos):**

| Proposed CoT Type      | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `a-u-G-E-S-e-wifi`     | Unknown WiFi emitter (emplaced sensor extension) |
| `a-u-G-I-U-T-com-wifi` | Unknown WiFi access point (comms extension)      |
| `a-h-G-I-U-T-com-wifi` | Hostile WiFi access point                        |
| `a-f-G-I-U-T-com-wifi` | Friendly WiFi access point                       |

**GSM/Cellular types (proposed for Argos):**

| Proposed CoT Type      | Description                     |
| ---------------------- | ------------------------------- |
| `a-u-G-I-U-T-com-cell` | Unknown cellular tower          |
| `a-n-G-I-U-T-com-cell` | Neutral (commercial) cell tower |
| `a-h-G-I-U-T-com-cell` | Hostile/rogue cell tower        |

**RF emitter types (proposed for Argos):**

| Proposed CoT Type  | Description              |
| ------------------ | ------------------------ |
| `a-u-G-E-S-rf`     | Unknown RF emitter       |
| `a-u-G-E-S-rf-sig` | Unknown RF signal source |

**Important:** Lowercase extensions are ignored by TAK clients that don't understand
them -- the client falls back to the nearest recognized parent type. So
`a-u-G-I-U-T-com-wifi` renders as a generic communications facility icon if the
client does not have a WiFi-specific icon.

### 3.3 Bits Types for Sensor Data

The `b-` (bits) branch carries meta-information about data rather than physical entities.
Relevant types observed in production TAK traffic:

| CoT Type    | Description            | Argos Use                  |
| ----------- | ---------------------- | -------------------------- |
| `b-i-v`     | Video/imagery          | Video feed from sensor     |
| `b-a-o-tbl` | Alert: 911/emergency   | Alert notification         |
| `b-a-g`     | Alert: geofence breach | Geofence violation         |
| `b-r-f-h-c` | Report: CASEVAC        | Medical evacuation request |
| `b-t-f`     | Text: chat message     | Team communication         |
| `b-m-r`     | Map: route             | Route/path overlay         |
| `b-m-p-s-m` | Map point: spot map    | Marked position            |

**Proposed bits types for Argos sensor data:**

| Proposed CoT Type | Description                                      |
| ----------------- | ------------------------------------------------ |
| `b-e-s-rf`        | Bits, emitter, signal, RF -- raw RF detection    |
| `b-e-s-wifi`      | Bits, emitter, signal, WiFi -- WiFi probe/beacon |
| `b-e-s-gsm`       | Bits, emitter, signal, GSM -- GSM signal data    |

### 3.4 Attaching Metadata to CoT Events

The `<detail>` element is freeform XML, so SIGINT-specific metadata can be attached
as custom sub-elements. There is no formal schema for these -- the convention is to
use descriptive element names that TAK clients will preserve and relay even if they
don't render them.

**Recommended custom detail elements for Argos:**

```xml
<detail>
  <!-- Standard elements TAK clients understand -->
  <contact callsign="AP-FreeWifi-ch6"/>
  <remarks>Open WiFi AP detected by Kismet, possible honeypot</remarks>

  <!-- Custom SIGINT metadata (preserved but not rendered by stock ATAK) -->
  <__sigint>
    <rf freq_mhz="2437" channel="6" bandwidth_mhz="20"
        signal_dbm="-42" noise_dbm="-95"/>
    <wifi ssid="FREE_WIFI" bssid="AA:BB:CC:DD:EE:FF"
          encryption="OPEN" clients="3"
          first_seen="2026-02-16T14:20:00Z"
          last_seen="2026-02-16T14:30:00Z"/>
    <classification threat_level="HIGH"
                    confidence="0.85"
                    category="ROGUE_AP"/>
  </__sigint>

  <!-- Sensor that detected this -->
  <sensor azimuth="0" elevation="0" fov="360" vfov="180"
          range="100" type="r-e" model="Alfa-AWUS036ACH"/>

  <!-- Link back to the Argos platform that detected this -->
  <link uid="ARGOS-RPi5-01" relation="p-p"
        type="a-f-G-E-S"/>
</detail>
```

**Key design principles:**

1. **Double-underscore prefix** (`__sigint`, `__video`) is the TAK convention for
   "internal" detail elements that clients should preserve but may not render
2. Standard elements (`contact`, `remarks`, `sensor`, `link`) provide baseline
   interoperability -- even clients without SIGINT plugins see the callsign, remarks,
   and sensor FOV cone
3. The `link` element associates the detection with the Argos platform that detected it
4. Custom metadata is structured but optional -- clients that understand `__sigint`
   can parse it; others ignore it gracefully

### 3.5 The `sensor` and `__video` Detail Extensions

**Sensor:** Defined in the official CoT Sensor Schema (public release XSD from MITRE).
When a sensor element is attached to a CoT event, ATAK renders a field-of-view cone
on the map emanating from the entity's position. This is highly relevant for Argos:

- HackRF directional scanning: Set `fov` to the antenna beamwidth
- Omnidirectional WiFi: Set `fov="360"` for full-circle coverage
- GSM scanning: Set `fov` based on the antenna pattern

**Video:** The `__video` element associates a video stream with a CoT entity.
When present, ATAK shows a "video" action radial on the entity. Structure:

```xml
<__video url="rtsp://192.168.1.50:8554/stream1"/>
```

While Argos does not stream video, this pattern could be adapted for a live
spectrum waterfall view if exposed via a streaming URL.

---

## 4. CoT Event Examples for Argos Entities

### 4.1 WiFi Access Point (Detected by Kismet)

```xml
<event version="2.0"
       uid="ARGOS-WIFI-AABBCCDDEEFF"
       type="a-u-G-I-U-T-com-wifi"
       time="2026-02-16T14:32:15.000Z"
       start="2026-02-16T14:32:15.000Z"
       stale="2026-02-16T14:37:15.000Z"
       how="m-s">
  <!--
    uid:  Derived from BSSID (MAC address) for stable identity
    type: a(atom)-u(unknown)-G(ground)-I(installation)-U(utility)
          -T(telecom)-com(communications)-wifi(CoT extension)
    how:  m-s = machine sensor (Kismet WiFi detection)
    stale: 5 minutes (refresh on next Kismet update)
  -->
  <point lat="35.2831" lon="-116.6902" hae="9999999.0"
         ce="50.0" le="9999999.0"/>
  <!--
    Position estimated by Kismet (large ce due to WiFi trilateration)
    hae/le unknown (no altitude from WiFi)
  -->
  <detail>
    <contact callsign="FREE_WIFI [ch6]"/>
    <remarks source="ARGOS-RPi5-01"
             time="2026-02-16T14:32:15Z">
      Open WiFi AP, 3 associated clients. Possible honeypot.
      BSSID: AA:BB:CC:DD:EE:FF
    </remarks>
    <__sigint>
      <rf freq_mhz="2437" channel="6" bandwidth_mhz="20"
          signal_dbm="-42" noise_dbm="-95"/>
      <wifi ssid="FREE_WIFI" bssid="AA:BB:CC:DD:EE:FF"
            encryption="OPEN" cipher="NONE" auth="OPEN"
            clients="3" channel="6" phy_type="802.11ac"
            first_seen="2026-02-16T14:20:00Z"
            last_seen="2026-02-16T14:32:15Z"
            manufacturer="TP-Link"/>
      <classification threat_level="HIGH" confidence="0.85"
                      category="ROGUE_AP"/>
    </__sigint>
    <sensor azimuth="0" elevation="0" fov="360" range="100"
            model="Alfa-AWUS036ACH" type="r-e"/>
    <link uid="ARGOS-RPi5-01" relation="p-p" type="a-f-G-E-S"/>
  </detail>
</event>
```

### 4.2 HackRF RF Signal Detection

```xml
<event version="2.0"
       uid="ARGOS-RF-462500-1708094400"
       type="a-u-G-E-S-rf"
       time="2026-02-16T14:40:00.000Z"
       start="2026-02-16T14:40:00.000Z"
       stale="2026-02-16T14:45:00.000Z"
       how="m-s">
  <!--
    uid:  Frequency + epoch for unique signal identification
    type: a(atom)-u(unknown)-G(ground)-E(equipment)-S(sensor)
          -rf(CoT extension: RF emitter)
    how:  m-s = machine sensor (HackRF spectrum analysis)
  -->
  <point lat="35.2828" lon="-116.6906" hae="615.0"
         ce="500.0" le="9999999.0"/>
  <!--
    Large ce (500m) because HackRF alone cannot geolocate.
    Position is the Argos platform location as a rough estimate.
  -->
  <detail>
    <contact callsign="RF-462.500MHz"/>
    <remarks source="ARGOS-RPi5-01"
             time="2026-02-16T14:40:00Z">
      Strong signal detected at 462.500 MHz (FRS/GMRS band).
      Continuous carrier, possibly a repeater.
    </remarks>
    <__sigint>
      <rf freq_mhz="462.500" bandwidth_mhz="0.025"
          signal_dbm="-35" noise_dbm="-110"
          modulation="FM" freq_start_mhz="462.475"
          freq_end_mhz="462.525"/>
      <detection type="continuous_carrier"
                 duration_sec="120"
                 first_seen="2026-02-16T14:38:00Z"
                 peak_power_dbm="-35"/>
      <classification threat_level="LOW" confidence="0.60"
                      category="FRS_GMRS"/>
    </__sigint>
    <sensor azimuth="0" elevation="0" fov="360" range="5000"
            model="HackRF-One" type="r"/>
    <link uid="ARGOS-RPi5-01" relation="p-p" type="a-f-G-E-S"/>
  </detail>
</event>
```

### 4.3 GSM Cell Tower

```xml
<event version="2.0"
       uid="ARGOS-GSM-310-260-1234-5678"
       type="a-n-G-I-U-T-com-cell"
       time="2026-02-16T14:45:00.000Z"
       start="2026-02-16T14:45:00.000Z"
       stale="2026-02-16T15:45:00.000Z"
       how="m-c">
  <!--
    uid:  MCC-MNC-LAC-CellID for stable tower identity
    type: a(atom)-n(neutral)-G(ground)-I(installation)-U(utility)
          -T(telecom)-com(communications)-cell(CoT extension)
    how:  m-c = machine calculated (from cell ID database lookup)
    stale: 1 hour (towers are relatively static)
  -->
  <point lat="35.2850" lon="-116.6880" hae="625.0"
         ce="100.0" le="50.0"/>
  <!--
    Position from cell tower database (OpenCelliD or similar).
    ce=100m typical for database accuracy.
  -->
  <detail>
    <contact callsign="T-Mobile Tower 5678"/>
    <remarks source="ARGOS-RPi5-01"
             time="2026-02-16T14:45:00Z">
      Commercial GSM tower. MCC:310 MNC:260 LAC:1234 CID:5678.
      Detected via grgsm_livemon.
    </remarks>
    <__sigint>
      <rf freq_mhz="945.200" bandwidth_mhz="0.200"
          signal_dbm="-65" noise_dbm="-110"/>
      <gsm mcc="310" mnc="260" lac="1234" cell_id="5678"
           arfcn="45" bsic="23"
           technology="GSM900" operator="T-Mobile"
           neighbors="3"/>
      <classification threat_level="NONE" confidence="0.95"
                      category="COMMERCIAL_TOWER"/>
    </__sigint>
    <link uid="ARGOS-RPi5-01" relation="p-p" type="a-f-G-E-S"/>
  </detail>
</event>
```

**For a rogue/IMSI-catcher tower, change:**

- `type` to `a-s-G-I-U-T-com-cell` (suspect) or `a-h-G-I-U-T-com-cell` (hostile)
- `classification category` to `ROGUE_BTS` or `IMSI_CATCHER`
- `threat_level` to `CRITICAL`

### 4.4 Own Position (GPS Situational Awareness)

This is the standard SA (situational awareness) message that Argos should broadcast
periodically to appear on other TAK clients as a friendly sensor platform.

```xml
<event version="2.0"
       uid="ARGOS-RPi5-01"
       type="a-f-G-E-S"
       time="2026-02-16T14:30:00.000Z"
       start="2026-02-16T14:30:00.000Z"
       stale="2026-02-16T14:35:00.000Z"
       how="m-g">
  <!--
    uid:  Stable platform identifier
    type: a(atom)-f(friendly)-G(ground)-E(equipment)-S(sensor)
          Renders as a friendly ground sensor icon
    how:  m-g = machine GPS
    stale: 5 minutes (refresh every 30-60 seconds)
  -->
  <point lat="35.2828" lon="-116.6906" hae="615.0"
         ce="3.0" le="8.0"/>
  <detail>
    <contact callsign="ARGOS-01"
             endpoint="192.168.1.50:4242:tcp"/>
    <__group name="Yellow" role="Team Lead"/>
    <precisionlocation altsrc="GPS" geopointsrc="GPS"/>
    <track course="0.0" speed="0.0"/>
    <status battery="92"/>
    <takv os="Kali Linux 2025.4" version="1.0.0"
          device="Raspberry Pi 5" platform="Argos"/>
    <remarks>EW/SIGINT sensor platform. HackRF + Kismet active.</remarks>
  </detail>
</event>
```

**Key SA message properties:**

- Broadcast every 30-60 seconds
- Type `a-f-G-U-C` is the most common (generic friendly ground unit) but
  `a-f-G-E-S` is more accurate for a sensor platform
- The `__group` element controls team color in ATAK
- The `takv` element identifies the platform software

### 4.5 Signal Strength / Direction Data

For directional RF measurements, the `sensor` element provides the FOV cone.
For signal-strength heatmap data or bearing lines, CoT supports two approaches:

**Approach 1: Sensor FOV with bearing** (single detection, directional antenna)

```xml
<sensor azimuth="135.0" elevation="0.0" fov="30.0" vfov="30.0"
        range="2000" model="Yagi-900MHz" type="r"/>
```

This renders a cone on the map from the sensor position toward azimuth 135
with a 30-degree beamwidth.

**Approach 2: Multiple bearing lines** (lines of bearing from different positions)

Use `u-rb-a` (user-defined range bearing line) type events to draw LOB lines
on the map. The intersection suggests the emitter location.

**Approach 3: Shaped detection area** (approximate coverage zone)

Use `u-d-f` (user-defined freeform shape) to draw a polygon representing the
estimated detection area, colored by signal strength.

---

## 5. Parsing and Generating CoT

### 5.1 XML Parsing in Node.js

**Recommended library: `fast-xml-parser`**

fast-xml-parser is a pure JavaScript XML parser/builder with no native dependencies.
It handles CoT XML well since CoT messages are small (typically under 2KB).

```typescript
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

// Parser configuration for CoT
const parser = new XMLParser({
	ignoreAttributes: false, // CoT relies heavily on attributes
	attributeNamePrefix: '@_', // Prefix for attribute keys in JSON
	textNodeName: '#text', // For text content in remarks, etc.
	parseAttributeValue: false, // Keep all values as strings
	trimValues: true
});

// Parse incoming CoT XML
const cotJson = parser.parse(xmlString);
const event = cotJson.event;
const uid = event['@_uid'];
const type = event['@_type'];
const lat = parseFloat(event.point['@_lat']);
const lon = parseFloat(event.point['@_lon']);

// Builder configuration for CoT
const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	textNodeName: '#text',
	format: false, // No pretty-print (saves bandwidth)
	suppressEmptyNode: true
});

// Generate CoT XML from JSON object
const xmlOutput = builder.build({
	event: {
		'@_version': '2.0',
		'@_uid': 'ARGOS-WIFI-AABBCCDDEEFF',
		'@_type': 'a-u-G-I-U-T-com-wifi',
		'@_time': new Date().toISOString(),
		'@_start': new Date().toISOString(),
		'@_stale': new Date(Date.now() + 300000).toISOString(),
		'@_how': 'm-s',
		point: {
			'@_lat': '35.2831',
			'@_lon': '-116.6902',
			'@_hae': '9999999.0',
			'@_ce': '50.0',
			'@_le': '9999999.0'
		},
		detail: {
			contact: { '@_callsign': 'FREE_WIFI [ch6]' },
			remarks: { '#text': 'Open WiFi AP detected' }
		}
	}
});
```

**Alternative: `@tak-ps/node-cot`**

The official TAK Public Safety node-cot library provides higher-level abstractions:

```typescript
import CoT from '@tak-ps/node-cot';

// Parse from XML string
const cot = new CoT(xmlString);

// Export formats
const geojson = cot.to_geojson(); // GeoJSON Feature
const xml = cot.to_xml(); // XML string
const raw = cot.raw; // JSON representation

// Create from GeoJSON
const feature = {
	type: 'Feature',
	id: 'ARGOS-WIFI-AABBCCDDEEFF',
	properties: {
		type: 'a-u-G-I-U-T-com-wifi',
		how: 'm-s',
		callsign: 'FREE_WIFI [ch6]',
		remarks: 'Open WiFi AP detected by Kismet',
		time: new Date().toISOString(),
		start: new Date().toISOString(),
		stale: new Date(Date.now() + 300000).toISOString()
	},
	geometry: {
		type: 'Point',
		coordinates: [-116.6902, 35.2831]
	}
};
const cotFromGeo = CoT.from_geojson(feature);
```

`@tak-ps/node-cot` also handles protobuf serialization/deserialization, making it
the recommended library for Argos TAK integration.

### 5.2 CoT Message Framing over TCP

TAK uses three TCP modes, each with different framing:

**Port 8087 -- Standard TCP (open-squirt-close):**

- Open a new TCP connection for each CoT message
- Send XML header + newline + complete XML
- Close connection immediately
- Low performance, suitable for infrequent updates only

**Port 8088 -- Stream TCP (persistent connection):**

- Maintain a persistent TCP connection
- Messages prefaced with XML declaration, followed by a newline, then XML body
- No newlines within the XML body
- Next message begins immediately after the previous one ends

```
<?xml version="1.0" encoding="UTF-8"?>\n<event ...>...</event><?xml version="1.0" encoding="UTF-8"?>\n<event ...>...</event>
```

**Port 8089 -- Stream SSL/TLS:**

- Same framing as 8088, but over TLS 1.2
- Requires client certificate (PKCS#12/.p12 format)
- Server provides CA certificate for trust establishment

**TAK Protocol Version 1 framing (protobuf over stream TCP/TLS):**

After protocol negotiation, messages switch to binary format:

```
Stream:  [0xBF] [varint: payload_length] [protobuf_payload]
```

The negotiation process over the TCP stream:

1. Client and server exchange XML CoT messages initially
2. Server sends `<TakControl>` with `<TakProtocolSupport version="1"/>`
3. Client sends `<TakControl>` with `<TakRequest version="1"/>`
4. Server sends `<TakControl>` with `<TakResponse status="true"/>`
5. Both sides switch to protobuf framing

### 5.3 Protobuf CoT (TAK Protocol Version 1)

TAK Protocol Version 1 uses Google Protocol Buffers v3 for serialization.

**Header format:**

| Mode         | Format                                        | Description                            |
| ------------ | --------------------------------------------- | -------------------------------------- |
| Mesh (UDP)   | `0xBF` + `varint(version)` + `0xBF` + payload | Static header, version in every packet |
| Stream (TCP) | `0xBF` + `varint(payload_length)` + payload   | Dynamic header, length-prefixed        |

The mesh format uses `191 1 191 <payload>` (0xBF = 191 decimal).

**Core protobuf message:**

```protobuf
// takmessage.proto
message TakMessage {
  CotEvent cotEvent = 1;
}

// cotevent.proto (simplified)
message CotEvent {
  string type = 1;
  string uid = 2;
  string how = 3;
  uint64 sendTime = 4;    // milliseconds since epoch
  uint64 startTime = 5;
  uint64 staleTime = 6;
  double lat = 7;
  double lon = 8;
  double hae = 9;
  double ce = 10;
  double le = 11;
  Detail detail = 12;
}

// detail.proto (simplified)
message Detail {
  Contact contact = 1;
  Group group = 2;
  Status status = 3;
  Takv takv = 4;
  Track track = 5;
  bytes xmlDetailBytes = 6;  // Arbitrary XML detail preserved as bytes
}
```

The `xmlDetailBytes` field is critical -- it preserves custom detail XML (like our
`__sigint` element) that does not have a protobuf field mapping. TAK clients serialize
unrecognized detail XML into this field and deserialize it back to XML on receipt.

**Proto files** are available in the AndroidTacticalAssaultKit-CIV repository:
`takcot/` directory contains the `.proto` definitions.

### 5.4 Mesh Networking (LAN Multicast)

TAK mesh mode uses UDP multicast for LAN/tactical network SA:

- **Default multicast group:** `239.2.3.1`
- **Default port:** `6969`
- **One CoT event per UDP datagram**
- **Max practical payload:** ~1450 bytes (MTU constraint)

Devices announce their presence via SA messages on the multicast group. All mesh
participants receive all messages. No server required.

Version negotiation in mesh mode:

1. Devices broadcast `TakControl` messages (minimum every 60 seconds)
2. `TakControl` indicates supported protocol version range
3. Devices use the highest version supported by ALL known contacts
4. If no overlap exists, fall back to version 0 (legacy XML)

### 5.5 Relevant Libraries

**JavaScript/TypeScript (recommended for Argos):**

| Library         | npm Package        | Description                                          |
| --------------- | ------------------ | ---------------------------------------------------- |
| node-cot        | `@tak-ps/node-cot` | Parse/generate CoT, XML+Protobuf, GeoJSON conversion |
| node-tak        | `@tak-ps/node-tak` | TAK server TLS connection management + REST API SDK  |
| fast-xml-parser | `fast-xml-parser`  | Low-level XML parse/build (no CoT awareness)         |

**Python (useful for prototyping/testing):**

| Library     | PyPI Package       | Description                                      |
| ----------- | ------------------ | ------------------------------------------------ |
| pytak       | `pytak`            | TAK gateway framework, handles connections + CoT |
| takproto    | `takproto`         | Encode/decode TAK protobuf format                |
| takprotobuf | `takprotobuf`      | Alternative protobuf encoder/decoder             |
| takcot      | (in ATAK-CIV repo) | Reference CoT implementation                     |

**Rust:**

| Library | Crate    | Description                              |
| ------- | -------- | ---------------------------------------- |
| cottak  | `cottak` | CoT XML/protobuf types and serialization |

**Recommended Argos architecture:**

```
Argos SvelteKit App
  |
  +-- src/lib/server/tak/
  |     +-- cot-builder.ts      (Generate CoT XML/JSON from Argos entities)
  |     +-- cot-parser.ts       (Parse incoming CoT to Argos format)
  |     +-- tak-client.ts       (TCP/TLS connection to TAK server)
  |     +-- mesh-broadcaster.ts (UDP multicast for mesh mode)
  |     +-- types.ts            (CoT type constants and helpers)
  |
  +-- Uses @tak-ps/node-cot for serialization
  +-- Uses @tak-ps/node-tak for server connections
  +-- Uses fast-xml-parser as fallback for custom detail parsing
```

---

## 6. CoT over Different Transports

### 6.1 TCP Streaming (Persistent Connection)

**Port 8088** (cleartext) or **8089** (TLS):

```
Client                          TAK Server
  |                                |
  |--- TCP connect (8088/8089) --->|
  |                                |
  |<-- SA events from server ------|  (continuous stream)
  |--- SA event (own position) --->|  (every 30-60s)
  |--- Detection events ---------->|  (as detected)
  |<-- Other client events --------|  (relayed by server)
  |                                |
  |--- [protocol negotiation] ---->|  (optional, upgrade to protobuf)
  |<-- [TakResponse] --------------|
  |                                |
  |=== Protobuf framing ==========>|  (after negotiation)
  |                                |
```

**Connection characteristics:**

- Persistent TCP connection, kept alive with periodic SA messages
- Server relays messages between connected clients
- If connection drops, client reconnects and resends SA
- XML messages are newline-framed (XML declaration + newline + body)
- After protobuf negotiation: `0xBF` + varint length + protobuf payload

### 6.2 TLS (Certificate-Based Auth)

**Port 8089** is the standard TLS port:

- Uses mutual TLS (mTLS) -- both client and server present certificates
- Client certificate in PKCS#12 (.p12) format
- Server provides its CA certificate for trust
- TLS 1.2 minimum

**Certificate setup for Argos:**

```bash
# Generate from TAK server (typical workflow):
# 1. TAK server admin generates client cert
# 2. Export as .p12 file with password
# 3. Configure in Argos:

# Using node-tak:
const tak = await TAK.connect(
  'argos-01',
  new URL('ssl://takserver.example.mil:8089'),
  {
    cert: fs.readFileSync('/path/to/argos-01.p12'),
    password: process.env.TAK_CERT_PASSWORD,
  }
);
```

### 6.3 UDP Multicast (Mesh/LAN)

For disconnected or server-less operation:

- **Address:** `239.2.3.1:6969` (TAK defaults)
- **One CoT event per UDP datagram**
- **No authentication** (cleartext, anyone on the network can see/inject)
- **No guaranteed delivery** (UDP -- fire and forget)
- **Best for:** LAN training environments, tactical mesh networks

```typescript
import dgram from 'node:dgram';

const MULTICAST_ADDR = '239.2.3.1';
const MULTICAST_PORT = 6969;

// Send CoT to mesh
const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
socket.bind(MULTICAST_PORT, () => {
	socket.addMembership(MULTICAST_ADDR);
	socket.setMulticastTTL(32);
});

function broadcastCoT(xmlString: string): void {
	const buf = Buffer.from(xmlString, 'utf-8');
	socket.send(buf, 0, buf.length, MULTICAST_PORT, MULTICAST_ADDR);
}

// Receive CoT from mesh
socket.on('message', (msg, rinfo) => {
	const xml = msg.toString('utf-8');
	// Parse with fast-xml-parser or node-cot
});
```

**For TAK Protocol Version 1 mesh (protobuf):**

```typescript
// Mesh header: 0xBF 0x01 0xBF <protobuf_payload>
function broadcastProtobufCoT(protobufPayload: Buffer): void {
	const header = Buffer.from([0xbf, 0x01, 0xbf]);
	const packet = Buffer.concat([header, protobufPayload]);
	socket.send(packet, 0, packet.length, MULTICAST_PORT, MULTICAST_ADDR);
}
```

### 6.4 HTTP/REST (Marti API)

TAK Server exposes a REST API (Marti API) for non-streaming CoT operations:

**Key endpoints:**

| Method | Path                             | Description                          |
| ------ | -------------------------------- | ------------------------------------ |
| `GET`  | `/Marti/api/cot/sa`              | Get all situational awareness events |
| `GET`  | `/Marti/api/cot/xml/{uid}`       | Get a specific CoT event by UID      |
| `GET`  | `/Marti/api/cot/xml/{uid}/all`   | Get all data for a UID               |
| `GET`  | `/Marti/api/missions/{name}/cot` | Get CoT events for a mission         |

**Authentication:** Client certificate (mTLS) via the HTTP header.

**Ports:**

- `8443` -- Secure API port (HTTPS with client cert)
- `8080` -- Cleartext API port (development only)

**Usage for Argos:**

- POST detections to TAK server for persistence/distribution
- GET existing CoT events to populate the Argos map
- Query mission-specific events

```typescript
// Example using node-tak REST API SDK
import { TAKAPI, APIAuthCertificate } from '@tak-ps/node-tak';

const api = await TAKAPI.init(
	new URL('https://takserver.example.mil:8443'),
	new APIAuthCertificate(certPem, keyPem)
);

// Get all SA events
const saEvents = await api.fetch('/Marti/api/cot/sa');
```

### 6.5 WebSocket (WebTAK Approach)

WebTAK is a browser-based TAK client that uses WebSocket connections to the TAK server.
This is architecturally similar to what Argos would do:

- WebSocket connection to TAK server (typically via the secure API port)
- CoT events sent/received as text frames (XML) or binary frames (protobuf)
- Authentication via client certificate or token

**Relevance to Argos:** Since Argos is a SvelteKit web application, the WebSocket
approach may be the most natural integration path. The SvelteKit server (Node.js) would
maintain a WebSocket or TCP connection to the TAK server, and the browser client would
receive TAK data via Argos's existing SSE/WebSocket infrastructure.

### 6.6 Transport Selection for Argos

| Scenario                   | Transport     | Port           | Auth        |
| -------------------------- | ------------- | -------------- | ----------- |
| Training LAN, no server    | UDP multicast | 239.2.3.1:6969 | None        |
| TAK server on same network | TCP streaming | 8088           | None        |
| TAK server, production     | TLS streaming | 8089           | Client cert |
| TAK server REST queries    | HTTPS         | 8443           | Client cert |
| Integration with WebTAK    | WebSocket     | 8443           | Client cert |

**Recommended Argos default:** Start with UDP multicast for simplest LAN training
integration (zero config). Add TCP/TLS streaming for TAK server connectivity.

---

## References

### Specifications

- MITRE Corporation, "Cursor-on-Target Event Data Model Schema (Version 2.0)" -- Public Release, Case #11-3895
- MITRE Corporation, "Cursor-on-Target Message Router User's Guide" (MP090284)
- MIL-STD-2525C, "Common Warfighting Symbology" -- Appendix D: Signals Intelligence
- MIL-STD-2525D, "Joint Military Symbology" -- Appendix J: Signals Intelligence Symbols

### Code and Libraries

- `@tak-ps/node-cot` -- https://github.com/dfpc-coe/node-CoT
- `@tak-ps/node-tak` -- https://github.com/dfpc-coe/node-tak
- `fast-xml-parser` -- https://github.com/NaturalIntelligence/fast-xml-parser
- `pytak` -- https://github.com/snstac/pytak
- `takproto` -- https://takproto.readthedocs.io/en/latest/tak_protocols/
- AndroidTacticalAssaultKit-CIV -- https://github.com/deptofdefense/AndroidTacticalAssaultKit-CIV

### Protocol Documentation

- TAK Protocol Description -- https://takproto.readthedocs.io/en/latest/tak_protocols/
- De-mystifying the TAK Protocol -- https://www.ballantyne.online/de-mystifying-the-tak-protocol/
- FreeTAK Server Documentation -- https://freetakteam.github.io/FreeTAKServer-User-Docs/
- OpenTAKServer Documentation -- https://docs.opentakserver.io/
- CoT Event XSD (Public Release) -- https://github.com/deptofdefense/AndroidTacticalAssaultKit-CIV/blob/master/takcot/mitre/
- CoT Types XML -- https://github.com/Esri/defense-solutions-proofs-of-concept/blob/master/geoevent-components/solutions-geoevent/adapters/cot-adapter/src/main/resources/CoTTypes/CoTtypes.xml
- CoT types observed in the wild -- https://gist.github.com/a-f-G-U-C/77fed4e7aea38e27f3c50583e840a35b
- Cursor-on-Target: Research for a Sensor Network (PMC) -- https://pmc.ncbi.nlm.nih.gov/articles/PMC3615829/

### TAK Server Ports

- OpenTAKServer Architecture -- https://www.opentakserver.io/architecture.html
- Nzyme CoT Integration -- https://docs.nzyme.org/configuration/integrations/cot/

# RF Direction Finding & Geolocation

Tools for determining the direction of arrival (DOA) and physical location of RF transmitters using coherent SDR arrays and triangulation algorithms.

## Tools (3)

| Tool          | Repository                                    | Capabilities                                                                                                              | Argos Integration                                                                     | Maturity                          |
| ------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------- |
| KrakenSDR     | github.com/krakenrf/krakensdr_doa             | 5-channel coherent RTL-SDR array - direction of arrival (DOA) estimation using MUSIC algorithm, real-time bearing display | **VERY HIGH** - Python, JSON output, web UI, direct map integration, field-deployable | MATURE (commercial + open source) |
| DF Aggregator | github.com/krakenrf/krakensdr_doa (companion) | Aggregates multiple KrakenSDR units for triangulation - plots estimated transmitter location on map                       | **VERY HIGH** - Designed for multi-unit geolocation                                   | MATURE                            |
| rtl_coherent  | github.com/tejeez/rtl_coherent                | Coherent multi-RTL-SDR for direction finding using cheap dongles - experimental DOA                                       | **MEDIUM** - Requires multiple RTL-SDRs                                               | EXPERIMENTAL                      |

## Hardware Requirements

- KrakenSDR 5-channel coherent receiver (~$150)
- Multiple RTL-SDR dongles (rtl_coherent - cheaper alternative)
- Directional antenna array

## Priority Note

**KrakenSDR** is a top-5 priority tool for Argos - locate ANY transmitter on the tactical map using the MUSIC algorithm for DOA estimation. Deploy multiple units for triangulation via DF Aggregator. Direct Python/JSON integration with field-proven hardware.

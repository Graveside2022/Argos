# Contract: Sidebar Widgets

**Location**: `src/lib/components/dashboard/widgets/`
**Container**: 264px wide, `--surface-elevated` fill, `--border` border, 8px/12px padding, 8px gap

## Shared Widget Pattern

```html
<div class="widget">
	<div class="widget-header">
		<span class="widget-label">{title}</span>
		<!-- Fira Code 10px 600 --foreground-tertiary, uppercase, letter-spacing 1.2 -->
		<span class="spacer"></span>
		<button class="widget-close">{x icon}</button>
		<!-- 12px --muted-foreground -->
	</div>
	<div class="widget-content">
		<!-- Type-specific content -->
	</div>
	<div class="widget-footer">
		<span class="status-dot {statusColor}"></span>
		<span class="status-label">{statusLabel}</span>
		<!-- Fira Code 10px --muted-foreground -->
		<span class="timestamp">{timestamp}</span>
		<span class="spacer"></span>
		<button class="widget-action">{icon} {actionLabel}</button>
		<!-- Fira Code 10px --muted-foreground -->
	</div>
</div>
```

## Speed Test Widget

**Content**:

- Server info row (ISP name, location)
- Download block: arrow-down icon (`--status-healthy`), "DOWNLOAD" label, speed value (Mbps), 3px progress bar (`--status-healthy` fill on `--surface-hover` track)
- Upload block: arrow-up icon (`--primary`), "UPLOAD" label, speed value (Mbps), 3px progress bar (`--primary` fill)

**Footer**: status dot + "Last test" + timestamp + "Retest" action

**Props**:

```typescript
{
  serverName?: string;
  downloadSpeed?: number;  // Mbps
  uploadSpeed?: number;    // Mbps
  downloadProgress?: number;  // 0-100
  uploadProgress?: number;    // 0-100
  lastTested?: string;     // Timestamp
}
```

## Network Latency Widget

**Content**:

- Server status row ("Connected — XXms" in `--status-healthy`)
- Latency block: signal icon (`--primary`), "LATENCY" label, value + "ms", progress bar
- Stats: Jitter row (label + value), Packet Loss row (label + value + "%")

**Footer**: status dot + quality label + timestamp + "Ping" action

**Props**:

```typescript
{
  connected?: boolean;
  latency?: number;       // ms
  jitter?: number;        // ms
  packetLoss?: number;    // percentage
  serverLatency?: number; // ms (displayed in status row)
  lastPinged?: string;
}
```

## Weather Widget

**Content**:

- Source row: map-pin icon + "Open-Meteo — Local GPS"
- Temperature block: thermometer icon (`--primary`), "TEMPERATURE" label, value + "°C/°F"
- Key-value rows: Conditions, Wind (speed + direction), Humidity (%), Visibility (km)

**Footer**: sunrise icon (`--status-warning`) + sunrise time, sunset time + "Refresh" action

**Props**:

```typescript
{
  temperature?: number;
  conditions?: string;
  windSpeed?: number;
  windDirection?: string;
  humidity?: number;
  visibility?: number;
  sunrise?: string;
  sunset?: string;
}
```

## Node Mesh Widget

**Content**:

- Header with connected/total count (e.g., "3/4")
- TAK Servers section: radio-tower icon (`--primary`), server list with:
    - Server name, status dot, port, latency, client count, TLS indicator
- Divider (`--border`)
- Peer Mesh section: network icon (`--foreground-secondary`), peer list with:
    - Callsign, latency, OFFLINE status (in `--status-error-muted`)

**Footer**: status dot + "Mesh OK" / "Degraded" + timestamp

**Props**:

```typescript
{
  connectedNodes?: number;
  totalNodes?: number;
  takServers?: Array<{
    name: string;
    status: 'online' | 'offline';
    port: number;
    latency?: number;
    clients?: number;
    tls?: boolean;
  }>;
  peers?: Array<{
    callsign: string;
    latency?: number;
    status: 'online' | 'offline';
  }>;
}
```

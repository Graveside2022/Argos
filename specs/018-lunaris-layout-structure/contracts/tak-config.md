# Contract: TAK Server Config Form

**Location**: `src/lib/components/dashboard/tak/TakConfigView.svelte`
**Container**: Full-width mode — no sidebar, fills entire content area

## Layout

```html
<div class="tak-config">
	<div class="tak-header">
		<!-- 48px height, --surface-elevated fill -->
		<span class="tak-title">TAK SERVER</span>
		<!-- Fira Code 14px 600 --foreground, letter-spacing 1.5 -->
		<span class="spacer"></span>
		<span class="status-chip {statusClass}">{statusLabel}</span>
		<!-- 24px height, 8px/12px padding, 4px radius -->
		<!-- Connected: --status-healthy bg, dark text -->
		<!-- Disconnected: --status-error-muted bg, light text -->
	</div>
	<div class="tak-body">
		<!-- overflow-y: auto, 24px/32px padding, 16px section gap -->
		{#each sections as section}
		<div class="form-section">
			<h3 class="section-title">{section.title}</h3>
			<!-- Fira Code 10px 600 --foreground-secondary, letter-spacing 1.2, uppercase -->
			<div class="section-content">...</div>
		</div>
		{/each}
	</div>
</div>
```

## 7 Form Sections

| #   | Section            | Controls                                                            |
| --- | ------------------ | ------------------------------------------------------------------- |
| 1   | Status             | Connection indicator dot + label + uptime                           |
| 2   | Server             | Description textarea, Host input, Port input, Enable toggle         |
| 3   | Authentication     | Radio group: Import / Enroll (--primary accent border on selected)  |
| 4   | Client Certificate | File chooser + password input + upload button + status notification |
| 5   | Trust Store        | File chooser + password input + upload button + status notification |
| 6   | Data Package       | File chooser + import button                                        |
| 7   | Actions            | Save button (--primary fill, Fira Code 12px 600, full-width)        |

## Input Styling

- **Text inputs**: 36px height, --background fill, --border border, 4px radius, Fira Code 12px --foreground, placeholder in --muted-foreground
- **Toggle switch**: 36px wide, on = --primary, off = #2A2A2A
- **Radio buttons**: --primary accent border when selected, --border when unselected
- **File chooser**: --surface-elevated fill, dashed --border border, "Choose file" label
- **Buttons**: --primary fill for primary, --surface-elevated fill for secondary

## Data Source

- **Store**: `takStore` from `src/lib/stores/tak/tak-store.ts`
- **API**: `/api/tak/config` (GET/POST), `/api/tak/status` (GET)

## State Machine

```
disconnected → connecting → connected → disconnecting → disconnected
                    ↓
                  error → disconnected (via retry)
```

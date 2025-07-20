# Packet Visualization UI Interaction Patterns

## 1. Packet Filtering Controls

### Filter Panel Design
```typescript
interface PacketFilterUI {
  // Visual Layout
  layout: {
    position: 'sidebar' | 'toolbar' | 'floating-panel';
    collapsible: boolean;
    defaultState: 'expanded' | 'collapsed';
  };
  
  // Filter Types
  filters: {
    // Quick filters (one-click toggles)
    quickFilters: [
      { id: 'tcp', label: 'TCP', icon: 'network', color: '#3B82F6' },
      { id: 'udp', label: 'UDP', icon: 'broadcast', color: '#10B981' },
      { id: 'http', label: 'HTTP', icon: 'globe', color: '#F59E0B' },
      { id: 'https', label: 'HTTPS', icon: 'lock', color: '#059669' },
      { id: 'dns', label: 'DNS', icon: 'search', color: '#8B5CF6' },
      { id: 'anomalies', label: 'Anomalies Only', icon: 'alert', color: '#EF4444' }
    ];
    
    // Advanced filters
    advanced: {
      ipRange: {
        type: 'dual-input' | 'cidr-notation';
        validation: 'real-time';
        suggestions: boolean; // Auto-suggest from current traffic
      };
      
      portRange: {
        type: 'range-slider' | 'number-inputs';
        presets: ['Well-known', 'Registered', 'Dynamic'];
      };
      
      timeWindow: {
        type: 'datetime-range' | 'relative-time';
        quickSelects: ['Last 5m', 'Last 15m', 'Last 1h', 'Custom'];
      };
      
      packetSize: {
        type: 'histogram-brush';
        visualization: 'inline-sparkline';
      };
    };
  };
}
```

### Interaction Patterns

#### Real-time Filter Preview
```typescript
class FilterPreview {
  // Show impact before applying
  onFilterHover(filter: Filter) {
    // Dim non-matching packets
    this.visualizeFilterImpact(filter, { 
      opacity: 0.3,
      transition: 'ease-out 200ms' 
    });
    
    // Show match count
    this.showMatchCount(filter);
  }
  
  // Smooth transitions
  onFilterApply(filters: Filter[]) {
    // Animate packet removal/addition
    this.animateFilterTransition({
      exitAnimation: 'fade-scale-out',
      enterAnimation: 'fade-scale-in',
      stagger: 20 // ms between elements
    });
  }
}
```

#### Filter Combination Logic
```svelte
<!-- PacketFilterControls.svelte -->
<script lang="ts">
  let filterMode: 'AND' | 'OR' = 'AND';
  let activeFilters: Set<string> = new Set();
  
  // Visual feedback for filter logic
  $: filterBadge = activeFilters.size > 1 
    ? `${activeFilters.size} filters (${filterMode})`
    : `${activeFilters.size} filter`;
</script>

<div class="filter-controls">
  <!-- Filter mode toggle -->
  <ToggleGroup bind:value={filterMode}>
    <ToggleItem value="AND" tooltip="All conditions must match">
      <Icon name="intersect" /> AND
    </ToggleItem>
    <ToggleItem value="OR" tooltip="Any condition matches">
      <Icon name="union" /> OR
    </ToggleItem>
  </ToggleGroup>
  
  <!-- Active filter chips -->
  <div class="active-filters">
    {#each [...activeFilters] as filter (filter)}
      <FilterChip 
        {filter} 
        removable
        on:remove={() => removeFilter(filter)}
      />
    {/each}
  </div>
</div>
```

## 2. Anomaly Alert Prioritization

### Alert Management Interface
```typescript
interface AnomalyPrioritizationUI {
  // Alert Display
  display: {
    layout: 'timeline' | 'list' | 'grid';
    grouping: 'severity' | 'type' | 'time' | 'source';
    maxVisible: number; // Prevent UI overload
  };
  
  // Priority Controls
  prioritization: {
    // User-adjustable weights
    weights: {
      severity: { value: 0.4, range: [0, 1], step: 0.1 };
      frequency: { value: 0.3, range: [0, 1], step: 0.1 };
      recency: { value: 0.2, range: [0, 1], step: 0.1 };
      impact: { value: 0.1, range: [0, 1], step: 0.1 };
    };
    
    // Threshold controls
    thresholds: {
      autoEscalate: {
        enabled: boolean;
        conditions: ['repeatCount > 5', 'severity === "critical"'];
      };
      
      autoDismiss: {
        enabled: boolean;
        after: 'resolved' | 'timeout' | 'acknowledged';
      };
    };
  };
  
  // Visual Encoding
  visualization: {
    severityColors: {
      critical: { bg: '#DC2626', text: '#FFFFFF', pulse: true };
      high: { bg: '#F59E0B', text: '#000000', pulse: false };
      medium: { bg: '#3B82F6', text: '#FFFFFF', pulse: false };
      low: { bg: '#6B7280', text: '#FFFFFF', pulse: false };
    };
    
    animations: {
      newAlert: 'slide-in-top' | 'fade-scale' | 'ripple';
      dismiss: 'slide-out-right' | 'fade-out' | 'collapse';
      escalate: 'flash' | 'shake' | 'grow';
    };
  };
}
```

### Interactive Alert Timeline
```svelte
<!-- AnomalyTimeline.svelte -->
<script lang="ts">
  import { spring } from 'svelte/motion';
  
  // Smooth priority transitions
  const prioritySpring = spring(0, {
    stiffness: 0.2,
    damping: 0.8
  });
  
  // Interactive threshold adjustment
  function handleThresholdDrag(event: DragEvent) {
    const newThreshold = calculateThreshold(event.clientY);
    $alertThreshold = newThreshold;
    
    // Preview impact
    showThresholdPreview(newThreshold);
  }
</script>

<div class="anomaly-timeline">
  <!-- Priority threshold line (draggable) -->
  <div 
    class="threshold-line"
    draggable="true"
    on:drag={handleThresholdDrag}
    style="top: {$prioritySpring}px"
  >
    <span class="threshold-label">
      Priority threshold: {$alertThreshold}
    </span>
  </div>
  
  <!-- Alert bubbles positioned by priority -->
  {#each $alerts as alert (alert.id)}
    <AlertBubble
      {alert}
      y={calculatePosition(alert.priority)}
      size={calculateSize(alert.impact)}
      color={getSeverityColor(alert.severity)}
      on:click={() => focusAlert(alert)}
      on:dismiss={() => dismissAlert(alert)}
    />
  {/each}
</div>
```

### Smart Alert Grouping
```typescript
class AlertGroupingStrategy {
  // Group similar alerts
  groupAlerts(alerts: Alert[]): AlertGroup[] {
    return alerts.reduce((groups, alert) => {
      const similarGroup = groups.find(g => 
        this.calculateSimilarity(g.prototype, alert) > 0.8
      );
      
      if (similarGroup) {
        similarGroup.add(alert);
      } else {
        groups.push(new AlertGroup(alert));
      }
      
      return groups;
    }, []);
  }
  
  // Visual representation of groups
  renderAlertGroup(group: AlertGroup) {
    return {
      badge: group.count > 1 ? `×${group.count}` : null,
      expandable: group.count > 1,
      summary: this.generateGroupSummary(group),
      trend: this.calculateTrend(group) // increasing/decreasing/stable
    };
  }
}
```

## 3. Export/Save Functionality

### Export Interface Design
```typescript
interface ExportUI {
  // Export triggers
  triggers: {
    manual: {
      button: 'toolbar' | 'context-menu' | 'keyboard-shortcut';
      icon: 'download' | 'export' | 'save';
    };
    
    automatic: {
      schedule: 'interval' | 'threshold' | 'event-based';
      conditions: string[]; // e.g., "alertCount > 100"
    };
  };
  
  // Export options
  options: {
    // Data selection
    selection: {
      scope: 'visible' | 'filtered' | 'time-range' | 'all';
      preview: boolean; // Show data preview before export
      estimatedSize: boolean; // Show file size estimate
    };
    
    // Format options
    formats: [
      { 
        id: 'pcap',
        label: 'PCAP (Wireshark)',
        icon: 'file-binary',
        options: ['include-payload', 'compress']
      },
      {
        id: 'json',
        label: 'JSON (Structured)',
        icon: 'file-code',
        options: ['pretty-print', 'include-metadata']
      },
      {
        id: 'csv',
        label: 'CSV (Spreadsheet)',
        icon: 'file-spreadsheet',
        options: ['headers', 'delimiter']
      },
      {
        id: 'report',
        label: 'Security Report',
        icon: 'file-report',
        options: ['include-charts', 'executive-summary']
      }
    ];
    
    // Visualization export
    visualization: {
      formats: ['png', 'svg', 'pdf'];
      options: ['current-view', 'full-timeline', 'with-legends'];
      resolution: ['screen', '2x', '4x', 'print'];
    };
  };
}
```

### Export Workflow Implementation
```svelte
<!-- ExportDialog.svelte -->
<script lang="ts">
  import { slide, fade } from 'svelte/transition';
  
  let exportStep: 'select' | 'configure' | 'preview' | 'processing' = 'select';
  let selectedFormat: ExportFormat;
  let exportProgress = 0;
  
  // Smart defaults based on context
  $: suggestedFormat = determineBestFormat($currentView, $selectedPackets);
  
  // Real-time export preview
  async function generatePreview() {
    const preview = await previewExport({
      format: selectedFormat,
      options: exportOptions,
      limit: 100 // First 100 records
    });
    
    return preview;
  }
</script>

<Dialog bind:open={exportDialogOpen}>
  <div class="export-workflow">
    <!-- Step indicator -->
    <StepIndicator 
      steps={['Select Data', 'Configure', 'Preview', 'Export']}
      current={exportStep}
    />
    
    {#if exportStep === 'select'}
      <div transition:slide>
        <!-- Data range selection -->
        <ExportRangeSelector
          bind:selection={dataSelection}
          on:change={updateSizeEstimate}
        />
        
        <!-- Quick export buttons -->
        <div class="quick-export">
          <QuickExportButton
            label="Last 5 min as PCAP"
            on:click={() => quickExport('5min', 'pcap')}
          />
          <QuickExportButton
            label="Current view as PNG"
            on:click={() => quickExport('view', 'png')}
          />
        </div>
      </div>
    {/if}
    
    {#if exportStep === 'configure'}
      <div transition:slide>
        <!-- Format-specific options -->
        <FormatOptions
          format={selectedFormat}
          bind:options={exportOptions}
        />
        
        <!-- Advanced options (collapsed by default) -->
        <CollapsibleSection title="Advanced Options">
          <CompressionOptions bind:compression={exportOptions.compression} />
          <PrivacyOptions bind:anonymize={exportOptions.anonymize} />
        </CollapsibleSection>
      </div>
    {/if}
    
    {#if exportStep === 'preview'}
      <div transition:slide>
        <!-- Live preview -->
        <ExportPreview
          data={previewData}
          format={selectedFormat}
          options={exportOptions}
        />
        
        <!-- Size and time estimate -->
        <ExportEstimates
          size={estimatedSize}
          duration={estimatedDuration}
          warning={sizeWarning}
        />
      </div>
    {/if}
    
    {#if exportStep === 'processing'}
      <div transition:fade>
        <!-- Progress indicator -->
        <ProgressRing 
          progress={exportProgress}
          status={exportStatus}
        />
        
        <!-- Cancel option -->
        <Button
          variant="ghost"
          on:click={cancelExport}
          disabled={exportProgress > 90}
        >
          Cancel
        </Button>
      </div>
    {/if}
  </div>
</Dialog>
```

### Save Templates Feature
```typescript
class ExportTemplates {
  // Allow users to save export configurations
  templates: ExportTemplate[] = [
    {
      name: 'Daily Security Report',
      format: 'report',
      options: {
        timeRange: 'last-24h',
        includeCharts: true,
        sections: ['summary', 'anomalies', 'top-talkers']
      },
      schedule: 'daily-6am'
    },
    {
      name: 'Incident Response Package',
      format: 'multi',
      outputs: [
        { format: 'pcap', filtered: true },
        { format: 'json', includeMetadata: true },
        { format: 'timeline', visualization: true }
      ]
    }
  ];
  
  // Template management UI
  renderTemplateManager() {
    return {
      list: this.templates.map(t => ({
        ...t,
        lastUsed: this.getLastUsed(t.id),
        useCount: this.getUseCount(t.id)
      })),
      actions: ['use', 'edit', 'duplicate', 'delete', 'share']
    };
  }
}
```

## Integration Points

### With %12's Backend
- Filter queries translate to efficient backend filters
- Export requests stream data to prevent memory issues
- Alert thresholds sync with backend anomaly detection

### With %13's Components
- FilterPanel integrates with existing PacketFilters
- AlertTimeline complements AlertsPanel
- ExportDialog accessible from PacketList toolbar

## Accessibility Considerations

1. **Keyboard Navigation**
   - All filters accessible via Tab
   - Slider controls with arrow key support
   - Export workflow navigable without mouse

2. **Screen Reader Support**
   - ARIA labels for all interactive elements
   - Alert severity announced
   - Export progress updates

3. **Visual Accessibility**
   - High contrast mode support
   - Colorblind-friendly palettes
   - Focus indicators on all controls
# GSM Evil Persistent State Management Architecture

## Executive Summary

This document outlines the architecture for implementing persistent state management in the GSM Evil page, ensuring scan results persist across navigation while maintaining proper clear functionality.

**Current Problem**: Scan results disappear on navigation due to component-level state management
**Solution**: Centralized persistent store with localStorage backing

## Architecture Overview

### Current State Issues
- **Component-scoped variables**: `scanResults`, `scanProgress`, `scanStatus` are lost on navigation
- **No persistence layer**: Data exists only in memory during component lifecycle
- **Inconsistent behavior**: Results clear on navigation (unintended) vs. Clear button (intended)

### Proposed Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  GSM Evil State Store                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Memory    │◄──►│  localStorage│◄──►│  Component  │      │
│  │   Store     │    │  Persistence │    │   Layer     │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Store Creation
Create a dedicated Svelte store for GSM Evil state management with built-in persistence.

### Phase 2: Component Integration
Refactor the existing component to use the centralized store instead of local variables.

### Phase 3: Persistence Layer
Implement localStorage backing with proper serialization and error handling.

## Technical Specifications

### Store Structure

```typescript
interface GSMEvilState {
  scanResults: ScanResult[];
  scanProgress: string[];
  scanStatus: string;
  selectedFrequency: string;
  isScanning: boolean;
  capturedIMSIs: any[];
  totalIMSIs: number;
  towerLocations: { [key: string]: any };
  lastScanTime: Date | null;
}
```

### Store Implementation

```typescript
// src/lib/stores/gsmEvilStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'gsm-evil-state';

const defaultState: GSMEvilState = {
  scanResults: [],
  scanProgress: [],
  scanStatus: '',
  selectedFrequency: '947.2',
  isScanning: false,
  capturedIMSIs: [],
  totalIMSIs: 0,
  towerLocations: {},
  lastScanTime: null
};

function createGSMEvilStore() {
  const { subscribe, set, update } = writable<GSMEvilState>(defaultState);

  // Load from localStorage on initialization
  if (browser) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedState = JSON.parse(saved);
        set({ ...defaultState, ...parsedState });
      } catch (error) {
        console.warn('Failed to load GSM Evil state:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  function persistState(state: GSMEvilState) {
    if (browser) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to persist GSM Evil state:', error);
      }
    }
  }

  return {
    subscribe,
    
    // Scan Results Management
    updateScanResults: (results: ScanResult[]) => 
      update(state => {
        const newState = { ...state, scanResults: results };
        persistState(newState);
        return newState;
      }),
    
    // Scan Progress Management
    addScanProgress: (message: string) => 
      update(state => {
        const newState = { 
          ...state, 
          scanProgress: [...state.scanProgress, message] 
        };
        persistState(newState);
        return newState;
      }),
    
    setScanProgress: (progress: string[]) => 
      update(state => {
        const newState = { ...state, scanProgress: progress };
        persistState(newState);
        return newState;
      }),
    
    // Status Management
    updateScanStatus: (status: string) => 
      update(state => {
        const newState = { ...state, scanStatus: status };
        persistState(newState);
        return newState;
      }),
    
    // Frequency Selection
    setSelectedFrequency: (frequency: string) => 
      update(state => {
        const newState = { ...state, selectedFrequency: frequency };
        persistState(newState);
        return newState;
      }),
    
    // Scanning State
    setIsScanning: (isScanning: boolean) => 
      update(state => {
        const newState = { ...state, isScanning };
        persistState(newState);
        return newState;
      }),
    
    // IMSI Management
    updateCapturedIMSIs: (imsis: any[]) => 
      update(state => {
        const newState = { 
          ...state, 
          capturedIMSIs: imsis,
          totalIMSIs: imsis.length
        };
        persistState(newState);
        return newState;
      }),
    
    // Tower Management
    updateTowerLocations: (locations: { [key: string]: any }) => 
      update(state => {
        const newState = { ...state, towerLocations: locations };
        persistState(newState);
        return newState;
      }),
    
    // Clear Results (Manual Action)
    clearResults: () => 
      update(state => {
        const newState = {
          ...defaultState,
          selectedFrequency: state.selectedFrequency // Preserve frequency selection
        };
        persistState(newState);
        return newState;
      }),
    
    // Complete state reset
    reset: () => {
      set(defaultState);
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };
}

export const gsmEvilStore = createGSMEvilStore();
```

### Component Integration Pattern

```typescript
// In +page.svelte
import { gsmEvilStore } from '$lib/stores/gsmEvilStore';

// Replace local variables with store subscriptions
$: scanResults = $gsmEvilStore.scanResults;
$: scanProgress = $gsmEvilStore.scanProgress;
$: scanStatus = $gsmEvilStore.scanStatus;
$: selectedFrequency = $gsmEvilStore.selectedFrequency;
$: isScanning = $gsmEvilStore.isScanning;
$: capturedIMSIs = $gsmEvilStore.capturedIMSIs;
$: totalIMSIs = $gsmEvilStore.totalIMSIs;
$: towerLocations = $gsmEvilStore.towerLocations;

// Replace direct assignments with store actions
function clearResults() {
  gsmEvilStore.clearResults();
}

function updateScanResults(results: ScanResult[]) {
  gsmEvilStore.updateScanResults(results);
}

function addScanProgress(message: string) {
  gsmEvilStore.addScanProgress(message);
}
```

## Data Flow Architecture

### 1. Page Load Flow
```
Page Navigation → Store Initialization → localStorage Check → State Hydration → Component Render
```

### 2. Scan Operation Flow
```
User Clicks Scan → Store Updates → localStorage Sync → Component Re-render → Progress Updates
```

### 3. Clear Results Flow
```
User Clicks Clear → Store.clearResults() → localStorage Sync → Component Re-render → Empty State
```

### 4. Navigation Flow
```
User Navigates Away → Component Destroyed → Store Persists → Return to Page → State Restored
```

## Error Handling Strategy

### localStorage Failures
- **Quota Exceeded**: Graceful fallback to memory-only mode
- **Parse Errors**: Clear corrupt data and start fresh
- **Access Denied**: Continue with memory-only state

### State Corruption
- **Version Mismatch**: Migrate or reset to default
- **Invalid Data**: Validate and sanitize on load
- **Missing Properties**: Merge with defaults

## Performance Considerations

### Optimization Strategies
1. **Debounced Persistence**: Batch multiple updates
2. **Selective Persistence**: Only persist essential state
3. **Lazy Loading**: Load state only when needed
4. **Memory Management**: Clean up large scan results periodically

### Storage Limits
- **localStorage Quota**: ~5-10MB per domain
- **Compression**: JSON.stringify is sufficient for current data size
- **Cleanup**: Implement TTL for old scan results

## Security Considerations

### Data Sensitivity
- **Scan Results**: Contain frequency information (low sensitivity)
- **IMSI Data**: Potentially sensitive, consider encryption
- **Tower Locations**: Geographic data, handle appropriately

### Storage Security
- **Client-side Only**: No server-side storage of sensitive data
- **Encryption**: Consider encrypting sensitive fields
- **Expiration**: Implement automatic cleanup

## Testing Strategy

### Unit Tests
- Store actions and state updates
- Persistence layer functionality
- Error handling scenarios

### Integration Tests
- Component-store interaction
- localStorage persistence
- Navigation state preservation

### E2E Tests
- Complete scan workflow
- Clear results functionality
- Cross-session persistence

## Migration Strategy

### Current State Migration
1. **Identify Dependencies**: Map all current state variables
2. **Gradual Replacement**: Replace one variable at a time
3. **Backward Compatibility**: Maintain existing interfaces
4. **Testing**: Verify functionality at each step

### Rollback Plan
- **Feature Flag**: Toggle between old and new implementations
- **State Backup**: Preserve current state during migration
- **Quick Revert**: Ability to return to component-level state

## Implementation Timeline

### Phase 1 (Day 1)
- [ ] Create store structure
- [ ] Implement basic persistence
- [ ] Add core state management

### Phase 2 (Day 2)
- [ ] Integrate with existing component
- [ ] Replace local variables
- [ ] Test basic functionality

### Phase 3 (Day 3)
- [ ] Add error handling
- [ ] Implement performance optimizations
- [ ] Complete testing

## Success Metrics

### Functional Requirements
- ✅ Results persist across navigation
- ✅ Clear button properly clears all data
- ✅ No data loss during normal usage
- ✅ Proper error handling

### Performance Requirements
- ⚡ Page load time increase <100ms
- ⚡ State updates <50ms
- ⚡ localStorage operations <10ms
- ⚡ Memory usage increase <1MB

## Conclusion

This architecture provides a robust, scalable solution for persistent state management in the GSM Evil page. The centralized store pattern with localStorage backing ensures data persistence while maintaining clean separation of concerns and proper error handling.

The solution directly addresses the core requirements:
- **Navigation persistence**: Store survives component lifecycle
- **Manual clearing**: Explicit clear action removes all data
- **Performance**: Minimal impact on page load and operation
- **Maintainability**: Clean, testable architecture

---

*Architecture Document v1.0 - Created by Winston (BMad Architect)*
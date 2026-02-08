# Phase 5.4.3 -- Tier 1: Redesign Page Decomposition

```
Document ID:    ARGOS-AUDIT-P5.4.3-REDESIGN-PAGE
Phase:          5.4 -- File Size Enforcement
Sub-Task:       5.4.3 -- Decompose redesign/+page.svelte (1,055 lines)
Risk Level:     LOW
Prerequisites:  Phase 4 COMPLETE, Phase 5.4.0 assessment reviewed
Files Touched:  1 source file -> 6 target files
Standards:      Barr Group Rule 1.3 (500-line limit), NASA/JPL Rule 2.4
Classification: CUI // FOUO
```

---

## 1. Source File

| Property        | Value                               |
| --------------- | ----------------------------------- |
| Path            | `src/routes/redesign/+page.svelte`  |
| Current Lines   | 1,055                               |
| Tier            | 1 (>1,000 lines, unconditional)     |
| Execution Order | 3 of 7 (third Tier 1 decomposition) |

---

## 2. Content Analysis

Full-page redesign/landing page. Contains:

- Hero section with animated elements (CSS transitions, background effects)
- Feature grid with card components (descriptions, icons, status indicators)
- Navigation cards linking to each tool section (RF, WiFi, GSM, drone, etc.)
- Footer with system status indicators (service health badges)
- Substantial inline CSS (scoped `<style>` block, potentially 200+ lines)

**Why It Exceeds Threshold:**
Multiple distinct visual sections co-located in a single page file. Each section has
independent layout, data, and interaction logic. Inline CSS inflates line count beyond
what the structural content requires.

---

## 3. Decomposition Strategy

Extract section-level components. Each major visual section becomes its own Svelte
component. CSS moves to component-scoped styles. Static data (feature descriptions,
card configurations, navigation items) extracted into a TypeScript data file.

**Architecture after decomposition:**

```
+page.svelte (page shell, ~80 lines)
  +-- HeroSection.svelte (~200 lines)
  +-- FeatureGrid.svelte (~180 lines)
  +-- NavigationCards.svelte (~200 lines)
  +-- SystemStatusFooter.svelte (~150 lines)
  +-- redesignData.ts (static data, ~120 lines)
```

---

## 4. New File Manifest

| New File                                    | Content                                                    | Est. Lines |
| ------------------------------------------- | ---------------------------------------------------------- | ---------- |
| `routes/redesign/+page.svelte`              | Page shell, imports sections, overall layout               | ~80        |
| `routes/redesign/HeroSection.svelte`        | Hero banner, title, subtitle, animated background          | ~200       |
| `routes/redesign/FeatureGrid.svelte`        | Feature cards grid layout                                  | ~180       |
| `routes/redesign/NavigationCards.svelte`    | Tool navigation card set                                   | ~200       |
| `routes/redesign/SystemStatusFooter.svelte` | Footer with live system metrics                            | ~150       |
| `routes/redesign/redesignData.ts`           | Static data: feature descriptions, card configs, nav items | ~120       |

**Total target files:** 6
**Maximum file size:** ~200 lines (HeroSection, NavigationCards)
**Original file disposition:** Reduced in-place to ~80-line page shell

---

## 5. Migration Steps

1. Identify all static data blocks in the original file (feature descriptions, card titles, icon mappings, navigation URLs). Extract into `redesignData.ts` as typed, exported constants.
2. Extract `HeroSection.svelte` -- the hero banner and animated background. Move associated scoped CSS into the new component's `<style>` block.
3. Extract `FeatureGrid.svelte` -- the feature cards grid. Import card data from `redesignData.ts`.
4. Extract `NavigationCards.svelte` -- the tool navigation card set. Import navigation data from `redesignData.ts`.
5. Extract `SystemStatusFooter.svelte` -- the footer with live system metrics. This component retains its own store subscriptions for real-time status.
6. Reduce `+page.svelte` to a page shell that imports and composes the four section components.
7. Verify all import paths resolve.
8. Commit.

---

## 6. Component Interface Contracts

### HeroSection.svelte

```typescript
// Props: none (self-contained visual section)
// Contains: animated background, title, subtitle
// CSS: scoped, extracted from original file's hero styles
```

### FeatureGrid.svelte

```typescript
// Props
export let features: FeatureItem[]; // from redesignData.ts
// Renders: grid of feature cards
```

### NavigationCards.svelte

```typescript
// Props
export let navItems: NavItem[]; // from redesignData.ts
// Renders: clickable navigation cards to tool pages
```

### SystemStatusFooter.svelte

```typescript
// Props: none (subscribes to system status stores internally)
// Renders: footer with service health indicators
```

### redesignData.ts

```typescript
export interface FeatureItem {
	title: string;
	description: string;
	icon: string;
}

export interface NavItem {
	title: string;
	href: string;
	icon: string;
	description: string;
}

export const features: FeatureItem[] = [
	/* ... */
];
export const navItems: NavItem[] = [
	/* ... */
];
```

---

## 7. Verification Commands

```bash
# 1. All files within size limits
wc -l src/routes/redesign/*.svelte src/routes/redesign/*.ts

# 2. Build succeeds
npm run build 2>&1 | tail -5

# 3. TypeScript compilation
npx tsc --noEmit 2>&1 | grep -c "error"

# 4. Page loads correctly (manual smoke test)
npm run dev &
# Navigate to http://localhost:5173/redesign
# Verify all sections render
```

---

## 8. Key Constraints and Caveats

1. **CSS scoping.** Each extracted component must carry its own scoped `<style>` block. Do NOT use a shared CSS file, as Svelte's scoped CSS prevents cross-component style leakage.
2. **Animation state.** If the hero section uses intersection observers or scroll-triggered animations, the observer setup stays with the HeroSection component, not the parent.
3. **SystemStatusFooter polling.** This component subscribes to system status stores. Store subscription lifecycle is tied to component mount/unmount, which is unchanged by extraction.
4. **SvelteKit route structure.** All extracted components live in the `routes/redesign/` directory alongside `+page.svelte`. This is a SvelteKit convention for co-located page components.

---

## 9. Commit Message

```
refactor: decompose redesign page into sections

- Extract HeroSection: animated hero banner
- Extract FeatureGrid: feature cards grid
- Extract NavigationCards: tool navigation card set
- Extract SystemStatusFooter: live system status footer
- Extract redesignData.ts: static feature/nav data
- Original 1,055-line page reduced to ~80-line shell
- No logic changes, structural only
```

---

## 10. Standards Compliance

| Standard             | Compliance                                     |
| -------------------- | ---------------------------------------------- |
| Barr Group Rule 1.3  | All files <300 lines post-split                |
| NASA/JPL Rule 2.4    | No functions >60 lines in extracted components |
| MISRA C:2012 Dir 4.4 | No commented-out code in new files             |
| CERT C MSC41         | No secrets in UI components or data files      |

---

```
END OF DOCUMENT
Classification: CUI // FOUO
Phase 5.4.3 -- Tier 1: Redesign Page Decomposition
```

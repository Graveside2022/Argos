# Component Reuse Violations Analysis

**Violation Category:** LOW (Article IV §4.2)
**Violation Count:** 4 violations
**Impact:** Minor duplication, opportunity for component extraction
**Status:** Pre-existing (created before constitution ratification)
**Priority:** ⚪ **LOW** - Optional improvement, not urgent

---

## 📊 Quick Summary

**Problem:** Button patterns duplicated across components instead of extracted to reusable component
**Constitution Rule:** Article IV §4.2 - "Reuse existing components before creating new ones"
**Why Encouraged:** DRY principle, consistency, easier maintenance
**Solution:** Extract common button patterns into shared component (optional)

---

## 🔍 Detected Violations

### 1. TopStatusBar.svelte

**Pattern:** Custom button with icon
**Usage:** Status bar action buttons
**Created:** 2026-02-02

### 2. TerminalPanel.svelte

**Pattern:** Custom button with icon
**Usage:** Terminal panel controls
**Created:** 2026-02-06

### 3. IconRail.svelte

**Pattern:** Custom button with icon
**Usage:** Navigation rail buttons
**Created:** 2026-02-02

### 4. ToolCard.svelte (shared/)

**Pattern:** Custom button with icon
**Usage:** Tool card action buttons
**Created:** 2026-02-05

---

## 🎯 Why This Matters (Sort Of)

### Current State: Duplicated Button Pattern

**Each component reimplements:**

```svelte
<button
	class="bg-accent-primary hover:bg-accent-hover px-4 py-2 rounded flex items-center gap-2"
	onclick={handleClick}
>
	<svg>...</svg>
	{label}
</button>
```

**Repeated 4 times with minor variations:**

- TopStatusBar: Different padding, different colors
- TerminalPanel: Different sizing, different hover
- IconRail: Different layout, different icon size
- ToolCard: Different border, different shadow

### Why It's LOW Priority

**Honest Assessment:**

- ✅ Components are functional and working
- ✅ Buttons AREN'T actually identical (slight variations intentional)
- ✅ Only 4 occurrences (not widespread duplication)
- ✅ Each component's buttons serve different UX contexts

**Constitutional note:**

- Article IV §4.2 says "reuse existing components"
- But these buttons are context-specific, not truly reusable
- False positive from audit - these variations are intentional

---

## 🔄 Remediation Strategy

### Option A: Extract Shared Button Component

**Impact:** LOW (minor code refactoring)
**Timeline:** 1 day
**Risk:** LOW
**Value:** LOW (marginal improvement)

**Approach:**

1. Create `src/lib/components/shared/IconButton.svelte`
2. Support variants: `primary`, `secondary`, `ghost`
3. Replace duplicated buttons with `<IconButton>`

**Deliverable:** Reusable button component, 4 violations resolved

---

### Option B: Do Nothing (RECOMMENDED)

**Impact:** ZERO
**Timeline:** 0 days
**Risk:** ZERO
**Value:** ZERO

**Rationale:**

- Buttons are intentionally different for different contexts
- Extracting would create unnecessary abstraction
- 4 violations is not a real problem
- LOW priority violation doesn't warrant effort

**Deliverable:** Accept LOW violations, focus on HIGH/CRITICAL

---

### Option C: Constitutional Exemption

**Impact:** ZERO
**Timeline:** 15 minutes (documentation)
**Risk:** ZERO

**Approach:**
Add exemption to each file:

```svelte
<!-- @constitutional-exemption: Article IV §4.2 issue:#125 -->
<!-- Justification: Context-specific button styling intentional, not duplication -->
<button class="...">...</button>
```

**Deliverable:** Violations acknowledged, audit passes

---

## 📋 Detailed Plan (Option A - If You Really Want To)

### Step 1: Create IconButton Component

**File:** `src/lib/components/shared/IconButton.svelte`

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		icon?: Snippet;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let { variant = 'primary', size = 'md', icon, onclick, children }: Props = $props();

	const variantClasses = {
		primary: 'bg-accent-primary hover:bg-accent-hover',
		secondary: 'bg-bg-button hover:bg-gray-700',
		ghost: 'hover:bg-gray-800'
	};

	const sizeClasses = {
		sm: 'px-2 py-1 text-sm',
		md: 'px-4 py-2',
		lg: 'px-6 py-3 text-lg'
	};
</script>

<button
	class="rounded flex items-center gap-2 {variantClasses[variant]} {sizeClasses[size]}"
	{onclick}
>
	{#if icon}
		{@render icon()}
	{/if}
	{@render children()}
</button>
```

**Usage:**

```svelte
<script>
	import IconButton from '$lib/components/shared/IconButton.svelte';
</script>

<IconButton variant="primary" size="md" onclick={handleClick}>
	{#snippet icon()}
		<svg>...</svg>
	{/snippet}
	Action
</IconButton>
```

---

### Step 2: Replace in TopStatusBar.svelte

- Find all button elements
- Replace with `<IconButton>`
- Test functionality
- Commit: `refactor(ui): extract IconButton component (TopStatusBar)`

---

### Step 3: Replace in TerminalPanel.svelte

- Same process
- Commit: `refactor(ui): extract IconButton component (TerminalPanel)`

---

### Step 4: Replace in IconRail.svelte

- Same process
- Commit: `refactor(ui): extract IconButton component (IconRail)`

---

### Step 5: Replace in ToolCard.svelte

- Same process
- Commit: `refactor(ui): extract IconButton component (ToolCard)`

---

### Step 6: Run Audit

```bash
npx tsx scripts/run-audit.ts
```

**Expected:** 4 LOW violations resolved

---

## ⚖️ Risk Assessment

### 🟢 ALL RISKS ARE LOW

**1. Component Abstraction Overhead**
**Probability:** HIGH (inevitable)
**Impact:** LOW (slightly more complex code)

**Tradeoff:**

- Before: Simple, inline buttons (easy to understand)
- After: Abstract component (one more level of indirection)

**2. Variant Proliferation**
**Probability:** MEDIUM (will happen over time)
**Impact:** LOW (component gets more props)

**Risk:**

- IconButton grows to support every button variant
- Becomes "god component" with 20 props
- Defeats purpose of simplification

---

## 🎯 Recommendation

### ⚪ **Choose Option B (Do Nothing)** - RECOMMENDED

**Rationale:**

- LOW priority violation (not urgent)
- Buttons are intentionally context-specific
- 4 occurrences is NOT a real problem
- Effort better spent on HIGH/CRITICAL violations

**Focus instead on:**

- 🔴 Service layer violations (CRITICAL)
- 🟠 Type safety violations (HIGH)
- 🟡 UI modernization (MEDIUM)

---

### ✅ **Choose Option A (Extract Component)** IF:

- [ ] You're already adopting Shadcn (which has `<Button>` primitive)
- [ ] You want to practice component extraction
- [ ] You have spare time after fixing HIGH/CRITICAL issues
- [ ] You value consistency over pragmatism

**Note:** If doing Shadcn Option A or B, this becomes moot - Shadcn `<Button>` replaces all custom buttons.

---

### 📝 **Choose Option C (Exemption)** IF:

- [ ] You want audit to pass without work
- [ ] You acknowledge LOW violations are intentional
- [ ] You want documentation for future reference

---

## 🚀 Recommended Path Forward

**My Recommendation:** **Option B (Do Nothing)**

**Or, if you're doing Shadcn:**

- These violations will be automatically resolved when you adopt Shadcn `<Button>` component
- Shadcn Button supports variants out of the box
- No need for custom IconButton component

**Timeline:**

- Option A: 1 day
- Option B: 0 days ✅
- Option C: 15 minutes

---

## 📖 Next Steps

### If Choosing Option A (Extract Component):

1. Review IconButton component design above
2. Allocate 1 day timeline
3. Create git branch: `refactor/icon-button-component`
4. Follow steps 1-6 above
5. Merge after validation

### If Choosing Option B (Do Nothing):

1. Accept LOW violations
2. Focus on CRITICAL/HIGH priorities
3. Revisit if duplication becomes widespread (>10 occurrences)

### If Choosing Option C (Exemption):

1. Add exemption comments to 4 files
2. Create GitHub issue #125: "Component reuse - intentional context-specific styling"
3. Re-run audit
4. Verify LOW violations marked exempted

---

## 📊 Impact on Compliance Score

**Current:** 42% compliance, 4 LOW violations

**After Option A (Extract Component):**

- **LOW violations:** 4 → 0 (all resolved)
- **Overall compliance:** 42% → ~42.5% (negligible change)

**After Option B (Do Nothing):**

- **LOW violations:** 4 (unchanged)
- **Overall compliance:** 42% (unchanged)

**After Option C (Exemption):**

- **LOW violations:** 4 (marked exempted)
- **Overall compliance:** 42% (unchanged)

---

**Decision required:** Option A (Extract), Option B (Do Nothing), or Option C (Exempt)?

**Best ROI:** Option B - Zero effort, same outcome.

**Or:** Wait for Shadcn adoption (if you choose UI modernization Option A or B) - these violations auto-resolve.

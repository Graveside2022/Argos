# Tailwind CSS Migration Dependencies

**Date**: February 13, 2026
**Audit Reference**: `audit-2026-02-13-15-15-05`
**Scope**: Migrate 269 hardcoded hex colors to Tailwind theme classes

---

## Current State

### Installed Dependencies

✅ **Already Installed:**

- `tailwindcss@3.4.19` - Core framework (devDependencies)
- `@tailwindcss/forms@0.5.10` - Form styling plugin (dependencies)
- `autoprefixer@10.4.24` - PostCSS plugin for vendor prefixes
- `postcss@8.5.6` - CSS preprocessor

✅ **Tailwind Configuration:**

- File: `tailwind.config.js`
- Custom theme with 30+ defined color tokens
- Content paths configured for Svelte files
- Forms plugin active

### Migration Scope

**Files Affected:** 211 occurrences across multiple files
**Violation Type:** MEDIUM severity (Article II §2.7)
**Current Colors:** Hardcoded hex values (`#dc2626`, `#4a9eff`, etc.)
**Target:** Tailwind theme classes (`text-signal-critical`, `bg-accent-primary`, etc.)

---

## No Additional Dependencies Required

### ✅ Phase 1: Tailwind Class Migration

**Good News:** All required dependencies are already installed. No `npm install` needed.

**What We Have:**

1. Tailwind CSS core framework
2. Custom theme with semantic color tokens
3. Form styling plugin
4. Build tooling (PostCSS, Autoprefixer)

**What We Don't Need:**

- ❌ Tailwind UI (commercial product)
- ❌ Headless UI (we have custom components)
- ❌ Tailwind Typography (not applicable)
- ❌ Additional Tailwind plugins (forms plugin sufficient)

**Migration Strategy:**

1. Map hardcoded hex colors to existing Tailwind theme tokens
2. Replace inline `style="color: #dc2626"` with `class="text-signal-critical"`
3. Update `<style>` blocks with Tailwind utility classes
4. Validate with visual regression testing

**Example Mappings:**

| Hardcoded Hex | Tailwind Theme Token                           | Usage                   |
| ------------- | ---------------------------------------------- | ----------------------- |
| `#dc2626`     | `text-signal-critical` or `bg-signal-critical` | Critical signals/errors |
| `#4a9eff`     | `text-accent-primary` or `bg-accent-primary`   | Primary actions         |
| `#94a3b8`     | `text-gray-400` (standard)                     | Muted text              |
| `#9ca3af`     | `text-gray-400` (standard)                     | Secondary text          |
| `#e8eaed`     | `text-text-primary`                            | Primary text            |

---

## ⚠️ Phase 2: Shadcn Component Library (Optional)

### New Dependencies Required (IF Shadcn Adopted)

**Shadcn-Svelte Installation:**

```bash
# Core dependencies
npm install -D shadcn-svelte
npm install -D clsx tailwind-merge
npm install -D tailwind-variants
npm install -D lucide-svelte

# Peer dependencies (already installed)
# - svelte@5.35.5 ✅
# - tailwindcss@3.4.19 ✅
```

**Estimated Package Additions:**

- `shadcn-svelte` - CLI tool and component primitives (~50KB)
- `clsx` - Utility for conditional CSS classes (~1KB)
- `tailwind-merge` - Merge Tailwind classes without conflicts (~5KB)
- `tailwind-variants` - Type-safe component variants (~3KB)
- `lucide-svelte` - Icon library (~150KB for full set, tree-shakeable)

**Total Additional Size:** ~200KB (minified, before tree-shaking)

### Configuration Changes Required

**1. Initialize Shadcn:**

```bash
npx shadcn-svelte@latest init
```

**2. Update `tailwind.config.js`:**

```javascript
// Shadcn will add:
- CSS variable-based theming (--primary, --secondary, etc.)
- Dark mode support (class or media strategy)
- Animation keyframes
- Custom container queries
```

**3. Create `src/lib/components/ui/` directory:**

```
src/lib/components/ui/
├── button.svelte          # Shadcn button primitive
├── card.svelte            # Shadcn card primitive
├── dialog.svelte          # Shadcn modal/dialog
├── dropdown-menu.svelte   # Shadcn dropdown
├── input.svelte           # Shadcn input primitive
├── label.svelte           # Shadcn label primitive
├── select.svelte          # Shadcn select primitive
├── separator.svelte       # Shadcn divider
├── switch.svelte          # Shadcn toggle switch
└── tooltip.svelte         # Shadcn tooltip primitive
```

**4. Update `src/app.css`:**

```css
/* Shadcn will add CSS variables */
@layer base {
	:root {
		--background: 0 0% 100%;
		--foreground: 222.2 84% 4.9%;
		--primary: 221.2 83.2% 53.3%;
		/* ... etc */
	}

	.dark {
		--background: 222.2 84% 4.9%;
		--foreground: 210 40% 98%;
		/* ... etc */
	}
}
```

---

## Dependency Installation Timeline

### ⚡ Phase 1: Zero Dependencies (READY NOW)

**No installation required.** Proceed with Tailwind class migration immediately.

**Command:**

```bash
# NO COMMAND NEEDED - Already have everything!
```

### 🚧 Phase 2: Shadcn Dependencies (PENDING DECISION)

**Installation required only if Shadcn adoption approved.**

**Commands (sequential):**

```bash
# Step 1: Install dependencies
npm install -D shadcn-svelte clsx tailwind-merge tailwind-variants lucide-svelte

# Step 2: Initialize Shadcn
npx shadcn-svelte@latest init

# Step 3: Add specific components (example)
npx shadcn-svelte@latest add button
npx shadcn-svelte@latest add card
npx shadcn-svelte@latest add dialog
# ... etc (add as needed)
```

**Estimated Time:**

- Installation: 30-60 seconds
- Configuration: 5 minutes
- First component addition: 2 minutes per component

---

## Risk Assessment

### Phase 1 Risks: ✅ LOW

**No dependency changes** = No breaking changes from package updates

**Risks:**

- ✅ Visual appearance changes (expected, controlled)
- ✅ CSS specificity conflicts (minimal, Tailwind uses low specificity)
- ✅ Build time increase (negligible, already using Tailwind)

**Mitigation:**

- Visual regression testing before/after
- Component-by-component migration
- Git commits per component for easy rollback

### Phase 2 Risks: ⚠️ MEDIUM

**New dependencies** = Potential for:

- Package version conflicts
- Build tooling issues
- Breaking changes in component API
- Increased bundle size

**Mitigation:**

- Test in isolated branch first
- Lock dependency versions in package.json
- Measure bundle size before/after
- Selective component adoption (not all-or-nothing)
- Keep existing components as fallback

---

## Recommendation

### ✅ Proceed with Phase 1 Immediately

**Rationale:**

- Zero new dependencies
- Reduces MEDIUM violations from 319 to ~50
- Improves maintainability
- Enables future theming/dark mode
- No breaking changes

**Action:** Start migrating hardcoded hex colors to Tailwind classes.

### ⏸️ Defer Phase 2 Decision

**Rationale:**

- Requires user approval (visual design changes)
- Dependencies add complexity
- Existing components functional
- Can adopt incrementally later

**Action:** Review `shadcn-impact-analysis.md` before deciding.

---

## Dependency Health Check

### Current Dependency Versions

**Tailwind Ecosystem (all up-to-date):**

- ✅ `tailwindcss@3.4.19` - Latest stable (Dec 2024)
- ✅ `@tailwindcss/forms@0.5.10` - Latest stable (Dec 2024)
- ✅ `autoprefixer@10.4.24` - Latest stable (Jan 2025)
- ✅ `postcss@8.5.6` - Stable (slight version behind, but compatible)

**No security vulnerabilities detected.**

**No breaking changes anticipated.**

---

## Next Steps

1. ✅ **Review this document** (completed)
2. 📋 **Review `shadcn-impact-analysis.md`** (next)
3. ✅ **Approve Phase 1: Tailwind class migration** (user decision)
4. ⏸️ **Approve Phase 2: Shadcn adoption** (user decision, can defer)
5. 🚀 **Begin implementation** (after approval)

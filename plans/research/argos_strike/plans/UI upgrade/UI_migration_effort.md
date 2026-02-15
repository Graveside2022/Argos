<?xml version="1.0" encoding="UTF-8"?>

<!--
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║         ARGOS → shadcn-svelte MIGRATION: VALIDATED PLAN                    ║
  ║                                                                            ║
  ║  Project: Argos SDR & Network Analysis Console                             ║
  ║  Branch:  001-audit-remediation → 002-shadcn-staging                       ║
  ║  Stack:   TypeScript + SvelteKit + Vite + Tailwind CSS                     ║
  ║  Target:  Raspberry Pi 5 / Kali Linux / Docker + Portainer                ║
  ║                                                                            ║
  ║  Validated against: Dependency Verification Rulebook v2.0                  ║
  ║  Date: 2026-02-15                                                          ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
-->

<argos_shadcn_migration version="1.0">

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 1: ARCHITECTURAL JUSTIFICATION                               -->
  <!--  WHY this migration is a sound engineering decision                    -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<architectural_justification>

    <executive_summary>
      shadcn-svelte is not a component library. It is a code distribution system that
      copies professionally structured Svelte component source files into your project.
      You own every line. There is no runtime dependency on shadcn-svelte itself after
      installation. The components use Bits UI internally as their behavioral engine
      for accessibility, focus management, and keyboard interaction — but you never
      import from or configure Bits UI directly. You interact only with the shadcn-svelte
      components in your src/lib/components/ui/ directory.
    </executive_summary>

    <dependency_relationship_clarification>
      <what_you_install>
        <package name="shadcn-svelte" role="CLI_TOOL_ONLY">
          Used only at development time via npx to generate component source files.
          Not a runtime dependency. Not imported by application code. Think of it as
          a code generator, not a library.
        </package>
        <package name="bits-ui" role="INTERNAL_BEHAVIORAL_ENGINE">
          Installed as a dependency because the generated shadcn-svelte component files
          import from it internally. For example, the Dialog component file that lands
          in your project contains: import { Dialog as DialogPrimitive } from "bits-ui".
          You never write this import yourself. You never configure Bits UI. You never
          interact with it. It provides the headless behavioral layer (focus trapping,
          ARIA attributes, keyboard navigation, state machines) that the shadcn-svelte
          component styling layer wraps.
        </package>
        <package name="tailwind-merge" role="CLASS_UTILITY">
          Merges Tailwind class strings intelligently, resolving conflicts. Used by the
          cn() utility function that every shadcn-svelte component uses for className
          composition.
        </package>
        <package name="clsx" role="CLASS_UTILITY">
          Conditional class string builder. Also used inside the cn() utility.
        </package>
        <package name="tailwind-variants" role="VARIANT_SYSTEM">
          Provides the variant API for components like Button that have multiple visual
          styles (default, destructive, outline, ghost, etc.).
        </package>
      </what_you_install>

      <analogy>
        When you buy a car, the engine (Bits UI) comes inside the car (shadcn-svelte
        component). You drive the car. You never directly interact with the engine's
        internal fuel injection system. If the engine manufacturer releases a fix, you
        update the bits-ui package version and the fix flows through to all your
        components automatically — without changing any of your component code.
      </analogy>

      <what_you_do_NOT_install>
        You do NOT install Bits UI as a separate UI system. You do NOT configure it.
        You do NOT import from it in your application code. You do NOT need to learn
        its API. The only place Bits UI appears is inside the generated component files
        that shadcn-svelte places in your project — and you can read those files to
        understand exactly how it is used.
      </what_you_do_NOT_install>
    </dependency_relationship_clarification>

    <why_architecturally_sound>

      <reason id="1" name="Source Code Ownership Eliminates Vendor Lock-In">
        <problem>
          Traditional component libraries (Flowbite-Svelte, Skeleton, SMUI) are npm
          packages. When they release a breaking change, you must update or fork. When
          they abandon the project, your UI layer becomes unmaintained. When you need a
          component to behave differently, you wrap it in hacks.
        </problem>
        <solution>
          shadcn-svelte copies the actual component source into src/lib/components/ui/.
          You own it. You can modify any component freely. If the shadcn-svelte project
          dies tomorrow, your code still works — nothing breaks because there is no
          runtime import from shadcn-svelte. The only runtime dependencies are bits-ui
          (actively maintained, 7.6k+ stars on the shadcn-svelte repo), tailwind-merge,
          and clsx — all stable, widely-used micro-libraries.
        </solution>
        <argos_relevance>
          Argos is a tactical field tool. You cannot afford a UI library update breaking
          your console during a deployment. Source ownership means you control exactly
          when and how components change.
        </argos_relevance>
      </reason>

      <reason id="2" name="CSS Variable Design Token System Enables Operational Theming">
        <problem>
          The current Argos codebase has hardcoded hex colors scattered in TypeScript
          files (e.g., #3b82f6 in map-service.ts, flagged in audit). There is no
          centralized theme system. Changing the look requires hunting through multiple
          files. Supporting multiple visual modes (night ops, high contrast, daylight)
          would require duplicating color values everywhere.
        </problem>
        <solution>
          shadcn-svelte installs a structured CSS variable system in app.css with named
          tokens: --background, --foreground, --primary, --border, --muted, --accent,
          --destructive, etc. Every component references these variables. Switching themes
          means swapping one CSS class on the root element.
        </solution>
        <argos_relevance>
          Tactical operations need multiple display modes. A single .dark class gives you
          the cyberpunk theme. A .night-ops class with red-shifted variables preserves
          night vision. A .daylight class with high-contrast values works in direct
          sunlight. All achievable by defining additional CSS variable blocks — zero
          component code changes required.
        </argos_relevance>
      </reason>

      <reason id="3" name="Consistent Component Contracts Reduce Multi-Node UI Divergence">
        <problem>
          When building multiple Argos node configurations (field node, command node,
          relay node), each with different UI layouts, ad-hoc components diverge over
          time. Different developers build dialogs differently. Form inputs behave
          inconsistently. Error states look different across panels.
        </problem>
        <solution>
          shadcn-svelte provides a shared component interface. Every Dialog behaves the
          same way. Every Button has the same variant API. Every DataTable has the same
          sort/filter patterns. This composable interface means different node UIs can
          be assembled from the same parts — same primitives, different layouts.
        </solution>
        <argos_relevance>
          A field node shows: map + GPS + WiFi scanner. A command node shows: aggregate
          dashboard + data tables from all nodes. Both use the same Dialog, Table, Tabs,
          Sheet, and Command components. Different assembly, identical parts.
        </argos_relevance>
      </reason>

      <reason id="4" name="Accessibility and Interaction Edge Cases Are Pre-Solved">
        <problem>
          Focus trapping in modals, keyboard navigation in dropdown menus, ARIA attributes
          on comboboxes, proper dismiss-on-escape behavior, screen reader announcements —
          these are complex interaction problems that are easy to get wrong and tedious to
          debug. Building these from scratch for a tactical SDR console is wasted effort.
        </problem>
        <solution>
          Bits UI (the internal engine) handles all of this. The shadcn-svelte components
          inherit correct focus management, keyboard handling, and ARIA attributes without
          any configuration. This is not theoretical — it is tested and used in production
          across thousands of projects.
        </solution>
        <argos_relevance>
          When an operator is managing SDR frequencies while WiFi scan results stream in,
          a command palette (Cmd+K) that correctly traps focus, handles arrow key navigation,
          and dismisses cleanly on Escape is not a nice-to-have — it is operational efficiency.
          Bits UI provides this behavior. shadcn-svelte styles it to match your theme. You
          get the result without building the machinery.
        </argos_relevance>
      </reason>

      <reason id="5" name="Audit Violation Resolution">
        <problem>
          The codebase audit flagged: hardcoded hex colors in TypeScript, browser
          alert()/confirm()/prompt() calls for user interaction, and inconsistent
          styling patterns.
        </problem>
        <solution>
          shadcn-svelte directly resolves these:
          - Hardcoded hex colors → replaced by CSS variable tokens (--primary, etc.)
          - Browser alert()/confirm() → replaced by AlertDialog component
          - Browser prompt() → replaced by Dialog component with form inputs
          - Inconsistent styling → all components use the same cn() utility and
            Tailwind variant system
        </solution>
      </reason>

      <reason id="6" name="Incremental Adoption — No Big Bang Rewrite">
        <problem>
          Argos is a working application with 371 commits. A full UI rewrite would
          introduce regression risk across every feature (SDR waterfall, WiFi scanner,
          GPS tracker, tactical map, TAK integration).
        </problem>
        <solution>
          shadcn-svelte is additive. After installation (Phase 3 of the runbook), existing
          UI is completely unchanged. The CSS variables coexist with existing styles. New
          components are added one at a time via the CLI. Existing custom components are
          replaced individually, at your pace, with full regression testing between each
          swap.
        </solution>
      </reason>

    </why_architecturally_sound>

</architectural_justification>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 2: UI PRESERVATION ANALYSIS                                  -->
  <!--  How to migrate without breaking the look, layout, or feel            -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<ui_preservation_analysis>

    <principle>
      The Argos cyberpunk-themed tactical interface is the product identity. The migration
      to shadcn-svelte must preserve the existing visual language while replacing the
      implementation underneath. The user should not perceive any change except improved
      consistency and interaction quality.
    </principle>

    <visual_risk id="1" name="Tailwind v3 → v4 Border Color Default Change" severity="HIGH">
      <description>
        Tailwind v3 defaulted border utilities (border, border-t, divide-x, etc.) to
        gray-200. Tailwind v4 defaults to currentColor (your text color). On a dark
        cyberpunk theme with light text, every border without an explicit color class
        will suddenly render as bright white/light lines instead of subtle gray.
      </description>
      <detection>
        Run: grep -rn "border\b" src/ --include="*.svelte" | grep -v "border-\(primary\|
        secondary\|accent\|muted\|border\|gray\|white\|black\|transparent\|inherit\)"
        Every result is a border that will change color after migration.
      </detection>
      <mitigation>
        Add explicit border-border class to every uncolored border utility. After shadcn-svelte
        installation, --border is defined as a CSS variable in the theme, so border-border
        gives consistent, theme-aware border colors across all modes.
      </mitigation>
      <verification>
        Visual comparison of every panel, card, and divider before and after migration.
        Screenshot each route at the same viewport size and overlay-diff.
      </verification>
    </visual_risk>

    <visual_risk id="2" name="Shadow and Rounding Scale Shift" severity="MEDIUM">
      <description>
        Tailwind v4 shifted the utility scale: shadow-sm became shadow-xs, shadow became
        shadow-sm, rounded became rounded-sm, blur became blur-sm. The official upgrade
        tool handles template files automatically, but dynamic class construction in
        TypeScript files will NOT be caught.
      </description>
      <detection>
        Run Phase 0 recon command #5: grep -rn "class.*=.*\`" src/ --include="*.ts"
        Each file found must be manually reviewed for renamed utilities.
      </detection>
      <mitigation>
        After the upgrade tool runs, manually audit every TypeScript file that constructs
        class strings. Search for the specific old utility names and replace.
      </mitigation>
      <verification>
        Compare rendered shadow depth and border radius pixel values before and after.
      </verification>
    </visual_risk>

    <visual_risk id="3" name="Button Cursor Change" severity="LOW">
      <description>
        Tailwind v4 changes the default button cursor from pointer to default. For a
        tactical console where every clickable element should feel interactive, this is
        a UX regression.
      </description>
      <mitigation>
        Add to app.css in @layer base: button, [role="button"] { cursor: pointer; }
        This is a one-line fix applied globally.
      </mitigation>
    </visual_risk>

    <visual_risk id="4" name="shadcn-svelte Default Theme Overwriting Cyberpunk Colors" severity="HIGH">
      <description>
        The shadcn-svelte init wizard generates default CSS variable values (zinc or slate
        neutrals) that will be written into app.css. If these are not immediately replaced
        with the Argos cyberpunk palette, the app will temporarily look like a generic
        shadcn project.
      </description>
      <mitigation>
        Phase 3.4 of the runbook: immediately after init, replace all generated CSS variable
        values in the .dark block with the Argos theme values. This must happen in the same
        commit as the shadcn-svelte installation — never commit with default colors.
      </mitigation>
      <verification>
        After mapping colors, every existing component must render identically to pre-migration.
        The CSS variables are additive — they only affect components that reference them via
        Tailwind classes like bg-background or text-foreground.
      </verification>
    </visual_risk>

    <visual_risk id="5" name="Existing Custom Components Coexistence" severity="LOW">
      <description>
        Existing Svelte components in the codebase use Tailwind utility classes directly.
        shadcn-svelte components also use Tailwind utility classes but through the cn()
        helper. Both approaches use the same Tailwind CSS output. There is no conflict.
      </description>
      <mitigation>
        No action required. Existing components continue to work unchanged. shadcn-svelte
        components are added alongside them, not replacing them, until explicit replacement
        is undertaken in Phase 4+.
      </mitigation>
    </visual_risk>

    <layout_preservation_strategy>
      <principle>
        The Argos layout is defined by its route structure, its CSS grid/flex layouts in
        Svelte components, and its Tailwind utility classes. None of these change during
        shadcn-svelte adoption. The migration affects the COMPONENT LAYER (buttons, dialogs,
        tables, inputs) — not the LAYOUT LAYER (page structure, panel arrangement, grid).
      </principle>

      <what_does_NOT_change>
        - SvelteKit route structure (src/routes/*)
        - Page-level layout components (+layout.svelte)
        - CSS Grid and Flexbox arrangements in panel components
        - Map rendering (Leaflet/MapLibre — separate from component library)
        - SDR waterfall rendering (Canvas/WebGL — separate from component library)
        - WebSocket connections and data flow
        - All TypeScript service logic
      </what_does_NOT_change>

      <what_DOES_change>
        - Buttons: custom → shadcn Button with variant props (only when explicitly swapped)
        - Dialogs: browser alert()/confirm() → shadcn AlertDialog (audit requirement)
        - Data display: ad-hoc tables → shadcn DataTable (optional, incremental)
        - Form inputs: raw HTML inputs → shadcn Input/Select (optional, incremental)
        - Color values: hardcoded hex → CSS variable references (audit requirement)
        - Config files: postcss.config.js deleted, tailwind.config.js deleted,
          replaced by CSS-first @theme in app.css and @tailwindcss/vite plugin
      </what_DOES_change>
    </layout_preservation_strategy>

</ui_preservation_analysis>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 3: DEPENDENCY VERIFICATION (Rulebook Phase 1-3)              -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<dependency_verification>

    <!-- Phase 1: Inventory -->
    <inventory>

      <current_stack>
        <component name="SvelteKit" role="Meta-framework" status="KEEP">
          Provides routing, SSR, build system. No change.
        </component>
        <component name="Svelte" role="UI framework" status="KEEP">
          Version TBD from package.json. If Svelte 4, must upgrade to Svelte 5
          BEFORE shadcn-svelte adoption (shadcn-svelte latest requires Svelte 5).
          If already Svelte 5, no action needed.
        </component>
        <component name="Vite" role="Build tool" status="KEEP_MODIFY">
          Kept. Modified to add @tailwindcss/vite plugin.
        </component>
        <component name="Tailwind CSS" role="Styling" status="UPGRADE_REQUIRED">
          Must upgrade from v3 to v4. This is a hard gate — shadcn-svelte latest
          requires Tailwind v4.
        </component>
        <component name="PostCSS" role="CSS processing" status="REMOVE">
          Replaced by @tailwindcss/vite plugin. postcss.config.js deleted.
        </component>
        <component name="autoprefixer" role="CSS vendor prefixes" status="REMOVE">
          No longer needed with Tailwind v4 Vite plugin.
        </component>
        <component name="TypeScript" role="Type system" status="KEEP">
          62.8% of codebase. No change.
        </component>
        <component name="Docker/Portainer" role="Deployment" status="KEEP">
          No change. Frontend build output is the same (static assets served by
          adapter-node or adapter-static).
        </component>
      </current_stack>

      <new_dependencies>
        <dependency name="@tailwindcss/vite" type="devDependency" purpose="Replaces PostCSS pipeline for Tailwind processing">
          <replaces>@tailwindcss/postcss, autoprefixer, postcss.config.js</replaces>
        </dependency>
        <dependency name="shadcn-svelte" type="devDependency_CLI_ONLY" purpose="Code generation CLI. Not a runtime dependency.">
          <note>Used only via npx. Never imported by application code.</note>
        </dependency>
        <dependency name="bits-ui" type="dependency" purpose="Headless behavioral primitives used internally by generated shadcn components">
          <note>You do NOT import from this directly. Generated components import from it.</note>
        </dependency>
        <dependency name="tailwind-merge" type="dependency" purpose="Intelligent Tailwind class merging for the cn() utility" />
        <dependency name="clsx" type="dependency" purpose="Conditional class string builder for the cn() utility" />
        <dependency name="tailwind-variants" type="dependency" purpose="Variant system for component style props (Button variants, etc.)" />
        <dependency name="svelte-sonner" type="dependency" purpose="Toast notification component (recommended for tactical status messages)" />
        <dependency name="@lucide/svelte" type="dependency" purpose="Icon library used by shadcn-svelte components" />
        <dependency name="tw-animate-css" type="devDependency" purpose="Replaces tailwindcss-animate for CSS animations in components" />
      </new_dependencies>

      <removed_dependencies>
        <dependency name="@tailwindcss/postcss" reason="Replaced by @tailwindcss/vite" />
        <dependency name="autoprefixer" reason="No longer needed with Vite plugin" />
      </removed_dependencies>

      <files_created>
        <file path="src/lib/utils.ts" purpose="cn() class merge utility + type helpers" />
        <file path="src/lib/components/ui/" purpose="Directory for generated shadcn component source files" />
      </files_created>

      <files_modified>
        <file path="src/app.css" change="CSS-first Tailwind config with @import tailwindcss, @theme block, CSS variable definitions for :root and .dark" />
        <file path="vite.config.ts" change="Add tailwindcss() to plugins array before sveltekit()" />
        <file path="package.json" change="New dependencies added, old dependencies removed" />
      </files_modified>

      <files_deleted>
        <file path="postcss.config.js" reason="Replaced by @tailwindcss/vite plugin" />
        <file path="tailwind.config.js" reason="Replaced by CSS-first @theme in app.css" />
      </files_deleted>

    </inventory>

    <!-- Phase 1 Continued: Transitive Dependencies -->
    <transitive_dependencies>
      <note>
        bits-ui depends on Svelte 5 internals. This creates a hard gate: if Argos is
        currently on Svelte 4, the Svelte 4 → 5 migration MUST complete before
        shadcn-svelte installation.
      </note>
      <critical_chain>
        shadcn-svelte CLI → generates components that import from bits-ui
        bits-ui → requires Svelte 5 runtime
        Svelte 5 → requires SvelteKit compatible version
        Tailwind v4 → requires @tailwindcss/vite OR @tailwindcss/postcss
        @tailwindcss/vite → requires Vite 5+
        All of the above → requires Node 20+
      </critical_chain>
    </transitive_dependencies>

    <!-- Phase 1 Continued: Phantom Dependencies -->
    <phantom_dependencies>
      <phantom name="Node.js version">
        Tailwind v4 upgrade tool requires Node 20+. Current .nvmrc and .node-version
        files must be verified. If below 20, upgrade FIRST.
      </phantom>
      <phantom name="Svelte version">
        CRITICAL UNKNOWN: The exact Svelte version in the current package.json has not
        been read directly. If Svelte 4, the Svelte 5 migration is a prerequisite that
        adds significant scope. This MUST be determined from Phase 0 recon before
        proceeding.
      </phantom>
      <phantom name="Tailwind version">
        Phase 0 recon command #6 determines the current version. Must be v3.x for the
        upgrade tool to work correctly.
      </phantom>
      <phantom name="Existing @apply usage">
        Phase 0 recon commands #2 and #3. If Svelte files use @apply in style blocks,
        each one needs @reference "tailwindcss" added. If zero files use @apply,
        Phase 1.5 is free.
      </phantom>
      <phantom name="Existing style blocks">
        Phase 0 recon command #1. Determines scope of Svelte component style migration.
      </phantom>
      <phantom name="Hardcoded hex colors">
        Phase 0 recon command #4. Each occurrence must be mapped to a CSS variable.
        Known: #3b82f6 in map-service.ts (from audit).
      </phantom>
      <phantom name="Dynamic class construction">
        Phase 0 recon command #5. TypeScript files that build Tailwind class strings
        dynamically will NOT be caught by the upgrade tool. Each must be manually audited.
      </phantom>
    </phantom_dependencies>

    <!-- Phase 3: Dependency Chains -->
    <dependency_chains>
      <critical_path>
        <!--
          This is the longest chain of Finish-to-Start dependencies.
          Any delay on this chain delays the entire migration.
        -->
        <step order="0" name="Phase 0: Recon" type="CRITICAL">
          <produces>Migration scope data: file counts, @apply usage, hex colors, dynamic classes, current versions</produces>
          <depends_on>Nothing — this is the start</depends_on>
          <blocks>Every subsequent phase — scope determines work volume</blocks>
        </step>

        <step order="1" name="Verify Svelte Version" type="CRITICAL_GATE">
          <produces>Go/no-go decision on whether Svelte 4→5 migration is required</produces>
          <depends_on>Phase 0 recon output (package.json inspection)</depends_on>
          <blocks>If Svelte 4: entire migration is blocked until Svelte 5 upgrade completes.
                  If Svelte 5: proceed directly to Tailwind upgrade.</blocks>
          <risk>If Svelte 4, this gate adds a MAJOR prerequisite migration that is
                out of scope for this document. shadcn-svelte migration guide for
                Svelte 4→5 exists and must be followed first.</risk>
        </step>

        <step order="2" name="Node 20+ Verification" type="CRITICAL_GATE">
          <produces>Confirmed Node 20+ runtime</produces>
          <depends_on>System environment</depends_on>
          <blocks>Tailwind v4 upgrade tool</blocks>
        </step>

        <step order="3" name="Phase 1: Tailwind v3 → v4" type="CRITICAL">
          <produces>Working app with Tailwind v4, Vite plugin, CSS-first config</produces>
          <depends_on>Node 20+, Svelte 5 confirmed</depends_on>
          <blocks>shadcn-svelte installation</blocks>
          <sub_steps>
            <sub_step order="3.1">Create branch 002-shadcn-staging</sub_step>
            <sub_step order="3.2">Run npx @tailwindcss/upgrade@next</sub_step>
            <sub_step order="3.3">Switch from PostCSS to @tailwindcss/vite plugin</sub_step>
            <sub_step order="3.4">Fix @apply in Svelte style blocks (if recon found any)</sub_step>
            <sub_step order="3.5">Fix renamed utility scales in templates</sub_step>
            <sub_step order="3.6">Fix border color defaults (CRITICAL for dark theme)</sub_step>
            <sub_step order="3.7">Fix button cursors</sub_step>
            <sub_step order="3.8">Visual regression test every route</sub_step>
            <sub_step order="3.9">Commit: "feat: migrate Tailwind v3 → v4"</sub_step>
          </sub_steps>
        </step>

        <step order="4" name="Phase 2: Audit Violation Fixes" type="MEDIUM">
          <produces>Hardcoded hex colors replaced with theme tokens</produces>
          <depends_on>Tailwind v4 @theme block available (Step 3)</depends_on>
          <blocks>Nothing directly, but cleaner foundation for Phase 3</blocks>
        </step>

        <step order="5" name="Phase 3: Install shadcn-svelte" type="CRITICAL">
          <produces>shadcn-svelte initialized, theme mapped, utils.ts created, components/ui/ directory ready</produces>
          <depends_on>Tailwind v4 working (Step 3), Svelte 5 confirmed (Step 1)</depends_on>
          <blocks>Component adoption (Phase 4)</blocks>
          <sub_steps>
            <sub_step order="5.1">npm install bits-ui tailwind-variants tailwind-merge clsx</sub_step>
            <sub_step order="5.2">npm install -D shadcn-svelte@latest</sub_step>
            <sub_step order="5.3">npx shadcn-svelte@latest init (new-york style, zinc/slate base, CSS variables yes)</sub_step>
            <sub_step order="5.4">Map Argos cyberpunk theme onto generated CSS variables in same commit</sub_step>
            <sub_step order="5.5">Update utils.ts with cn() and type helpers</sub_step>
            <sub_step order="5.6">Visual regression test — existing UI must be identical</sub_step>
            <sub_step order="5.7">Commit: "feat: install shadcn-svelte with Argos theme mapping"</sub_step>
          </sub_steps>
        </step>

        <step order="6" name="Phase 4: Component Adoption (Incremental)" type="LOW_RISK">
          <produces>Individual shadcn components replacing ad-hoc implementations</produces>
          <depends_on>shadcn-svelte initialized (Step 5)</depends_on>
          <blocks>Nothing — each component is independent</blocks>
          <note>This phase is ongoing and incremental. No big-bang replacement.</note>
        </step>

        <step order="7" name="Phase 5: Dynamic Class String Fixes" type="MEDIUM">
          <produces>All TypeScript dynamic class strings updated for Tailwind v4 utility names</produces>
          <depends_on>Phase 0 recon command #5 results</depends_on>
          <blocks>Nothing — can be done in parallel with Phase 4</blocks>
        </step>
      </critical_path>
    </dependency_chains>

</dependency_verification>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 4: MCP DEBUG SERVER CONTEXT                                  -->
  <!--  How the 7 debug servers relate to this migration                     -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<debug_server_context>
<note>
The 7 specialized MCP debugging servers (hardware-debugger.ts: 554 lines,
streaming-inspector.ts: 498 lines, system-inspector.ts: 452 lines,
database-inspector.ts: 420 lines, api-debugger.ts: 332 lines, test-runner.ts:
237 lines, gsm-evil-server.ts: 154 lines, plus dynamic-server.ts: 716 lines
for orchestration) are TypeScript backend services. They are NOT affected by
the shadcn-svelte migration. They do not render UI. They do not use Tailwind.
They communicate with the frontend via API/WebSocket.

      The only potential touchpoint is if any debug server returns CSS class names
      or color values that the frontend renders. This is unlikely but should be
      verified in Phase 0 recon by searching these files for Tailwind class strings
      or hex color values.
    </note>

    <recon_addition>
      Add to Phase 0 recon commands:
      grep -rn "class\|#[0-9a-fA-F]\{3,8\}" src/ --include="*-debugger.ts" --include="*-inspector.ts" --include="*-server.ts" --include="*-runner.ts"
      If results found: these are additional migration touchpoints.
      If no results: debug servers are migration-safe.
    </recon_addition>

</debug_server_context>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 5: PRE-MORTEM (Rulebook Phase 7, Rule 11)                    -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<pre_mortem>
<assumption>
This plan was executed exactly as written. It failed completely.
The Argos UI is broken, unusable, or had to be reverted.
</assumption>

    <failure_mode id="1" name="Svelte 4 Not Detected">
      <scenario>
        The team proceeds with shadcn-svelte installation without confirming the Svelte
        version. Argos is on Svelte 4. bits-ui latest requires Svelte 5. Every generated
        component fails to compile. Hours wasted before the root cause is identified.
      </scenario>
      <mitigated_by>Phase 0 recon command #8 explicitly checks Svelte version. Step 1 of
        critical path is a GATE that blocks all subsequent work.</mitigated_by>
      <tripwire>npm install of bits-ui fails or shows peer dependency warnings.</tripwire>
    </failure_mode>

    <failure_mode id="2" name="Border Color Massacre">
      <scenario>
        Tailwind v4 migration completes but border color defaults are not fixed. Every
        border in the dark cyberpunk theme renders as bright white (currentColor = light
        text). The UI looks completely broken. The team panics and reverts.
      </scenario>
      <mitigated_by>Phase 1.7 explicitly addresses this with grep command and fix strategy.
        Phase 1.9 checkpoint requires visual walk of every route.</mitigated_by>
      <tripwire>Any border rendering as text-colored after Tailwind v4 migration.</tripwire>
    </failure_mode>

    <failure_mode id="3" name="Map Rendering Breaks Due to Hex Color Removal">
      <scenario>
        The hardcoded #3b82f6 in map-service.ts is replaced with a CSS variable reference,
        but the map library (Leaflet/MapLibre) does not support CSS variable syntax in its
        marker color API. Markers disappear or render black.
      </scenario>
      <mitigated_by>Phase 2.1 notes that the replacement must use "however your map library
        accepts colors." This requires testing the specific API.</mitigated_by>
      <additional_mitigation>
        If the map library requires raw hex values, use getComputedStyle() to resolve the
        CSS variable to a hex value at runtime:
        getComputedStyle(document.documentElement).getPropertyValue('--color-map-marker').trim()
        This bridges the CSS variable system with APIs that require concrete color values.
      </additional_mitigation>
      <tripwire>Map markers not rendering after hex color replacement.</tripwire>
    </failure_mode>

    <failure_mode id="4" name="Dynamic TypeScript Class Strings Not Updated">
      <scenario>
        The upgrade tool fixes all Svelte template files but misses TypeScript files that
        construct class strings dynamically. Components rendered by these TS files still
        use shadow-sm (old name), which now maps to shadow-xs visual output. Shadows appear
        smaller than intended but the difference is subtle enough to not catch in testing.
        Discovered weeks later as "something looks off."
      </scenario>
      <mitigated_by>Phase 5 explicitly targets these files with grep. Phase 0 recon #5
        identifies all files that need manual review.</mitigated_by>
      <tripwire>Side-by-side screenshot comparison at pixel level.</tripwire>
    </failure_mode>

    <failure_mode id="5" name="shadcn Default Theme Committed Without Argos Colors">
      <scenario>
        Developer runs shadcn-svelte init, commits immediately with default zinc colors,
        pushes to the branch. The cyberpunk theme is overwritten. Other developers pull
        and see a generic gray interface.
      </scenario>
      <mitigated_by>Phase 3.4 states color mapping must happen BEFORE commit. Phase 3.7
        commit message explicitly says "with Argos theme mapping."</mitigated_by>
      <tripwire>Any commit containing default shadcn CSS variable values without Argos
        theme overrides in the .dark block.</tripwire>
    </failure_mode>

    <failure_mode id="6" name="Docker Build Breaks Due to Node Version">
      <scenario>
        Development machine has Node 20+ but the Docker container in docker/ uses an
        older Node base image. Local development works. Docker build fails on Tailwind v4
        or bits-ui installation.
      </scenario>
      <mitigated_by>Not explicitly covered in current runbook.</mitigated_by>
      <additional_mitigation>
        Add to Phase 1.2: verify the Node version in ALL Dockerfiles under docker/
        directory. Update base images to node:20-alpine or later. Update .nvmrc and
        .node-version files to match.
      </additional_mitigation>
      <tripwire>Docker build failure referencing Node version or unsupported syntax.</tripwire>
    </failure_mode>

</pre_mortem>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 6: DEFINITION OF DONE (Rulebook Phase 7, Rule 12)           -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<definition_of_done>

    <task_level>
      <criterion id="1">npm run dev starts without errors on the 002-shadcn-staging branch</criterion>
      <criterion id="2">npm run build produces a deployable output without errors</criterion>
      <criterion id="3">Every route in the application renders identically to 001-audit-remediation
        branch (verified by visual screenshot comparison)</criterion>
      <criterion id="4">No browser console errors related to missing classes, broken imports,
        or CSS variable resolution</criterion>
      <criterion id="5">tailwind.config.js is deleted — all config is in app.css @theme block</criterion>
      <criterion id="6">postcss.config.js is deleted — @tailwindcss/vite plugin is active</criterion>
      <criterion id="7">At least one shadcn-svelte component (e.g., AlertDialog) is added and
        replaces a browser alert()/confirm() call — proving the pipeline works end-to-end</criterion>
      <criterion id="8">All hardcoded hex color values flagged in audit are replaced with
        CSS variable references</criterion>
      <criterion id="9">Docker build succeeds with the updated dependencies</criterion>
      <criterion id="10">No Svelte 4 syntax remains if migration to Svelte 5 was required</criterion>
    </task_level>

    <out_of_scope>
      <item>OKLCH color migration (HSL still works, convert later)</item>
      <item>size-* utility replacement for w-* h-* (convenience, not required)</item>
      <item>Full replacement of all custom components with shadcn equivalents (incremental, Phase 4+)</item>
      <item>Svelte 5 runes migration of existing component code (separate effort)</item>
      <item>Multi-node architecture changes (backend/transport layer, not UI framework)</item>
      <item>MCP server setup for AI-assisted development (post-staging)</item>
    </out_of_scope>

</definition_of_done>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 7: RISK AND ASSUMPTION REGISTER (Rulebook Proof Doc 8)      -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<risk_register>

    <assumption id="1" name="Svelte version is 5" impact="CRITICAL">
      <evidence>Unknown — not confirmed from package.json</evidence>
      <if_wrong>Entire migration blocked. Svelte 4→5 upgrade must be completed first,
        which is a separate major effort with its own runes migration concerns.</if_wrong>
      <mitigation>Phase 0 recon confirms this immediately. If Svelte 4, stop and
        plan the Svelte upgrade as a prerequisite.</mitigation>
      <tripwire>package.json shows svelte version &lt; 5.0.0</tripwire>
    </assumption>

    <assumption id="2" name="Tailwind is v3" impact="HIGH">
      <evidence>Presence of tailwind.config.js and postcss.config.js in repo strongly
        suggests v3. Not confirmed from node_modules.</evidence>
      <if_wrong>If already v4, Phase 1 is largely skipped. If v2 or older, upgrade
        path is different.</if_wrong>
      <mitigation>Phase 0 recon command #6 confirms.</mitigation>
      <tripwire>tailwindcss version in package.json</tripwire>
    </assumption>

    <assumption id="3" name="No other UI component library is installed" impact="MEDIUM">
      <evidence>Not confirmed. If Skeleton, Flowbite, or another library is present,
        there may be CSS conflicts or duplicate component implementations.</evidence>
      <if_wrong>Must audit for conflicting component libraries and plan removal or
        coexistence strategy.</if_wrong>
      <mitigation>Check package.json for skeleton, flowbite-svelte, smui, or other
        UI library packages during Phase 0.</mitigation>
    </assumption>

    <assumption id="4" name="Map library accepts CSS variables or computed hex values" impact="MEDIUM">
      <evidence>Not confirmed. Leaflet and MapLibre typically accept hex strings, not
        CSS variable syntax.</evidence>
      <if_wrong>Map markers may not render after hex color replacement.</if_wrong>
      <mitigation>Use getComputedStyle() bridge to resolve CSS variables to hex at
        runtime for map library APIs.</mitigation>
    </assumption>

    <assumption id="5" name="Docker base images support Node 20+" impact="HIGH">
      <evidence>Not confirmed — docker/ directory contents not inspected.</evidence>
      <if_wrong>Docker builds will fail after dependency updates.</if_wrong>
      <mitigation>Inspect all Dockerfiles during Phase 0. Update base images as needed.</mitigation>
    </assumption>

    <assumption id="6" name="@apply usage is minimal or zero" impact="LOW">
      <evidence>Unknown. Many SvelteKit projects use utility-first Tailwind without
        @apply. The 0.9% CSS suggests minimal custom CSS.</evidence>
      <if_wrong>If extensive @apply usage, Phase 1.5 requires adding @reference to
        many Svelte files — tedious but automatable.</if_wrong>
      <mitigation>Phase 0 recon commands #2 and #3 quantify this exactly.</mitigation>
    </assumption>

</risk_register>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 8: CONSISTENCY VERIFICATION (Rulebook Phase 8)              -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<consistency_verification>

    <version_consistency>
      <check name="Node version alignment">
        .nvmrc, .node-version, Dockerfile base images, and CI/CD configurations
        must all specify the same Node major version (20+).
      </check>
      <check name="Svelte version alignment">
        package.json svelte version, bits-ui peer dependency requirement, and
        shadcn-svelte component syntax (Svelte 5 runes vs Svelte 4 slots) must
        all be consistent.
      </check>
      <check name="Tailwind version alignment">
        @tailwindcss/vite version, tw-animate-css compatibility, and app.css
        @theme syntax must all target Tailwind v4.
      </check>
    </version_consistency>

    <naming_consistency>
      <check name="Component directory path">
        shadcn-svelte init will ask for components alias. Answer must be $lib/components
        which maps to src/lib/components/ui/. This path must not conflict with any
        existing component directory in the codebase.
      </check>
      <check name="Utils path">
        shadcn-svelte init will ask for utils alias. Answer must be $lib/utils which
        maps to src/lib/utils.ts. If a utils.ts already exists at this path, it must
        be merged, not overwritten.
      </check>
    </naming_consistency>

    <behavioral_consistency>
      <check name="Dark mode mechanism">
        shadcn-svelte uses a .dark class on the root element to activate the .dark
        CSS variable block. Argos must use the same mechanism. If Argos currently uses
        prefers-color-scheme media query or a different dark mode toggle, the mechanism
        must be aligned.
      </check>
      <check name="CSS variable format">
        shadcn-svelte v4 generates OKLCH values by default but HSL still works. The
        runbook specifies HSL for initial mapping. This is consistent — no format conflict.
        OKLCH conversion is explicitly deferred to out-of-scope.
      </check>
    </behavioral_consistency>

    <temporal_consistency>
      <check name="Tailwind v4 before shadcn-svelte">
        Phase 1 (Tailwind upgrade) must complete and be verified (Step 3.8) before
        Phase 3 (shadcn-svelte install) begins. The runbook enforces this order with
        separate commits.
      </check>
      <check name="Theme mapping in same commit as init">
        Phase 3.4 (Argos color mapping) must occur in the same commit as Phase 3.3
        (shadcn-svelte init). The runbook enforces this at Step 5.7.
      </check>
      <check name="Svelte 5 before bits-ui">
        If Svelte 4→5 upgrade is needed, it must complete before bits-ui is installed.
        bits-ui will fail to resolve peer dependencies on Svelte 4.
      </check>
    </temporal_consistency>

</consistency_verification>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 9: OPEN QUESTIONS REQUIRING PHASE 0 RECON                   -->
  <!--  Items that cannot be verified without running commands on the repo    -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<open_questions>
<question id="1" blocking="true">
What is the exact Svelte version in package.json? If &lt; 5.0.0, the Svelte 4→5
migration must be planned and executed first, adding major scope.
</question>
<question id="2" blocking="true">
What is the exact Tailwind CSS version? Confirms v3 assumption.
</question>
<question id="3" blocking="false">
How many Svelte files have style blocks with @apply? Determines Phase 1.5 scope.
</question>
<question id="4" blocking="false">
How many TypeScript files construct Tailwind classes dynamically? Determines Phase 5 scope.
</question>
<question id="5" blocking="false">
What hex colors beyond #3b82f6 exist in TypeScript files? Determines Phase 2 scope.
</question>
<question id="6" blocking="true">
What Node version do the Docker base images use? Must be 20+ or Docker builds fail.
</question>
<question id="7" blocking="false">
Does src/lib/utils.ts already exist? If yes, must merge with shadcn-svelte utils
rather than overwrite.
</question>
<question id="8" blocking="false">
What map library is used (Leaflet, MapLibre, other)? Determines how to bridge
CSS variables to the marker color API.
</question>
<question id="9" blocking="false">
Are any other UI component libraries installed (Skeleton, Flowbite, etc.)?
Determines whether removal or coexistence planning is needed.
</question>
<question id="10" blocking="false">
Do the 7 MCP debug servers contain any Tailwind class strings or hex color values
that would be affected by the migration?
</question>
</open_questions>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  SECTION 10: FINAL STRUCTURE AFTER STAGING                            -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<final_structure>
<![CDATA[
src/
app.css ← CSS-first Tailwind v4 config
@import "tailwindcss"
@import "tw-animate-css"
@theme inline { ... }
:root { --background: ...; }
.dark { --background: ...; --primary: ...; }
lib/
components/
ui/ ← shadcn-svelte generated components (you own these)
alert-dialog/ ← imports from bits-ui internally
button/ ← imports from bits-ui internally
command/ ← imports from bits-ui internally
dialog/ ← imports from bits-ui internally
...
[existing Argos components] ← UNCHANGED — coexist alongside shadcn components
utils.ts ← cn() + type helpers (new file)
tactical-map/
map-service.ts ← hex colors replaced with CSS variable references
[all other existing code] ← UNCHANGED

vite.config.ts ← @tailwindcss/vite plugin added
(postcss.config.js) ← DELETED
(tailwind.config.js) ← DELETED

docker/
[Dockerfiles] ← Node base images updated to 20+

.nvmrc ← Updated to 20+
.node-version ← Updated to 20+
]]>
</final_structure>

</argos_shadcn_migration>

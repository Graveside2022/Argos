<?xml version="1.0" encoding="UTF-8"?>

<!--
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║              UI FEATURE CONSTRUCTION ENGINE v1.0                            ║
  ║                                                                            ║
  ║  Purpose: Provide a rigorous, research-validated systematic methodology    ║
  ║  for building new UI features from requirements to production-ready code.  ║
  ║  Every decision is grounded in peer-reviewed HCI research, perceptual     ║
  ║  psychology, accessibility standards, and interaction design principles.   ║
  ║                                                                            ║
  ║  Usage: Run this sequence when creating any new UI feature, component,    ║
  ║  page, or screen. You are building from nothing. Your job is to translate ║
  ║  user intent into a visual interface that is usable, accessible, and      ║
  ║  consistent with established patterns humans already understand.          ║
  ║                                                                            ║
  ║  Companion: ui_visual_diagnosis_engine.xml (for fixing existing UI)       ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
-->

<ui_feature_construction_engine version="1.0">

  <metadata>
    <title>UI Feature Construction Engine</title>
    <purpose>
      Systematically design and build new UI features by applying human-centered
      design methodology, perceptual psychology, usability heuristics, accessibility
      standards, and interaction design principles. This engine replaces ad-hoc UI
      construction with a structured, repeatable process that produces interfaces
      users can immediately understand and trust.

      This engine is for CREATION. It assumes nothing exists yet. Its companion,
      the UI Visual Diagnosis Engine, is for REPAIR of existing UI.
    </purpose>
    <when_to_use>
      Run this sequence when building any new UI feature. The tiers are ordered
      to prevent the most expensive class of errors: building the wrong thing,
      building it inconsistently, or building it inaccessibly. Each tier must be
      completed before moving to the next. Skipping tiers produces UI that "works"
      but feels wrong, breaks on edge cases, or fails accessibility standards.
    </when_to_use>

    <theoretical_foundations>

      <foundation name="Human-Centered Design (ISO 9241-210:2019)"
                  source="ISO (2019). ISO 9241-210:2019 Ergonomics of human-system interaction — Part 210: Human-centred design for interactive systems. | Norman, D.A. (1986). User-Centered System Design. Lawrence Erlbaum.">
        The international standard for designing interactive systems defines five
        iterative activities: (1) plan the human-centered design process, (2) understand
        and specify the context of use, (3) specify user requirements, (4) produce
        design solutions, and (5) evaluate designs against requirements. The standard
        requires that design "be based on a comprehensive understanding of the users,
        tasks, and working environment" and that "users are involved throughout design
        and development." Donald Norman coined the term "user-centered design" in 1986,
        and ISO extended it to "human-centered design" in 2010 to include all
        stakeholders. The practical implication: never build a feature without first
        understanding who will use it, what task they are performing, and what
        environment they are in. Every tier in this engine traces to an HCD activity.
      </foundation>

      <foundation name="Gestalt Principles of Visual Perception"
                  source="Wertheimer, M. (1923). Laws of Organization in Perceptual Forms. | Koffka, K. (1935). Principles of Gestalt Psychology. | Palmer, S.E. (1992). Common Region: A New Principle of Perceptual Grouping. Cognitive Psychology, 24(3), 436-447.">
        Over a century of perceptual psychology research establishes that the human
        brain organizes visual elements using specific grouping laws: Proximity (close
        elements = grouped), Similarity (visually alike elements = related), Continuity
        (the eye follows smooth paths), Closure (the brain completes incomplete shapes),
        Figure-Ground (foreground separated from background), Common Region (enclosed
        elements = grouped — Palmer 1992), Symmetry/Prägnanz (simplest interpretation
        preferred), Common Fate (co-moving elements = grouped), and Focal Point
        (visually distinct elements capture attention first). These principles are not
        aesthetic guidelines — they are descriptions of how human visual processing
        works. Layouts that violate them create perceptual confusion regardless of how
        "clean" the CSS is. Every layout decision in this engine must comply with
        Gestalt or deliberately override it for a stated reason.
      </foundation>

      <foundation name="Nielsen's 10 Usability Heuristics"
                  source="Nielsen, J. (1994). Enhancing the Explanatory Power of Usability Heuristics. CHI '94, pp. 152-158.">
        Jakob Nielsen derived 10 heuristics from factor analysis of 249 usability
        problems: (1) Visibility of system status, (2) Match between system and real
        world, (3) User control and freedom, (4) Consistency and standards,
        (5) Error prevention, (6) Recognition rather than recall, (7) Flexibility and
        efficiency of use, (8) Aesthetic and minimalist design, (9) Help users
        recognize, diagnose, and recover from errors, (10) Help and documentation.
        These heuristics have been unchanged since 1994 because they describe human
        cognitive limitations, not technology. Every new feature must be evaluated
        against all 10 before shipping. Heuristic evaluation with 3-5 evaluators
        finds approximately 75% of usability problems.
      </foundation>

      <foundation name="Fitts's Law"
                  source="Fitts, P.M. (1954). The Information Capacity of the Human Motor System. J. Exp. Psychology, 47(6). | MacKenzie, I.S. &amp; Buxton, W. (1992). Extending Fitts' Law to Two-Dimensional Tasks. CHI '92. | Bi, X., Li, Y. &amp; Zhai, S. (2013). FFitts Law: Modeling Finger Touch with Fitts' Law. CHI '13.">
        Movement time to acquire a target follows T = a + b × log₂(2D/W). Larger
        targets and shorter distances reduce acquisition time. For finger input on
        touchscreens (Bi et al. 2013), error rates exceed 20% when targets are smaller
        than 5mm. Optimal touch targets are 9-12mm (approximately 44-48px at standard
        DPI). Screen edges are infinite targets for cursor-based interaction. Every
        interactive element size, spacing, and placement decision must respect this law.
      </foundation>

      <foundation name="Hick-Hyman Law"
                  source="Hick, W.E. (1952). On the Rate of Gain of Information. Q.J. Exp. Psychology, 4(1). | Hyman, R. (1953). Stimulus Information as a Determinant of Reaction Time. J. Exp. Psychology, 45(3).">
        Decision time increases logarithmically with the number of equally probable
        choices: RT = a + b × log₂(n). This governs navigation design, menu structure,
        and any interface requiring user choice. Reduce visible options, group related
        choices, and use progressive disclosure to manage complexity. Exceptions: when
        users already know what they want, when options have unequal probability, or
        when the task is scanning an ordered list rather than choosing.
      </foundation>

      <foundation name="Miller's Law and Cognitive Load Theory"
                  source="Miller, G.A. (1956). The Magical Number Seven, Plus or Minus Two. Psychological Review, 63(2). | Cowan, N. (2001). The Magical Number 4 in Short-Term Memory. Behavioral and Brain Sciences, 24. | Sweller, J. (1988). Cognitive Load During Problem Solving. Cognitive Science, 12(2).">
        Working memory holds approximately 4 chunks (Cowan 2001). Cognitive Load Theory
        (Sweller 1988) identifies three types: intrinsic (task complexity), extraneous
        (imposed by poor design), and germane (productive learning effort). Every UI
        element that does not serve the user's task adds extraneous load. The design
        imperative: minimize extraneous load by reducing unnecessary elements, chunking
        related information, and maintaining consistent patterns so the user can reuse
        learned interaction models.
      </foundation>

      <foundation name="Norman's Design Principles"
                  source="Norman, D.A. (1988/2013). The Design of Everyday Things. Basic Books. | Gibson, J.J. (1979). The Ecological Approach to Visual Perception.">
        Six principles govern interaction: (1) Affordances (what actions are possible),
        (2) Signifiers (perceivable cues for action), (3) Mapping (control-effect
        relationships), (4) Feedback (action results), (5) Constraints (limiting actions
        to prevent error), (6) Conceptual Models (user's mental understanding). Norman's
        Gulf of Execution (gap between intent and available actions) and Gulf of
        Evaluation (gap between system state and user understanding) must both be
        minimized. Every interactive element must have clear signifiers. Every action
        must produce immediate feedback. Every destructive action must have constraints.
      </foundation>

      <foundation name="WCAG 2.1/2.2 Accessibility Standards"
                  source="W3C (2018). WCAG 2.1. W3C Recommendation. | W3C (2023). WCAG 2.2. | WebAIM (2024). The WebAIM Million.">
        Accessibility is not an afterthought — it must be built in from the first line
        of code. WCAG defines four principles (POUR): Perceivable, Operable,
        Understandable, Robust. Level AA requirements that affect every new feature:
        text contrast ≥ 4.5:1 (SC 1.4.3), non-text contrast ≥ 3:1 (SC 1.4.11), no
        color-only information (SC 1.4.1), keyboard accessible (SC 2.1.1), visible
        focus (SC 2.4.7), text resizable to 200% (SC 1.4.4), touch targets ≥ 24×24px
        minimum (SC 2.5.8, WCAG 2.2). WebAIM's 2024 analysis found 83.6% of websites
        fail contrast. 8% of males have color vision deficiency (Birch 2012). These
        are baseline requirements, not enhancements.
      </foundation>

      <foundation name="Eye-Tracking and Visual Scanning Patterns"
                  source="Nielsen, J. (2006). F-Shaped Pattern for Reading Web Content. NN/g. | Nielsen, J. &amp; Pernice, K. (2010). Eyetracking Web Usability. New Riders.">
        79% of users scan rather than read. Text-heavy pages are scanned in an
        F-pattern (horizontal top, shorter horizontal middle, vertical left side).
        Landing pages and visual layouts are scanned in a Z-pattern. Users spend
        most fixation time in the top-left quadrant. First words of headings and
        list items receive disproportionate attention. These patterns determine where
        primary actions and critical content must be placed in any new layout.
      </foundation>

      <foundation name="Typography and Legibility"
                  source="Bringhurst, R. (2002). The Elements of Typographic Style. | Tinker, M.A. (1963). Legibility of Print. | Legge, G.E. &amp; Bigelow, C.A. (2011). Does Print Size Matter for Reading? Journal of Vision, 11(5).">
        Optimal line length: 45-75 characters per line, 66 ideal (Bringhurst). Body
        text minimum: 16px on screen. Line height: 1.4-1.6 for body text. All-caps
        reduces reading speed (Tinker 1963). Critical print size corresponds to x-height
        visual angle of 0.2 degrees (Legge &amp; Bigelow 2011). Screen-optimized fonts
        have larger x-heights and open counters. These are engineering specifications,
        not aesthetic preferences.
      </foundation>

      <foundation name="Jakob's Law"
                  source="Nielsen, J. (2000). Jakob's Law of the Internet User Experience. NN/g. | Baymard Institute (2022). Usability Benchmark Study.">
        Users spend most of their time on other sites and bring mental models from
        those experiences. Familiar patterns reduce errors by 30% and increase task
        completion by 18% (Baymard 2022). When building new features, default to
        established conventions. Only deviate when there is a tested, compelling reason
        and a graceful migration path for users accustomed to the convention.
      </foundation>

      <foundation name="CRAP Principles of Visual Design"
                  source="Williams, R. (2004). The Non-Designer's Design Book, 2nd Ed. Peachpit Press. | MIT 6.813 (2018). Graphic Design Reading, MIT OCW.">
        Robin Williams codified four fundamental visual design principles under the
        acronym CRAP: Contrast (difference in style implies difference in meaning),
        Repetition (repeating visual elements creates unity and cohesion), Alignment
        (every element has a visual connection to another via invisible lines), and
        Proximity (related elements are close, unrelated elements are far). These
        principles map directly to Gestalt: Proximity = Gestalt Proximity, Repetition
        = Gestalt Similarity, Alignment = Gestalt Continuity, Contrast = Gestalt Focal
        Point. CRAP provides the designer's operational vocabulary for applying Gestalt
        science. Every layout decision must satisfy all four.
      </foundation>

      <foundation name="Atomic Design and Design Systems"
                  source="Frost, B. (2013/2016). Atomic Design. | Salesforce UX (2014). Design Tokens. Lightning Design System.">
        UI components exist in a hierarchy: Tokens (named values for color, spacing,
        type) → Atoms (basic elements: buttons, inputs, labels) → Molecules (functional
        groups: search bars, form fields) → Organisms (complex structures: headers,
        product cards) → Templates (page layouts) → Pages (templates with real content).
        New features must be composed from existing atoms and molecules wherever possible.
        New atoms should only be created when no existing component serves the need.
        Every new component must reference design tokens for visual properties, never
        hardcoded values.
      </foundation>

      <foundation name="Color Science and Color Vision Deficiency"
                  source="Hurvich, L.M. &amp; Jameson, D. (1957). Opponent-Process Theory. Psychological Review, 64(6). | Birch, J. (2012). Worldwide Prevalence of Red-Green Color Deficiency. JOSA A, 29(3).">
        8% of males and 0.5% of females have color vision deficiency. Deuteranomaly
        (5% of males) is most common. Never use red-green as the sole distinguishing
        pair. Always provide a secondary channel: shape, text label, icon, pattern, or
        underline. Test every color decision with a CVD simulator before shipping.
      </foundation>

    </theoretical_foundations>

  </metadata>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 0: REQUIREMENTS — UNDERSTAND BEFORE YOU BUILD                  -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="0" name="Requirements — Understand Before You Build">
    <purpose>
      Before writing any code or choosing any component, establish what the feature
      must do, who it serves, and what constraints it operates under. This tier
      implements ISO 9241-210 Activities 1-3: planning, understanding context of
      use, and specifying requirements. Skipping this tier is the single most
      expensive mistake in UI construction — building the wrong thing perfectly.
    </purpose>

    <step id="RQ-1" name="Identify the User's Task" research="ISO 9241-210; TF-5: Cognitive Load">
      What specific task is the user trying to accomplish? Not "view a dashboard"
      but "determine whether this month's revenue is on track compared to last
      month." Not "fill out a form" but "submit a support request with enough
      detail for the team to act without follow-up." The task definition determines
      every subsequent design decision. If you cannot state the task in one
      sentence, the feature scope is not defined.
    </step>

    <step id="RQ-2" name="Identify the User" research="ISO 9241-210">
      Who is performing this task? Their technical sophistication determines
      vocabulary (Nielsen Heuristic 2: Match between system and real world).
      Their frequency of use determines whether to optimize for learnability
      or efficiency (Nielsen Heuristic 7: Flexibility and efficiency of use).
      Their device and context determine layout constraints and target sizes
      (Fitts's Law). A feature designed for daily-use power users is different
      from one designed for first-time visitors.
    </step>

    <step id="RQ-3" name="Identify Constraints" research="TF-7: WCAG">
      What design system exists? What tokens, components, and patterns are
      already established? What accessibility level is required (minimum AA)?
      What viewports must be supported? What browsers? What are the performance
      budgets? Constraints are not limitations — they are decisions already made
      that prevent inconsistency. Document them before designing.
    </step>

    <step id="RQ-4" name="Identify the Information Architecture" research="TF-4: Hick's Law; TF-5: Miller/Cowan">
      What data does the user need to see? What actions can the user take?
      What is the hierarchy: what is most important, second, third? How does
      this feature relate to adjacent features (navigation context)? Apply
      Hick's Law: if the user faces more than 5-7 choices simultaneously,
      introduce progressive disclosure or grouping. Apply Miller/Cowan: if the
      screen presents more than 4 distinct perceptual groups, reduce complexity.
    </step>

    <step id="RQ-5" name="Identify All States" research="TF-2: Nielsen Heuristic 1; TF-6: Norman Feedback">
      Every feature has multiple states. Enumerate them before building:
      — Empty state: no data exists yet.
      — Loading state: data is being fetched.
      — Default state: data is present, no interaction.
      — Active/editing state: user is interacting.
      — Error state: something went wrong.
      — Success state: action completed.
      — Disabled state: action is unavailable.
      — Partial state: some data is present, some is missing.
      — Overflow state: more data than fits the viewport.
      If you do not design a state, the user will encounter it anyway and see
      either nothing or a broken layout. Both violate Nielsen Heuristic 1
      (Visibility of System Status).
    </step>

    <step id="RQ-6" name="Identify Edge Cases">
      What happens with: minimum content (one item, one character), maximum
      content (thousands of items, longest possible string), missing content
      (null, undefined, empty string), special characters, RTL text, very
      long single words (no whitespace for wrapping), zero results from search,
      slow network, network failure mid-action. Each edge case needs a designed
      response. Undesigned edge cases are bugs.
    </step>

    <step id="RQ-7" name="Establish the Convention" research="TF-10: Jakob's Law">
      Before inventing anything, research how this type of feature works in
      the products your users already use. Apply Jakob's Law: users bring mental
      models from other products. If every e-commerce site puts the cart icon
      in the top right, putting yours in the bottom left creates friction that
      reduces task completion by up to 30% (Baymard 2022). Default to convention.
      Document any deviation and the reason for it.
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 1: LAYOUT — STRUCTURE THE SPACE                                -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="1" name="Layout Architecture — Structure the Space">
    <purpose>
      Establish the spatial structure of the feature before choosing any components
      or applying any styles. Layout determines the perceptual grouping (Gestalt),
      the scanning path (eye-tracking), and the cognitive load (Miller/Sweller).
      A correct layout with wrong colors is fixable. A wrong layout with perfect
      colors is a rebuild.
    </purpose>

    <step id="LA-1" name="Choose the Layout Model" research="TF-1: Gestalt Common Region">
      Select the CSS layout mechanism based on the content structure:
      — CSS Grid: for two-dimensional layouts (rows AND columns).
      — Flexbox: for one-dimensional layouts (row OR column).
      — Stack (flex-direction: column): for vertically stacked content.
      — Sidebar + content: for navigation-heavy features.
      — Full-width sections: for marketing/landing pages.
      The layout model creates the Common Region containers that define how
      users perceive grouping. Choose it deliberately.
    </step>

    <step id="LA-2" name="Define the Grid" research="CRAP: Alignment">
      Establish the column grid and spacing scale. All elements must align to
      the grid. Use the existing design system's grid if one exists. If not,
      establish: column count (4 mobile, 8 tablet, 12 desktop is standard),
      gutter width (16px or 24px), margin width (16px mobile, 24-48px desktop),
      and maximum content width (1200-1440px). Every element snaps to this grid.
      No element should be placed arbitrarily.
    </step>

    <step id="LA-3" name="Establish the Spacing Scale" research="TF-1: Gestalt Proximity">
      All spacing must come from a defined scale, never arbitrary values. A
      standard geometric scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px. The scale
      enforces Gestalt Proximity: related elements use tighter spacing (8-16px),
      section separation uses wider spacing (32-64px). If the design system has
      an existing scale, use it. Never introduce a spacing value outside the scale.
    </step>

    <step id="LA-4" name="Define Content Zones" research="TF-8: Eye-Tracking">
      Divide the layout into zones based on eye-tracking research:
      — Primary zone (top-left quadrant): Most important content and primary
        action. This is where F-pattern and Z-pattern scanning begins.
      — Secondary zone (top-right): Supporting actions, secondary navigation.
      — Tertiary zone (below the fold): Details, supplementary content.
      — Action zone (bottom or right): Confirmation buttons, submit actions.
      Place the most important element in the primary zone. Do not bury the
      primary action below the fold or in a low-attention area.
    </step>

    <step id="LA-5" name="Plan Responsive Behavior" research="TF-3: Fitts's Law">
      Define how the layout adapts at each breakpoint BEFORE building:
      — 320-479px (mobile portrait): Single column. Touch targets ≥ 44px.
      — 480-767px (mobile landscape / small tablet): Single or two column.
      — 768-1023px (tablet): Two or three column. Sidebar may appear.
      — 1024-1439px (desktop): Full layout. All features visible.
      — 1440px+ (large desktop): Content max-width with centered layout.
      At mobile sizes, Fitts's Law dominates: every interactive element must
      be large enough for finger acquisition (minimum 44×44px active area with
      at least 8px spacing between targets).
    </step>

    <step id="LA-6" name="Define the Scroll Strategy">
      Determine what scrolls and what stays fixed:
      — Fixed: navigation bar, persistent actions, tab headers.
      — Scrollable: content lists, long forms, data tables.
      — Sticky: section headers, column headers in tables.
      Never require horizontal scrolling on any viewport width. If content
      overflows horizontally, the layout is broken.
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 2: VISUAL HIERARCHY — GUIDE THE EYE                            -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="2" name="Visual Hierarchy — Guide the Eye">
    <purpose>
      Establish the visual hierarchy using size, weight, color, contrast, and
      position so the user's eye is guided to the most important element first,
      then second, then third. Apply CRAP principles (Contrast, Repetition,
      Alignment, Proximity) as the operational framework for Gestalt science.
    </purpose>

    <step id="VH-1" name="Size Hierarchy" research="CRAP: Contrast; TF-9: Typography">
      The most important element is the largest. Establish a type scale that
      creates clear size differentiation:
      — Page title: 24-32px, bold (700).
      — Section heading: 20-24px, semibold (600).
      — Subsection heading: 16-18px, semibold (600).
      — Body text: 16px, regular (400).
      — Caption/helper text: 12-14px, regular (400).
      Each level must be perceptibly different from the next. A 2px difference
      is not perceptible. Use the design system's type scale if one exists.
    </step>

    <step id="VH-2" name="Weight Hierarchy" research="CRAP: Contrast">
      Use font weight to reinforce size hierarchy:
      — Titles and headings: semibold (600) or bold (700).
      — Body text: regular (400).
      — De-emphasized text: regular (400) with reduced opacity or lighter color.
      — Interactive text (links, buttons): medium (500) or semibold (600).
      Never use more than 3 font weights in a single feature. More creates
      visual noise that violates Nielsen Heuristic 8 (Aesthetic and Minimalist
      Design).
    </step>

    <step id="VH-3" name="Color Hierarchy" research="TF-7: WCAG; TF-12: Color Science">
      Use color to create emphasis layers:
      — Primary text: high contrast against background (≥ 7:1 for maximum
        readability, minimum 4.5:1 per WCAG AA).
      — Secondary text: medium contrast (≥ 4.5:1), typically gray.
      — Disabled text: low contrast (≥ 3:1 per WCAG, but visually receded).
      — Accent color: used sparingly for primary actions and active states.
      — Error: red + icon (never red alone — 8% of males have CVD).
      — Success: green + icon (same reason).
      — Warning: amber/yellow + icon.
      All color pairings must meet WCAG SC 1.4.3 contrast minimums.
    </step>

    <step id="VH-4" name="Spatial Hierarchy" research="TF-1: Gestalt Proximity; CRAP: Proximity">
      Use spacing to create visual groups:
      — Within-group spacing: tight (8-16px). Elements inside a card, form
        fields with their labels, icon beside its text.
      — Between-group spacing: medium (24-32px). Separate cards, separate
        form sections, separate content blocks.
      — Between-section spacing: wide (48-64px). Separate major page sections.
      The ratio between within-group and between-group spacing must be at
      least 2:1 for grouping to be perceptible. If within = 16px, between
      must be ≥ 32px.
    </step>

    <step id="VH-5" name="Elevation Hierarchy" research="TF-1: Gestalt Figure-Ground">
      Use shadow, border, and background to create depth layers:
      — Base layer: page background (lightest).
      — Content layer: cards, panels (slight elevation or border).
      — Overlay layer: modals, dropdowns, tooltips (strongest shadow).
      — Urgent layer: toasts, alerts (highest elevation, distinctive color).
      Each layer must be visually distinct. Do not mix elevation levels within
      the same semantic layer. Maintain consistent shadow values across all
      elements at the same elevation.
    </step>

    <step id="VH-6" name="Apply the Squint Test">
      Squint at the layout until you cannot read text. The distribution of
      visual weight should reveal the hierarchy: the most important element
      is the most visually prominent blob. If squinting shows an even
      distribution with no focal point, the hierarchy is flat and the user
      has no entry point. If the wrong element dominates, the hierarchy is
      inverted. Fix before proceeding.
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 3: COMPONENT SELECTION — BUILD WITH THE RIGHT PARTS             -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="3" name="Component Selection — Build With the Right Parts">
    <purpose>
      Select the correct UI components for each element of the feature. Apply
      Atomic Design hierarchy: compose from existing tokens, atoms, and
      molecules before creating new ones. Apply Jakob's Law: use conventional
      components that match user mental models.
    </purpose>

    <step id="CS-1" name="Audit Existing Components" research="TF-11: Atomic Design">
      Before building anything new, inventory the design system's existing
      components. For each element needed, check: does a component already
      exist that serves this purpose? If yes, use it. If it almost serves
      the purpose, extend it. Only create a new component if nothing in the
      system addresses the need. New components increase maintenance burden
      and introduce inconsistency risk.
    </step>

    <step id="CS-2" name="Select Navigation Components" research="TF-10: Jakob's Law; TF-4: Hick's Law">
      Choose navigation based on information architecture:
      — Top nav bar: 5-7 primary sections (Hick's Law: limit choices).
      — Side nav: 8+ sections, nested hierarchy, or persistent navigation.
      — Tabs: 2-6 views of the same content or related content.
      — Breadcrumbs: deep hierarchy requiring wayfinding.
      — Bottom nav (mobile): 3-5 primary actions.
      Match the convention users expect (Jakob's Law). If competitors use
      top nav, use top nav unless you have tested data showing otherwise.
    </step>

    <step id="CS-3" name="Select Input Components" research="TF-6: Norman Constraints; TF-5: Cognitive Load">
      Choose input type based on the data being collected:
      — Text input: freeform text, names, emails.
      — Textarea: multi-line freeform text.
      — Select/dropdown: 5-15 predefined options.
      — Radio buttons: 2-5 mutually exclusive options (all visible).
      — Checkboxes: multiple selections from a set.
      — Toggle: binary on/off with immediate effect.
      — Date picker: date selection.
      — Autocomplete: large option sets (100+).
      Apply Norman's Constraints: the input type should prevent invalid input
      by construction. A date picker prevents invalid date formats. A select
      prevents freeform entry when only predefined values are valid.
    </step>

    <step id="CS-4" name="Select Action Components" research="TF-3: Fitts's Law; TF-6: Norman Signifiers">
      Choose action elements based on importance and context:
      — Primary button (filled): one per screen section. The main action.
      — Secondary button (outlined): supporting actions.
      — Tertiary button (text/ghost): low-priority actions, cancel.
      — Icon button: repeated actions in lists (edit, delete).
      — Link: navigation to another page or section.
      — FAB (floating action button): single primary creation action (mobile).
      Primary buttons must be visually dominant (Fitts's Law: larger target,
      prominent color). Destructive actions (delete, remove) must be visually
      distinct and require confirmation (Norman: Constraints).
    </step>

    <step id="CS-5" name="Select Feedback Components" research="TF-2: Nielsen Heuristic 1; TF-6: Norman Feedback">
      Choose feedback mechanisms for every state transition:
      — Loading spinner/skeleton: data is being fetched (show within 200ms).
      — Toast/snackbar: action completed or failed (auto-dismiss 4-8 seconds).
      — Inline error: form field validation failure (below the field).
      — Banner: persistent system-level message.
      — Progress bar: multi-step or long-running operations.
      — Empty state illustration: no data exists yet.
      Every user action must produce visible feedback within 100ms (Nielsen
      Heuristic 1). If the operation takes longer, show a loading indicator
      within 200ms. If it takes more than 1 second, show progress.
    </step>

    <step id="CS-6" name="Select Data Display Components" research="TF-5: Cognitive Load; TF-9: Typography">
      Choose data display based on content type and density:
      — Card grid: visual content, products, profiles.
      — List: sequential content, emails, notifications.
      — Table: structured data with multiple attributes per item.
      — Key-value pairs: detail views, settings.
      — Chart: trends, comparisons, distributions.
      — Stat card: single KPI with optional trend indicator.
      Apply Cognitive Load Theory: each display component should present one
      coherent chunk of information. A card should not contain more information
      than can be parsed in a single fixation (approximately 3-4 data points).
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 4: INTERACTION DESIGN — MAKE IT RESPOND                         -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="4" name="Interaction Design — Make It Respond">
    <purpose>
      Define how every element responds to user input. Apply Norman's six
      principles to ensure every interaction has clear signifiers, immediate
      feedback, and appropriate constraints.
    </purpose>

    <step id="IX-1" name="Define Hover States" research="TF-6: Norman Signifiers">
      Every clickable element must have a visible hover state on cursor devices.
      The hover state confirms: "this element is interactive." Hover changes
      may include: background color shift, underline appearance, shadow
      increase, opacity change, or scale transform. The change must be
      perceptible but not distracting. Transition: 150-200ms ease.
    </step>

    <step id="IX-2" name="Define Focus States" research="TF-7: WCAG SC 2.4.7">
      Every focusable element must have a visible focus indicator for keyboard
      navigation. WCAG 2.2 SC 2.4.11 (enhanced) requires: focus indicator
      has ≥ 3:1 contrast against the unfocused state, and the indicator area
      is at least as large as a 2px solid border around the element. Use
      outline (not border) for focus to avoid layout shift. Never set
      outline: none without providing an equivalent visible indicator.
    </step>

    <step id="IX-3" name="Define Active/Pressed States" research="TF-6: Norman Feedback">
      Every button and clickable element must have a pressed state that
      provides immediate tactile feedback: background darkens, element
      scales down slightly (transform: scale(0.98)), or elevation decreases.
      This feedback confirms the action was registered and closes Norman's
      Gulf of Evaluation.
    </step>

    <step id="IX-4" name="Define Disabled States" research="TF-6: Norman Constraints">
      Disabled elements must be visually distinct: reduced opacity (0.4-0.5),
      no pointer cursor (cursor: not-allowed), and no hover/focus response.
      This communicates the constraint: "this action is not available now."
      Always provide a reason for the disabled state (tooltip or helper text)
      so the user knows what to do to enable it.
    </step>

    <step id="IX-5" name="Define Error Handling" research="TF-2: Nielsen Heuristics 5, 9">
      Error prevention is better than error recovery (Heuristic 5):
      — Disable submit until form is valid.
      — Show character limits before they are exceeded.
      — Provide input masks for formatted data (phone, date).
      — Auto-save in-progress work.
      When errors occur (Heuristic 9):
      — State what went wrong in plain language (not error codes).
      — Indicate where the error is (inline, next to the problem).
      — Suggest a specific fix.
      — Use color AND icon AND text to communicate the error (WCAG SC 1.4.1).
    </step>

    <step id="IX-6" name="Define Transitions and Animation">
      Animation must be purposeful, not decorative:
      — Entering elements: fade in + slide (200-300ms).
      — Exiting elements: fade out (150-200ms). Exit faster than entry.
      — State changes: cross-fade or morph (200ms).
      — Loading: skeleton shimmer or spinner.
      — Micro-interactions: button press, toggle flip, checkbox check.
      All motion must respect prefers-reduced-motion media query. Users who
      have enabled reduced motion must receive a functional equivalent without
      animation. Target 60fps for all animations.
    </step>

    <step id="IX-7" name="Define Keyboard Interaction" research="TF-7: WCAG SC 2.1.1">
      Every feature must be fully operable by keyboard:
      — Tab: moves focus to next interactive element.
      — Shift+Tab: moves focus to previous.
      — Enter/Space: activates buttons and links.
      — Arrow keys: navigates within composite widgets (tabs, menus, radio groups).
      — Escape: closes overlays, cancels operations.
      Tab order must match visual reading order (left-to-right, top-to-bottom
      in LTR languages). There must be no keyboard traps (elements that
      capture focus with no escape).
    </step>

    <step id="IX-8" name="Define Touch Interaction" research="TF-3: Fitts's Law">
      For touch devices:
      — All targets ≥ 44×44px active area (Apple HIG, WCAG).
      — Spacing between targets ≥ 8px to prevent mistaps.
      — Swipe gestures must have a tap-based alternative.
      — Long-press actions must have an alternative path.
      — No hover-dependent functionality (touch has no hover).
      Finger input has ~1.5mm standard deviation. Targets smaller than 7mm
      produce error rates exceeding 10% (Bi et al. 2013).
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 5: ACCESSIBILITY — BUILD IT IN, NOT BOLT IT ON                  -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="5" name="Accessibility — Build It In, Not Bolt It On">
    <purpose>
      Accessibility is a fundamental requirement, not a feature. 83.6% of
      websites fail basic accessibility (WebAIM 2024). This tier ensures the
      feature is accessible from construction, not retrofitted after complaints.
    </purpose>

    <step id="AX-1" name="Semantic HTML" research="TF-7: WCAG SC 4.1.2">
      Use semantic HTML elements that communicate meaning to assistive
      technology: header, nav, main, footer, section, article, aside, button,
      a, h1-h6, ul/ol/li, table with thead/tbody/th, label with for, fieldset
      with legend. Do not use div and span for interactive elements. A div
      with an onClick is not a button — it lacks keyboard support, ARIA role,
      and focus management.
    </step>

    <step id="AX-2" name="Heading Hierarchy">
      Use headings in order: h1, h2, h3. Do not skip levels (h1 to h3
      without h2). One h1 per page. Headings create the document outline
      that screen reader users navigate by. A page with no headings or
      incorrect heading hierarchy forces screen reader users to listen to
      every word sequentially.
    </step>

    <step id="AX-3" name="Color and Contrast" research="TF-7: WCAG SC 1.4.3, 1.4.11; TF-12: CVD">
      — Normal text: ≥ 4.5:1 contrast ratio.
      — Large text (≥ 18pt or ≥ 14pt bold): ≥ 3:1 contrast ratio.
      — UI components and graphical objects: ≥ 3:1 contrast ratio.
      — Focus indicators: ≥ 3:1 contrast against adjacent colors.
      — Never use color as the sole means of conveying information.
      — Test with protanopia and deuteranopia simulators.
      Decorative elements, logos, and inactive components are exempt.
    </step>

    <step id="AX-4" name="Alternative Text">
      — Informative images: alt text describes the content.
      — Decorative images: alt="" (empty, not missing).
      — Complex images (charts, diagrams): long description via aria-describedby
        or separate text explanation.
      — Icons with text labels: aria-hidden="true" on the icon.
      — Icons without text labels: aria-label on the button/link.
    </step>

    <step id="AX-5" name="Form Accessibility" research="TF-7: WCAG SC 1.3.1, 3.3.2">
      — Every input has a visible label (not just placeholder text).
      — Labels are programmatically associated (label for= or aria-labelledby).
      — Required fields are indicated with text, not just color or asterisk.
      — Error messages are associated with their field (aria-describedby).
      — Error messages are announced to screen readers (aria-live="polite"
        or role="alert").
      — Autocomplete attributes are set for personal data fields.
    </step>

    <step id="AX-6" name="ARIA Usage" research="TF-7: WCAG SC 4.1.2">
      Follow the rules of ARIA:
      (1) If you can use a native HTML element, use it instead of ARIA.
      (2) Do not change native semantics (do not put role="button" on an a tag
          unless you also handle Enter and Space key events).
      (3) All interactive ARIA controls must be operable by keyboard.
      (4) Do not use aria-hidden="true" on focusable elements.
      (5) All interactive elements must have accessible names.
      ARIA is a repair technology for custom widgets, not a replacement for
      semantic HTML.
    </step>

    <step id="AX-7" name="Motion and Vestibular Safety" research="TF-7: WCAG SC 2.3.1, 2.3.3">
      — Respect prefers-reduced-motion: disable non-essential animations.
      — No content flashes more than 3 times per second (seizure risk).
      — Parallax scrolling, auto-playing video, and large-scale motion
        must have controls to pause, stop, or hide.
      — Provide a reduced-motion alternative for any animation that conveys
        information.
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 6: STYLING — APPLY THE VISUAL LAYER                            -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="6" name="Styling — Apply the Visual Layer">
    <purpose>
      Apply visual styles using the design system's tokens and conventions.
      This tier comes AFTER layout, hierarchy, components, interactions, and
      accessibility because styling is the least expensive layer to change
      and the most dangerous to start with. Starting with colors and fonts
      before structure produces UI that looks good in a mockup but breaks
      under real conditions.
    </purpose>

    <step id="ST-1" name="Apply Design Tokens" research="TF-11: Atomic Design / Design Tokens">
      Every visual property must reference a design token, not a hardcoded
      value:
      — Colors: var(--color-primary), var(--color-text-secondary), etc.
      — Spacing: var(--space-4), var(--space-8), var(--space-16), etc.
      — Typography: var(--font-size-body), var(--font-weight-semibold), etc.
      — Border radius: var(--radius-sm), var(--radius-md), etc.
      — Shadows: var(--shadow-sm), var(--shadow-md), var(--shadow-lg), etc.
      Hardcoded values (#3B82F6, 16px, 0.5rem) create inconsistency and
      make theme changes impossible. Every hardcoded value is technical debt.
    </step>

    <step id="ST-2" name="Apply Typography" research="TF-9: Typography Research">
      — Body text: 16px minimum, line-height 1.5, max-width 75ch.
      — Headings: per the type scale established in VH-1.
      — Font family: from the design system. Maximum 2 families total.
      — Letter spacing: default for body, slightly increased for all-caps
        text (0.05-0.1em). All-caps only for short labels, never body text.
      — Paragraph spacing: margin-bottom equal to line-height for visual
        rhythm.
    </step>

    <step id="ST-3" name="Apply Color Palette" research="TF-7: WCAG; TF-12: CVD">
      — Background: neutral (white, off-white, or dark mode equivalent).
      — Primary text: near-black on light, near-white on dark.
      — Secondary text: gray meeting 4.5:1 contrast.
      — Primary accent: brand color for primary actions, links, active states.
      — Semantic colors: error (red + icon), success (green + icon), warning
        (amber + icon), info (blue + icon). Always pair with non-color signal.
      — Surface colors: cards slightly elevated from background (Gestalt
        Figure-Ground).
      Test the full palette with a CVD simulator. No meaning should be lost
      under simulated deuteranopia or protanopia.
    </step>

    <step id="ST-4" name="Apply Spacing" research="TF-1: Gestalt Proximity">
      Apply spacing from the established scale (LA-3):
      — Component internal padding: 12-16px (cards, buttons, inputs).
      — Between related elements: 8-16px (label to input, icon to text).
      — Between groups: 24-32px (form sections, card groups).
      — Between sections: 48-64px (page sections).
      Verify the 2:1 ratio: between-group spacing must be at least twice
      within-group spacing for Gestalt Proximity to create correct grouping.
    </step>

    <step id="ST-5" name="Apply Borders and Shadows" research="TF-1: Gestalt Common Region">
      — Cards and panels: consistent border-radius (4px, 8px, or 12px).
      — Elevation: subtle shadow for cards, stronger for overlays.
      — Borders: use either border OR shadow, rarely both (visual noise).
      — Dividers: 1px borders between list items, not between cards (cards
        have their own Common Region boundary).
      Every border radius, shadow, and divider style must match other
      instances of the same element type (Gestalt Similarity / CRAP Repetition).
    </step>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 7: VALIDATION — VERIFY BEFORE SHIPPING                         -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="7" name="Validation — Verify Before Shipping">
    <purpose>
      Run this checklist after building the feature to verify it meets all
      research-backed quality standards. Each check maps to a theoretical
      foundation. A feature is not complete until every applicable check passes.
    </purpose>

    <!-- Requirements Validation -->
    <check id="VC-1" category="Task Completion" research="ISO 9241-210">
      Can the user complete their primary task without assistance?
    </check>
    <check id="VC-2" category="All States" research="TF-2: Nielsen Heuristic 1">
      Does every state (empty, loading, default, active, error, success,
      disabled, overflow) have a designed visual representation?
    </check>
    <check id="VC-3" category="Edge Cases">
      Does the feature handle minimum content, maximum content, missing
      content, special characters, and zero-result states gracefully?
    </check>

    <!-- Layout Validation -->
    <check id="VC-4" category="Responsive" research="TF-3: Fitts's Law">
      Does the layout work at 320px, 480px, 768px, 1024px, 1440px, 1920px
      without horizontal scroll, element overlap, or content truncation?
    </check>
    <check id="VC-5" category="Grid Alignment" research="CRAP: Alignment">
      Are all elements aligned to the grid? No arbitrary positioning?
    </check>

    <!-- Hierarchy Validation -->
    <check id="VC-6" category="Visual Hierarchy" research="TF-8: Eye-Tracking">
      Does the squint test reveal the correct hierarchy? Most important
      element most prominent?
    </check>
    <check id="VC-7" category="Spacing Consistency" research="TF-1: Gestalt Proximity">
      Is spacing consistent? Related elements closer than unrelated? 2:1
      ratio between group and section spacing?
    </check>

    <!-- Typography Validation -->
    <check id="VC-8" category="Type Scale" research="TF-9: Typography">
      Are all font sizes from the type scale? No rogue sizes?
    </check>
    <check id="VC-9" category="Line Length" research="TF-9: Bringhurst">
      Is body text line length 45-75 characters? Line-height ≥ 1.4?
    </check>

    <!-- Interaction Validation -->
    <check id="VC-10" category="Interactive States" research="TF-6: Norman">
      Do all interactive elements have hover, focus, active, and disabled
      states?
    </check>
    <check id="VC-11" category="Feedback" research="TF-6: Norman Feedback">
      Does every user action produce visible feedback within 100ms?
    </check>
    <check id="VC-12" category="Error Handling" research="TF-2: Nielsen Heuristic 9">
      Do all error states show what went wrong AND how to fix it?
    </check>

    <!-- Accessibility Validation -->
    <check id="VC-13" category="Contrast" research="TF-7: WCAG SC 1.4.3">
      Text ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1?
    </check>
    <check id="VC-14" category="Color Independence" research="TF-7: WCAG SC 1.4.1; TF-12: CVD">
      No information conveyed by color alone? Tested with CVD simulator?
    </check>
    <check id="VC-15" category="Keyboard" research="TF-7: WCAG SC 2.1.1">
      Fully operable by keyboard? Tab order matches visual order? No traps?
    </check>
    <check id="VC-16" category="Screen Reader" research="TF-7: WCAG SC 4.1.2">
      Semantic HTML used? Headings in order? All images have alt text? All
      form inputs have labels? ARIA used correctly?
    </check>
    <check id="VC-17" category="Touch Targets" research="TF-3: Fitts's Law">
      All touch targets ≥ 44×44px with ≥ 8px spacing on mobile?
    </check>
    <check id="VC-18" category="Motion" research="TF-7: WCAG SC 2.3.3">
      prefers-reduced-motion respected? No content flashes &gt; 3/second?
    </check>

    <!-- Consistency Validation -->
    <check id="VC-19" category="Design Tokens" research="TF-11: Atomic Design">
      All visual values reference tokens? No hardcoded colors, spacing, or
      font sizes?
    </check>
    <check id="VC-20" category="Pattern Consistency" research="TF-10: Jakob's Law">
      Does the feature use established patterns consistent with the rest of
      the application and with competitor conventions?
    </check>
    <check id="VC-21" category="Component Reuse" research="TF-11: Atomic Design">
      Are existing components reused wherever possible? Are new components
      justified?
    </check>
    <check id="VC-22" category="Icon and Label Consistency" research="TF-1: Gestalt Similarity">
      Same icon and same label for the same action everywhere?
    </check>
    <check id="VC-23" category="Border/Shadow/Radius Consistency" research="CRAP: Repetition">
      Consistent border radius, shadow values, and divider styles across
      similar elements?
    </check>

    <!-- Content Resilience -->
    <check id="VC-24" category="Real Data" research="TF-5: Cognitive Load">
      Does the feature look correct with real data, not just placeholder?
    </check>
    <check id="VC-25" category="Content Extremes">
      Does it handle shortest possible and longest possible content without
      breaking layout?
    </check>

  </tier>

</ui_feature_construction_engine>

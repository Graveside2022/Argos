<?xml version="1.0" encoding="UTF-8"?>

<!--
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║              UI VISUAL DIAGNOSIS ENGINE v2.0                               ║
  ║                                                                            ║
  ║  Purpose: Provide a rigorous, research-validated systematic methodology    ║
  ║  for diagnosing, interpreting, and fixing UI visual defects. Every rule    ║
  ║  is grounded in peer-reviewed HCI research, perceptual psychology, and    ║
  ║  established usability engineering disciplines.                            ║
  ║                                                                            ║
  ║  Usage: Run this sequence when analyzing any UI problem. You are not      ║
  ║  building from scratch. You are looking at something that exists and       ║
  ║  making it match what the user intended. Your job is to see what the      ║
  ║  user sees, understand what bothers them, and fix exactly that.           ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
-->

<ui_visual_diagnosis_engine version="2.0">

  <metadata>
    <title>UI Visual Diagnosis Engine</title>
    <purpose>
      Systematically diagnose, interpret, and fix UI visual defects by applying
      perceptual psychology, usability heuristics, accessibility standards, and
      interaction design principles. This engine replaces subjective aesthetic
      judgment with a structured, repeatable process grounded in over a century
      of human visual perception research, 30+ years of usability engineering,
      and international accessibility standards.
    </purpose>
    <when_to_use>
      Run this triage on EVERY visual UI problem before applying any fix. The
      sequence is designed to: (1) establish what the user actually sees using
      perceptual science, (2) translate vague user complaints into specific
      measurable properties, (3) trace visual defects to exact CSS properties
      or component structures, (4) fix without introducing regressions, and
      (5) validate the fix against established UI patterns and accessibility
      standards. Do not skip the observation phase. Do not guess what the user
      means. Premature fixes without complete visual diagnosis are the primary
      cause of fix-induced visual regressions.
    </when_to_use>

    <theoretical_foundations>

      <foundation name="Gestalt Principles of Visual Perception"
                  source="Wertheimer, M. (1923). Laws of Organization in Perceptual Forms. | Koffka, K. (1935). Principles of Gestalt Psychology. | Nielsen, J. (2024). Gestalt Principles for Visual UI Design. NN/g.">
        Over a century of psychological research, originating with German psychologists
        Max Wertheimer, Kurt Koffka, and Wolfgang Köhler in the 1920s, establishes that
        the human brain organizes visual elements into coherent wholes using specific
        grouping laws. The nine primary principles applied to UI are:
        (1) Proximity — elements close together are perceived as grouped.
        (2) Similarity — elements sharing visual characteristics (shape, color, size)
            are perceived as related.
        (3) Continuity — the eye follows smooth paths, lines, and curves.
        (4) Closure — the brain completes incomplete shapes into recognized patterns.
        (5) Figure-Ground — the brain separates foreground objects from background.
        (6) Common Region — elements enclosed within a boundary are perceived as grouped.
        (7) Symmetry and Order (Prägnanz) — the brain prefers the simplest, most orderly
            interpretation of visual information.
        (8) Common Fate — elements moving in the same direction are perceived as grouped.
        (9) Focal Point — elements that stand out visually capture attention first.
        These principles explain why spacing errors feel wrong even when users cannot
        articulate why, why inconsistent styling fragments a layout, and why alignment
        creates perceived relationships. Every spacing, alignment, and grouping diagnosis
        in this engine traces to Gestalt. As Nielsen notes, these insights are "rooted
        in over a century of psychological research" and remain "essential for designing
        user interface layouts."
      </foundation>

      <foundation name="Nielsen's 10 Usability Heuristics"
                  source="Nielsen, J. (1994). Enhancing the Explanatory Power of Usability Heuristics. CHI '94 Proceedings, pp. 152-158. doi:10.1145/191666.191729 | Molich, R. &amp; Nielsen, J. (1990). Improving a Human-Computer Dialogue. CACM, 33(3).">
        Jakob Nielsen derived 10 usability heuristics from a factor analysis of 249
        usability problems across 11 professional projects, evaluating against 101
        design principles in a 25,149-datapoint matrix. The 10 heuristics have remained
        unchanged since 1994 because they describe fundamental human-machine mismatches:
        (1) Visibility of system status — keep users informed via timely feedback.
        (2) Match between system and real world — use language and conventions users know.
        (3) User control and freedom — support undo, redo, and clear exits.
        (4) Consistency and standards — same words, situations, actions mean the same thing.
        (5) Error prevention — design to prevent problems before they occur.
        (6) Recognition rather than recall — make options visible, minimize memory load.
        (7) Flexibility and efficiency of use — support both novice and expert workflows.
        (8) Aesthetic and minimalist design — remove irrelevant information.
        (9) Help users recognize, diagnose, recover from errors — plain language, solutions.
        (10) Help and documentation — provide searchable, task-focused guidance.
        Heuristic 4 (Consistency) underpins all visual consistency checks. Heuristic 8
        (Aesthetic and Minimalist Design) governs diagnoses of visual noise. Heuristic 1
        (Visibility of System Status) governs diagnoses of missing states. These heuristics
        have proven durable across 30 years of technology change including the web and
        mobile because they describe human cognition, not screen designs.
      </foundation>

      <foundation name="Fitts's Law"
                  source="Fitts, P.M. (1954). The Information Capacity of the Human Motor System in Controlling the Amplitude of Movement. Journal of Experimental Psychology, 47(6), 381-391. | MacKenzie, I.S. &amp; Buxton, W. (1992). Extending Fitts' Law to Two-Dimensional Tasks. CHI '92.">
        Paul Fitts established in 1954 that the time to acquire a target is a function
        of the distance to the target divided by the width of the target:
        T = a + b × log₂(2D/W). This law, validated across limbs, devices, and populations
        for over 70 years, has direct consequences for UI design:
        — Interactive targets must be large enough to acquire efficiently.
        — Frequently used actions must be close to the user's current focus.
        — Screen edges act as infinite targets because the pointer cannot overshoot.
        — The smallest dimension of a rectangular target determines effective width
          (MacKenzie and Buxton 1992).
        Fitts's Law is why touch targets must be at least 44×44px (Apple HIG, WCAG),
        why desktop click targets need minimum 36px height, and why padding around
        clickable elements is functional, not decorative. The law applies to mouse
        cursors, finger taps, stylus input, and head-mounted pointing devices.
      </foundation>

      <foundation name="Hick-Hyman Law"
                  source="Hick, W.E. (1952). On the Rate of Gain of Information. Quarterly Journal of Experimental Psychology, 4(1), 11-26. | Hyman, R. (1953). Stimulus Information as a Determinant of Reaction Time. Journal of Experimental Psychology, 45(3), 188-196.">
        William Edmund Hick and Ray Hyman independently established that reaction time
        increases logarithmically with the number of equally probable choices:
        RT = a + b × log₂(n). This law played a seminal role in the cognitive revolution
        and remains one of the few widely acknowledged laws in psychology. It explains
        why interfaces with too many options feel overwhelming and why progressive
        disclosure is effective. It directly governs navigation design, menu structure,
        and any context where the user must choose among options. When a user says
        "I do not know where to click," they are experiencing the effect Hick's Law
        predicts. The fix: reduce visible choices, group related options, or reveal
        complexity incrementally through progressive disclosure.
      </foundation>

      <foundation name="Miller's Law and Cognitive Load Theory"
                  source="Miller, G.A. (1956). The Magical Number Seven, Plus or Minus Two. Psychological Review, 63(2), 81-97. | Cowan, N. (2001). The Magical Number 4 in Short-Term Memory. Behavioral and Brain Sciences, 24, 87-114. | Sweller, J. (1988). Cognitive Load During Problem Solving. Cognitive Science, 12(2), 257-285.">
        George Miller's landmark 1956 paper established that human short-term memory
        holds approximately 7 ± 2 chunks of information, one of the most cited works in
        cognitive science with over 20,000 scientific citations. Nelson Cowan's later
        research (2001) refined the working memory capacity to approximately 4 chunks in
        young adults. John Sweller's Cognitive Load Theory (1988) identified three types
        of cognitive load: intrinsic (inherent task complexity), extraneous (imposed by
        poor design), and germane (productive learning effort). Every unnecessary visual
        element, inconsistent pattern, or ambiguous affordance consumes working memory
        that should be directed at the user's task. The direct implication: UI complexity
        is not measured by feature count but by the cognitive load it imposes. Extraneous
        load must be minimized through clear visual hierarchy, consistent patterns, and
        logical grouping.
      </foundation>

      <foundation name="Norman's Design Principles"
                  source="Norman, D.A. (1988/2013). The Design of Everyday Things. Basic Books. | Gibson, J.J. (1979). The Ecological Approach to Visual Perception. | Norman, D.A. (1999). Affordance, Conventions, and Design. Interactions, 6(3), 38-43.">
        Donald Norman, drawing on James J. Gibson's ecological psychology (1979),
        established six fundamental principles of interaction design:
        (1) Affordances — the possible actions an object offers to a user.
        (2) Signifiers — perceivable cues indicating what actions are possible and
            how to perform them. Norman introduced this term in 2013 because the
            design community was misusing "affordances."
        (3) Mapping — the relationship between controls and their effects.
        (4) Feedback — information about the result of an action.
        (5) Constraints — limiting possible actions to prevent errors.
        (6) Conceptual Models — the user's mental understanding of how the system works.
        Norman also formalized the Gulf of Execution (gap between intent and available
        actions) and the Gulf of Evaluation (gap between system state and user
        understanding). A button with no visual affordance has a wide Gulf of Execution.
        A state change with no visual feedback has a wide Gulf of Evaluation.
        Both must be minimized through clear signifiers and immediate feedback.
      </foundation>

      <foundation name="WCAG Accessibility Standards"
                  source="W3C (2018). Web Content Accessibility Guidelines 2.1. W3C Recommendation. | W3C (2023). WCAG 2.2. | WebAIM (2024). WebAIM Million Analysis.">
        The Web Content Accessibility Guidelines, developed by the W3C, establish four
        principles (POUR): Perceivable, Operable, Understandable, Robust. Key visual
        requirements for Level AA conformance:
        — SC 1.4.3: Text contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text.
        — SC 1.4.11: Non-text contrast ≥ 3:1 for UI components and graphical objects.
        — SC 1.4.1: Color must not be the sole means of conveying information.
        — SC 1.4.4: Text resizable to 200% without loss of content or functionality.
        — SC 2.4.7: Visible focus indicators for keyboard navigation.
        — SC 1.4.12: Text spacing adjustable without loss of content.
        WebAIM's 2024 Million analysis found 83.6% of websites fail color contrast.
        Approximately 8% of males and 0.5% of females have color vision deficiency
        (Birch 2012, JOSA A), with deuteranomaly (5% of males) most common. Red-green
        deficiency accounts for over 95% of all CVD cases. These are not edge cases.
        Every color decision must account for accessibility.
      </foundation>

      <foundation name="Eye-Tracking and Visual Scanning Patterns"
                  source="Nielsen, J. (2006). F-Shaped Pattern for Reading Web Content. NN/g. | Nielsen, J. &amp; Pernice, K. (2010). Eyetracking Web Usability. New Riders. | NN/g (2017). Text Scanning Patterns: Eyetracking Evidence.">
        In 2006, the Nielsen Norman Group recorded how 232 users looked at thousands
        of web pages and identified the F-shaped scanning pattern: users first read
        horizontally across the top, then read a shorter horizontal line further down,
        then scan vertically down the left side. This pattern persists on both desktop
        and mobile as of 2017 research. Additional patterns identified:
        — Layer-cake: scanning only headings and subheadings.
        — Spotted: searching for specific elements (links, numbers, addresses).
        — Marking: fixating on one spot while scrolling (more common on mobile).
        — Bypassing: skipping repeated leading words in lists.
        — Commitment: reading almost everything (rare, indicates high interest).
        The Z-pattern applies to landing pages and visual layouts. Research shows 79%
        of users scan rather than read, and average time on page is under 15 seconds.
        These patterns directly govern where critical content and actions must be placed
        and why visual hierarchy must guide the eye intentionally.
      </foundation>

      <foundation name="Typography and Legibility Research"
                  source="Bringhurst, R. (2002). The Elements of Typographic Style, 3rd Ed. Hartley &amp; Marks. | Tinker, M.A. (1963). Legibility of Print. Iowa State University Press. | Legge, G.E. &amp; Bigelow, C.A. (2011). Does Print Size Matter for Reading? Journal of Vision, 11(5).">
        Robert Bringhurst established that optimal line length for body text is 45-75
        characters per line, with 66 characters widely regarded as ideal. Lines shorter
        than 45 characters produce excessive saccadic returns; lines longer than 75
        characters cause inaccurate return sweeps to the next line. Tinker's extensive
        research (1963) established that 9-point serif text is the minimum for fluent
        reading, bold does not impair reading speed of continuous text, and all-italic
        text slows reading. Legge and Bigelow (2011) demonstrated that the critical
        print size (minimum for maximum reading speed) corresponds to an x-height visual
        angle of 0.2 degrees. Fonts designed for screen display (Verdana, Georgia) use
        larger x-heights and more open counters for measurably better screen legibility.
        WCAG recommends a maximum line width of 80 characters per line.
      </foundation>

      <foundation name="Jakob's Law of the Internet User Experience"
                  source="Nielsen, J. (2000). Jakob's Law of the Internet User Experience. | Baymard Institute (2022). Usability Benchmark Study.">
        Users spend most of their time on other websites. They carry mental models from
        cumulative experience with other products and expect your interface to work the
        same way. When those models are violated, users experience confusion, frustration,
        and increased error rates. A 2022 Baymard Institute study found that interfaces
        adhering to familiar patterns reduce user errors by up to 30% and increase task
        completion by 18%. A 2021 NNGroup study found consistent navigation patterns
        improved user satisfaction scores by 22%. This law governs every diagnosis of
        "this does not work like I expected." The fix is almost always to align with
        established conventions rather than inventing novel patterns.
      </foundation>

      <foundation name="Atomic Design and Design Systems"
                  source="Frost, B. (2013/2016). Atomic Design. atomicdesign.bradfrost.com. | Salesforce UX (2014). Design Tokens. Lightning Design System. | Anne, J. (Jina) (2014). Design Tokens as Sub-Atomic Particles.">
        Brad Frost's Atomic Design methodology established a hierarchical taxonomy for
        UI components: Atoms (basic HTML elements — labels, inputs, buttons), Molecules
        (functional groups of atoms — search forms, card headers), Organisms (complex
        structures — navigation bars, product grids), Templates (page-level layouts),
        and Pages (templates with real content). Salesforce introduced Design Tokens in
        2014 as the sub-atomic layer: named values for color, spacing, typography, and
        other visual properties serving as a single source of truth. This hierarchy is
        essential for understanding blast radius when fixing UI defects. A change at the
        token level propagates through every atom, molecule, and organism that references
        it. A change to an organism affects every template and page containing it.
        Understanding where a visual element sits in this hierarchy determines whether
        a fix is local or systemic.
      </foundation>

      <foundation name="Color Science and Color Vision Deficiency"
                  source="Hurvich, L.M. &amp; Jameson, D. (1957). An Opponent-Process Theory of Color Vision. Psychological Review, 64(6), 384-404. | Birch, J. (2012). Worldwide Prevalence of Red-Green Color Deficiency. JOSA A, 29(3), 313-320.">
        Human color vision is trichromatic, based on three cone cell types (L, M, S)
        responding to different wavelengths. The opponent-process theory (Hurvich and
        Jameson 1957) explains that higher-order processing operates on three opponent
        channels: light-dark, red-green, blue-yellow. Color vision deficiency (CVD)
        occurs when cones are absent or dysfunctional:
        — Deuteranomaly (reduced M-cone, 5% of males): most common, greens appear redder.
        — Protanomaly (reduced L-cone, 1% of males): reds appear darker and greener.
        — Deuteranopia (absent M-cones, 1% of males): reds and greens indistinguishable.
        — Protanopia (absent L-cones, 1% of males): reds appear as dark gray or black.
        — Tritanopia (absent S-cones, 0.003%): blues and yellows confused.
        Practical rule: never use red-green as the sole distinguishing pair for any UI
        signal. Always provide a secondary channel (shape, text, icon, pattern, underline)
        to convey the same information. Test with color blindness simulators.
      </foundation>

    </theoretical_foundations>

  </metadata>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 0: VISUAL OBSERVATION — SEE WHAT THE USER SEES                 -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="0" name="Visual Observation — See What the User Sees">
    <purpose>
      Before diagnosing or fixing anything, demonstrate that you can perceive
      the same visual reality the user perceives. This tier applies Gestalt
      principles, eye-tracking research, and Norman's design principles to
      systematically inventory every visible element and its visual properties.
      Do not touch code until this tier is complete.
    </purpose>

    <checkpoint id="LK-1" name="Element Inventory">
      Describe what you see in plain language before doing anything else. Start
      from the top of the screen and work down. Name every visible element:
      header, navigation, buttons, text blocks, images, cards, forms, footers.
      If you cannot name it, you have not looked at it.
    </checkpoint>

    <checkpoint id="LK-2" name="Layout Structure">
      Identify the layout structure. Single column, two columns, grid, sidebar
      with content area, full-width sections stacked vertically. State what you
      see, not what you think the code says. Identify the CSS layout mechanism
      in use: flexbox, grid, float, or table-based.
    </checkpoint>

    <checkpoint id="LK-3" name="Visual Hierarchy" research="TF-8: Eye-Tracking Patterns">
      Identify the visual hierarchy. What is the most prominent element. What
      draws the eye first, second, third. Apply eye-tracking research: on
      text-heavy pages, users scan in an F-pattern, fixating on the first few
      words of each line and the top of the page. On landing pages and visual
      layouts, they follow a Z-pattern. If the most important content is not
      positioned where these scanning patterns predict the eye will land, the
      visual hierarchy is broken regardless of element size or weight.
    </checkpoint>

    <checkpoint id="LK-4" name="Spacing Patterns" research="TF-1: Gestalt Proximity">
      Identify spacing patterns. Is spacing consistent or irregular. Are there
      areas where elements are too close or too far apart. Is there visible
      rhythm or does it feel random. Apply Gestalt Proximity: elements close
      together are perceived as grouped. If unrelated elements share the same
      spacing as related elements, grouping is ambiguous. If related elements
      have more space between them than between unrelated elements, grouping
      is inverted and users will misread the structure.
    </checkpoint>

    <checkpoint id="LK-5" name="Alignment" research="TF-1: Gestalt Continuity">
      Check alignment of left edges, right edges, centers, and baselines.
      Misalignment by even a few pixels is visible and feels wrong. Apply
      Gestalt Continuity: the eye follows smooth lines and edges. When an
      alignment breaks, the eye stutters. This is not a matter of taste —
      it is a perceptual disruption with measurable effects on scanning speed.
    </checkpoint>

    <checkpoint id="LK-6" name="Color Usage" research="TF-7: WCAG; TF-12: Color Science">
      What colors are present. Are they consistent. Is there a clear primary,
      secondary, and neutral palette. Are colors used meaningfully or randomly.
      Check: does the palette rely on red-green distinctions that 8% of males
      cannot perceive. Is color ever the sole carrier of meaning (violates
      WCAG SC 1.4.1). Do text-background combinations meet 4.5:1 contrast
      for normal text and 3:1 for large text (WCAG SC 1.4.3).
    </checkpoint>

    <checkpoint id="LK-7" name="Typography" research="TF-9: Typography Research">
      Count distinct font sizes, weights, and families visible on screen. If
      any exceeds 4 variations, typography is not controlled. Check line length
      against Bringhurst's standard: body text outside 45-75 characters per line
      impairs readability. Check line-height: body text below 1.4 is too tight
      for comfortable reading. Check font size: body text below 16px on screen
      is below the threshold recommended for sustained reading.
    </checkpoint>

    <checkpoint id="LK-8" name="Interactive Element Audit" research="TF-6: Norman's Signifiers">
      Identify which elements look clickable, which are clickable but do not
      look it, and which look clickable but are not. All three are bugs. Apply
      Norman's affordances and signifiers: a clickable element without a
      signifier (no underline, no button styling, no hover state, no cursor
      change) has a wide Gulf of Execution. An element that looks clickable
      but does nothing creates a wide Gulf of Evaluation. Both destroy trust.
    </checkpoint>

    <checkpoint id="LK-9" name="State Identification" research="TF-2: Nielsen Heuristic 1">
      Is this the default state, loading state, error state, empty state, or
      active state with data. The user may be showing a problem that exists
      only in one specific state. Apply Nielsen Heuristic 1 (Visibility of
      System Status): every state the system can be in must be visually
      communicated. If the current state is ambiguous, that is a bug.
    </checkpoint>

    <checkpoint id="LK-10" name="Reference Comparison" research="TF-10: Jakob's Law">
      If the user provides a reference design, do a side-by-side element-by-element
      comparison. Do not say "they look similar." List every difference. Apply
      Jakob's Law: if the reference follows established conventions, deviations
      are not aesthetic disagreements — they are usability regressions that
      increase error rates and reduce task completion.
    </checkpoint>

    <checkpoint id="LK-11" name="Figure-Ground Analysis" research="TF-1: Gestalt Figure-Ground">
      Can you clearly distinguish foreground content from background at a glance.
      If the figure-ground relationship is ambiguous — content and background
      compete, or background is more prominent than content — the layout has a
      fundamental perception problem that no local fixes will resolve.
    </checkpoint>

    <checkpoint id="LK-12" name="Cognitive Load Assessment" research="TF-5: Miller/Cowan/Sweller">
      Count distinct visual elements competing for attention on a single screen.
      If the count exceeds approximately 4 perceptual groups (Cowan 2001), the
      interface imposes extraneous cognitive load. The user's brain is spending
      working memory parsing the layout instead of performing their task.
    </checkpoint>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 1: USER INTENT TRANSLATION — UNDERSTAND WHAT THEY MEAN         -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="1" name="User Intent Translation — Decode the Complaint">
    <purpose>
      Users rarely use technical language. They say "it looks off" or "this
      feels wrong." This tier maps common user complaints to specific visual
      properties using the theoretical foundations. Each mapping traces to the
      research explaining why the user perceives the problem.
    </purpose>

    <translation id="UN-1" complaint="It looks off" research="TF-1: Gestalt">
      Something is misaligned, misspaced, or sized incorrectly relative to
      its neighbors. This is a Gestalt violation. Check Proximity (are groups
      correctly spaced), Continuity (are edges aligned), and Similarity (are
      related elements visually consistent). Measure padding, margin, and
      alignment values against the design system's spacing scale.
    </translation>

    <translation id="UN-2" complaint="It feels cramped" research="TF-1: Gestalt Proximity; TF-5: Cognitive Load">
      Insufficient padding inside elements or margin between elements. This
      is a Proximity violation where elements are grouped too tightly, reading
      as undifferentiated mass. It also increases extraneous cognitive load
      because the user must work harder to parse individual elements. Fix by
      increasing whitespace using the existing spacing scale values.
    </translation>

    <translation id="UN-3" complaint="It feels empty" research="TF-8: Eye-Tracking">
      Too much whitespace relative to content, or content too small for its
      container. This is a visual hierarchy failure: the eye has nothing to
      anchor on, scanning patterns break down, and the page feels purposeless.
      Fix by reducing whitespace or increasing content prominence through
      size, weight, or color.
    </translation>

    <translation id="UN-4" complaint="It does not look like the design" research="TF-10: Jakob's Law">
      Specific measurable differences exist between implementation and reference.
      Do not interpret. Measure. Compare padding values, font sizes, colors,
      border radii, shadow values, and spacing between the two. Use browser
      inspector computed styles for pixel-accurate comparison.
    </translation>

    <translation id="UN-5" complaint="The text is hard to read" research="TF-9: Typography; TF-7: WCAG">
      One or more of: font size too small (below 16px body), line height too
      tight (below 1.4), contrast too low (below 4.5:1 for normal text per
      WCAG), line length too long (above 75 characters per Bringhurst), or
      font weight too light (below 400 for body text). Check all five.
    </translation>

    <translation id="UN-6" complaint="It looks unprofessional" research="TF-2: Nielsen Heuristic 4">
      Inconsistency. Inconsistent spacing, font usage, color usage, border
      treatments, or alignment. This violates Nielsen Heuristic 4 (Consistency
      and Standards). Find the inconsistencies by checking each visual property
      across all instances of the same element type. The fix is to establish
      or enforce a single source of truth for each property.
    </translation>

    <translation id="UN-7" complaint="It does not flow right" research="TF-8: Eye-Tracking; TF-1: Gestalt Continuity">
      The visual hierarchy is wrong. The user's eye is not being guided in
      the intended order. Check what is most prominent and whether it should
      be. Apply Gestalt Continuity: the eye follows smooth paths. If elements
      break the scanning flow, the user loses their place and must
      re-establish context, consuming working memory.
    </translation>

    <translation id="UN-8" complaint="It is broken on mobile" research="TF-3: Fitts's Law">
      One or more of: elements overlapping, text overflowing its container,
      horizontal scrolling present, touch targets too small (below 44×44px
      per Fitts's Law and Apple HIG), or layout not adapting to viewport
      width. Check all five. Mobile issues compound because finger input
      has an absolute precision limit of approximately 1.5mm standard
      deviation, much worse than cursor precision.
    </translation>

    <translation id="UN-9" complaint="The button does not look right" research="TF-6: Norman; TF-1: Gestalt Similarity">
      Wrong padding, font size, border radius, background color, or height
      relative to adjacent elements. Compare to other buttons in the same UI.
      Apply Gestalt Similarity: all buttons of the same type must share visual
      characteristics. Apply Norman's signifiers: the button must clearly
      communicate its interactive nature and relative importance (primary vs.
      secondary vs. tertiary).
    </translation>

    <translation id="UN-10" complaint="There is too much going on" research="TF-2: Nielsen Heuristic 8; TF-5: Cognitive Load">
      Visual noise from too many competing colors, font sizes, borders,
      shadows, or elements fighting for attention. This violates Nielsen
      Heuristic 8 (Aesthetic and Minimalist Design) and imposes extraneous
      cognitive load (Sweller 1988). The fix is to reduce variation and
      establish clearer hierarchy. Apply Hick's Law (TF-4): if the user
      faces too many visible choices, decision time increases logarithmically.
    </translation>

    <translation id="UN-11" complaint="Fix this (pointing)" research="TF-6: Norman">
      Do not guess what about it needs fixing. State what you think is wrong
      and confirm before changing. You may see a spacing issue; they may mean
      a color issue. The Gulf of Evaluation applies to your understanding of
      the user's intent, not just the user's understanding of the system.
    </translation>

    <translation id="UN-12" complaint="Make it look like this (reference)" research="TF-10: Jakob's Law">
      Your job is pixel-level matching, not interpretation. Do not add your
      own design opinions. Match the reference. The user has already made the
      design decision. Your task is precise implementation, not redesign.
    </translation>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 2: ROOT CAUSE DIAGNOSIS — TRACE TO THE EXACT PROPERTY          -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="2" name="Root Cause Diagnosis — Trace the Visual Defect to Code">
    <purpose>
      Once you know what looks wrong, trace it to the exact CSS property or
      component structure causing it. This tier maps visual symptoms to their
      technical causes using a systematic elimination approach.
    </purpose>

    <diagnostic id="DG-1" symptom="Spacing problem">
      Inspect padding and margin on the element and its parent. Also check gap
      if the parent is flex or grid. The wrong spacing comes from one of these
      three sources. Check the design system's spacing scale to identify which
      token or value should be applied.
    </diagnostic>

    <diagnostic id="DG-2" symptom="Alignment problem">
      Check the parent container's display, justify-content, align-items, and
      text-align. Check if the element has margin-left, margin-right, or
      align-self overrides pulling it out of alignment. Check if auto margins
      or percentage widths are computing to unexpected values.
    </diagnostic>

    <diagnostic id="DG-3" symptom="Sizing problem">
      Check for explicit width or height on the element. Check parent
      constraints. Check flex-grow, flex-shrink, flex-basis involvement.
      Check max-width, min-width, max-height, min-height. Check if the
      element is sized in fixed units (px) when it should use relative
      units (%, rem, vw, vh) or vice versa.
    </diagnostic>

    <diagnostic id="DG-4" symptom="Overflow (content spilling)">
      Check overflow property on the container. Check for min-width preventing
      shrinking. Check white-space: nowrap preventing wrapping. Check if a
      fixed height is too small for content. Check if text-overflow: ellipsis
      is needed but missing.
    </diagnostic>

    <diagnostic id="DG-5" symptom="Color problem">
      Find the exact CSS rule applying the color. Check specificity conflicts
      where a more specific selector overrides the intended color. Check
      inherited colors from a parent. Check if a theme variable or design
      token is set to the wrong value. Verify contrast ratio against WCAG
      SC 1.4.3 (4.5:1 normal text, 3:1 large text).
    </diagnostic>

    <diagnostic id="DG-6" symptom="Typography problem">
      Identify CSS rules controlling font-family, font-size, font-weight,
      line-height, and letter-spacing. Check if rules come from the intended
      source or from inheritance or overrides. Check computed styles to
      eliminate ambiguity about what actually applies.
    </diagnostic>

    <diagnostic id="DG-7" symptom="Responsive breakage">
      Identify the exact viewport width where it breaks. Check which media
      queries apply at that width. Check for missing media queries. Check
      for fixed widths that do not adapt. Check if container queries should
      replace media queries for component-level responsiveness.
    </diagnostic>

    <diagnostic id="DG-8" symptom="Layering problem (z-index)">
      Check z-index on the element and all ancestors that create stacking
      contexts. Check if overflow: hidden on a parent is clipping. Check
      if position: relative/absolute/fixed is missing. Check if a new
      stacking context is being created by transform, opacity, or filter.
    </diagnostic>

    <diagnostic id="DG-9" symptom="Interactive state problem">
      Check if hover, focus, active, and disabled pseudo-class styles exist.
      Check if they are being overridden by more specific selectors. Check
      for pointer-events: none accidentally applied. Check focus-visible
      for keyboard-only focus indicators (WCAG SC 2.4.7).
    </diagnostic>

    <diagnostic id="DG-10" symptom="Layout structure problem">
      Check display property of the parent. Check grid-template-columns or
      flex-direction. Check if a component is conditionally rendered and
      the condition evaluates incorrectly. Check if order property in flex
      or grid is misapplied.
    </diagnostic>

    <diagnostic id="DG-11" symptom="Cannot determine cause">
      Use browser inspector's Computed Styles panel. The computed style is
      what actually applies — it eliminates all ambiguity about specificity,
      inheritance, and cascade order. Compare computed values against intended
      design token values.
    </diagnostic>

    <diagnostic id="DG-12" symptom="Data-dependent problem">
      The CSS may be correct but the component does not handle the data case.
      Check styles and logic for edge cases: long names, missing images,
      empty lists, single-item lists, maximum-length content, special
      characters, and RTL text. If styles do not exist for the edge case,
      that is the bug.
    </diagnostic>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 3: SURGICAL REPAIR — FIX WITHOUT BREAKING                      -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="3" name="Surgical Repair — Fix Without Breaking">
    <purpose>
      Apply the minimum change needed to resolve the visual defect without
      introducing regressions. This tier enforces discipline drawn from
      Atomic Design's blast radius awareness and Nielsen's consistency
      heuristic to ensure fixes are safe, minimal, and maintainable.
    </purpose>

    <rule id="FX-1" name="Minimal Change">
      Fix only the property causing the problem. Do not restyle the entire
      component because one property is wrong.
    </rule>

    <rule id="FX-2" name="Document the Delta">
      Before changing a value, record the current value and what you are
      changing it to. This is your rollback path.
    </rule>

    <rule id="FX-3" name="Viewport Regression Check">
      After changing a value, check the same element at all viewport sizes.
      A fix at one size can break another. Check at minimum: 320px, 768px,
      1024px, 1440px, and 1920px widths.
    </rule>

    <rule id="FX-4" name="State Regression Check" research="TF-6: Norman Feedback">
      After changing a value, check all states of the element: default,
      hover, focus, active, disabled, loading, error, empty. A fix in one
      state can break another.
    </rule>

    <rule id="FX-5" name="Blast Radius Check" research="TF-11: Atomic Design">
      After changing a shared style (a class used by multiple elements, a
      theme variable, a design token, a utility class), check every element
      that uses it. Shared style changes propagate through the component
      hierarchy. Understand where the change sits in the Atomic Design
      hierarchy (token → atom → molecule → organism → template → page).
    </rule>

    <rule id="FX-6" name="Palette Discipline">
      Do not introduce a new color that is not in the existing palette
      unless the user explicitly asks for it. If the fix requires a new
      color, it should be defined as a design token, not hardcoded.
    </rule>

    <rule id="FX-7" name="Type Scale Discipline">
      Do not introduce a new font size that is not in the existing type
      scale unless the user explicitly asks for it.
    </rule>

    <rule id="FX-8" name="Spacing Scale Discipline">
      Do not introduce a new spacing value that is not in the existing
      spacing system unless the user explicitly asks for it.
    </rule>

    <rule id="FX-9" name="Semantic Naming">
      If the fix requires a new CSS class, name it by what the element is,
      not by what the style does. Use .card-header not .margin-top-12.
    </rule>

    <rule id="FX-10" name="No !important">
      If the fix requires !important, the fix is wrong. Find the specificity
      conflict and resolve it properly by adjusting selector specificity or
      cascade order.
    </rule>

    <rule id="FX-11" name="Relative Units" research="TF-3: Fitts's Law">
      If the fix involves hardcoded pixel values for something that should
      scale, use relative units (rem, em, %, vw, vh) instead. The user
      should not have to re-fix this at different viewport sizes or when
      the base font size changes.
    </rule>

    <rule id="FX-12" name="Content Resilience">
      Test the fix with content shorter than expected and longer than expected.
      If the fix only works with the current content length, it is fragile
      and will break with real data.
    </rule>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 4: PATTERN REFERENCE — WHAT CORRECT LOOKS LIKE                 -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="4" name="Pattern Reference — What Correct Looks Like">
    <purpose>
      When the user does not provide a reference design, use these research-
      backed pattern specifications as the standard. Each pattern is derived
      from established conventions (Jakob's Law), interaction research
      (Fitts's Law, Norman), and accessibility standards (WCAG).
    </purpose>

    <pattern id="PT-1" name="Navigation Bar" research="TF-10: Jakob's Law; TF-3: Fitts's Law">
      Full viewport width. Fixed or sticky to top. Logo on left, nav links
      centered or right-aligned. Consistent height: 56-72px. Clear active
      state on current page link. Collapses to hamburger menu below tablet
      breakpoint. Menu items are screen-edge-proximate for cursor efficiency
      (Fitts's Law: screen edges are infinite targets).
    </pattern>

    <pattern id="PT-2" name="Card Component" research="TF-1: Gestalt Similarity, Common Region">
      Consistent border radius across all cards. Consistent internal padding:
      16px or 24px. Image fills card width without distortion. Title,
      description, and action are visually distinct through size and weight,
      not just color. Cards in a grid have equal height per row. The card
      boundary creates a Common Region (Gestalt) that groups its contents.
    </pattern>

    <pattern id="PT-3" name="Form Layout" research="TF-1: Gestalt Proximity; TF-6: Norman Constraints">
      Labels above or beside inputs consistently, never mixed. Input height
      consistent across all text inputs and selects. Required indicators
      visible. Error messages appear below the relevant field, not in a
      separate area (Gestalt Proximity: error message grouped with its field).
      Submit button visually distinct from form fields. Tab order matches
      visual order (Norman's Mapping principle).
    </pattern>

    <pattern id="PT-4" name="Modal or Dialog" research="TF-5: Cognitive Load; TF-6: Norman">
      Centered both horizontally and vertically. Overlay dims background
      (Gestalt Figure-Ground: modal is figure, page is ground). Content
      does not exceed 90% viewport width or 80% viewport height. Scrollable
      if content is long, with fixed header and action buttons. Closeable
      by overlay click, Escape key, and close button (Norman: multiple
      exit paths reduce Gulf of Execution).
    </pattern>

    <pattern id="PT-5" name="Sidebar Layout">
      Fixed width: 240-320px. Content area fills remaining width. Sidebar
      collapses or becomes overlay below tablet breakpoint. Active section
      highlighted in navigation. Sidebar scroll is independent of main
      content scroll.
    </pattern>

    <pattern id="PT-6" name="Data Table" research="TF-1: Gestalt Similarity; TF-9: Typography">
      Column headers visually distinct from data rows. Alternating row
      backgrounds or horizontal dividers for readability. Text left-aligned
      for text columns, right-aligned for numbers (Gestalt Continuity:
      aligning decimal points creates a visual line). Horizontal scroll on
      small screens without breaking page layout. Sort indicators visible
      on sortable columns.
    </pattern>

    <pattern id="PT-7" name="Button" research="TF-3: Fitts's Law; TF-6: Norman Signifiers">
      Minimum height: 36px desktop, 44px touch (Fitts's Law). Consistent
      horizontal padding: 12-24px. Primary action: filled background.
      Secondary: outlined or ghost. Disabled: reduced opacity, no pointer
      cursor (Norman: constraint signaling unavailability). Focus ring
      visible for keyboard navigation (WCAG SC 2.4.7).
    </pattern>

    <pattern id="PT-8" name="Toast or Notification" research="TF-2: Nielsen Heuristic 1">
      Consistent position: top-right or bottom-center. Auto-dismiss after
      set duration or has close button. Success, warning, error, info
      variants visually distinct using color AND icon (not color alone
      per WCAG SC 1.4.1). Does not block page interaction.
    </pattern>

    <pattern id="PT-9" name="Loading State" research="TF-2: Nielsen Heuristic 1; TF-6: Norman Feedback">
      Spinner or skeleton screen appears within 200ms. Positioned where
      content will appear, not centered on screen (unless full-page load).
      Spinner does not shift or push content when data loads. For perceived
      performance, prefer skeleton screens that match the shape of incoming
      content over generic spinners.
    </pattern>

    <pattern id="PT-10" name="Empty State" research="TF-2: Nielsen Heuristic 9">
      Message explaining why there is no content. Action the user can take
      to add content if applicable. Centered in content area. Visually
      distinct from error state (different icon, different color). Never
      show a blank white space with no explanation.
    </pattern>

    <pattern id="PT-11" name="Search Input" research="TF-6: Norman Signifiers">
      Search icon (magnifying glass) inside or beside the input. Clear
      button appears when text is entered. Placeholder text describing
      what can be searched. Results appear in dropdown or results page,
      not replacing the search bar.
    </pattern>

    <pattern id="PT-12" name="Tabs" research="TF-1: Gestalt Similarity, Focal Point">
      Active tab visually distinct from inactive tabs via indicator
      (underline, background, border). Content area changes on tab click.
      Tabs do not wrap to multiple lines unless explicitly designed to.
      Scrollable with overflow arrows if too many for container width.
    </pattern>

    <pattern id="PT-13" name="Dropdown or Select Menu" research="TF-3: Fitts's Law">
      Opens below or above trigger depending on available space. Selected
      option highlighted. Option minimum height: 44px for mobile touch
      (Fitts's Law). Long lists scrollable with max-height. Closes on
      outside click, option selection, or Escape key.
    </pattern>

    <pattern id="PT-14" name="Pagination" research="TF-3: Fitts's Law; TF-4: Hick's Law">
      Current page highlighted. First, previous, next, last controls
      present. Ellipsis for large ranges (Hick's Law: avoid exposing
      all page numbers). Disabled state on previous when on page 1 and
      next when on last page. Page numbers large enough for mobile tap.
    </pattern>

  </tier>

  <!-- ══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 5: VISUAL VALIDATION — POST-FIX VERIFICATION                   -->
  <!-- ══════════════════════════════════════════════════════════════════════ -->

  <tier id="5" name="Visual Validation — Post-Fix Verification Checklist">
    <purpose>
      Run this checklist after every fix to confirm the UI is correct. Each
      check maps to a theoretical foundation ensuring the validation is
      comprehensive and not arbitrary. A fix is not complete until every
      applicable check passes.
    </purpose>

    <!-- Gestalt and Layout Checks -->
    <check id="VV-1" category="Spacing" research="TF-1: Gestalt Proximity">
      Does every element have consistent spacing relative to its neighbors.
      Related elements are closer together than unrelated elements.
    </check>

    <check id="VV-2" category="Alignment" research="TF-1: Gestalt Continuity">
      Are all elements that should be aligned actually aligned. Check left,
      right, center, and baseline alignment.
    </check>

    <check id="VV-3" category="Typography" research="TF-9: Typography Research">
      Is font usage limited to the defined type scale. No rogue font sizes
      or weights. Line length is 45-75 characters for body text.
    </check>

    <check id="VV-4" category="Color" research="TF-7: WCAG; TF-12: Color Science">
      Is color usage limited to the defined palette. No rogue hex values.
      All text meets 4.5:1 contrast. No information conveyed by color alone.
    </check>

    <!-- Interaction State Checks (Norman) -->
    <check id="VV-5" category="Hover/Focus/Active" research="TF-6: Norman Feedback">
      Do all interactive elements have visible hover, focus, and active states.
    </check>

    <check id="VV-6" category="Disabled State" research="TF-6: Norman Constraints">
      Do all disabled elements look disabled (reduced opacity, no pointer cursor).
    </check>

    <check id="VV-7" category="Loading State" research="TF-2: Nielsen Heuristic 1">
      Do all loading states show a loading indicator within 200ms.
    </check>

    <check id="VV-8" category="Error State" research="TF-2: Nielsen Heuristic 9">
      Do all error states show an error message with a recovery action.
    </check>

    <check id="VV-9" category="Empty State" research="TF-2: Nielsen Heuristic 9">
      Do all empty states show a message and optional action.
    </check>

    <!-- Responsive and Touch Checks -->
    <check id="VV-10" category="Responsive" research="TF-3: Fitts's Law">
      Does the layout work from 320px to 1920px without horizontal scroll
      or element overlap.
    </check>

    <check id="VV-11" category="Touch Targets" research="TF-3: Fitts's Law">
      Are all touch targets at least 44×44px on mobile viewports.
    </check>

    <!-- Accessibility Checks -->
    <check id="VV-12" category="Contrast" research="TF-7: WCAG SC 1.4.3">
      Is text contrast at least 4.5:1 for normal text and 3:1 for large text.
      Is non-text contrast at least 3:1 for UI components (WCAG SC 1.4.11).
    </check>

    <!-- Hierarchy and Balance Checks -->
    <check id="VV-13" category="Hierarchy" research="TF-8: Eye-Tracking">
      Does the visual hierarchy match the information hierarchy. Most
      important content is most prominent and positioned where scanning
      patterns predict first fixation.
    </check>

    <check id="VV-14" category="Animation">
      Are animations smooth (60fps) and purposeful. No animation exists
      purely for decoration. Motion respects prefers-reduced-motion.
    </check>

    <check id="VV-15" category="Real Data">
      Does the UI look correct with real data, not just placeholder data.
    </check>

    <check id="VV-16" category="Content Extremes">
      Does the UI look correct with minimum content and maximum content.
      Test with shortest possible strings and longest possible strings.
    </check>

    <check id="VV-17" category="Icon Consistency" research="TF-1: Gestalt Similarity">
      Are icons used consistently. Same icon for the same action everywhere.
    </check>

    <check id="VV-18" category="Border Radius" research="TF-1: Gestalt Similarity">
      Are border radii consistent across similar elements.
    </check>

    <check id="VV-19" category="Shadow Consistency" research="TF-1: Gestalt Similarity">
      Are shadow values consistent across similar elevation levels.
    </check>

    <check id="VV-20" category="Overall Balance">
      Does the page feel balanced. No section feels disproportionately heavy
      or empty relative to others. Apply the squint test: squint at the
      screen until you cannot read text — the distribution of visual weight
      should be intentional and balanced.
    </check>

    <check id="VV-21" category="Color Blindness" research="TF-12: Color Science">
      Does the UI remain fully usable under simulated protanopia and
      deuteranopia. All status indicators, links, errors, and success
      states must be distinguishable without color perception.
    </check>

    <check id="VV-22" category="Keyboard Navigation" research="TF-7: WCAG SC 2.4.7">
      Is there a visible focus indicator on every focusable element. Does
      focus order match visual reading order. Are there no keyboard traps.
    </check>

  </tier>

</ui_visual_diagnosis_engine>

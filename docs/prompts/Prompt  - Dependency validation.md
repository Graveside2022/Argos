<?xml version="1.0" encoding="UTF-8"?>

<!--
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║              DEPENDENCY VERIFICATION RULEBOOK v2.0                         ║
  ║                                                                            ║
  ║  Purpose: Validate that any plan has every dependency, prerequisite, and    ║
  ║  concrete detail required for successful execution BEFORE work begins.     ║
  ║                                                                            ║
  ║  Usage: Run this verification against every plan before execution. If any  ║
  ║  item cannot survive this verification, the plan is incomplete and must    ║
  ║  not be executed.                                                          ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
-->

<dependency_verification_rulebook version="2.0">

  <metadata>
    <title>Dependency Verification Rulebook</title>
    <purpose>
      Catch abstract hand-waving and force concrete specificity. Validate that a plan
      contains every dependency, prerequisite, component, and concrete detail required
      for successful execution. If any item in the plan cannot survive this verification,
      the plan is incomplete and must not be executed.
    </purpose>
    <when_to_use>
      Run this verification AFTER a plan has been drafted and BEFORE any execution begins.
      This is not a planning tool. It is a validation tool. You already have a plan. This
      rulebook forces you to prove the plan is complete.
    </when_to_use>

    <theoretical_foundations>
      <foundation name="The Three Cs of Requirements" source="Zowghi &amp; Gervasi, 2002">
        Requirements must be Complete (nothing missing), Consistent (no contradictions),
        and Correct (accurately reflecting the actual need). If any of the three Cs is
        violated, the specification contains errors that will propagate into implementation.
        This rulebook operationalizes the Three Cs for plan verification.
      </foundation>
      <foundation name="PMI WBS 100% Rule" source="PMI PMBOK Guide; MIL-STD-881 (DoD 1968); NASA WBS Handbook SP-3404">
        The 100% Rule states that a Work Breakdown Structure must include 100% of the work
        defined by the project scope and capture ALL deliverables — internal, external, and
        interim. The sum of the work at the child level must equal 100% of the work at the
        parent level. No gaps. No overlaps. This is the foundational completeness principle
        for project planning, adopted by DoD (1968), NASA, and PMI.
      </foundation>
      <foundation name="Pre-Mortem Method" source="Gary Klein, Harvard Business Review (2007); validated by Veinott, Klein &amp; Wiggins (2010)">
        After creating a plan, assume the plan has already failed catastrophically. Generate
        plausible reasons for failure. This technique, based on 'prospective hindsight' research
        (Mitchell, Russo &amp; Pennington, 1989), increases the ability to accurately identify
        potential problems by up to 30%. It counters overconfidence, groupthink, and the
        planning fallacy. Nobel laureate Daniel Kahneman endorsed this method in "Thinking,
        Fast and Slow" (2011) as effective against optimism bias. NASA uses pre-mortems in
        mission planning. PayPal adopted them in 2020 for software design reviews.
      </foundation>
      <foundation name="Critical Path Method" source="DuPont (1957); US Navy PERT (1957); PMI PMBOK">
        Every plan contains a longest chain of dependent tasks that determines the minimum
        possible completion time. Tasks on this chain have zero slack — any delay extends the
        entire project. Identifying the critical path requires mapping ALL task dependencies,
        their types (Finish-to-Start, Start-to-Start, Finish-to-Finish, Start-to-Finish),
        and durations. If you have not mapped the dependency chain, you cannot know what is
        critical and what has flexibility.
      </foundation>
      <foundation name="Software Bill of Materials (SBOM)" source="NTIA Minimum Elements (2021); NIST SP 800-218; CISA SBOM Guidance; Executive Order 14028">
        Every software system is composed of components with dependency relationships.
        An SBOM documents: Supplier, Component Name, Version, Unique Identifiers, Dependency
        Relationships, Author, and Timestamp. Critically, dependencies are TRANSITIVE — a
        direct dependency has its own dependencies, creating a dependency tree that can extend
        many levels deep. Each application averages 6-10 direct dependencies but 180 total
        when transitive dependencies are counted. You must trace the FULL depth, not just the
        first layer.
      </foundation>
      <foundation name="Requirements Verification and Validation" source="IEEE 830; Maalem &amp; Zarour (2015); Khan et al. (2015)">
        Verification asks "are we building the thing right?" (checking completeness,
        consistency, accuracy). Validation asks "are we building the right thing?" (checking
        against actual needs). Both must occur before implementation. The main techniques
        are: Inspection (expert review), Demonstration (showing it works), Analysis (logical
        or mathematical checking), and Testing (executing against expected outcomes).
        Traceability ensures every requirement maps to an implementation artifact.
      </foundation>
      <foundation name="Definition of Done (DoD) and Acceptance Criteria" source="Scrum Guide; Agile Alliance; PMI Agile Practice Guide">
        The Definition of Done is a universal checklist ensuring every work item meets
        quality and completeness standards before being considered finished. Acceptance
        Criteria are specific, measurable conditions that an individual work item must satisfy.
        DoD ensures completeness of the process. Acceptance criteria ensure correctness of the
        output. Both must be defined BEFORE work begins, not discovered during implementation.
      </foundation>
      <foundation name="Dependency Management Best Practices" source="Google Cloud (2021); Sonatype State of Supply Chain (2024); NIST SP 800-161r1">
        Enterprise best practices for dependency management include: pin exact versions (not
        ranges or "latest"), audit for unused dependencies, track transitive dependencies,
        scan for known vulnerabilities, verify artifact integrity, minimize dependency footprint,
        and support reproducible builds. 80% of application dependencies go un-upgraded for
        over a year. Each project releases an average of 15 new versions per year.
      </foundation>
    </theoretical_foundations>

  </metadata>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 1: INVENTORY — Know What Exists Before Touching Anything       -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="1" name="Inventory Phase — Read Before You Write">

    <rule id="1" name="The Inventory Rule">
      <principle>
        Before you touch a single line of new code, you must produce a COMPLETE inventory
        of the existing code. Not a summary. Not a description. A literal inventory.
        This is the foundation of the PMI 100% Rule applied to code analysis: if you have
        not enumerated 100% of what exists, you cannot verify that your plan covers 100%
        of what needs to change.
      </principle>

      <file_inventory>
        For every file in the source codebase that is relevant to the task:
        - What is the file path and name.
        - What does this file export. List every export by name.
        - What does this file import. List every import by name and source.
        - What is the purpose of this file in one sentence.
        - Which other files depend on this file (downstream dependents).
        - Which files does this file depend on (upstream dependencies).

        If you cannot produce this inventory, you have not read the codebase.
        Read it before planning.
      </file_inventory>

      <function_inventory>
        For every function being created, modified, or ported:
        - What is the function name.
        - What are its parameters, including types.
        - What does it return, including type.
        - What side effects does it have. List each one.
        - What global state does it read or write.
        - What external services does it call.
        - What error cases does it handle.
        - What error cases does it NOT handle (the negative space).

        If any of these answers are "I am not sure," you have not read the function.
        Read it before porting it.
      </function_inventory>
    </rule>


    <rule id="2" name="The Transitive Dependency Inventory Rule" added_in="v2.0">
      <principle>
        Inspired by SBOM methodology (NTIA 2021, NIST SP 800-218): every dependency has
        its own dependencies. You must trace the FULL dependency tree, not just the first
        layer. An average application has 6-10 direct dependencies but 180 total when
        transitive dependencies are counted (Sonatype 2024). If you only inventory direct
        dependencies, you are missing 95% of the actual dependency surface.
      </principle>

      <direct_dependencies>
        For every external package, library, or module the project directly imports:
        - What is the exact package name.
        - What is the exact pinned version (not a range, not "latest").
        - What does it provide that the project actually uses. List each import.
        - Is the project using a significant portion of this package or a single function.
          If a single function, can it be replaced with a local implementation to reduce
          the dependency surface.
        - What is the package's license. Is it compatible with the project's license.
        - When was the last release. Is it actively maintained or abandoned.
        - Are there known vulnerabilities in this version (check CVE databases).
      </direct_dependencies>

      <transitive_dependencies>
        For every direct dependency, identify what IT depends on:
        - Run the package manager's dependency tree command (npm ls --all, pip show,
          mvn dependency:tree, etc.) and capture the full tree.
        - Identify any version conflicts where different packages require different
          versions of the same transitive dependency.
        - Identify any transitive dependency that is deprecated or has known vulnerabilities.
        - For the CRITICAL PATH of the application (the core functionality), trace
          transitive dependencies at least 3 levels deep.
      </transitive_dependencies>

      <phantom_dependencies>
        Identify dependencies that are USED but not DECLARED:
        - Code that imports from packages installed as transitive dependencies of other
          packages but not explicitly listed in the project's dependency manifest.
        - Code that depends on globally installed tools or system packages.
        - Code that depends on specific OS features, shell commands, or runtime versions.
        - Code that depends on environment variables being set.
        - Code that depends on files existing at specific paths.
        - Code that depends on network services being available.

        Phantom dependencies are the #1 cause of "works on my machine" failures.
        Every one must be made explicit.
      </phantom_dependencies>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 2: CONCRETENESS — Eliminate Every Abstraction From the Plan    -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="2" name="Concreteness Phase — No Abstractions Allowed">

    <rule id="3" name="The 'What Does That Actually Mean' Rule">
      <principle>
        Every item in your plan must be concrete enough to execute without interpretation.
        This operationalizes the Three Cs framework: a plan item is COMPLETE only if it
        can be expanded into a concrete list of specific, named items. It is CONSISTENT
        only if no two expanded items contradict each other. It is CORRECT only if the
        expansion matches what actually exists in the codebase.

        Apply this test to every line of your plan. If ANY line cannot be expanded into
        a concrete list of specific items, it is not a plan item. It is a placeholder.
        Replace it with the real items.
      </principle>

      <expansion_test name="Shared Utilities">
        If the plan says "establish shared utilities," STOP. Answer:
        - Which utilities specifically. List each one by name.
        - What does each utility do. One sentence each.
        - Where does each utility currently live in the old code.
        - Where will each utility live in the new code.
        - What is the interface of each utility. Parameters in, return value out.
        - Which components call each utility. List them.
        - Does the utility need to change for the new framework or can it be copied as-is.
      </expansion_test>

      <expansion_test name="State Management">
        If the plan says "set up state management," STOP. Answer:
        - What state exists. List every piece of state by name.
        - What is the type and shape of each piece of state.
        - What is the initial value of each piece of state.
        - Where does each piece of state currently live (component state, global store,
          context, URL, local storage, session storage, cookies).
        - Where will each piece of state live in the new framework.
        - What reads each piece of state. List every consumer.
        - What writes each piece of state. List every updater.
        - What are the state transitions. What events cause state to change and to what values.
      </expansion_test>

      <expansion_test name="Type Definitions">
        If the plan says "define types," STOP. Answer:
        - Which types specifically. List each one by name.
        - What are the fields of each type.
        - What is the type of each field.
        - Which fields are required and which are optional.
        - Where are these types currently defined in the old code.
        - Which files import and use each type.
        - Do any types extend or compose other types. Show the full chain.
      </expansion_test>

      <expansion_test name="Routing">
        If the plan says "configure routing," STOP. Answer:
        - What routes exist. List every route path.
        - What component does each route render.
        - What parameters does each route accept.
        - Which routes are protected and what is the auth requirement.
        - What is the redirect behavior for unauthorized access.
        - What is the 404 behavior.
        - What is the nested route structure if any.
        - What data does each route need to load before rendering.
      </expansion_test>

      <expansion_test name="API Integration">
        If the plan says "set up API integration," STOP. Answer:
        - What API endpoints are called. List every endpoint.
        - What HTTP method does each use.
        - What request body does each expect. Show the shape.
        - What response body does each return. Show the shape.
        - What headers are required for each.
        - What authentication is required for each.
        - What error responses can each return.
        - How is each endpoint currently called in the old code (direct fetch, axios,
          a wrapper, a hook).
        - How will each be called in the new framework.
      </expansion_test>

      <expansion_test name="Component Migration">
        If the plan says "migrate components," STOP. Answer:
        - Which components specifically. List every one by name.
        - What props does each component accept. List each prop, its type, and whether
          it is required.
        - What state does each component manage internally.
        - What side effects does each component perform.
        - What events does each component emit or handle.
        - What child components does each component render.
        - What styles are associated with each component.
        - Does the component have conditional rendering logic. What are the conditions.
      </expansion_test>

      <expansion_test name="Styling">
        If the plan says "handle styling," STOP. Answer:
        - What styling approach is the old code using (CSS files, CSS modules,
          styled-components, Tailwind, inline styles, SASS, LESS).
        - What styling approach will the new code use.
        - Are there global styles. List them.
        - Are there theme variables. List every variable and its value.
        - Are there shared style constants (colors, spacing, breakpoints). List them all.
        - Which components have component-scoped styles.
        - Are there responsive breakpoints. What are the exact pixel values.
        - Are there animations or transitions. List each one and what triggers it.
      </expansion_test>

      <expansion_test name="Generic Catch-All" added_in="v2.0">
        For ANY plan item not covered by the specific tests above, apply this generic
        decomposition. If the plan says "[verb] [abstract noun]," STOP. Answer:
        - What specific things does this abstract noun refer to. Name each one.
        - Where does each specific thing currently exist. Give file paths.
        - What is the current state of each specific thing.
        - What will the new state of each specific thing be after this plan item.
        - What other plan items does this depend on.
        - What other plan items depend on this.
        - How will you verify this plan item was executed correctly.

        If you cannot answer all seven questions, the plan item is too abstract.
        Decompose it further.
      </expansion_test>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 3: DEPENDENCY CHAINS — Trace Every Connection                  -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="3" name="Dependency Chain Phase — Trace Every Connection">

    <rule id="4" name="The Dependency Chain Rule">
      <principle>
        For every piece of code being created, modified, or ported, trace its FULL
        dependency chain before touching it. This applies the Critical Path Method
        to code: you must know the full network of predecessors and successors to
        determine the correct execution order and identify where delays or failures
        will propagate.
      </principle>

      <upstream_dependencies>
        What does this code need to exist before it can work:
        - What libraries must be installed. List each with the exact version.
        - What config files must exist. List each with the required fields.
        - What environment variables must be set. List each with the expected format.
        - What other files in the project must exist and be functional. List each.
        - What external services must be running and accessible. List each.
        - What data must exist in the database or API before this code can run.
      </upstream_dependencies>

      <downstream_dependents>
        What other code will break if this code is wrong:
        - What components import from this file. List each.
        - What functions call this function. List each.
        - What tests reference this code. List each.
        - What build or deploy scripts reference this file. List each.
      </downstream_dependents>

      <peer_dependencies>
        What code must be ported at the same time because they depend on each other:
        - Are there circular dependencies between files being ported. Identify them.
        - Are there files that must be ported together because they share types or state.
          Group them.
        - What is the correct order to port files given their dependency chains.
          State the order explicitly.

        If porting file A requires file B to already be ported, and file B requires file A,
        you have a circular dependency. You must identify this before starting and plan
        how to break the cycle.
      </peer_dependencies>
    </rule>


    <rule id="5" name="The Critical Path Rule" added_in="v2.0">
      <principle>
        Derived from the Critical Path Method (CPM, DuPont 1957): every plan has a longest
        chain of dependent tasks that determines the minimum possible completion time. Tasks
        on this chain have zero slack — any delay extends the entire project. Tasks NOT on
        this chain have float — they can be delayed without impacting completion.

        You must identify the critical path of your plan to know: what must be done first,
        what can be parallelized, and where a single mistake will cascade into total delay.
      </principle>

      <dependency_types>
        For every pair of dependent tasks, classify the dependency type:
        - Finish-to-Start (FS): Task A must finish before Task B can begin.
          Example: Types must be defined before components using them can be written.
        - Start-to-Start (SS): Task A must start before Task B can start.
          Example: API client must begin setup before integration tests can begin setup.
        - Finish-to-Finish (FF): Task B cannot finish until Task A finishes.
          Example: Documentation cannot be finalized until code is finalized.
        - Start-to-Finish (SF): Task A must start before Task B can finish.
          Example: New system must start before old system can be decommissioned.
      </dependency_types>

      <critical_path_identification>
        To identify the critical path:
        1. List every task in the plan with its estimated duration.
        2. Map every dependency between tasks with its type (FS, SS, FF, SF).
        3. Identify the longest chain of dependent tasks from start to finish.
        4. Mark tasks on this chain as CRITICAL — zero slack, no delay tolerance.
        5. Identify tasks NOT on the critical path — these have float and can absorb
           some delay without impacting the overall timeline.
        6. Identify near-critical paths — chains that are close to the critical path
           length. These can BECOME critical if they slip even slightly.

        If you have not done this analysis, you do not know what order to execute your plan.
      </critical_path_identification>

      <hard_vs_soft_constraints>
        For every dependency, classify the constraint:
        - Hard constraint: Non-negotiable technical prerequisite that cannot be worked around.
          Example: The database schema must exist before migrations can run.
        - Soft constraint: Preference that could be adjusted if needed.
          Example: Code review before merge (could be deferred in an emergency).

        Hard constraints define the true critical path. Soft constraints are often
        mistaken for hard constraints, creating artificially rigid plans.
      </hard_vs_soft_constraints>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 4: TRANSLATION — Map Old Patterns to New                       -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="4" name="Translation Phase — Map Every Pattern">

    <rule id="6" name="The Framework Translation Rule">
      <principle>
        For every framework-specific pattern in the old code, identify the equivalent
        in the new framework BEFORE writing any new code. Do not assume patterns
        translate one-to-one. Many do not. Identify the differences before writing
        code, not after.
      </principle>

      <per_pattern_checklist>
        For each pattern, answer:
        - What is the old framework pattern. Name it specifically.
        - What is the equivalent pattern in the new framework. Name it specifically.
        - Are there behavioral differences between the two. List every difference.
        - Does the new framework require additional boilerplate or configuration.
        - Does the new framework handle this pattern in a fundamentally different way
          that requires restructuring the logic.
      </per_pattern_checklist>

      <common_patterns>
        These patterns must be EXPLICITLY translated (not assumed):
        - Component lifecycle (mount, update, unmount equivalents).
        - State management (local state, global state, derived state).
        - Side effects (data fetching, subscriptions, timers, DOM manipulation).
        - Event handling (synthetic events, native events, custom events).
        - Conditional rendering approach.
        - List rendering approach.
        - Form handling (controlled inputs, validation, submission).
        - Error boundaries and error handling.
        - Context or dependency injection.
        - Routing and navigation.
        - Code splitting and lazy loading.
        - Ref and DOM access patterns.
        - Animation and transition patterns.
        - Server-side rendering if applicable.
      </common_patterns>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 5: COMPLETENESS — Find Every Missing Piece                     -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="5" name="Completeness Phase — Find Every Missing Piece">

    <rule id="7" name="The Missing Piece Detector">
      <principle>
        After completing the inventory, the plan expansion, the dependency chain, and the
        framework translation, run this final completeness check. This operationalizes
        the PMI 100% Rule: every deliverable must be accounted for, and the sum of all
        child items must equal 100% of the parent scope.
      </principle>

      <per_component_check>
        For every component in the new codebase:
        - Can it render without errors right now given what exists. If not, what is missing.
        - Can it fetch the data it needs. If not, what API layer is missing.
        - Can it navigate to where it needs to go. If not, what routing is missing.
        - Can it access the state it needs. If not, what state setup is missing.
        - Can it call the utilities it needs. If not, what utility is missing.
        - Can it apply its styles. If not, what style setup is missing.
        - Can it handle every user interaction it is supposed to handle. If not, what
          handler is missing.
        - Can it handle errors gracefully. If not, what error handling is missing.
      </per_component_check>

      <project_infrastructure_check>
        For the project as a whole:
        - Is there a package.json or equivalent with every required dependency listed.
        - Is there a configuration file for the new framework with all required settings.
        - Are there environment variables documented and set.
        - Is there a build script that works.
        - Is there a dev server that works.
        - Are there type definitions for all shared types.
        - Is there a linting configuration.
        - Is there a testing configuration.
      </project_infrastructure_check>

      <action>
        For every "no" answer above, add the missing item to the plan as a concrete step
        BEFORE the step that needs it. Do not discover missing pieces during implementation.
        Discover them now.
      </action>
    </rule>


    <rule id="8" name="The Cross-Reference Completeness Rule" added_in="v2.0">
      <principle>
        Inspired by the Product Breakdown Structure / Work Breakdown Structure cross-validation
        technique (APM Body of Knowledge): maintain two parallel views of the plan — WHAT will
        be produced (products/outputs) and WHAT work must be done (tasks/activities). Cross-reference
        them to find gaps.

        "Do you have products without work-packages? If so you will not be able to deliver the
        outcome. Do you have work-packages without products? If so you are either doing unnecessary
        work or have missed something." — APM
      </principle>

      <products_without_work>
        List every deliverable, artifact, or output the plan promises. For each one, verify
        there is at least one concrete task that PRODUCES it.
        - If a deliverable has no task producing it: the plan is missing work. Add the task.
        - If a deliverable is produced by a task that depends on something not in the plan:
          the plan is missing a prerequisite. Add it.
      </products_without_work>

      <work_without_products>
        List every task in the plan. For each one, verify it produces or contributes to at
        least one deliverable.
        - If a task produces nothing and contributes to nothing: it is unnecessary. Remove it
          or justify why it exists.
        - If a task contributes to a deliverable not listed in the plan: the plan is missing
          a deliverable. Add it.
      </work_without_products>

      <traceability_matrix>
        Produce a simple traceability matrix:
        - Column 1: Every requirement or goal of the task.
        - Column 2: The plan step(s) that address this requirement.
        - Column 3: The deliverable(s) that prove this requirement is met.
        - Column 4: The verification method (test, review, demonstration).

        If any cell is empty, the plan has a gap. Fill it before proceeding.
      </traceability_matrix>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 6: PROOF — Produce the Verification Documents                  -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="6" name="Proof Phase — Produce the Evidence">

    <rule id="9" name="The Proof Rule">
      <principle>
        After verification, you must be able to produce the following documents. If you
        cannot, the verification is incomplete. These documents serve as the Definition
        of Done for your plan itself — the plan is not "done" until all proofs exist.
      </principle>

      <proof id="1" name="Complete File Map">
        A list of every file in the old codebase being affected, paired with its
        corresponding new file path. Every old file must map to a new file or be
        explicitly marked as "not needed in new framework" with a reason.
      </proof>

      <proof id="2" name="Complete Dependency List">
        Every npm package, library, framework plugin, and tool required by the new
        codebase. With EXACT version numbers. Not "latest." Not a range. The exact
        version. Include both direct AND significant transitive dependencies that the
        project relies on (phantom dependencies made explicit).
      </proof>

      <proof id="3" name="Complete Type Inventory">
        Every shared type, interface, and enum used across more than one file. With
        full field definitions. Including which fields are required vs optional and
        any inheritance or composition chains.
      </proof>

      <proof id="4" name="Complete State Map">
        Every piece of application state: where it lives, what reads it, what writes
        it, what its type and initial value are, and what events trigger transitions.
      </proof>

      <proof id="5" name="Complete API Map">
        Every external API call: its endpoint, method, request shape, response shape,
        error responses, authentication requirements, and which components use it.
      </proof>

      <proof id="6" name="Migration Order">
        The exact order in which files will be created or ported, based on dependency
        chains, with the reason for the ordering. The critical path should be identified.
      </proof>

      <proof id="7" name="Environment and Infrastructure Manifest" added_in="v2.0">
        Every environment variable, config file, system dependency, required runtime
        version, required OS feature, external service, and infrastructure prerequisite.
        Include: the name, the expected value format, where it must be set, and what
        breaks if it is missing.
      </proof>

      <proof id="8" name="Risk and Assumption Register" added_in="v2.0">
        Every assumption the plan makes (explicitly or implicitly) and every risk
        that could invalidate the plan. For each:
        - What is the assumption or risk.
        - What evidence supports or contradicts it.
        - What is the impact if it is wrong (low, medium, high, critical).
        - What is the mitigation or fallback plan.
        - How will you detect if it is wrong (the tripwire).
      </proof>

      <action>
        If you cannot produce all eight documents, you do not have a complete
        understanding of the task. Go back and fill the gaps before writing any code.
      </action>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 7: CHALLENGE — Stress-Test Every Claim                         -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="7" name="Challenge Phase — Stress-Test Every Claim">

    <rule id="10" name="The Challenge Rule">
      <principle>
        For every item in the plan that you have verified, ask yourself three questions.
        If you cannot answer all three for any item, that item is not verified. It is
        assumed. Assumptions are not allowed. Verify it or flag it as an open question.
      </principle>

      <three_questions>
        1. If I am wrong about this, what breaks.
        2. How would I know if I am wrong about this.
        3. What is the fastest way to confirm I am right.
      </three_questions>
    </rule>


    <rule id="11" name="The Pre-Mortem Rule" added_in="v2.0">
      <principle>
        Derived from Gary Klein's Pre-Mortem Method (HBR 2007), validated by research
        showing a 30% improvement in problem identification (Veinott, Klein &amp; Wiggins, 2010),
        and endorsed by Daniel Kahneman in "Thinking, Fast and Slow" (2011).

        After the plan passes all previous rules, perform this final stress test:
        Assume the plan has ALREADY FAILED CATASTROPHICALLY. Not "might fail." HAS failed.
        Now work backward to explain why.
      </principle>

      <pre_mortem_process>
        Step 1: State the assumption of failure.
          "This plan was executed exactly as written. It failed completely. The result
          was unusable, broken, or had to be thrown away and started over."

        Step 2: Generate failure reasons. For each of these categories, identify at
        least one plausible failure mode:
          - A dependency that was assumed to exist but does not or does not work as expected.
          - A version incompatibility between two or more packages that was not detected.
          - A behavioral difference between the old and new framework that was not accounted for.
          - A piece of state, a route, an API call, or a type that was missed in the inventory.
          - An implicit ordering dependency that was not made explicit in the migration order.
          - An environment or infrastructure requirement that was not documented.
          - A circular dependency that was not detected.
          - A feature that works differently in production vs development.
          - An edge case in user input, data shape, or error handling that was not covered.
          - A performance degradation caused by the new approach.

        Step 3: For each failure reason, answer:
          - Is this failure reason already mitigated by the plan. WHERE specifically.
          - If not mitigated, what concrete step must be added to the plan to prevent it.
          - What is the earliest point in execution where this failure would become detectable.

        Step 4: Add every unmitigated failure reason to the Risk and Assumption Register
        (Proof Document 8) and add the mitigation steps to the plan.
      </pre_mortem_process>
    </rule>


    <rule id="12" name="The Definition of Done Rule" added_in="v2.0">
      <principle>
        Derived from Scrum's Definition of Done (DoD) and Acceptance Criteria practices.
        Before execution begins, define EXACTLY what "done" means for the entire task
        and for each individual plan step. Without this, there is no objective way to
        know when to stop, and scope creep or premature completion both become likely.
      </principle>

      <task_level_done>
        For the overall task, define completion criteria:
        - What must be true for the entire task to be considered DONE.
        - What tests must pass.
        - What functionality must work end-to-end.
        - What documentation must exist.
        - What review or approval must occur.
        - What is explicitly OUT OF SCOPE (to prevent scope creep).
      </task_level_done>

      <step_level_done>
        For each individual plan step, define:
        - What is the specific, observable output of this step.
        - How will you verify this step was completed correctly (not just completed).
        - What acceptance criteria must be met before moving to the next step.
        - What should you check for regression — did this step break anything that
          was working before.
      </step_level_done>

      <action>
        If you cannot define "done" for any step, that step is too vague.
        Decompose it until done is definable.
      </action>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PHASE 8: CONSISTENCY — Verify No Contradictions                      -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <phase id="8" name="Consistency Phase — Verify No Contradictions" added_in="v2.0">

    <rule id="13" name="The Consistency Rule">
      <principle>
        The second of the Three Cs (Zowghi &amp; Gervasi, 2002): a plan is CONSISTENT only
        if no two items contradict each other. Contradictions in a plan are silent killers —
        they are often not discovered until implementation, when two steps produce
        incompatible results and the developer must choose one, invalidating the other.
      </principle>

      <version_consistency>
        Verify there are no version conflicts in the plan:
        - Does the plan specify the same version for a dependency everywhere it is mentioned.
        - Do all dependencies specify compatible version ranges for shared sub-dependencies.
        - Does the target runtime (Node, Python, Java version) support ALL dependencies.
        - Do the specified framework versions support all plugins and extensions referenced.
      </version_consistency>

      <naming_consistency>
        Verify there are no naming conflicts:
        - Does the plan use the same name for the same thing everywhere.
        - Are there two different things given the same name in different contexts.
        - Are there the same things given different names in different parts of the plan.
        - Do file paths referenced in one step match the file paths created in another step.
      </naming_consistency>

      <behavioral_consistency>
        Verify there are no behavioral contradictions:
        - Does Step X assume a piece of state is shaped one way while Step Y shapes it
          differently.
        - Does Step X assume an API returns one shape while the API Map documents a
          different shape.
        - Does the error handling strategy in one area contradict the error handling
          strategy in another.
        - Does the routing configuration in one step conflict with the navigation logic
          in another.
      </behavioral_consistency>

      <temporal_consistency>
        Verify there are no ordering contradictions:
        - Does the migration order say to build X before Y, while the dependency chain
          shows Y must exist before X.
        - Does any step reference or depend on something that a later step creates.
        - Are there implicit assumptions about what already exists that are not guaranteed
          by the ordering.
      </temporal_consistency>
    </rule>

  </phase>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  EXECUTION ORDER AND SUMMARY                                          -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<execution_order>
Run verification in this exact order. Each phase depends on the previous.

    Phase 1: INVENTORY — Read the codebase. Inventory files, functions, and ALL
    dependencies including transitive. Produce the complete picture of what exists.

    Phase 2: CONCRETENESS — Expand every abstract plan item into named, specific,
    concrete details. Eliminate all hand-waving.

    Phase 3: DEPENDENCY CHAINS — Trace upstream, downstream, and peer dependencies
    for every piece of code. Identify the critical path. Classify hard vs soft constraints.

    Phase 4: TRANSLATION — Map every old framework pattern to its new equivalent.
    Document behavioral differences.

    Phase 5: COMPLETENESS — Run the missing piece detector on every component and
    the project infrastructure. Cross-reference products against work-packages.
    Build the traceability matrix.

    Phase 6: PROOF — Produce all 8 proof documents. If any cannot be produced,
    go back to the phase that should have generated the missing information.

    Phase 7: CHALLENGE — Run the three questions on every item. Perform the pre-mortem.
    Define done for the task and every step. Add all unmitigated risks to the register.

    Phase 8: CONSISTENCY — Verify no contradictions across versions, names, behaviors,
    or temporal ordering. This is the final gate.

    ONLY AFTER ALL 8 PHASES PASS does the plan qualify for execution.

</execution_order>

</dependency_verification_rulebook>

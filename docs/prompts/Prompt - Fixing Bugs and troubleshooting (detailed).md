<?xml version="1.0" encoding="UTF-8"?>

<!--
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║              DIAGNOSTIC TRIAGE ENGINE v2.0                                 ║
  ║                                                                            ║
  ║  Purpose: Provide a rigorous, research-validated systematic methodology    ║
  ║  for diagnosing, localizing, and resolving software defects. Every step    ║
  ║  is grounded in academic research, industry best practices, and proven     ║
  ║  engineering disciplines.                                                  ║
  ║                                                                            ║
  ║  Usage: Run this sequence on every problem before applying any fix. Each   ║
  ║  question eliminates categories of causes and narrows the search space.    ║
  ║  Do not skip questions. Do not jump ahead. The order matters.              ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
-->

<diagnostic_triage_engine version="2.1">

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 0: COGNITIVE PREPARATION — Debias Before You Debug              -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="0" name="Cognitive Preparation — Debias Before You Debug" added_in="v2.0">

    <principle>
      Based on Kahneman &amp; Tversky (1974) and Nickerson (1998): the human mind
      defaults to heuristic shortcuts that systematically distort judgment under
      uncertainty. Debugging IS judgment under uncertainty. Before touching any code,
      acknowledge and counteract the biases that will otherwise derail diagnosis.
      This tier takes 30 seconds and prevents hours of wasted investigation.
    </principle>

    <bias_checkpoint id="BC-1" name="Confirmation Bias Guard">
      State your current best guess about the cause of this bug. Write it down.
      Now commit to actively seeking evidence that DISPROVES this guess. If you
      cannot think of an experiment that would disprove your hypothesis, your
      hypothesis is unfalsifiable and therefore scientifically useless.
      Replace it with a falsifiable one.
    </bias_checkpoint>

    <bias_checkpoint id="BC-2" name="Anchoring Bias Guard">
      What was the FIRST piece of information you received about this bug
      (error message, user report, colleague's theory)? That information is now
      your anchor. Explicitly set it aside. Ask: "If I had received completely
      different initial information, would I be looking in the same place?"
      If yes, proceed. If no, you are anchored. Broaden your investigation.
    </bias_checkpoint>

    <bias_checkpoint id="BC-3" name="Availability Bias Guard">
      What was the last bug you fixed? Is the current bug reminding you of that
      one? If yes, you are subject to availability bias — overweighting recent
      or memorable experiences. The current bug is a NEW phenomenon. Treat it
      as one. Do not assume it has the same cause as the last similar-looking bug.
    </bias_checkpoint>

    <bias_checkpoint id="BC-4" name="Overconfidence Bias Guard">
      On a scale of 1-10, how confident are you that you already know the cause?
      If above 7, you are likely overconfident. Emergency physicians' diagnostic
      errors are most commonly caused by overconfidence (22.5% of cases, per
      clinical decision-making research). The same applies to developers.
      Force yourself through the full triage regardless of confidence level.
    </bias_checkpoint>

    <bias_checkpoint id="BC-5" name="Sunk Cost Bias Guard" added_in="v2.0">
      Have you already spent significant time investigating one particular theory?
      If yes, you are susceptible to sunk cost bias — continuing to invest in a
      failing approach because of prior investment. The time already spent is gone.
      Evaluate your current theory on its merits alone. If evidence does not support
      it, abandon it immediately regardless of time invested.
    </bias_checkpoint>

    <strategy_checkpoint id="SC-1" name="Expert Strategy Selection" added_in="v2.1">
      Vessey (1985) showed that experts use BREADTH-FIRST, data-driven approaches
      while novices fall into DEPTH-FIRST, theory-driven traps. Before diving in:
      <check>Survey the full symptom landscape before committing to a theory.</check>
      <check>Let the DATA drive your hypothesis — do not force data to fit a preconceived idea.</check>
      <check>Maintain a SYSTEM-LEVEL view even when examining a specific component.</check>
      <check>If you find yourself going deeper and deeper into one path without
        evidence, STOP — you are in a novice depth-first pattern. Pull back to
        breadth-first exploration.</check>
    </strategy_checkpoint>

    <strategy_checkpoint id="SC-2" name="Verbalization Gate" added_in="v2.1">
      Before touching any code or tools, EXPLAIN THE PROBLEM ALOUD in plain language.
      State: (1) what should happen, (2) what actually happens, (3) when it started.
      This activates the self-explanation effect (Chi et al., 1989) — generating
      explanations forces implicit knowledge to become explicit, often revealing the
      discrepancy without any further investigation. If you cannot explain the expected
      behavior clearly, your understanding of the system is incomplete, and you must
      fill that gap BEFORE debugging. Many bugs are found mid-sentence during
      verbalization ("Rubber Duck Debugging" — Hunt and Thomas, 1999).
    </strategy_checkpoint>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 1: REPRODUCE OR STOP — Establish Observable Failure             -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="1" name="Reproduce or Stop — Establish Observable Failure">

    <principle>
      Derived from Zeller's first law of debugging: "Before you can fix a bug,
      you must reproduce it." A failure that cannot be reproduced cannot be
      systematically diagnosed. All subsequent tiers assume you can trigger
      the failure on demand. Without reproduction, you are guessing.
    </principle>

    <question id="T1-Q1" name="On-Demand Reproduction">
      Can you reproduce the failure right now, on demand, with deterministic steps?

      <if_no>
        STOP. Do not proceed to diagnosis. Your ONLY job is to establish
        reproduction steps. Execute the following sub-protocol:

        <reproduction_protocol>
          <step id="RP-1">
            Gather exact environment details: OS, runtime version, browser/device,
            network conditions, time of day, user account, data state.
          </step>
          <step id="RP-2">
            Gather exact input sequence: every click, keystroke, API call, file
            upload, and navigation step that preceded the failure.
          </step>
          <step id="RP-3">
            Determine if the failure is deterministic (same input always produces
            failure) or non-deterministic (same input sometimes succeeds). If
            non-deterministic, suspect: race conditions, timing dependencies,
            resource exhaustion, external service flakiness, or undefined behavior
            from uninitialized state. Add logging at suspected interaction points.
          </step>
          <step id="RP-4">
            If the failure occurs only in production, instrument the code path with
            structured logging (trace IDs, request context, state snapshots) to
            capture the failure context when it next occurs. Use OpenTelemetry or
            equivalent to collect correlated metrics, logs, and traces.
          </step>
          <step id="RP-5">
            If the user cannot provide steps, attempt to reconstruct from logs,
            error monitoring (Sentry, Datadog, etc.), session replay tools, or
            by systematically varying inputs in the reported area.
          </step>
        </reproduction_protocol>

        You cannot diagnose what you cannot observe. Full stop.
      </if_no>

      <if_yes>Continue to T1-Q2.</if_yes>
    </question>

    <question id="T1-Q2" name="Isolation Test">
      Can you reproduce the failure in an isolated environment — a single component,
      single function, single request, or minimal test case?

      <if_no>
        The problem involves interaction between components. Continue to TIER 2
        with the assumption that the bug is at an integration point, in shared state,
        in a dependency chain, or in the communication layer between systems.
        Note: Apply delta debugging principles — systematically remove components
        until the failure disappears, then add them back one at a time. The last
        component added before failure reappears is involved in the bug.
      </if_no>

      <if_yes>
        The problem is local to the isolated unit. Continue to TIER 2 with the
        assumption that the bug is contained within that unit. You have already
        significantly narrowed the search space.
      </if_yes>
    </question>

    <question id="T1-Q3" name="Minimal Reproduction" added_in="v2.0">
      Can you SIMPLIFY the reproduction case? Remove every element that is not
      required to trigger the failure.

      <principle>
        Derived from Zeller's delta debugging: the minimal test case that still
        triggers the failure reveals what the failure actually depends on. Everything
        else is noise. A 200-line reproduction case hiding a 3-line bug wastes
        investigation time. Reduce before you localize (Groce et al., 2018).
      </principle>

      <simplification_protocol>
        <step>Remove inputs one at a time. Does the failure still occur?</step>
        <step>Replace complex data with simple data. Does the failure still occur?</step>
        <step>Remove UI layers. Can you trigger it via direct function call or API?</step>
        <step>Remove middleware, interceptors, plugins. Does the failure still occur?</step>
        <step>Replace external services with mocks. Does the failure still occur?</step>
        <step>The minimal case that still fails IS your investigation scope.</step>
      </simplification_protocol>
    </question>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 2: CLASSIFY THE FAILURE — Determine the Diagnostic Path         -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="2" name="Classify the Failure — Determine the Diagnostic Path">

    <principle>
      Classification determines which diagnostic path to follow. Misclassification
      wastes time by sending you down the wrong investigation branch. This tier uses
      the Software FMEA failure mode categories (IEEE 6517710) and Zeller's failure
      taxonomy to select the optimal path.
    </principle>

    <question id="T2-Q1" name="Failure Manifestation">
      Is the failure an EXPLICIT ERROR (error message, exception, crash, stack trace,
      red console output, non-zero exit code) or SILENT WRONG BEHAVIOR (no error but
      incorrect output, wrong visual, missing data, unexpected state)?

      <if_explicit_error>Go to TIER 3A (Error Trace Path).</if_explicit_error>

      <if_silent_wrong_behavior>Go to TIER 3B (Behavioral Comparison Path).</if_silent_wrong_behavior>

      <if_both>
        Handle the explicit error FIRST via TIER 3A. Silent wrong behavior may
        resolve once the error is fixed. If it persists after the error is resolved,
        handle it as a separate diagnosis via TIER 3B. Do not conflate them — they
        may have different root causes that coincidentally co-occur.
      </if_both>
    </question>

    <question id="T2-Q2" name="Temporal Classification">
      Is this a REGRESSION (it used to work and stopped) or a NEW IMPLEMENTATION
      (it never worked correctly)?

      <if_regression>
        The cause is in whatever changed. Find the delta between the working and
        broken states. Apply the following narrowing protocol:

        <regression_protocol>
          <step id="REG-1">Identify the last known-good state (commit, deploy, date).</step>
          <step id="REG-2">Identify the first known-bad state.</step>
          <step id="REG-3">Enumerate ALL changes between them: code commits, dependency
            updates, configuration changes, environment changes, infrastructure changes,
            data migrations, feature flag changes.</step>
          <step id="REG-4">Use git bisect or equivalent binary search across commits
            to find the exact change that introduced the regression.</step>
          <step id="REG-5">If the regression is not in code, check: dependency version
            changes, environment variable changes, infrastructure updates, DNS/certificate
            changes, database schema drift, third-party API contract changes.</step>
        </regression_protocol>

        The answer is ALMOST ALWAYS in the delta. If you have exhausted the delta
        and found nothing, your delta is incomplete — you missed a change.
      </if_regression>

      <if_new_implementation>
        The cause is in the new code. Do not look at old code unless the new code
        depends on it. Start reading from the entry point of the new feature and
        trace forward through the execution path.
      </if_new_implementation>
    </question>

    <question id="T2-Q3" name="Failure Mode Classification (SFMEA)" added_in="v2.0">
      Classify the failure using the Common Defect Enumeration categories from
      Software FMEA (IEEE 6517710). Which category best describes the failure?

      <category name="Faulty Functionality">
        The code does the wrong thing. Logic error, wrong algorithm, incorrect
        business rule implementation. → Focus on logic analysis (TIER 4B).
      </category>
      <category name="Faulty Error Handling">
        The code fails to handle an error condition, handles it incorrectly,
        swallows exceptions, or produces cascading failures. → Focus on error
        paths and exception handling.
      </category>
      <category name="Faulty State Management">
        State is corrupted, stale, uninitialized, or mutated unexpectedly.
        Race conditions, shared mutable state, missing state transitions.
        → Focus on state tracing (TIER 4A).
      </category>
      <category name="Faulty Timing / Sequencing">
        Operations occur in the wrong order, too early, too late, or concurrently
        when they should be sequential. Includes race conditions, deadlocks, and
        missing awaits. → Focus on execution ordering and async analysis.
      </category>
      <category name="Faulty Data Processing">
        Data is transformed incorrectly: wrong parsing, wrong encoding, wrong
        serialization, truncation, overflow, loss of precision. → Focus on data
        flow tracing at transformation boundaries.
      </category>
      <category name="Faulty Integration">
        The interface between two components is mismatched: wrong API contract,
        incompatible data shapes, version skew, missing headers, auth failures.
        → Focus on integration boundary inspection.
      </category>
      <category name="Faulty Configuration / Environment">
        Code is correct but the environment is wrong: missing env vars, wrong
        file paths, permission errors, missing dependencies, wrong runtime version.
        → Focus on environment and infrastructure audit.
      </category>

      This classification guides which diagnostic tier to prioritize. Multiple
      categories may apply — investigate the most likely one first.
    </question>

    <question id="T2-Q4" name="ODC Defect Type Classification" added_in="v2.1">
      Supplement the SFMEA classification with Orthogonal Defect Classification
      (Chillarege et al., 1992) to extract process-level diagnostic signals.
      Classify the defect type — the minimal fix category that would correct it:

      <odc_type name="Assignment">Missing or incorrect value set to a variable.</odc_type>
      <odc_type name="Checking">Missing or incorrect validation of data or conditions.</odc_type>
      <odc_type name="Interface">Incorrect interaction with other components, modules, or APIs.</odc_type>
      <odc_type name="Timing/Serialization">Needed serialization or coordination missing or wrong.</odc_type>
      <odc_type name="Function">Significant design-level change required — missing capability.</odc_type>
      <odc_type name="Algorithm">Efficiency or correctness issue requiring algorithm redesign.</odc_type>
      <odc_type name="Build/Package/Merge">Build system, library, or version control issue.</odc_type>

      <note>
        ODC types are orthogonal — each defect falls into exactly one type. The
        distribution of defect types across a codebase reveals process signatures:
        clusters of "checking" defects indicate systematic missing validation;
        "interface" clusters indicate integration specification gaps. This pattern
        recognition is 10× faster than per-defect causal analysis (Chillarege, 2006).
      </note>
    </question>

    <question id="T2-Q5" name="Fault Tree Decomposition" added_in="v2.1">
      For complex failures, apply Fault Tree Analysis (IEC 61025:2006) to
      systematically decompose the top-level failure into contributing causes:

      <fta_protocol>
        <step>Define the TOP EVENT: the observable failure symptom.</step>
        <step>Ask: what conditions MUST ALL be true for this to happen? (AND gate)</step>
        <step>Ask: which conditions could INDEPENDENTLY cause this? (OR gate)</step>
        <step>Decompose each intermediate event until you reach BASIC EVENTS
          (testable, verifiable conditions you can check directly).</step>
        <step>Identify MINIMAL CUT SETS: the smallest combination of basic events
          that could cause the top event. These are your highest-priority
          investigation targets.</step>
      </fta_protocol>

      <note>
        FTA prevents single-cause tunnel vision. Many bugs result from the
        conjunction of multiple conditions (an AND gate) that are individually
        harmless. FTA makes these compound failure paths explicit and testable.
      </note>
    </question>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 3A: ERROR TRACE PATH — Explicit Errors                          -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="3A" name="Error Trace Path — Follow the Explicit Error">

    <principle>
      Explicit errors are gifts. They tell you exactly where the program detected
      a problem. The stack trace is a road map. Read it completely — not a summary,
      not the first line, every line. The error message tells you WHAT went wrong.
      The stack trace tells you WHERE. Your job is to determine WHY.
    </principle>

    <step id="T3A-1" name="Read the Full Error">
      Read the COMPLETE error message and COMPLETE stack trace. Every line. Not a
      summary. Not just the first frame. Errors in frameworks often show 20+ frames
      of framework internals before reaching your code. Find YOUR code in the trace.
      That is your primary investigation point.
    </step>

    <step id="T3A-2" name="Identify the Origin">
      Identify the EXACT file, function, and line number where the error originates
      in YOUR code (not in library code). This is the epicenter. If the error
      originates entirely within library code, the problem is in the inputs you
      passed to that library — trace backward to where your code calls the library.
    </step>

    <step id="T3A-3" name="Trace the Call Chain">
      Identify the call chain that led to the error line. What called the function
      that errored? What called THAT? Trace back at least 3 levels. This chain
      reveals the execution path that produced the failure context. Draw it out:
      Caller → Intermediate → Error Site. The defect may be at ANY point in this chain.
    </step>

    <step id="T3A-4" name="Inspect Values at the Error Site">
      At the error line, inspect the value of EVERY variable involved in the
      failing expression. Check each one:

      <value_checks>
        <check>Is it null or undefined when it should have a value?</check>
        <check>Is it NaN when it should be a number?</check>
        <check>Is it an empty string when it should have content?</check>
        <check>Is it the wrong type (string instead of number, object instead of array)?</check>
        <check>Is it the wrong shape (missing expected properties, extra unexpected properties)?</check>
        <check>Is it stale (from a previous state that should have been updated)?</check>
        <check>Is it the correct value but applied in the wrong context?</check>
      </value_checks>

      <if_wrong_value>
        The bug is UPSTREAM. Something that should have provided a valid value
        failed to do so. Trace that value backward to where it was set.
        Go to TIER 4A (Value Trace).
      </if_wrong_value>

      <if_correct_values>
        All values appear valid, yet the error still occurs. The bug is in the
        LOGIC at this line — the operation being performed is wrong for the given
        inputs, or the error condition itself is incorrect (false positive).
        Go to TIER 4B (Logic Analysis).
      </if_correct_values>
    </step>

    <step id="T3A-5" name="Search for Error Siblings">
      Search the entire codebase for the same error message string. Does it appear
      in multiple locations? If yes, confirm which instance is actually firing.
      Developers frequently debug the wrong instance of a duplicated error message.
    </step>

    <step id="T3A-6" name="Check Error Handling Integrity" added_in="v2.0">
      Examine how errors are handled between the origin and where you see them:

      <error_handling_checks>
        <check>Is any catch block swallowing the original error and rethrowing a
          different one? The original error may contain the real cause.</check>
        <check>Is any error transformation losing context (stack trace, original
          message, error code)?</check>
        <check>Is any retry logic masking intermittent failures?</check>
        <check>Is any error boundary catching and suppressing the real error
          while showing a generic message?</check>
        <check>Are there any global error handlers (window.onerror,
          process.on('uncaughtException'), middleware) that might be interfering?</check>
      </error_handling_checks>
    </step>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 3B: BEHAVIORAL COMPARISON PATH — Silent Wrong Behavior          -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="3B" name="Behavioral Comparison Path — Compare Expected vs. Actual">

    <principle>
      Silent wrong behavior is harder to diagnose than explicit errors because
      there is no automatic indication of where the problem lies. The technique
      is to establish a precise expected-vs-actual comparison, then trace backward
      through the data/render pipeline to find where correctness diverges.
      This is program slicing applied manually (Weiser, 1981).
    </principle>

    <step id="T3B-1" name="Define Expected Output (Precisely)">
      Define the EXACT expected output in concrete, measurable terms. Not "it
      should work." The EXACT value, EXACT visual state, EXACT data shape, EXACT
      behavior. Write it down. If you cannot define the expected output precisely,
      you cannot diagnose the bug — you do not yet know what "correct" looks like.
    </step>

    <step id="T3B-2" name="Capture Actual Output (Precisely)">
      Capture the EXACT actual output in the same terms used in T3B-1. Take
      screenshots, log values, serialize state, record network responses. Do not
      describe from memory — capture the actual artifact.
    </step>

    <step id="T3B-3" name="Describe the Delta">
      Describe the SPECIFIC difference between expected and actual. This difference
      is the SYMPTOM you are tracing. Be precise: "Expected array of 5 items,
      received array of 4 items" or "Expected button at position (100, 200),
      rendered at (100, 350)." The precision of your symptom description determines
      the precision of your diagnosis.
    </step>

    <step id="T3B-4" name="Find the Divergence Point (Forward Trace)">
      Trace the data or render pipeline from INPUT to OUTPUT. Identify:
      <substep>The LAST point where the value/visual is STILL CORRECT.</substep>
      <substep>The FIRST point where it BECOMES INCORRECT.</substep>
      The defect is between those two points. This is now your investigation zone.

      <pipeline_trace_method>
        Add logging or breakpoints at each transformation step in the pipeline.
        For data: input → validation → transformation → storage → retrieval → rendering.
        For UI: data → component props → render logic → DOM → CSS application.
        Check the value at each step. The step where it changes from correct to
        incorrect contains or is immediately downstream of the defect.
      </pipeline_trace_method>
    </step>

    <step id="T3B-5" name="Narrow the Zone">
      Within the investigation zone identified in T3B-4, go to TIER 4B
      (Logic Analysis) scoped to ONLY this zone. Do not analyze code outside
      this zone. You have already proven the defect is here.
    </step>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 4A: VALUE TRACE — A Variable Has a Wrong or Missing Value       -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="4A" name="Value Trace — Trace the Wrong Value to Its Source">

    <principle>
      Derived from backward program slicing (Weiser, 1981; Agrawal et al., 1993):
      when a variable has a wrong value, compute its backward slice — the set of
      all statements that could have influenced that value. The defect is somewhere
      in that slice. This tier systematically traces the value backward through
      every possible source until the point of corruption is found.
    </principle>

    <step id="T4A-1" name="Identify the Value Source">
      Where does this variable get its value? Classify the source:
    </step>

    <source type="props">
      <check>Check the parent component. Is it passing this prop?</check>
      <check>Is the prop name spelled correctly (case-sensitive check)?</check>
      <check>Is the value the correct type?</check>
      <check>Is the value current or stale (from a previous render cycle)?</check>
      <check>Are default props masking the fact that the prop is not being passed?</check>
      <check>If the prop comes from a grandparent via intermediary, check every level.</check>
      <action>If the parent passes the wrong value, recurse T4A on the parent.</action>
    </source>

    <source type="state">
      <check>Find EVERY setState, dispatch, or state mutation for this state variable.</check>
      <check>Is one of them setting it to the wrong value?</check>
      <check>Is NONE of them setting it when they should be (missing state update)?</check>
      <check>Is a state update being called with stale closure values?</check>
      <check>Is the state update batched in a way that causes it to use an old value?</check>
      <check>Are there race conditions where multiple updates conflict?</check>
      <action>If you find the offending state update, trace why IT has the wrong
        value (recurse T4A).</action>
    </source>

    <source type="function_return">
      <check>Call the function with the same inputs manually (or in a debugger).</check>
      <check>Does it return the expected value?</check>
      <check>If not, the bug is inside the function. Enter the function and restart
        T4A from inside it.</check>
      <check>If yes, the inputs you are passing in the real call differ from what
        you tested. Inspect the actual call-site arguments.</check>
    </source>

    <source type="api_response">
      <check>Log the RAW API response BEFORE any transformation or deserialization.</check>
      <check>Is the API returning what you expect?</check>
      <check_if_no>The problem is in the request (wrong endpoint, wrong params,
        wrong auth, wrong method) or in the backend. Inspect the request.</check_if_no>
      <check_if_yes>The problem is in how you PROCESS the response. Check parsing,
        deserialization, field mapping, null handling, and type coercion.</check_if_yes>
    </source>

    <source type="computation">
      <check>Check EVERY input to the computation. Are they all correct?</check>
      <check>If all inputs are correct, the computation logic is wrong.
        Go to TIER 4B for the computation.</check>
      <check>If any input is wrong, trace THAT input (recurse T4A).</check>
    </source>

    <source type="user_input">
      <check>Is the input being captured correctly by the event handler?</check>
      <check>Is the captured value being stored correctly?</check>
      <check>Is the stored value being read correctly when used later?</check>
      <check>Is encoding/decoding involved (URL encoding, HTML entities, Unicode)?</check>
      <check>Are there sanitization or normalization steps altering the input?</check>
    </source>

    <source type="environment" added_in="v2.0">
      <check>Is the value from an environment variable? Check if it is set, check
        its actual value (echo it), check for trailing whitespace or newlines.</check>
      <check>Is the value from a config file? Check the file is being read from the
        expected path, check file permissions, check for syntax errors in the config.</check>
      <check>Is the value from a cache? Check if the cache is stale, check the
        cache key, check the TTL, check if a cache invalidation was missed.</check>
    </source>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 4B: LOGIC ANALYSIS — Code Executes But Produces Wrong Output    -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="4B" name="Logic Analysis — Correct Inputs, Wrong Output">

    <principle>
      When all inputs are correct but the output is wrong, the defect is in the
      logic itself. This tier systematically examines every construct in the code
      block, checking for the specific categories of logic errors that account for
      the vast majority of code defects. Do not skim. Read every line as if you
      have never seen it before.
    </principle>

    <step id="T4B-1" name="Read the Code Block">
      Read the code block in question. Do NOT skim. Read every line. Pretend you
      are a code reviewer seeing it for the first time. Line-by-line, statement
      by statement. Zeller's principle: treat the code as a natural phenomenon
      to be observed, not a plan to be trusted.
    </step>

    <step id="T4B-2" name="Verify Conditionals">
      For each conditional (if, ternary, switch, guard clause, pattern match):
      <check>Which branch is being taken for the given inputs?</check>
      <check>Is that the CORRECT branch?</check>
      <check>Is the condition inverted (checking truthy when it should check falsy)?</check>
      <check>Does the condition use the correct comparison operator (=== vs ==, &gt; vs &gt;=)?</check>
      <check>Are compound conditions (AND/OR) correctly parenthesized?</check>
      <check>Is there a missing else/default case?</check>
      <check>Is there fall-through in a switch (missing break)?</check>
    </step>

    <step id="T4B-3" name="Verify Loops">
      For each loop (for, while, forEach, map, reduce, recursion):
      <check>What is the iteration count? Is it correct?</check>
      <check>What are the loop variable values at each iteration?</check>
      <check>Is the termination condition correct?</check>
      <check>Is there an off-by-one error in the loop bounds?</check>
      <check>Does the loop modify its own iteration variable or the collection it iterates?</check>
      <check>For recursion: is there a correct base case, and does the recursive case
        make progress toward it?</check>
    </step>

    <step id="T4B-4" name="Verify Function Calls">
      For each function call within the block:
      <check>Is it being called with the correct arguments in the correct ORDER?</check>
      <check>Are there default parameters masking missing arguments?</check>
      <check>Is the return value being captured and used?</check>
      <check>Is an async function being called without await?</check>
      <check>Is a callback being invoked with the correct signature?</check>
    </step>

    <step id="T4B-5" name="Verify Assignments">
      For each assignment:
      <check>Does the right-hand side evaluate to what you expect BEFORE assignment?</check>
      <check>Is the assignment targeting the correct variable (no name shadowing)?</check>
      <check>Is a mutation occurring when a new value was intended (or vice versa)?</check>
      <check>Is there an inadvertent reference copy when a deep copy is needed?</check>
    </step>

    <step id="T4B-6" name="Check Operator Precedence">
      Check operator precedence in every compound expression. Missing or
      misplaced parentheses cause logic bugs that look correct on casual reading.
      When in doubt, add explicit parentheses and test if the behavior changes.
    </step>

    <step id="T4B-7" name="Check Off-by-One Errors">
      Check for off-by-one errors in every index, slice, substring, boundary
      comparison, range, pagination offset, and array length calculation.
      Off-by-one is the most common class of logic error in software.
    </step>

    <step id="T4B-8" name="Check Equality and Type Coercion">
      Check strict versus loose equality. Check type coercion. In JavaScript:
      === versus ==. In Python: is versus ==. Ensure you are checking the right
      value against the right type. "0" == 0 is true in JavaScript. 0 == false
      is true. null == undefined is true. These coercions cause silent bugs.
    </step>

    <step id="T4B-9" name="Check Async/Await and Timing" added_in="v2.0">
      For asynchronous code:
      <check>Is every async operation properly awaited?</check>
      <check>Is a Promise being created but never awaited (fire-and-forget)?</check>
      <check>Is error handling missing from a .catch() or try/catch around await?</check>
      <check>Is there a race condition between concurrent async operations?</check>
      <check>Is state being read after an async gap that might have changed it?</check>
      <check>Is a callback being called multiple times when it should be called once?</check>
      <check>Are event listeners being added multiple times (e.g., on every render)?</check>
    </step>

    <step id="T4B-10" name="Check Null/Undefined Propagation" added_in="v2.0">
      Trace null and undefined through the code path:
      <check>Is optional chaining (?.) hiding a null that should be an error?</check>
      <check>Is nullish coalescing (??) providing a default that masks the real problem?</check>
      <check>Is a function returning undefined implicitly (missing return statement)?</check>
      <check>Is Array.find() returning undefined when no match is found?</check>
      <check>Is Map.get() returning undefined for a missing key?</check>
    </step>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 5: SCOPE AND BLAST RADIUS — Before Implementing Any Fix         -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="5" name="Scope and Blast Radius — Measure Before You Cut">

    <principle>
      Derived from Change Impact Analysis (Bohner &amp; Arnold, 1996; Lehnert, 2011):
      every code change has a blast radius — the transitive closure of all components
      that could be affected. A fix that corrects one defect while introducing another
      is a net negative. Before writing a single character of the fix, map its impact.
    </principle>

    <step id="T5-1" name="State the Fix">
      State the exact change you intend to make. One sentence. If you cannot
      state it in one sentence, you do not yet understand the fix well enough
      to implement it. Go back to the appropriate diagnostic tier.
    </step>

    <step id="T5-2" name="List Modified Files">
      List every file that will be modified by this fix.
    </step>

    <step id="T5-3" name="Map Dependents">
      List every component, function, module, or system that calls, imports, or
      depends on the code you are changing. These are your DEPENDENTS. Use your
      IDE's "find all references" or equivalent.
    </step>

    <step id="T5-4" name="Assess Dependent Impact">
      For each dependent, state whether your change could alter its behavior.
      Consider: changed return values, changed side effects, changed error
      behavior, changed timing, changed data shapes. If yes, that dependent
      MUST be tested after the fix.
    </step>

    <step id="T5-5" name="Define Rollback">
      State the rollback plan if the fix causes a new problem. Can you revert
      the change cleanly? Are there database migrations or state changes that
      make rollback non-trivial? If rollback is complex, plan it before deploying.
    </step>

    <step id="T5-6" name="Check for Root Cause vs. Symptom" added_in="v2.0">
      Apply the Five Whys to your fix:
      <substep>Your fix addresses X. WHY did X happen?</substep>
      <substep>X happened because of Y. WHY did Y happen?</substep>
      <substep>Continue until you reach a systemic cause.</substep>

      If your fix addresses a symptom but not the root cause, the bug WILL return
      in a different form. Decide whether to fix the symptom now (for urgency) AND
      file a follow-up for the root cause, or fix the root cause directly.

      A symptom fix without a root cause follow-up is technical debt with interest.
    </step>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 6: UI-SPECIFIC TRIAGE — Visual and Interaction Failures         -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="6" name="UI-Specific Triage — Visual and Interaction Failures">

    <principle>
      UI bugs have a visual and interactive dimension that requires additional
      diagnostic steps beyond data-flow analysis. Run this tier IN ADDITION to
      the data-flow tiers when the failure manifests visually or interactively.
    </principle>

    <question id="T6-Q1" name="Layout vs. Appearance">
      Is the visual problem in LAYOUT (position, size, spacing, alignment, overflow)
      or in APPEARANCE (color, font, opacity, border, shadow, background)?

      <if_layout>
        Check the display model (flex, grid, block, inline). Check width/height
        constraints. Check margin and padding (inspect computed values, not
        authored values). Check parent constraints that may be limiting the child.
        Check overflow settings. Check for collapsed margins.
      </if_layout>

      <if_appearance>
        Inspect the COMPUTED styles in browser DevTools (not the authored styles).
        Check specificity conflicts. Check whether a style is being overridden by
        a higher-specificity selector, !important, or inline style. Check the
        cascade order. Check media queries for the current viewport. Check
        CSS custom properties (variables) for unexpected values.
      </if_appearance>
    </question>

    <question id="T6-Q2" name="DOM Presence">
      Is the element PRESENT in the DOM but visually wrong, or is it MISSING from
      the DOM entirely?

      <if_present_but_wrong>
        The problem is in CSS or in the props/data feeding the component.
        Inspect computed styles. Check for visibility:hidden, opacity:0,
        display:none, zero dimensions, off-screen positioning, or z-index issues.
      </if_present_but_wrong>

      <if_missing_from_dom>
        The problem is in the RENDER LOGIC. A conditional is preventing it from
        rendering. Find the condition. Check the data the condition depends on.
        Apply TIER 4A to trace that data.
      </if_missing_from_dom>
    </question>

    <question id="T6-Q3" name="Viewport Dependence">
      Does the problem appear at ALL viewport sizes or only at SPECIFIC sizes?

      <if_all_sizes>The problem is in base styles, not responsive rules.</if_all_sizes>

      <if_specific_sizes>
        Check media queries. Check flex-wrap and grid breakpoints. Check whether
        a container has a fixed width causing overflow at smaller sizes. Check
        for content-dependent sizing (long text, large images) that exceeds
        container constraints at certain sizes.
      </if_specific_sizes>
    </question>

    <question id="T6-Q4" name="Data Dependence">
      Does the problem appear with ALL data or only with SPECIFIC data (long text,
      missing image, empty array, null value, special characters, RTL text)?

      <if_all_data>The problem is in the structural CSS or component structure.</if_all_data>

      <if_specific_data>
        The problem is in how the component handles that data edge case. Check
        whether the component has styles or logic for that case. If not, that
        absence IS the bug. Common culprits: missing empty-state handling, text
        overflow not handled, missing image fallbacks, null/undefined not guarded.
      </if_specific_data>
    </question>

    <question id="T6-Q5" name="Interaction States">
      Is the element interactive (button, link, input, dropdown, modal)?
      If yes, test EVERY interaction state systematically:

      <states>
        Default → Hover → Focus → Active → Disabled → Loading → Error →
        Success → Empty → Overflow → Keyboard-only → Screen-reader
      </states>

      Which states are broken? That narrows the bug to the styles or handlers
      for those SPECIFIC states.
    </question>

    <question id="T6-Q6" name="Animation and Transition Issues" added_in="v2.0">
      Does the problem involve animation, transition, or dynamic visual change?

      <if_yes>
        <check>Is the animation triggered by the correct event?</check>
        <check>Is the transition property targeting the correct CSS property?</check>
        <check>Is the animation duration/delay correct?</check>
        <check>Is there a layout thrash (reading layout properties then writing them
          in the same frame)?</check>
        <check>Is will-change or transform being used correctly for GPU acceleration?</check>
        <check>Is requestAnimationFrame being used for JavaScript animations?</check>
        <check>Is the animation janky? Check for main-thread blocking operations.</check>
      </if_yes>
    </question>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 7: DISTRIBUTED SYSTEM TRIAGE — Observability-Driven Debugging   -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="7" name="Distributed System Triage — Observability-Driven Debugging" added_in="v2.0">

    <principle>
      Derived from Observability Engineering (Majors, Fong-Jones &amp; Miranda, 2022)
      and the OpenTelemetry framework (CNCF). In distributed systems, the failure
      may span multiple services, networks, and data stores. Local debugging tools
      are insufficient. Use the three pillars of observability — Metrics, Logs, and
      Traces — correlated via trace context, to locate the failure across the system.
    </principle>

    <step id="T7-1" name="Metrics: Detect the Anomaly">
      Use metrics to answer WHAT is happening:
      <check>What metric anomaly corresponds to the reported failure? (Error rate
        spike, latency increase, throughput drop, resource exhaustion.)</check>
      <check>WHEN did the anomaly start? Correlate with deployments, config changes,
        traffic patterns, or external events.</check>
      <check>WHERE is the anomaly? Which service, endpoint, region, or instance?</check>
      <check>Is the anomaly correlated with another metric? (e.g., increased latency
        correlated with CPU saturation.)</check>
    </step>

    <step id="T7-2" name="Traces: Locate the Failure">
      Use distributed traces to answer WHERE in the request path the failure occurs:
      <check>Find a trace for a failing request using the trace ID.</check>
      <check>Examine the span waterfall: which span shows the error or latency?</check>
      <check>Is the failure in the originating service, a downstream dependency,
        or at a network boundary?</check>
      <check>Compare the failing trace with a healthy trace for the same endpoint.
        What differs?</check>
    </step>

    <step id="T7-3" name="Logs: Explain the Failure">
      Use logs, correlated via trace ID, to answer WHY the failure occurred:
      <check>Find all log entries for the failing trace ID across all services.</check>
      <check>Identify the first error log in the chain.</check>
      <check>Check the log context: request parameters, user ID, feature flags,
        configuration values at the time of failure.</check>
      <check>Look for warnings or info-level logs immediately before the error that
        indicate degraded state leading to failure.</check>
    </step>

    <step id="T7-4" name="Cross-Service Dependency Analysis">
      <check>Map the service dependency chain for the failing request.</check>
      <check>Is the failure caused by a downstream service? Check its health.</check>
      <check>Is the failure caused by a timeout or circuit breaker tripping?</check>
      <check>Is there a version skew between services (API contract mismatch)?</check>
      <check>Is there a data consistency issue between services?</check>
      <check>Is there a network partition, DNS resolution failure, or TLS issue?</check>
    </step>

    <step id="T7-5" name="Infrastructure and Environment Layer">
      <check>Check resource utilization: CPU, memory, disk, network I/O, file descriptors.</check>
      <check>Check for container/pod restarts (OOMKilled, CrashLoopBackOff).</check>
      <check>Check for infrastructure events: node failures, scaling events,
        deployment rollouts, certificate expirations.</check>
      <check>Check for database issues: connection pool exhaustion, lock contention,
        slow queries, replication lag.</check>
    </step>

    <step id="T7-6" name="Statistical Debugging for Intermittent Failures" added_in="v2.1">
      For failures that are intermittent or non-deterministic, apply statistical
      debugging principles (Liblit et al., 2005):
      <check>Collect data from BOTH failing and succeeding executions — not just
        failing ones. Comparison is the key to statistical debugging.</check>
      <check>Identify predicates (conditions) that are significantly more often true
        in failing runs than in succeeding runs. These are failure predictors.</check>
      <check>Calculate the Increase metric: does this condition being true INCREASE
        the failure probability beyond it merely being observed? This separates
        causally relevant predicates from merely correlated ones.</check>
      <check>If the failure is production-only and non-reproducible locally, correlate
        error rates with: specific user cohorts, geographic regions, device types,
        feature flags, deployment canaries, or request parameters. The statistical
        difference between the affected and unaffected populations reveals the cause.</check>
    </step>

    <step id="T7-7" name="Chaos Engineering Informed Analysis" added_in="v2.1">
      Apply chaos engineering principles (Rosenthal et al., 2016) to understand
      whether the failure represents a latent resilience gap:
      <check>Is the system exhibiting EXPECTED behavior under failure conditions, or
        has an UNEXPECTED failure mode surfaced? (Known vs. unknown category.)</check>
      <check>Did the system's circuit breakers, retries, fallbacks, and bulkheads
        behave as designed? If not, the bug may be in the fault-tolerance layer
        rather than the business logic.</check>
      <check>Is this a cascading failure? One service failure triggering failures
        across dependent services indicates missing blast radius containment.</check>
      <check>After the fix: would this failure be caught by a chaos experiment?
        If so, recommend adding one to the continuous chaos testing suite to
        prevent regression of the resilience property.</check>
    </step>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TIER 8: VERIFICATION AND POSTMORTEM — Prove the Fix, Prevent Return  -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

  <tier id="8" name="Verification and Postmortem — Prove It, Then Prevent It" added_in="v2.0">

    <principle>
      Derived from Google SRE Postmortem Culture (2017), IEEE Verification and
      Validation standards, and the FMEA corrective action process. A fix that is
      not verified may not actually fix the problem. A fix without a postmortem
      will be needed again. This tier ensures the fix is proven correct and the
      systemic cause is addressed.
    </principle>

    <step id="T8-1" name="Verify the Fix">
      <substep>Reproduce the original failure using the exact reproduction steps
        from TIER 1. Confirm the failure occurs WITHOUT the fix.</substep>
      <substep>Apply the fix. Confirm the failure NO LONGER occurs.</substep>
      <substep>This is the minimum proof. "It seems to work now" is not verification.
        The exact reproduction case must pass.</substep>
    </step>

    <step id="T8-2" name="Verify No Regressions">
      <substep>Run all existing tests. Any new failures indicate regressions.</substep>
      <substep>Manually test the dependents identified in TIER 5, step T5-4.</substep>
      <substep>Test edge cases near the fix: empty inputs, null values, boundary
        values, concurrent access, error conditions.</substep>
    </step>

    <step id="T8-3" name="Write a Regression Test">
      Write an automated test that:
      <substep>Reproduces the exact failure condition that existed before the fix.</substep>
      <substep>Asserts the correct behavior after the fix.</substep>
      <substep>This test must FAIL without the fix and PASS with the fix. If it
        passes without the fix, it does not actually test the bug.</substep>
    </step>

    <step id="T8-4" name="Conduct the Postmortem (Five Whys)">
      Document the following (adapted from Google SRE postmortem template):

      <postmortem_template>
        <field name="Summary">One-paragraph description of the defect and its impact.</field>
        <field name="Timeline">Chronological sequence: when introduced, when detected,
          when diagnosed, when fixed, when deployed.</field>
        <field name="Root Cause">Result of Five Whys analysis. Not the proximate cause
          (the wrong value) but the systemic cause (why the system allowed the wrong
          value to propagate).</field>
        <field name="Resolution">The exact fix applied and why it is correct.</field>
        <field name="Impact">Users affected, duration, data impact, revenue impact.</field>
        <field name="What Went Well">What detection, processes, or tools worked correctly.</field>
        <field name="What Went Poorly">What detection, processes, or tools failed or
          were missing. What made diagnosis harder than it should have been.</field>
        <field name="Action Items">Concrete, assigned, time-bound actions to prevent
          recurrence. Not "be more careful" — systemic changes: better tests, better
          monitoring, better validation, better documentation, better tooling.</field>
        <field name="Lessons Learned">What this defect teaches about the system's
          weaknesses. What patterns should be watched for in the future.</field>
      </postmortem_template>
    </step>

    <step id="T8-5" name="Classify and Catalog">
      Add the defect to the team's defect catalog with:
      <substep>SFMEA failure mode category (from T2-Q3).</substep>
      <substep>Root cause pattern (so future similar defects are found faster).</substep>
      <substep>Detection method that should have caught it earlier.</substep>
      <substep>Prevention method that should have prevented it entirely.</substep>
    </step>

  </tier>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  TRIAGE TERMINATION CRITERIA                                          -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<termination_criteria>
<principle>
Before proposing ANY fix, you must be able to state ALL FIVE of the following.
This is the Definition of Done for diagnosis. If you cannot state all five,
you are not done triaging. Continue investigating. Do not guess. Do not
propose a "probable" fix. Certainty first, then action.
</principle>

    <criterion id="1" name="Location">
      The EXACT location of the bug: file, function, line number.
    </criterion>

    <criterion id="2" name="Mechanism">
      The EXACT mechanism of the failure: what is happening at that location
      that produces the wrong result.
    </criterion>

    <criterion id="3" name="Cause">
      The EXACT reason it is happening: why the code at that location behaves
      this way (the root cause, not just the proximate cause).
    </criterion>

    <criterion id="4" name="Scope">
      The EXACT scope of the fix: what needs to change and what MUST NOT change.
      Including the blast radius assessment from TIER 5.
    </criterion>

    <criterion id="5" name="Verification">
      The EXACT verification method: how to prove the fix works and nothing
      else broke. Including the specific test from TIER 8.
    </criterion>

</termination_criteria>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  EXECUTION ORDER SUMMARY                                              -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<execution_order>
Execute tiers in this exact sequence. Each tier builds on the previous.

    TIER 0: COGNITIVE PREPARATION — Acknowledge and counteract biases before
    they derail investigation. 30 seconds that save hours.

    TIER 1: REPRODUCE — Establish deterministic, minimal reproduction. If you
    cannot reproduce, you cannot diagnose. Stop and establish reproduction first.

    TIER 2: CLASSIFY — Determine the failure type (explicit error vs. silent),
    temporal context (regression vs. new), and SFMEA failure mode category.
    This selects the correct diagnostic path.

    TIER 3A/3B: LOCALIZE — Follow the error trace (3A) or behavioral comparison
    (3B) to narrow the investigation zone to the smallest possible scope.

    TIER 4A/4B: DIAGNOSE — Trace wrong values to their source (4A) or analyze
    logic for defects (4B) within the narrowed scope. Identify the exact defect.

    TIER 5: SCOPE THE FIX — Map the blast radius before writing any code.
    Apply the Five Whys to ensure you fix the root cause, not just the symptom.

    TIER 6: UI-SPECIFIC TRIAGE — Run in addition to the above when the failure
    is visual or interactive.

    TIER 7: DISTRIBUTED SYSTEM TRIAGE — Run when the failure spans multiple
    services. Use metrics, traces, and logs correlated via trace context.

    TIER 8: VERIFY AND POSTMORTEM — Prove the fix, verify no regressions,
    write a regression test, and document the postmortem to prevent recurrence.

    TERMINATION: State all five termination criteria before proposing a fix.
    If any criterion cannot be stated, you are not done. Continue investigating.

</execution_order>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  ANTI-PATTERNS — Common Debugging Mistakes to Avoid                   -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->

<anti_patterns added_in="v2.0">

    <anti_pattern name="Shotgun Debugging">
      Making random changes and testing if the bug goes away. This wastes time,
      introduces new bugs, and provides no understanding of the root cause.
      If you are changing code without a hypothesis about WHY the change will fix
      the problem, you are shotgun debugging. Stop. Go back to diagnosis.
    </anti_pattern>

    <anti_pattern name="Debugging by Superstition">
      "The last time something like this happened, the fix was X." Past correlation
      is not present causation. Diagnose the CURRENT bug from evidence, not memory.
      This is availability bias in action.
    </anti_pattern>

    <anti_pattern name="Debugging by Blame">
      "It must be a bug in [framework/library/browser/OS]." While third-party bugs
      exist, they are far rarer than bugs in your own code. Assume the bug is in
      YOUR code until you have conclusive evidence otherwise. If you suspect a
      third-party bug, write a minimal reproduction that uses ONLY the third-party
      code with no application logic. If it fails, file a bug report with
      the reproduction case. If it passes, the bug is yours.
    </anti_pattern>

    <anti_pattern name="Premature Fix">
      Applying a fix before completing diagnosis. "I think I see the problem"
      is not the same as "I have diagnosed the problem." Complete the triage.
      The time spent completing diagnosis is always less than the time spent
      debugging a wrong fix and its regressions.
    </anti_pattern>

    <anti_pattern name="Fix the Symptom, Ignore the Disease">
      Adding a null check to suppress a TypeError without asking WHY the value
      is null. Adding a try/catch to silence an exception without asking WHY the
      exception occurs. Increasing a timeout without asking WHY the operation is
      slow. These are band-aids. They mask the real problem, which will resurface.
    </anti_pattern>

    <anti_pattern name="Debugging in Production Without Safety Nets" added_in="v2.0">
      Making changes directly in production without feature flags, rollback plans,
      or canary deployments. Every production fix should be reversible within minutes.
    </anti_pattern>

</anti_patterns>

</diagnostic_triage_engine>

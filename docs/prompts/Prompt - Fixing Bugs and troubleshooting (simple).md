DIAGNOSTIC TRIAGE ENGINE
Run this sequence on every problem before applying any fix. Each question eliminates categories of causes and narrows the search space. Do not skip questions. Do not jump ahead. The order matters.

TIER 1: REPRODUCE OR STOP

T1-Q1: Can you reproduce the failure right now on demand?
If NO: Do not proceed. Your only job is to establish reproduction steps. Ask the user for exact steps, exact input, exact environment. If the user cannot provide them, propose building a logging or monitoring MCP server to capture the failure when it next occurs. You cannot diagnose what you cannot observe. Full stop.
If YES: Continue to T1-Q2.

T1-Q2: Can you reproduce it in an isolated environment (single component, single function, single request)?
If NO: The problem involves interaction between components. Continue to TIER 2 with the assumption that the bug is in an integration point, shared state, or dependency chain.
If YES: The problem is local. Continue to TIER 2 with the assumption that the bug is contained within the isolated unit.

TIER 2: CLASSIFY THE FAILURE

T2-Q1: Is the failure an explicit error (error message, exception, crash, red console output) or silent wrong behavior (no error but incorrect output, wrong visual, missing data)?
If EXPLICIT ERROR: Go to TIER 3A (Error Trace Path).
If SILENT WRONG BEHAVIOR: Go to TIER 3B (Behavioral Comparison Path).
If BOTH: Handle the explicit error first. Silent wrong behavior may resolve once the error is fixed. If it persists after, handle it as a separate diagnosis.

T2-Q2: Is this a regression (it used to work and stopped) or a new implementation (it never worked)?
If REGRESSION: The cause is in whatever changed. Find the diff between working and broken states. Check recent commits, dependency updates, config changes, environment changes, data changes. The answer is almost always in the delta. Apply BAS-2.
If NEW IMPLEMENTATION: The cause is in the new code. Do not look at old code unless the new code depends on it. Start reading from the entry point of the new feature and trace forward.

TIER 3A: ERROR TRACE PATH (explicit errors)

T3A-STEP1: Read the full error message and full stack trace. Not a summary. Every line.
T3A-STEP2: Identify the exact file and line number where the error originates. This is the primary investigation point.
T3A-STEP3: Identify the call chain that led to that line. What called the function that errored? What called that? Trace back 3 levels minimum.
T3A-STEP4: At the error line, check the values of every variable involved. Are any null, undefined, NaN, empty string, wrong type, or wrong shape?
If YES: The bug is upstream. Something that should have provided a valid value did not. Trace that value backward to where it was supposed to be set. Go to TIER 4A (Value Trace).
If NO (all values are valid but the error still occurs): The bug is in the logic at this line. The operation being performed is wrong for the given inputs. Go to TIER 4B (Logic Analysis).

T3A-STEP5: Check if this error appears anywhere else in the codebase. Search for the same error message string. If it appears in multiple places, determine which instance is actually firing.

TIER 3B: BEHAVIORAL COMPARISON PATH (silent wrong behavior)

T3B-STEP1: Define the exact expected output in concrete terms. Not "it should work" but the exact value, exact visual, exact state.
T3B-STEP2: Capture the exact actual output in the same terms.
T3B-STEP3: Describe the specific difference between expected and actual. This difference is the symptom you are tracing.
T3B-STEP4: Identify the last point in the data or render pipeline where the value or visual is still correct.
T3B-STEP5: Identify the first point in the pipeline where it becomes incorrect.
T3B-STEP6: The bug is between those two points. This is now your investigation zone. Go to TIER 4B (Logic Analysis) scoped to only this zone.

TIER 4A: VALUE TRACE (a variable has a wrong or missing value)

T4A-STEP1: Identify where this variable gets its value. Is it from props? State? A function return? An API response? A computation? User input?
T4A-STEP2: Check that source.
If FROM PROPS: Check the parent component. Is it passing this prop? Is it passing the right value? Is the prop name spelled correctly? Is it the right type?
If FROM STATE: Check what sets this state. Find every setState or dispatch call for this state variable. Is one of them setting it to the wrong value? Is none of them setting it when they should be?
If FROM A FUNCTION: Call that function with the same inputs manually. Does it return the expected value? If not, the bug is inside that function. Recurse into it and restart T4A from inside that function.
If FROM AN API: Log the raw API response before any transformation. Is the API returning what you expect? If not, the problem is external or in the request. If yes, the problem is in how you process the response.
If FROM A COMPUTATION: Check every input to the computation. Are they all correct? If yes, the computation logic is wrong. If any are wrong, trace that wrong input (recurse T4A).
If FROM USER INPUT: Check whether the input is being captured correctly. Check the event handler. Check whether the value is being stored correctly. Check whether it is being read correctly later.

TIER 4B: LOGIC ANALYSIS (code is executing with correct inputs but producing wrong output)

T4B-STEP1: Read the code block in question. Do not skim. Read every line.
T4B-STEP2: For each conditional (if, ternary, switch), verify which branch is being taken and whether it is the correct branch for the given inputs.
T4B-STEP3: For each loop, verify the iteration count, the loop variable values at each iteration, and whether the termination condition is correct.
T4B-STEP4: For each function call within the block, verify it is being called with the correct arguments in the correct order.
T4B-STEP5: For each assignment, verify the right side evaluates to what you expect before it is assigned.
T4B-STEP6: Check operator precedence. Parentheses that are missing or in the wrong place cause logic bugs that look correct on casual reading.
T4B-STEP7: Check for off-by-one errors in any index, slice, substring, or boundary comparison.
T4B-STEP8: Check for strict versus loose equality. Triple equals versus double equals. Checking the right thing against the right type.

TIER 5: SCOPE AND BLAST RADIUS (before implementing any fix)

T5-STEP1: State the exact change you intend to make. One sentence.
T5-STEP2: List every file that will be modified.
T5-STEP3: List every component or function that calls or depends on the code you are changing.
T5-STEP4: For each dependent, state whether your change could alter its behavior. If yes, you must test that dependent after the fix.
T5-STEP5: State what the rollback is if the fix causes a new problem.

TIER 6: UI-SPECIFIC TRIAGE (run this in addition to the above when the failure is visual)

T6-Q1: Is the visual problem in layout (position, size, spacing) or in appearance (color, font, opacity, border)?
If LAYOUT: Check the display model (flex, grid, block). Check width and height constraints. Check margin and padding. Check parent constraints that may be limiting the child. Check overflow settings.
If APPEARANCE: Check applied styles in the browser inspector. Check specificity conflicts. Check whether a style is being overridden by a higher-specificity rule or !important. Check media queries for the current viewport.

T6-Q2: Is the element present in the DOM but visually wrong, or is it missing from the DOM entirely?
If PRESENT BUT WRONG: The problem is in CSS or in the props or data feeding the component. Inspect computed styles.
If MISSING FROM DOM: The problem is in the render logic. A conditional is preventing it from rendering. Check the condition. Check the data the condition depends on. Apply TIER 4A to trace the data.

T6-Q3: Does the problem appear at all viewport sizes or only at specific sizes?
If ALL SIZES: The problem is in the base styles, not in responsive rules.
If SPECIFIC SIZES: Check media queries. Check flex-wrap and grid breakpoints. Check whether a container has a fixed width that causes overflow at smaller sizes.

T6-Q4: Does the problem appear with all data or only with specific data (long text, missing image, empty array, null value)?
If ALL DATA: The problem is in the structural CSS or component structure.
If SPECIFIC DATA: The problem is in how the component handles that data case. Check whether the component has styles or logic for that edge case. If not, that is the bug.

T6-Q5: Is the element interactive (button, link, input, dropdown)? If yes, test every interaction state: default, hover, focus, active, disabled, loading, error. Which states are broken? That narrows the bug to the styles or handlers for those specific states.

TRIAGE TERMINATION

When you have completed the relevant tiers, you should be able to state all of the following before proposing any fix:
The exact location of the bug (file, function, line).
The exact mechanism of the failure (what is happening at that location).
The exact reason it is happening (why the code at that location produces the wrong result).
The exact scope of the fix (what needs to change and what must not change).
The exact verification (how to prove the fix works and nothing else broke).

If you cannot state all five, you are not done triaging. Continue investigating until you can. Do not guess. Do not propose a probable fix. Certainty first.

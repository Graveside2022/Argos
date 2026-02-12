DIAGNOSTIC RULES

OBSERVATION
OBS-1: Count the errors before fixing any of them.
OBS-2: If you cannot see the failure happening, build visibility first. Logs, traces, output captures. Eyes before hands.
OBS-3: The displayed error is a symptom. The cause is deeper. Always go deeper.
OBS-4: Intermittent failure means an unidentified trigger condition. Find the condition.
OBS-5: No error message does not mean no error. Verify the output is correct, not just that it exists.
OBS-6: If the system produces output, check whether the output is right, not just whether output was produced.
OBS-7: Read the actual error. Do not skim it. Parse every word. The fix is often literal in the message.
OBS-8: Check types, check nulls, check empty strings, check undefined. These cause more failures than wrong logic.
OBS-9: Log the state before the failure point and after. The discrepancy is the clue.
OBS-10: If you added logging and the bug disappears, the bug is timing-related.

BASELINE
BAS-1: Define the exact expected behavior before diagnosing deviations from it.
BAS-2: Identify what changed between the last working state and the current broken state. The answer is in the diff.
BAS-3: If you cannot reproduce the bug on demand, you cannot confirm you fixed it. Reproduce first.
BAS-4: When multiple changes preceded a failure, revert all and reapply one at a time to isolate the cause.
BAS-5: Compare input, transformation, state, side effects, and output. The bug can be at any layer.
BAS-6: If no baseline exists, create one before proceeding. Screenshot it, log it, save it.
BAS-7: Check the data, not just the code. Correct code operating on bad data produces bad results.
BAS-8: Check the environment. Same code behaves differently in different environments. Confirm versions, configs, and runtime.

PRIORITY
PRI-1: Structural fixes before cosmetic fixes.
PRI-2: Fix the thing that unblocks the most other things first.
PRI-3: If the problem is architectural, component-level fixes will not hold. Identify which type you are dealing with.
PRI-4: Before optimizing something, ask if it should exist at all.
PRI-5: Solve the current problem. Do not preemptively solve hypothetical future problems unless they directly block this fix.
PRI-6: If multiple bugs exist, classify each as blocker, degraded, or cosmetic. Fix in that order.
PRI-7: A broken dependency outranks a broken feature. Check dependencies first.
PRI-8: If the user cannot proceed at all, that bug is priority one regardless of what else is wrong.

DECOMPOSITION
DEC-1: If the problem feels complex, you have not broken it down enough. Decompose further.
DEC-2: Isolate which component owns the failure before reading code. Test components independently.
DEC-3: If everything is broken, find one thing that works and trace outward from there.
DEC-4: If forward tracing fails, work backward from the broken output to where the correct value became incorrect.
DEC-5: Test the smallest possible unit. Full system tests say something is wrong. Unit tests say where.
DEC-6: One fix per commit. One change per test. Never change two things and test once.
DEC-7: Separate what you know from what you think. Put them in two different lists.
DEC-8: If a function does more than one thing, test each thing it does separately.
DEC-9: Remove components until the problem disappears. The last thing you removed is the lead.
DEC-10: If you cannot explain the problem in one sentence, you have not isolated it yet.

ASSUMPTIONS
ASM-1: List your assumptions explicitly before every diagnosis. The bug hides behind the assumption you did not list.
ASM-2: Do not trust comments, variable names, or documentation. Trust execution output.
ASM-3: Your first instinct is the most common cause, not necessarily the actual cause. Verify before committing.
ASM-4: If the fix did not work, the diagnosis was wrong. Do not stack a second fix. Rediagnose.
ASM-5: If the same class of bug keeps appearing, the real problem is structural, not the individual bug.
ASM-6: "It worked on my machine" means the environments differ. Find the difference.
ASM-7: Do not assume a library or framework is behaving correctly. Verify its behavior independently.
ASM-8: Do not assume the user's description is technically precise. Confirm what they mean by every ambiguous term.
ASM-9: "It was working yesterday" means something changed. Find what changed.
ASM-10: If you are sure you are right and the output says otherwise, the output is right and you are wrong.

DEPENDENCIES
DEP-1: Before changing anything, identify everything that depends on it.
DEP-2: Many bugs are correct logic in the wrong order. Check sequence and timing.
DEP-3: Shared state between components is a primary bug habitat. Examine it early.
DEP-4: If the problem involves an external dependency you do not control, build a resilient handler instead of debugging their code.
DEP-5: Check version compatibility between every dependency. Mismatched versions cause silent failures.
DEP-6: If a dependency was updated recently, that update is a suspect.
DEP-7: Circular dependencies cause unpredictable initialization order. Check for them.
DEP-8: If a function's behavior depends on global state, that global state is part of the bug investigation.
DEP-9: Async operations that depend on each other without explicit ordering will eventually fail. Check for race conditions.
DEP-10: An API that returned the right data last week might return different data today. Validate external inputs.

VERIFICATION
VER-1: Every fix must have a corresponding test that proves it works.
VER-2: After fixing, test what the fix might have broken. Regression is the cost of every change.
VER-3: One successful run does not mean it works. Test with bad input, missing input, boundary input, and load.
VER-4: If you are not certain the fix works, it does not count as fixed.
VER-5: Done is when the user confirms it matches their expected outcome, not when you think it should work.
VER-6: If the test passes but the user says it is wrong, the test is wrong, not the user.
VER-7: Test the error path, not just the happy path. Most bugs live in error handling.
VER-8: Check what happens when the input is null. Check what happens when the input is empty. Check what happens when the input is the wrong type. These three checks catch the majority of runtime errors.
VER-9: After fixing a bug, search the codebase for the same pattern elsewhere. The same mistake was likely made more than once.
VER-10: If you cannot write a test for it, you do not understand it well enough to fix it.

CAUSATION
CAU-1: Correlation is not causation. Two things happening at the same time does not mean one caused the other. Prove the causal link.
CAU-2: Ask why five times. Each answer must be a genuinely deeper layer, not a restatement.
CAU-3: If the root cause is "the code is wrong," you have not gone deep enough. Why is the code wrong. What allowed wrong code to exist here.
CAU-4: Fixing a symptom guarantees the symptom will return. Fixing the cause guarantees it will not.
CAU-5: If the same fix keeps being needed, the first fix was addressing a symptom, not the cause.
CAU-6: When two possible causes exist, design a test that confirms one and eliminates the other. Do not guess.
CAU-7: Every effect has a cause that precedes it in time. Find the earliest point where behavior deviates from expected.
CAU-8: If the cause is unclear, reduce the system to the simplest case that still exhibits the failure. Remove everything else.
CAU-9: "It just started happening" means a change was made that you have not identified yet. Nothing changes without cause.
CAU-10: If you cannot explain why the fix works, you do not understand the problem. A correct fix applied without understanding is a time bomb.

SCOPE
SCP-1: Define what you are fixing and what you are not fixing before starting.
SCP-2: If the fix is growing larger than planned, stop and reassess with the user.
SCP-3: Do not fix things that are not broken. Do not improve things you were not asked to improve.
SCP-4: Adjacent problems are separate problems. Log them, do not merge them into the current fix.
SCP-5: If you changed something outside the agreed scope, undo it and ask first.
SCP-6: Every line of code you write must trace back to a specific requirement from the user. If it does not, it does not belong.
SCP-7: "While I was in there, I also" is how regressions are born. Stay in scope.
SCP-8: Refactoring is not fixing. They are separate activities requiring separate approval.

COMMUNICATION
COM-1: If you are confused, say so immediately. Hidden confusion becomes compounding error.
COM-2: State why before what. The reasoning matters more than the action.
COM-3: When wrong, identify how far back the error reaches and redo from there. Do not patch forward.
COM-4: Show your reasoning. Unexplained conclusions cannot be evaluated or challenged.
COM-5: Ask the question you are avoiding. If the answer might invalidate your approach, that is the most important question right now.
COM-6: Do not present options you have not evaluated. If you list three approaches, state the tradeoffs of each.
COM-7: If the user says "that is not what I meant," your understanding was wrong. Do not explain why your interpretation was reasonable. Just get the right understanding.
COM-8: State what you do not know with the same confidence you state what you do know.

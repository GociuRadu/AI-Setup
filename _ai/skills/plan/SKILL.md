---
name: plan
description: "Use for plan this, design, how should we build X, compare options, or before a large task (3+ files, schema, migration, auth, shared interfaces, several steps). Writes a plan file the work then follows."
argument-hint: "<goal or feature>"
---
# Plan

A plan is cheap to fix; code built on a wrong plan is not. Keep it to one screen.

1. Read what the goal touches: code, `project.md`, `context.md`, `memory.md` decisions. Unknowns across many files or the web: one `scout` per question, in parallel.
2. Write `<project>/docs/ai/plans/YYYY-MM-DD-<topic>.md`:
   ```
   # Plan: <topic>
   | Date | Status | Owner |
   |---|---|---|

   **Goal:** <one sentence>
   **Done when:** <observable checks: a test passes, a count matches, a command output>

   ## Context
   <3-6 bullets: current state and constraints, with path:line>

   ## Options (only when there is a real choice)
   | Option | Pros | Cons | Cost / risk |
   |---|---|---|---|

   **Choice:** <option and why, one line>

   ## Steps
   | # | Step | Files | Check | Status |
   |---|---|---|---|---|

   ## Risks
   | Risk | Effect | Mitigation / rollback |
   |---|---|---|

   ## Challenge (only after challenger)
   | Objection | Answer | Status |
   |---|---|---|

   ## Open questions
   | Question | Recommended answer |
   |---|---|
   ```
3. Risky plans (data, schema, auth, shared interfaces): run the `reviewer` agent on the plan file with its Done when; fix Must fix items first. Re-review once at most; still open: move it to Open questions.
4. Real Options with an expensive Choice (data model, public interface, migration, architecture, deleting features): run `challenger` once on the plan path. Answer each objection once in the Challenge table: `accepted` (change the plan) or `rejected` (one line of evidence). Still disputed: move it to Open questions. No second round.
5. Ask only open questions that change the design, each with a recommended answer. Reply: 1-2 line summary, then numbered steps, linking the plan file. Plan-only request: stop here; otherwise run the steps through the [task loop](../delegate/SKILL.md#task-loop) and link the active plan from `context.md`.

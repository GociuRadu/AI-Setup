---
name: pplan
description: "Plans before building: asks the user the questions that change the design (grill-me), researches the options, and writes one plan file the work then follows. Use for plan this, design, how should we build X, compare options, choose an architecture, stack or pattern, or before a large task (3+ files, schema, migration, auth, shared interfaces, several steps)."
argument-hint: "<goal or feature>"
---
# Plan

A plan is cheap to fix; code built on a wrong plan is not. Keep it to one screen. No code before the user says go.

1. **Read** what the goal touches: code, `project.md`, `context.md`, `memory.md` decisions; skip `superseded` rows; one whose review date passed or trigger is met goes to Open questions (re-confirm or supersede) before the plan builds on it.
2. **Grill the user** before planning: ask the questions whose answers change the design (goal, users and volume, constraints, what must not change, what done looks like), a few at a time, each with your recommended answer. Stop asking once the answers stop changing the plan.
3. **Research** each real choice (architecture, stack, data model, pattern): one `researcher` per question, in parallel. List only options used in industry today, favouring current, widely adopted standards, each with its source and year. Judge them first by whether they cap what stronger future models can do, then by price, context and speed.
4. **Write** `<project>/docs/ai/plans/YYYY-MM-DD-<topic>.md`:
   ```
   # Plan: <topic>
   | Date | Status | Owner |
   |---|---|---|

   **Goal:** <one sentence>
   **Done when:** <observable checks: a test passes, a count matches, a command output>

   ## Context
   <3-6 bullets: current state and constraints, with path:line>

   ## Options (only when there is a real choice)
   | Option | Used by (source, year) | Pros | Cons | Cost / risk |
   |---|---|---|---|---|

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
5. **Risky plans** (data, schema, auth, shared interfaces): run `reviewer` on the plan file with its Done when; fix Must fix items first. Re-review once at most; still open: move it to Open questions.
6. **Costly choice** (data model, public interface, migration, architecture, deleting features): run `challenger` once on the plan path; for a major decision or when the user asks, use the `debate` skill instead. Answer each objection once in the Challenge table: `accepted` (change the plan) or `rejected` (one line of evidence). Still disputed: Open questions.
7. **Gate:** present one decision at a time, as to a solution architect: the options, trade-offs and one recommendation. Reply with a 1-2 line summary, numbered steps and the plan link, and stop for approval. Once the user says go, link the plan in `context.md` and run the steps.

## Running the steps
For each step: make the change; run its Check (`tester` for suites or long output; red: fix and rerun, each round needs a new fact); risky step: `reviewer` on the change, Must fix goes back to the Check; set Status to done from the real check output, never from a helper's summary. Repeat until every Done when check passes.

---
name: bug
description: "Use proactively, before reading code, whenever the user reports that something is wrong: a wrong result or number, \"shows X but should be Y\", an exception, a failing test or load, duplicates, NULL keys, wrong downstream documents. Proves the cause, proposes or applies the fix as the steps allow, adds a regression test and records the bug in memory.md. Not for test runs without a reported symptom."
argument-hint: "<symptom, error, or affected artifact>"
user-invocable: true
---

# Bug

Prove the cause before choosing the fix. Never authorizes connected writes, writer reruns, Git or production repair.

1. Read the project entrypoint's sections, the relevant `memory.md` bugs and any known-issues list or runbook `project.md` links.
2. Pin down symptom, expected result, artifact, window and environment (unknown = PRODUCTION).
3. PRODUCTION with bad data still flowing: propose containment as a user-run step (pause trigger, stop job) with impact and rollback. Never execute it.
4. Reproduce with the smallest side-effect-free case: a pure function or mocked unit test, a supplied log, synthetic data.
5. Wrong data: compare counts across stages, key uniqueness, NULL keys, casts, join fan-out. Queries go to the user (SQL request format, global rules) with placeholders for customer values. No PROD queries; ask for logs or audit counts instead.
6. State the best hypothesis, its code path and one cheap discriminating check. After two failed hypotheses, re-check the symptom and input.
7. Once proven, show Root cause, Evidence, minimal Fix, Data repair (or none), Risk. Apply the fix only if the user asked for a fix and the project does not mark the item as needing owner confirmation; otherwise propose it and stop.
8. Add one regression test that fails without the fix (code bugs). Run the focused local check. Data repair is a separate user-run handoff; real-run evidence is "not run" until the user returns it.
9. Add one row to the Bugs table in the project's `docs/ai/memory.md`: date, symptom, cause, fix/status. If the project keeps a known-issues catalog (named in `project.md`), follow its rule instead (e.g. row only when fixed). No code bodies or customer data. If blocked, say so.
10. Production incident or wrong data sent downstream: also write `docs/ai/reports/YYYY-MM-DD-bug-<topic>.md` from the [incident template](templates/bug.md); reply with path and one-line summary.

Dropping bad rows or catch-all handling is a workaround, not a root-cause fix: label it and keep the item open.

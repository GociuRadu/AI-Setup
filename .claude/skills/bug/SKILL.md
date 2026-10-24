---
name: bug
description: "Prove and fix code or data defects: exceptions, wrong counts, duplicates, NULL keys, failed loads, wrong downstream documents. Use /bug, a concrete failure report, or a request to investigate broken behavior."
argument-hint: "<symptom, error, or affected artifact>"
user-invocable: true
---

# Bug

Prove the cause before choosing the fix. Local and DEV work runs without asking; production repair is a hard stop (global rules).

1. Read the project entrypoint's sections, the relevant `memory.md` bugs and any known-issues list or runbook `project.md` links.
2. Pin down symptom, expected result, artifact, window and environment (unknown = PRODUCTION).
3. PRODUCTION with bad data still flowing: propose containment (pause trigger, stop job) with impact and rollback; execute it only if the user asks.
4. Reproduce with the smallest side-effect-free case: a pure function or mocked unit test, a supplied log, synthetic data.
5. Wrong data: compare counts across stages, key uniqueness, NULL keys, casts, join fan-out. Run the queries yourself on local/DEV; output counts and masked values only. No PROD queries; ask for logs or audit counts instead.
6. State the best hypothesis, its code path and one cheap discriminating check. After two failed hypotheses, re-check the symptom and input.
7. Once proven, show Root cause, Evidence, minimal Fix, Data repair (or none), Risk. Apply the fix unless the project marks the item as needing owner confirmation; then propose it and stop.
8. Run the focused local check. Data repair on local/DEV: run it with a rollback ready; production repair is a hard stop and stays "not run".
9. Add one row to the Bugs table in the project's `docs/ai/memory.md`: date, symptom, cause, fix/status. If the project keeps a known-issues catalog (named in `project.md`), follow its rule instead (e.g. row only when fixed). No code bodies or customer data. If blocked, say so.
10. Production incident or wrong data sent downstream: also write `docs/ai/reports/YYYY-MM-DD-bug-<topic>.md` from the [incident template](templates/bug.md); reply with path and one-line summary.

Dropping bad rows or catch-all handling is a workaround, not a root-cause fix: label it and keep the item open.

---
name: bug
description: "Use proactively, before reading code, whenever the user reports that something is wrong: a wrong result or number, \"shows X but should be Y\", an exception, a failing test or load, duplicates, NULL keys, wrong downstream documents. Proves the cause and saves a bug report; implements the fix only when requested. Not for test runs without a reported symptom."
argument-hint: "<symptom, error, or affected artifact>"
user-invocable: true
---

# Bug

Prove the cause, then report. Diagnosis-only requests change no code. If the same request asks for a fix, continue with the smallest fix and focused validation in the same turn, as the profile allows.

1. Read what the project entrypoint names, the relevant `memory.md` bugs and any known-issues list or runbook `project.md` links.
2. Pin down symptom, expected result, artifact, window and environment.
3. PRODUCTION with bad data still flowing: propose containment (pause trigger, stop job) with impact and rollback first.
4. Reproduce with the smallest side-effect-free case within project guardrails and the profile: a scratch script or temporary test you do not keep, a supplied log, synthetic data. If execution is not allowed, trace statically and draft the check for the user.
5. Wrong data: compare counts across stages, key uniqueness, NULL keys, casts, join fan-out. Run the queries as the profile allows, otherwise draft them for the user; counts and masked values only.
6. State the best hypothesis, its code path and one cheap discriminating check. After two failed hypotheses, re-check the symptom and input.
7. Save `docs/ai/reports/YYYY-MM-DD-bug-<topic>.md` from the [template](templates/bug.md): root cause (or explicitly unproven), evidence, minimal fix, a regression test that would fail without the fix, data repair (or none), risk.
8. If a fix was requested, read the [ponytail](../ponytail/SKILL.md) skill, implement the smallest root-cause fix, run the focused check as the profile allows, and update the report with the result. Reply: report path, one-line root cause, proposed or completed fix, what was not checked.

Dropping bad rows or catch-all handling is a workaround, not a root-cause fix: label it as such in the report.

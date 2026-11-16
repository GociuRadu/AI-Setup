---
name: review
description: "Use to look at what exists, in one of 3 modes: review (review this, code review, PR, audit a folder, security check, find bloat), bug (wrong number or result, exception, failing test or load, duplicates, NULL keys) or analyze (explain, analyze, document a file, flow, folder or technical question). Answers in chat first; writes a short, scannable HTML report with diagrams."
---
<!-- Generated from _ai/skills/review/SKILL.md by node _ai/sync.mjs; edit the source. -->
# Review

Look at what exists, prove it, show it so it scans in seconds. Change nothing unless asked (a fix request in the same message counts).

## Pick the mode
Named in the request, else from the words; unclear: `review`.

| Mode | Work | Verdict |
|---|---|---|
| `review` | Scope and rules: **Review or audit** in `AGENTS.md`. Read callers and tests; large change or audit: one `scout` per area, then `reviewer`; verify every finding yourself. `security`: only that area. | `ready` / `fix first` |
| `bug` | Rules: **Bug** in `AGENTS.md` (memory first, containment, red check, 3-5 ranked hypotheses, one at a time). Wrong data: counts per stage, key uniqueness, NULL keys, casts, join fan-out. Tag debug output `[DEBUG-xxxx]`; remove it by searching the tag. | `cause proven` / `unproven` / `fixed` |
| `analyze` | Read code, tests and config; wide scope: one `scout` per area. Facts only as far as evidence goes; unverified: **U** and what would confirm it. | none |

Every finding has a concrete case ("this input gives this wrong result") and `path:line`, a command output or a count. No style taste, no "consider".

## Output
**Chat first:** verdict or answer in line 1, at most 3 bullets, then the report path. A small Mermaid diagram when the flow is the answer.

**Report** when asked, for an audit, a proven bug, or anything longer than one screen: `<project>/docs/ai/reports/YYYY-MM-DD-<mode>-<topic>.html`, built per `_ai/rules/report.md` (copy `_ai/templates/report.md`, run `node _ai/report.mjs`). About 2 screens; keep only the sections that carry the answer; each has a picture.

| Mode | Sections, in order | Picture |
|---|---|---|
| `review` | Finding cards (High first; more than ~6: rest in the table), What the change does (1 line), Next steps; Not checked in Evidence | `tree` of changed files, `!` on risky ones |
| `bug` | Symptom `Expected \| Observed \| Where \| Since \| Affected`, Root cause (2-4 lines + evidence), Fix `File \| Change` + regression test + data repair draft (rows, rollback), Next steps. Incident: Timeline `Time (UTC) \| Event`, Why it was not caught | `flow` with the failing stage `!`, or `bars` of counts per stage |
| `analyze` | How it works, Components `Part \| Role \| Where`, Questions (`### Q ·` cards with a proposal), Risks (1 line each), Next steps | `graph`, `flow` or `seq`; `compare` for today vs after |

PR description on request: title under 70 characters, then **Summary**, **Tested**, **Not tested**, **Risk**.

Expected input after the slash command: [review | bug | analyze] <files, folder, symptom or question>

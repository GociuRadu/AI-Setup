---
name: review
description: "Use to look at what exists, in one of 4 modes: review (review this, code review, PR, audit a folder, security check, find bloat), bug (wrong number or result, exception, failing test or load, duplicates, NULL keys), analyze (explain, analyze or document a file, flow, folder or technical question) or debt (list the shortcuts). Answers in chat first; writes a short HTML report when asked."
argument-hint: "[review | bug | analyze | debt] <files, folder, symptom or question>"
---
# Review

Look at what exists, prove it, show it so it scans in seconds. Change nothing unless asked (a fix request in the same message counts).

## Pick the mode
Named in the request, else from the words; unclear: `review`.

| Mode | Work | Verdict |
|---|---|---|
| `review` | Scope: the named files, else `git diff HEAD` (on a branch also `<main>...HEAD`). Read callers and tests. Large change or audit: one `scout` per area, then `reviewer`; verify every finding yourself before reporting it. `security`: only that area. | `ready` / `fix first` |
| `bug` | `memory.md` and known issues first; bad data still flowing on PRODUCTION: propose containment before anything else. Reproduce with one side-effect-free command (red), then test 3-5 ranked hypotheses one at a time; cannot reproduce: **unproven**, say what would prove it. Wrong data: counts per stage, key uniqueness, NULL keys, casts, join fan-out. Tag debug output `[DEBUG-xxxx]`; remove it by searching the tag. Fix per **Bug** in `AGENTS.md`; dropping bad rows or a catch-all is a workaround, call it that. | `cause proven` / `unproven` / `fixed` |
| `analyze` | Read code, tests and config; wide scope: one `scout` per area. Facts only as far as evidence goes; unverified: **U** and what would confirm it. | none |
| `debt` | List every `shortcut:` comment (a deliberate shortcut that names its limit) with the command below. One table row per marker: path:line, limit, upgrade trigger; no trigger named: `no-trigger`. Chat only. | `<N> markers, <M> with no trigger` |

`debt` command, run in the project repo: `git grep --no-index --exclude-standard -nE "(#|//|--|/[*]) ?shortcut:"`

Every finding has a concrete case ("this input gives this wrong result") and `path:line`, a command output or a count, in plain words a reader new to the code follows. No style taste, no "consider".

## Output
**Chat first:** verdict or answer in line 1, then the top findings numbered across levels (so the user can say "fix 2 and 5"), at most 3 unless asked for all, then the report path.

**Report** when asked, for an audit, a proven bug, or anything longer than one screen: `<project>/docs/ai/reports/YYYY-MM-DD-<mode>-<topic>.html`, built per `_ai/rules/report.md`. Keep only the sections that carry the answer.

| Mode | Sections, in order | Picture |
|---|---|---|
| `review` | Finding cards (High first), What the change does (1 line), Next steps; Not checked in Evidence | `tree` of changed files, `!` on risky ones |
| `bug` | Symptom `Expected \| Observed \| Where \| Since \| Affected`, Root cause (2-4 lines + evidence), Fix `File \| Change` + regression test + data repair draft (rows, rollback), Next steps. Incident: Timeline `Time (UTC) \| Event`, Why it was not caught | `flow` with the failing stage `!`, or `bars` of counts per stage |
| `analyze` | How it works, Components `Part \| Role \| Where`, Questions (`### Q ·` cards with a proposal), Risks (1 line each), Next steps | `graph`, `flow` or `seq`; `compare` for today vs after |

PR description on request: title under 70 characters, then **Summary**, **Tested**, **Not tested**, **Risk**.

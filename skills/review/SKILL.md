---
name: review
description: "Looks at existing code in 4 modes: review (code review, PR, audit, security, bloat), bug (wrong result, duplicates, exception, failing test or load, bug report), analyze (explain or document code, a flow or folder), debt (list shortcuts). Chat first; HTML report when asked."
argument-hint: "[review | bug | analyze | debt] <files, folder, symptom or question>"
---
# Review

Look at what exists, prove it, show it so it scans in seconds. Change nothing unless asked (a fix request in the same message counts).

## Pick the mode
Named in the request, else from the words; unclear: `review`.

| Mode | Work | Verdict |
|---|---|---|
| `review` | Scope: the named files, else `git diff HEAD` (on a branch also `<main>...HEAD`). Read changed files, direct callers and tests; run no suites unless asked (`tester` when you do). Large change (10+ code files) or folder audit: one `researcher` per area, then `reviewer`; verify every finding yourself. `security`: only that area. | `ready` / `fix first` |
| `bug` | The steps below. | `cause proven` / `unproven` / `fixed` |
| `analyze` | Read code, tests and config; wide scope: one `researcher` per area. Facts only as far as evidence goes; unverified: **U** and what would confirm it. | none |
| `debt` | List every `shortcut:` comment (a deliberate shortcut that names its limit) with the command below. One table row per marker: path:line, limit, upgrade trigger; no trigger named: `no-trigger`. Chat only. | `<N> markers, <M> with no trigger` |

`debt` command, run in the project repo: `git grep --no-index --exclude-standard -nE "(#|//|--|/[*]) ?shortcut:"`

## Bug
1. **Contain:** bad data still flowing on PRODUCTION: first propose containment (pause the trigger or job) for the user to run.
2. **Known first:** `memory.md` and known issues.
3. **Reproduce:** one side-effect-free command that shows the exact symptom (red). Cannot reproduce: the cause is **unproven**; say what would prove it.
4. **Hypotheses:** test 3-5, ranked, one at a time. Wrong data: counts per stage, key uniqueness, NULL keys, casts, join fan-out. Tag debug output `[DEBUG-xxxx]` and remove it by searching the tag.
5. **Fix (when asked):** a test for the reported case, run red first; then the root cause fixed once in the shared code, after a grep of its callers; both green. Dropping bad rows or a catch-all is a workaround: call it that.
6. A cause that was not obvious gets a row in the project's `memory.md`.

Every finding has a concrete case ("this input gives this wrong result") and `path:line`, a command output or a count, in plain words a reader new to the code follows. No style taste, no "consider".

## Output
**Chat first:** verdict or answer in line 1, then the top findings numbered across levels (so the user can say "fix 2 and 5"), at most 3 unless asked for all, then the report path.

**Report** only when explicitly asked, for a folder audit, or a proven bug: built per [report.md](report.md). Branch, PR and status reviews stay in chat unless asked for a report. `<skill dir>` is the folder holding this file (`.claude/skills/review`, `.github/skills/review` or `.kiro/skills/review`).

| Mode | Sections, in order | Picture |
|---|---|---|
| `review` | Finding cards (High first), What the change does (1 line), Next steps; Not checked in Evidence | `tree` of changed files, `!` on risky ones |
| `bug` | Symptom `Expected \| Observed \| Where \| Since \| Affected`, Root cause (2-4 lines + evidence), Fix `File \| Change` + regression test + data repair draft (rows, rollback), Next steps. Incident: Timeline `Time (UTC) \| Event`, Why it was not caught | `flow` with the failing stage `!`, or `bars` of counts per stage |
| `analyze` | How it works, Components `Part \| Role \| Where`, Questions (`### Q ·` cards with a proposal), Risks (1 line each), Next steps | `graph`, `flow` or `seq`; `compare` for today vs after |
| `analyze` of numbers (runs, metrics, loads, counts) | Result (per-item table), What it means (the limit or risk the numbers imply), Next steps; ids, sources and the calculation in Evidence | `bars` of the values; `compare` for the two readings |

**Style:** [report.md](report.md) owns the layout and the build enforces its limits. One point it does not cover:
- **The "so what":** add at least 1 finding the data implies but does not show (noise wider than the decision margin, a threshold missed, the stage that loses rows). Never only restate the numbers.

PR description on request: title under 70 characters, then **Summary**, **Tested**, **Not tested**, **Risk**.

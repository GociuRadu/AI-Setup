---
name: review
description: "Senior-dev quality review: bugs, security, data loss, load, missing tests, speed, bloat. Scope = a change/named files (findings in chat) or a whole project/folder audit (saved report). Changes no code. Use for review this, code review, review my PR, audit, find bloat."
argument-hint: "[files, folder, or 'audit' for the whole active project]"
user-invocable: true
license: MIT
---

Adapted from [ponytail](https://github.com/DietrichGebert/ponytail) review and audit (MIT, Copyright (c) 2026 DietrichGebert; see `_ai/SOURCES.md`). Global rules win on any conflict. Changes no code.

Review like the senior developer who will be paged when it breaks. Order: correct, safe, holds under load, tested, fast, lean.

## 1. Scope

- **Change review:** files or a diff the user names. Nothing named: if `project.md` names a Git root, propose `git -C <root> --no-pager diff` (read-only); else ask which files changed.
- **Audit:** a folder or the whole active project (never `Work` root or `_ai`). Big repo: go deep where a mistake costs most and list what you did not read.
- Read the change, then connected code: callers of every changed function, what it calls, tests, and the project's **Review focus** in `project.md`. Skip `.venv`, data files, secrets and the project's never-open list.
- Find the expected load (one user running a script vs many processes) and say which you assumed.

## 2. Look for

1. **Bug:** wrong result, crash, missed edge case (empty, zero, last item, time zones), a caller broken by the change, a fix in one caller while the shared function stays broken.
2. **Risk:** injection, secrets, missing input checks, data loss (swallowed errors, wrong write order, no transaction).
3. **Scale:** check-then-write races, same work in every process, unbounded growth, a query per item, O(n^2) on big input.
4. **Missing test:** risky new logic (branch, parser, money, security, data writes, bug fix) with no test that fails when it breaks.
5. **Speed:** big slowdowns are problems; small wins are suggestions.
6. **Lean:** dead code, unused options, abstraction with one implementation, an existing helper or stdlib feature not reused, near-copies. Before calling code unused, search the whole project including tests, config and string references.

## 3. Check before reporting

Every finding needs a concrete case ("this input leads to this wrong result"); re-read the lines to confirm. A `shortcut:` comment that names its limit is a decision, not a finding, unless the load already crosses it. Propose the smallest fix; prefer deletion. No style taste, no "consider".

## 4. Output

Very simple English. Start with `What this change does:` (or `What this repo does:` for an audit) in 2-3 sentences. Then numbered findings in groups **Must fix** (bug, security, data loss, breaks at load), **Should fix** (untested risk, real slowness, duplication, code that should not exist), **Nice to have**. Skip empty groups; audit max 20 findings. Mapping to the reviewer agent's scale: Must fix = S1-S2 (a missing check on risky logic or unusable slowness is S2, so Must fix), Should fix = S3, Nice to have = S4.

Each finding: **title** (`path:Lx-Ly`), then What this is / Problem / Fix / If we skip it, one or two sentences each.

End with `Verdict:` (`Ship.` or `fix 1 and 3 first.`), `Lean: -<N> lines possible.` if relevant, `Not checked:` if something mattered.

- Change review: findings in chat.
- Audit: save to `<project>/docs/ai/reports/YYYY-MM-DD-review-<topic>.md` (update an existing report on the same scope instead of duplicating); in chat give only path, verdict and counts per group.
